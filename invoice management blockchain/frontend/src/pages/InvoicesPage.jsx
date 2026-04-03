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
      if (res.data.email_sent) {
        alert('Email reminder sent successfully!')
        setCopiedInvoiceId(invoiceId)
        setTimeout(() => setCopiedInvoiceId(''), 1500)
      } else {
        await navigator.clipboard.writeText(res.data.message)
        setCopiedInvoiceId(invoiceId)
        setTimeout(() => setCopiedInvoiceId(''), 1500)
        alert('Client has no email. Reminder text copied to clipboard.')
      }
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Invoices</h2>
          <p className="mt-1 text-sm text-gray-500">Manage collections and invoice-level actions.</p>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-md border border-red-200 bg-red-50 p-4 shadow-sm text-sm text-red-700">
          {error}
        </div>
      )}

      <section className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        {rows.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <p className="text-sm font-medium text-gray-400">No invoices available. Create an invoice to start tracking receivables.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead>
                <tr className="bg-gray-50/50 text-left text-gray-500">
                  <th className="py-3 pl-6 pr-4 font-semibold">Invoice</th>
                  <th className="py-3 px-4 font-semibold">Client</th>
                  <th className="py-3 px-4 font-semibold">Due Date</th>
                  <th className="py-3 px-4 text-right font-semibold">Total</th>
                  <th className="py-3 px-4 text-right font-semibold">Received</th>
                  <th className="py-3 px-4 text-right font-semibold">Pending</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  <th className="py-3 px-6 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {rows.map((invoice) => (
                  <tr key={invoice.id} className="transition-colors hover:bg-gray-50/50">
                    <td className="py-4 pl-6 pr-4 font-medium text-gray-900">{invoice.invoice_number}</td>
                    <td className="py-4 px-4 text-gray-600">{invoice.client_name}</td>
                    <td className="py-4 px-4 text-gray-500">{formatDate(invoice.due_date)}</td>
                    <td className="py-4 px-4 text-right text-gray-900">{formatCurrency(invoice.total_amount)}</td>
                    <td className="py-4 px-4 text-right text-gray-500">{formatCurrency(invoice.paid_amount)}</td>
                    <td className="py-4 px-4 text-right font-medium text-gray-900">{formatCurrency(invoice.outstanding_amount)}</td>
                    <td className="py-4 px-4"><StatusBadge status={invoice.status} /></td>
                    <td className="py-4 px-6">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => setSelectedInvoice(invoice)}
                          className="rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                        >
                          Add Payment
                        </button>
                        <button
                          onClick={() => sendReminder(invoice.id)}
                          className="rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                        >
                          {copiedInvoiceId === invoice.id ? 'Sent/Copied' : 'Send Reminder'}
                        </button>
                        <button
                          onClick={() => verifyInvoice(invoice.id)}
                          className="rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                        >
                          Verify
                        </button>
                        <button
                          onClick={() => openDetail(invoice.id)}
                          className="rounded-md bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
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
