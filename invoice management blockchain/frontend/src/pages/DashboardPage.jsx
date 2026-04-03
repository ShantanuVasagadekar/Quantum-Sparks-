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
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 shadow-sm text-sm text-red-700">
          {error}
        </div>
      )}

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Invoiced" value={formatCurrency(totalInvoiced)} />
        <StatCard label="Amount Received" value={formatCurrency(amountReceived)} />
        <StatCard label="Amount Pending" value={formatCurrency(amountPending)} />
        <StatCard label="Overdue Amount" value={formatCurrency(overdueAmount)} />
      </section>

      <section className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-gray-200 bg-gray-50/50 px-6 py-5">
          <h3 className="text-base font-semibold text-gray-900">Priority Action Required</h3>
          <p className="mt-1 text-sm text-gray-500">Invoices with approaching due dates or high pending balances.</p>
        </div>
        
        {outstandingInvoices.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <p className="text-sm font-medium text-gray-400">All caught up. No outstanding invoices at this time.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {outstandingInvoices.map((invoice) => (
              <div key={invoice.id} className="p-6 transition-colors hover:bg-gray-50/50">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex flex-col gap-1">
                    <p className="text-lg font-bold text-gray-900">{formatCurrency(invoice.outstanding_amount)}</p>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="font-medium text-gray-700">{invoice.client_name}</span>
                      <span className="text-gray-400">&bull;</span>
                      <span className="text-gray-500">Due {formatDate(invoice.due_date)}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={invoice.status} />
                    <div className="h-4 w-px bg-gray-200 mx-2 hidden lg:block"></div>
                    <button
                      onClick={() => openDetail(invoice.id)}
                      className="rounded-md bg-white px-3.5 py-2 text-sm font-semibold text-gray-700 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                    >
                      View
                    </button>
                    <button
                      onClick={() => setSelectedInvoice(invoice)}
                      className="rounded-md bg-white px-3.5 py-2 text-sm font-semibold text-gray-700 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                    >
                      Record Payment
                    </button>
                    <button
                      onClick={() => sendReminder(invoice.id)}
                      className="rounded-md bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
                    >
                      {copiedInvoiceId === invoice.id ? 'Copied Link' : 'Send Reminder'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-gray-200 bg-gray-50/50 px-6 py-5">
          <h3 className="text-base font-semibold text-gray-900">Recent Invoices</h3>
          <p className="mt-1 text-sm text-gray-500">Historical view of the latest generated invoices.</p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead>
              <tr className="bg-white text-left text-gray-500">
                <th className="py-3 pl-6 pr-4 font-semibold">Invoice</th>
                <th className="py-3 px-4 font-semibold">Client</th>
                <th className="py-3 px-4 font-semibold">Due Date</th>
                <th className="py-3 px-4 text-right font-semibold">Total Amount</th>
                <th className="py-3 px-4 text-right font-semibold">Pending</th>
                <th className="py-3 px-6 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {invoices.slice(0, 12).map((invoice) => (
                <tr key={invoice.id} className="transition-colors hover:bg-gray-50/50">
                  <td className="py-4 pl-6 pr-4 font-medium text-gray-900">{invoice.invoice_number}</td>
                  <td className="py-4 px-4 text-gray-600">{invoice.client_name}</td>
                  <td className="py-4 px-4 text-gray-500">{formatDate(invoice.due_date)}</td>
                  <td className="py-4 px-4 text-right text-gray-900">{formatCurrency(invoice.total_amount)}</td>
                  <td className="py-4 px-4 text-right font-medium text-gray-900">{formatCurrency(invoice.outstanding_amount)}</td>
                  <td className="py-4 px-6"><StatusBadge status={invoice.status} /></td>
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
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900">{value}</p>
    </div>
  )
}

export default DashboardPage
