import { useEffect, useMemo, useState } from 'react'
import api from '../api/client'
import InvoiceDetailModal from '../components/InvoiceDetailModal'
import PaymentModal from '../components/PaymentModal'
import StatusBadge from '../components/StatusBadge'
import { formatCurrency, formatDate } from '../utils/format'

function DashboardPage({ refreshToken }) {
  const [summary, setSummary] = useState(null)
  const [invoices, setInvoices] = useState([])
  const [detailInvoice, setDetailInvoice] = useState(null)
  const [detailTimeline, setDetailTimeline] = useState([])
  const [detailPayments, setDetailPayments] = useState([])
  const [selectedInvoice, setSelectedInvoice] = useState(null)
  const [anchoring, setAnchoring] = useState(false)
  const [copiedInvoiceId, setCopiedInvoiceId] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true

    async function fetchData() {
      const [summaryRes, invoicesRes] = await Promise.all([
        api.get('/dashboard/summary'),
        api.get('/invoices')
      ])

      if (!mounted) return
      setSummary(summaryRes.data)
      setInvoices(invoicesRes.data)
      setError('')
    }

    fetchData().catch((err) => {
      if (mounted) {
        setSummary({ total_invoiced: 0, total_collected: 0, total_outstanding: 0, total_overdue: 0 })
        setInvoices([])
        setError(err.response?.data?.error || 'Unable to load dashboard data.')
      }
    })

    return () => {
      mounted = false
    }
  }, [refreshToken])

  async function openDetail(invoiceId) {
    try {
      const [invoiceRes, timelineRes, paymentsRes] = await Promise.all([
        api.get(`/invoices/${invoiceId}`),
        api.get(`/invoices/${invoiceId}/timeline`),
        api.get(`/invoices/${invoiceId}/payments`)
      ])
      setDetailInvoice(invoiceRes.data)
      setDetailTimeline(timelineRes.data.timeline)
      setDetailPayments(paymentsRes.data)
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to load invoice details.')
    }
  }

  async function sendReminder(invoiceId) {
    try {
      const reminder = await api.post(`/invoices/${invoiceId}/reminder`)
      await navigator.clipboard.writeText(reminder.data.message)
      setCopiedInvoiceId(invoiceId)
      setTimeout(() => setCopiedInvoiceId(''), 1500)
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to generate reminder message.')
    }
  }

  async function verifyInvoice(invoiceId) {
    try {
      setAnchoring(true)
      await api.post(`/invoices/${invoiceId}/anchor`)
      const [summaryRes, invoicesRes] = await Promise.all([
        api.get('/dashboard/summary'),
        api.get('/invoices')
      ])
      setSummary(summaryRes.data)
      setInvoices(invoicesRes.data)

      if (detailInvoice?.id === invoiceId) {
        await openDetail(invoiceId)
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to verify invoice.')
    } finally {
      setAnchoring(false)
    }
  }

  const outstandingInvoices = useMemo(
    () => invoices.filter((invoice) => Number(invoice.outstanding_amount) > 0 && invoice.status !== 'cancelled').slice(0, 8),
    [invoices]
  )

  if (!summary) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((item) => (
          <div key={item} className="h-28 animate-pulse rounded-xl border border-slate-700 bg-slate-800" />
        ))}
      </div>
    )
  }

  const totalInvoiced = Number(summary.total_invoiced || 0)
  const amountReceived = Number(summary.total_collected || 0)
  const amountPending = Number(summary.total_outstanding || 0)
  const overdueAmount = Number(summary.total_overdue || 0)

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-md border border-red-900 bg-red-950/50 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Invoiced" value={formatCurrency(totalInvoiced)} />
        <StatCard label="Amount Received" value={formatCurrency(amountReceived)} />
        <StatCard label="Amount Pending" value={formatCurrency(amountPending)} />
        <StatCard label="Overdue Amount" value={formatCurrency(overdueAmount)} />
      </section>

      <section className="rounded-xl border border-slate-700 bg-slate-800 p-4">
        <p className="text-sm text-slate-300">
          Priority focus: invoices with due dates approaching and high pending balances should be followed up first.
        </p>
      </section>

      <section className="rounded-xl border border-slate-700 bg-slate-900 p-5">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-white">Outstanding Invoices</h2>
          <p className="mt-1 text-sm text-slate-400">Immediate action view for unpaid invoices.</p>
        </div>

        {outstandingInvoices.length === 0 ? (
          <div className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-6 text-center">
            <p className="text-sm text-slate-300">No outstanding invoices at this time.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {outstandingInvoices.map((invoice) => (
              <div key={invoice.id} className="rounded-lg border border-slate-700 bg-slate-800 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="space-y-1">
                    <p className="text-base font-semibold text-white">{invoice.client_name}</p>
                    <p className="text-2xl font-semibold text-white">{formatCurrency(invoice.outstanding_amount)}</p>
                    <p className="text-sm text-slate-400">Due {formatDate(invoice.due_date)}</p>
                    <StatusBadge status={invoice.status} />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setSelectedInvoice(invoice)}
                      className="rounded-md border border-slate-600 px-3 py-2 text-sm text-slate-200 hover:bg-slate-700"
                    >
                      Add Payment
                    </button>
                    <button
                      onClick={() => sendReminder(invoice.id)}
                      className="rounded-md border border-slate-600 px-3 py-2 text-sm text-slate-200 hover:bg-slate-700"
                    >
                      {copiedInvoiceId === invoice.id ? 'Copied' : 'Send Reminder'}
                    </button>
                    <button
                      onClick={() => openDetail(invoice.id)}
                      className="rounded-md bg-slate-100 px-3 py-2 text-sm font-medium text-slate-900 hover:bg-white"
                    >
                      View Invoice
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-slate-700 bg-slate-900 p-5">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-white">Invoice List</h2>
          <p className="mt-1 text-sm text-slate-400">Secondary tabular view of recent invoices.</p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-left text-slate-400">
                <th className="pb-2 pr-4">Invoice</th>
                <th className="pb-2 pr-4">Client</th>
                <th className="pb-2 pr-4">Due Date</th>
                <th className="pb-2 pr-4 text-right">Total</th>
                <th className="pb-2 pr-4 text-right">Amount Pending</th>
                <th className="pb-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {invoices.slice(0, 12).map((invoice) => (
                <tr key={invoice.id} className="border-b border-slate-800 hover:bg-slate-800/70">
                  <td className="py-3 pr-4 text-slate-100">{invoice.invoice_number}</td>
                  <td className="py-3 pr-4 text-slate-300">{invoice.client_name}</td>
                  <td className="py-3 pr-4 text-slate-300">{formatDate(invoice.due_date)}</td>
                  <td className="py-3 pr-4 text-right text-slate-100">{formatCurrency(invoice.total_amount)}</td>
                  <td className="py-3 pr-4 text-right font-medium text-slate-100">{formatCurrency(invoice.outstanding_amount)}</td>
                  <td className="py-3"><StatusBadge status={invoice.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {selectedInvoice && (
        <PaymentModal
          invoice={selectedInvoice}
          onClose={() => setSelectedInvoice(null)}
          onSaved={async () => {
            const [summaryRes, invoicesRes] = await Promise.all([
              api.get('/dashboard/summary'),
              api.get('/invoices')
            ])
            setSummary(summaryRes.data)
            setInvoices(invoicesRes.data)
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
          onClose={() => {
            setDetailInvoice(null)
            setDetailTimeline([])
            setDetailPayments([])
          }}
        />
      )}
    </div>
  )
}

function StatCard({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800 p-5">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-white">{value}</p>
    </div>
  )
}

export default DashboardPage
