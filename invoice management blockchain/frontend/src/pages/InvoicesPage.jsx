import { useEffect, useMemo, useState } from 'react'
import api from '../api/client'
import InvoiceDetailModal from '../components/InvoiceDetailModal'
import PaymentModal from '../components/PaymentModal'
import StatusBadge from '../components/StatusBadge'
import { formatCurrency, formatDate } from '../utils/format'

function InvoicesPage({ refreshToken }) {
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedInvoice, setSelectedInvoice] = useState(null)
  const [detailInvoice, setDetailInvoice] = useState(null)
  const [detailTimeline, setDetailTimeline] = useState([])
  const [detailPayments, setDetailPayments] = useState([])
  const [anchoring, setAnchoring] = useState(false)
  const [copiedInvoiceId, setCopiedInvoiceId] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    fetchInvoices().catch(() => {})
  }, [refreshToken])

  async function fetchInvoices() {
    setLoading(true)
    try {
      const res = await api.get('/invoices')
      setInvoices(res.data)
      setError('')
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to load invoices.')
    } finally {
      setLoading(false)
    }
  }

  async function sendReminder(invoiceId) {
    try {
      const res = await api.post(`/invoices/${invoiceId}/reminder`)
      await navigator.clipboard.writeText(res.data.message)
      setCopiedInvoiceId(invoiceId)
      setTimeout(() => setCopiedInvoiceId(''), 1500)
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to send reminder message.')
    }
  }

  async function verifyInvoice(invoiceId) {
    try {
      setAnchoring(true)
      await api.post(`/invoices/${invoiceId}/anchor`)
      await fetchInvoices()

      if (detailInvoice?.id === invoiceId) {
        await openDetail(invoiceId)
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to verify invoice.')
    } finally {
      setAnchoring(false)
    }
  }

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

  const rows = useMemo(() => invoices, [invoices])

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-700 bg-slate-900 p-4">
        <div className="space-y-2">
          {[1, 2, 3, 4].map((item) => (
            <div key={item} className="h-12 animate-pulse rounded-md bg-slate-800" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <>
      <section className="rounded-xl border border-slate-700 bg-slate-900 p-5">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-white">Invoice List</h2>
          <p className="mt-1 text-sm text-slate-400">Manage collections and invoice-level actions.</p>
        </div>

        {error && (
          <div className="mb-3 rounded-md border border-red-900 bg-red-950/50 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        )}

        {rows.length === 0 ? (
          <div className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-8 text-center text-sm text-slate-300">
            No invoices available. Create an invoice to start tracking receivables.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 text-left text-slate-400">
                  <th className="pb-2 pr-4">Invoice</th>
                  <th className="pb-2 pr-4">Client</th>
                  <th className="pb-2 pr-4">Due Date</th>
                  <th className="pb-2 pr-4 text-right">Total</th>
                  <th className="pb-2 pr-4 text-right">Amount Received</th>
                  <th className="pb-2 pr-4 text-right">Amount Pending</th>
                  <th className="pb-2 pr-4">Status</th>
                  <th className="pb-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((invoice) => (
                  <tr key={invoice.id} className="border-b border-slate-800 hover:bg-slate-800/70">
                    <td className="py-3 pr-4 text-slate-100">{invoice.invoice_number}</td>
                    <td className="py-3 pr-4 text-slate-300">{invoice.client_name}</td>
                    <td className="py-3 pr-4 text-slate-300">{formatDate(invoice.due_date)}</td>
                    <td className="py-3 pr-4 text-right text-slate-100">{formatCurrency(invoice.total_amount)}</td>
                    <td className="py-3 pr-4 text-right text-slate-100">{formatCurrency(invoice.paid_amount)}</td>
                    <td className="py-3 pr-4 text-right font-medium text-slate-100">{formatCurrency(invoice.outstanding_amount)}</td>
                    <td className="py-3 pr-4"><StatusBadge status={invoice.status} /></td>
                    <td className="py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => setSelectedInvoice(invoice)}
                          className="rounded-md border border-slate-600 px-2.5 py-1.5 text-xs text-slate-200 hover:bg-slate-700"
                        >
                          Add Payment
                        </button>
                        <button
                          onClick={() => sendReminder(invoice.id)}
                          className="rounded-md border border-slate-600 px-2.5 py-1.5 text-xs text-slate-200 hover:bg-slate-700"
                        >
                          {copiedInvoiceId === invoice.id ? 'Copied' : 'Send Reminder'}
                        </button>
                        <button
                          onClick={() => verifyInvoice(invoice.id)}
                          className="rounded-md border border-slate-600 px-2.5 py-1.5 text-xs text-slate-200 hover:bg-slate-700"
                        >
                          Verify Invoice
                        </button>
                        <button
                          onClick={() => openDetail(invoice.id)}
                          className="rounded-md bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-slate-900 hover:bg-white"
                        >
                          View
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selectedInvoice && (
        <PaymentModal
          invoice={selectedInvoice}
          onClose={() => setSelectedInvoice(null)}
          onSaved={fetchInvoices}
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
    </>
  )
}

export default InvoicesPage
