import { useEffect, useMemo, useState } from 'react'
import api from '../api/client'
import InvoiceDetailModal from '../components/InvoiceDetailModal'
import PaymentModal from '../components/PaymentModal'
import StatusBadge from '../components/StatusBadge'
import { formatCurrency, formatDate } from '../utils/format'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts'

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, padding: '10px 14px' }}>
      <p style={{ fontSize: 11, color: '#6B7280', marginBottom: 4 }}>{label}</p>
      <p style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{formatCurrency(payload[0].value)}</p>
    </div>
  )
}

export default function DashboardPage({ refreshToken }) {
  const [summary, setSummary]                   = useState(null)
  const [invoices, setInvoices]                 = useState([])
  const [collectionsTrend, setCollectionsTrend] = useState([])
  const [detailInvoice, setDetailInvoice]       = useState(null)
  const [detailTimeline, setDetailTimeline]     = useState([])
  const [detailPayments, setDetailPayments]     = useState([])
  const [selectedInvoice, setSelectedInvoice]   = useState(null)
  const [anchoring, setAnchoring]               = useState(false)
  const [error, setError]                       = useState('')

  useEffect(() => {
    let mounted = true
    async function fetchData() {
      const [summaryRes, invoicesRes, trendRes] = await Promise.all([
        api.get('/dashboard/summary'),
        api.get('/invoices'),
        api.get('/dashboard/collections-trend'),
      ])
      if (!mounted) return
      setSummary(summaryRes.data)
      setInvoices(invoicesRes.data)
      setCollectionsTrend(trendRes.data)
      setError('')
    }
    fetchData().catch((err) => {
      if (mounted) {
        setSummary({ total_invoiced: 0, total_collected: 0, total_outstanding: 0, overdue_count: 0 })
        setError(err.response?.data?.error || 'Unable to load dashboard data.')
      }
    })
    return () => { mounted = false }
  }, [refreshToken])

  async function openDetail(invoiceId) {
    try {
      const [invoiceRes, timelineRes, paymentsRes] = await Promise.all([
        api.get(`/invoices/${invoiceId}`),
        api.get(`/invoices/${invoiceId}/timeline`),
        api.get(`/invoices/${invoiceId}/payments`),
      ])
      setDetailInvoice(invoiceRes.data)
      setDetailTimeline(timelineRes.data.timeline)
      setDetailPayments(paymentsRes.data)
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to load invoice details.')
    }
  }

  async function verifyInvoice(invoiceId) {
    try {
      setAnchoring(true)
      await api.post(`/invoices/${invoiceId}/anchor`)
      const [summaryRes, invoicesRes, trendRes] = await Promise.all([
        api.get('/dashboard/summary'),
        api.get('/invoices'),
        api.get('/dashboard/collections-trend'),
      ])
      setSummary(summaryRes.data)
      setInvoices(invoicesRes.data)
      setCollectionsTrend(trendRes.data)
      if (detailInvoice?.id === invoiceId) await openDetail(invoiceId)
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to verify invoice.')
    } finally {
      setAnchoring(false)
    }
  }

  const recentInvoices = useMemo(() => invoices.slice(0, 6), [invoices])
  const pendingActions = useMemo(
    () => invoices.filter(i => i.status === 'overdue' || i.status === 'sent' || i.status === 'accepted').slice(0, 5),
    [invoices]
  )

  if (!summary) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[1,2,3,4].map(i => <div key={i} className="h-24 animate-pulse rounded-lg bg-gray-100 border border-[#E5E7EB]" />)}
        </div>
      </div>
    )
  }

  const totalInvoiced   = Number(summary.total_invoiced   || 0)
  const amountReceived  = Number(summary.total_collected  || 0)
  const amountPending   = Number(summary.total_outstanding || 0)
  const overdueCount    = Number(summary.overdue_count    || 0)

  return (
    <div className="space-y-6">

      {/* Page header */}
      <div>
        <h1 className="text-2xl font-semibold text-[#111827]">Dashboard</h1>
        <p className="mt-1 text-sm text-[#6B7280]">Your business at a glance.</p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Gross Billings"     value={formatCurrency(totalInvoiced)}  />
        <KpiCard label="Cash Received"      value={formatCurrency(amountReceived)} color="success" />
        <KpiCard label="Unpaid Receivables" value={formatCurrency(amountPending)}  color="warning" />
        <KpiCard label="Past Due"           value={overdueCount}                   color={overdueCount > 0 ? 'danger' : 'neutral'} suffix="invoices" />
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

        {/* Left — chart + recent invoices */}
        <div className="lg:col-span-2 space-y-6">

          {/* Revenue trend */}
          <Card title="Revenue Trend">
            {collectionsTrend.length === 0 ? (
              <div className="flex h-48 items-center justify-center text-sm text-[#6B7280]">No revenue data yet.</div>
            ) : (
              <div className="h-48 mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={collectionsTrend} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                    <defs>
                      <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%"   stopColor="#2563EB" stopOpacity={0.12} />
                        <stop offset="100%" stopColor="#2563EB" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9CA3AF' }} dy={8} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#9CA3AF' }}
                      tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                    <RechartsTooltip content={<ChartTooltip />} cursor={{ stroke: '#E5E7EB' }} />
                    <Area type="monotone" dataKey="collected" stroke="#2563EB" strokeWidth={1.5}
                      fillOpacity={1} fill="url(#rev)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>

          {/* Recent invoices */}
          <Card title="Recent Invoices">
            {recentInvoices.length === 0 ? (
              <p className="py-8 text-center text-sm text-[#6B7280]">No invoices yet.</p>
            ) : (
              <div className="divide-y divide-[#E5E7EB]">
                {recentInvoices.map(inv => (
                  <div key={inv.id} className="flex items-center justify-between py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#111827] truncate">{inv.client_name}</p>
                      <p className="text-xs text-[#6B7280] mt-0.5">{inv.invoice_number} · Due {formatDate(inv.due_date)}</p>
                    </div>
                    <div className="flex items-center gap-3 ml-4 shrink-0">
                      <span className="text-sm font-semibold text-[#111827]">{formatCurrency(inv.total_amount)}</span>
                      <StatusBadge status={inv.status} />
                      <button onClick={() => openDetail(inv.id)}
                        className="text-xs font-medium text-[#2563EB] hover:underline">
                        View
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Right — pending actions */}
        <div className="space-y-6">
          <Card title="Needs Attention">
            {pendingActions.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm text-[#6B7280]">All caught up 🎉</p>
              </div>
            ) : (
              <div className="divide-y divide-[#E5E7EB]">
                {pendingActions.map(inv => (
                  <div key={inv.id} className="py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[#111827] truncate">{inv.client_name}</p>
                        <p className="text-xs text-[#6B7280] mt-0.5">Due {formatDate(inv.due_date)}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold text-[#111827]">{formatCurrency(inv.outstanding_amount)}</p>
                        <StatusBadge status={inv.status} />
                      </div>
                    </div>
                    <div className="mt-2 flex gap-3">
                      {['accepted','partial'].includes(inv.status) && (
                        <button onClick={() => setSelectedInvoice(inv)}
                          className="text-xs font-medium text-[#2563EB] hover:underline">
                          Record Payment
                        </button>
                      )}
                      <button onClick={() => openDetail(inv.id)}
                        className="text-xs font-medium text-[#6B7280] hover:text-[#111827]">
                        View
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

      </div>

      {/* Modals */}
      {selectedInvoice && (
        <PaymentModal
          invoice={selectedInvoice}
          onClose={() => setSelectedInvoice(null)}
          onSaved={async () => {
            const [s, inv, t] = await Promise.all([
              api.get('/dashboard/summary'),
              api.get('/invoices'),
              api.get('/dashboard/collections-trend'),
            ])
            setSummary(s.data); setInvoices(inv.data); setCollectionsTrend(t.data)
          }}
        />
      )}

      {detailInvoice && (
        <InvoiceDetailModal
          invoice={detailInvoice}
          timeline={detailTimeline}
          payments={detailPayments}
          anchoring={anchoring}
          onAnchor={verifyInvoice}
          onRefresh={async () => {
            const [s, inv] = await Promise.all([api.get('/dashboard/summary'), api.get('/invoices')])
            setSummary(s.data); setInvoices(inv.data)
            await openDetail(detailInvoice.id)
          }}
          onPaid={async () => {
            const [s, inv] = await Promise.all([api.get('/dashboard/summary'), api.get('/invoices')])
            setSummary(s.data); setInvoices(inv.data)
            await openDetail(detailInvoice.id)
          }}
          onClose={() => { setDetailInvoice(null); setDetailTimeline([]); setDetailPayments([]) }}
        />
      )}

    </div>
  )
}

/* ── Sub-components ─────────────────────────────────────── */

const COLOR = {
  success: { label: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0' },
  warning: { label: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
  danger:  { label: '#DC2626', bg: '#FEF2F2', border: '#FECACA' },
  neutral: { label: '#6B7280', bg: '#F9FAFB', border: '#E5E7EB' },
}

function KpiCard({ label, value, color = 'neutral', suffix }) {
  const c = COLOR[color]
  return (
    <div
      className="rounded-lg border bg-white p-5"
      style={{ borderColor: c.border }}
    >
      <p className="text-xs font-medium text-[#6B7280] uppercase tracking-wider">{label}</p>
      <p className="mt-2 text-2xl font-semibold" style={{ color: c.label }}>
        {value}
        {suffix && <span className="ml-1 text-sm font-normal text-[#6B7280]">{suffix}</span>}
      </p>
    </div>
  )
}

function Card({ title, children }) {
  return (
    <div className="rounded-lg border border-[#E5E7EB] bg-white">
      <div className="border-b border-[#E5E7EB] px-5 py-4">
        <h2 className="text-sm font-semibold text-[#111827]">{title}</h2>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  )
}
