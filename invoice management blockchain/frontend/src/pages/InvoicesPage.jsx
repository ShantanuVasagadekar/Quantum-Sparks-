import { useEffect, useMemo, useState } from 'react'
import { useLocation, Link } from 'react-router-dom'
import api from '../api/client'
import InvoiceDetailModal from '../components/InvoiceDetailModal'
import PaymentModal from '../components/PaymentModal'
import StatusBadge from '../components/StatusBadge'
import { formatCurrency, formatDate } from '../utils/format'
import { useToast } from '../ui/ToastContext'

function InvoicesPage({ refreshToken }) {
  const location = useLocation()
  const { showToast } = useToast()
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedInvoice, setSelectedInvoice] = useState(null)
  const [detailInvoice, setDetailInvoice] = useState(null)
  const [detailTimeline, setDetailTimeline] = useState([])
  const [detailPayments, setDetailPayments] = useState([])
  const [anchoring, setAnchoring] = useState(false)
  const [acceptingId, setAcceptingId] = useState('')
  const [copiedInvoiceId, setCopiedInvoiceId] = useState('')
  const [error, setError] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortBy, setSortBy] = useState('due_date')
  const [sortDir, setSortDir] = useState('asc')
  const [page, setPage] = useState(1)
  const pageSize = 12

  useEffect(() => {
    fetchInvoices().catch(() => {})
  }, [refreshToken, location.search])

  async function fetchInvoices() {
    setLoading(true)
    try {
      const params = new URLSearchParams(location.search)
      const search = params.get('search') || ''
      const res = await api.get('/invoices', { params: { search } })
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
        showToast('Email reminder sent successfully!', 'success')
        setCopiedInvoiceId(invoiceId)
        setTimeout(() => setCopiedInvoiceId(''), 1500)
      } else {
        await navigator.clipboard.writeText(res.data.message)
        setCopiedInvoiceId(invoiceId)
        setTimeout(() => setCopiedInvoiceId(''), 1500)
        showToast('Client has no email. Reminder text copied to clipboard.', 'success')
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to send reminder message.')
    }
  }

  async function acceptInvoice(invoiceId) {
    try {
      setAcceptingId(invoiceId)
      await api.post(`/invoices/${invoiceId}/accept`)
      showToast('Invoice accepted. Anchoring to Algorand…', 'success')
      await fetchInvoices()
      if (detailInvoice?.id === invoiceId) await openDetail(invoiceId)
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to accept invoice.', 'error')
    } finally {
      setAcceptingId('')
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

  const filteredRows = useMemo(() => {
    if (statusFilter === 'all') return invoices
    return invoices.filter((i) => i.status === statusFilter)
  }, [invoices, statusFilter])

  const sortedRows = useMemo(() => {
    const arr = [...filteredRows]
    arr.sort((a, b) => {
      let av = a[sortBy]
      let bv = b[sortBy]
      if (sortBy.includes('amount')) {
        av = Number(av || 0)
        bv = Number(bv || 0)
      } else {
        av = av ? String(av) : ''
        bv = bv ? String(bv) : ''
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })
    return arr
  }, [filteredRows, sortBy, sortDir])

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize))
  const rows = useMemo(() => {
    const start = (page - 1) * pageSize
    return sortedRows.slice(start, start + pageSize)
  }, [sortedRows, page])

  useEffect(() => {
    setPage(1)
  }, [statusFilter, sortBy, sortDir, location.search])

  if (loading) {
    return (
      <div className="rounded-xl border border-[#E5E7EB] bg-white p-4">
        <div className="space-y-2">
          {[1, 2, 3, 4].map((item) => (
            <div key={item} className="h-12 animate-pulse rounded-md bg-gray-100" />
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
        <div className="flex items-center gap-2">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-md border border-[#E5E7EB] bg-white px-2 py-1.5 text-sm text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#2563EB]">
            <option value="all">All statuses</option>
            <option value="accepted">Accepted</option>
            <option value="paid">Paid</option>
            <option value="partial">Partial</option>
            <option value="overdue">Overdue</option>
            <option value="sent">Sent</option>
            <option value="draft">Draft</option>
            <option value="disputed">Disputed</option>
          </select>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}
            className="rounded-md border border-[#E5E7EB] bg-white px-2 py-1.5 text-sm text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#2563EB]">
            <option value="due_date">Sort: Due date</option>
            <option value="total_amount">Sort: Total amount</option>
            <option value="status">Sort: Status</option>
          </select>
          <button onClick={() => setSortDir((d) => d === 'asc' ? 'desc' : 'asc')}
            className="rounded-md border border-[#E5E7EB] bg-white px-2 py-1.5 text-sm text-[#111827] hover:bg-gray-50">
            {sortDir === 'asc' ? '↑ Asc' : '↓ Desc'}
          </button>
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
            <p className="text-sm font-medium text-gray-400">
              {(new URLSearchParams(location.search).get('search') || '').trim()
                ? 'No results found for your search.'
                : 'No invoices available. Create an invoice to start tracking receivables.'}
            </p>
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
                  <th className="py-3 px-4 font-semibold">Blockchain</th>
                  <th className="py-3 px-6 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                  {rows.map((invoice) => {
                    const canAccept = invoice.status === 'sent' || invoice.status === 'draft'
                    const canPay    = ['accepted', 'partial'].includes(invoice.status)
                    return (
                    <tr key={invoice.id} className="transition-colors hover:bg-gray-50 cursor-default">
                      <td className="py-4 pl-6 pr-4 font-semibold text-[#111827]">{invoice.invoice_number}</td>
                      <td className="py-4 px-4 text-[#6B7280]">{invoice.client_name}</td>
                      <td className="py-4 px-4 text-[#6B7280]">{formatDate(invoice.due_date)}</td>
                      <td className="py-4 px-4 text-right font-semibold text-[#111827]">{formatCurrency(invoice.total_amount)}</td>
                      <td className="py-4 px-4 text-right text-[#6B7280]">{formatCurrency(invoice.paid_amount)}</td>
                      <td className="py-4 px-4 text-right font-semibold text-[#111827]">{formatCurrency(invoice.outstanding_amount)}</td>
                      <td className="py-4 px-4"><StatusBadge status={invoice.status} /></td>
                      <td className="py-4 px-4">
                        {invoice.algo_anchor_tx_id && !invoice.algo_anchor_tx_id.startsWith('PENDING_') ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-[#2563EB]">
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" /></svg>
                            Anchored
                          </span>
                        ) : (
                          <span className="text-xs text-[#6B7280]">Not anchored</span>
                        )}
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex flex-wrap items-center gap-2">
                          {canAccept && (
                            <button
                              onClick={() => acceptInvoice(invoice.id)}
                              disabled={acceptingId === invoice.id}
                              className="rounded-md bg-[#2563EB] px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                            >
                              {acceptingId === invoice.id ? 'Accepting…' : 'Accept'}
                            </button>
                          )}
                          <button
                            onClick={() => canPay ? setSelectedInvoice(invoice) : showToast('Accept the invoice before recording a payment.', 'error')}
                            className={`rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors ${
                              canPay
                                ? 'border-[#E5E7EB] bg-white text-[#111827] hover:bg-gray-50'
                                : 'border-[#E5E7EB] bg-white text-[#6B7280] cursor-not-allowed opacity-60'
                            }`}
                            title={!canPay ? 'Invoice must be accepted first' : ''}
                          >
                            Add Payment
                          </button>
                          {invoice.status !== 'cancelled' && invoice.status !== 'disputed' && (
                            <Link
                              to={`/invoices/${invoice.id}/edit`}
                              className="rounded-md border border-[#E5E7EB] bg-white px-3 py-1.5 text-xs font-semibold text-[#111827] hover:bg-gray-50 transition-colors"
                            >
                              Edit
                            </Link>
                          )}
                          <button
                            onClick={() => sendReminder(invoice.id)}
                            className="rounded-md border border-[#E5E7EB] bg-white px-3 py-1.5 text-xs font-semibold text-[#111827] hover:bg-gray-50 transition-colors"
                          >
                            {copiedInvoiceId === invoice.id ? 'Sent ✓' : 'Remind'}
                          </button>
                          <button
                            onClick={() => openDetail(invoice.id)}
                            className="rounded-md bg-[#2563EB] px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition-colors"
                          >
                            View
                          </button>
                        </div>
                      </td>
                    </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {sortedRows.length > pageSize && (
        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-sm text-gray-600">Page {page} of {totalPages}</span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}

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
          onRefresh={async () => {
            await fetchInvoices()
            await openDetail(detailInvoice.id)
          }}
          onPaid={async () => {
            await fetchInvoices()
            await openDetail(detailInvoice.id)
          }}
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
