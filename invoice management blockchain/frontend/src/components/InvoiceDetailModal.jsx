import { useState } from 'react'
import { formatCurrency, formatDate, formatDateTime } from '../utils/format'
import { getToken } from '../api/auth'
import api from '../api/client'
import AlgoPaymentButton from './AlgoPaymentButton'
import PaymentSourceBadge from './PaymentSourceBadge'
import PaymentTimeline from './PaymentTimeline'
import TxnLink from './TxnLink'
import VerificationBadge from './VerificationBadge'
import StatusBadge from './StatusBadge'
import { useToast } from '../ui/ToastContext'
import { motion } from 'framer-motion'

function InvoiceDetailModal({ invoice, timeline, payments, onAnchor, onClose, anchoring, onPaid, onRefresh }) {
  const [downloading, setDownloading]     = useState(false)
  const [accepting, setAccepting]         = useState(false)
  const [disputing, setDisputing]         = useState(false)
  const [verifying, setVerifying]         = useState(false)
  const [verifyResult, setVerifyResult]   = useState(null)
  const [reverifyingId, setReverifyingId] = useState('')
  const { showToast } = useToast()

  const txId       = invoice.algo_anchor_tx_id || invoice.anchor_tx_id
  const hash       = invoice.anchor_hash || invoice.invoice_hash
  const explorerUrl = invoice.anchor_explorer_url || (txId && !txId.startsWith('PENDING_') ? `https://testnet.algoexplorer.io/tx/${txId}` : null)
  const isAnchored  = Boolean(txId) && !txId?.startsWith('PENDING_')

  const canAccept  = ['draft', 'sent'].includes(invoice.status)
  const canDispute = ['accepted', 'partial'].includes(invoice.status)
  const canPay     = ['accepted', 'partial'].includes(invoice.status)

  const handleDownloadPDF = async () => {
    try {
      setDownloading(true)
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
      const token = getToken()
      const res = await fetch(`${baseUrl}/invoices/${invoice.id}/pdf`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (!res.ok) throw new Error('Failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `invoice-${invoice.invoice_number}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch {
      showToast('Unable to download invoice PDF.', 'error')
    } finally {
      setDownloading(false)
    }
  }

  const handleAccept = async () => {
    try {
      setAccepting(true)
      await api.post(`/invoices/${invoice.id}/accept`)
      showToast('Invoice accepted. Anchoring to Algorand…', 'success')
      if (onRefresh) await onRefresh()
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to accept invoice.', 'error')
    } finally {
      setAccepting(false)
    }
  }

  const handleDispute = async () => {
    const reason = window.prompt('Enter a reason for querying this receivable (optional):')
    if (reason === null) return // cancelled
    try {
      setDisputing(true)
      await api.post(`/invoices/${invoice.id}/dispute`, { reason })
      showToast('Receivable logically marked as Queried.', 'success')
      if (onRefresh) await onRefresh()
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to query the receivable.', 'error')
    } finally {
      setDisputing(false)
    }
  }

  const handleVerify = async () => {
    try {
      setVerifying(true)
      setVerifyResult(null)
      const res = await api.get(`/invoices/${invoice.id}/verify`)
      setVerifyResult(res.data)
      if (res.data.result === 'VERIFIED') showToast('Invoice integrity verified on Algorand ✓', 'success')
      else if (res.data.result === 'TAMPERED') showToast('WARNING: Invoice data has been tampered!', 'error')
      else showToast(`Verification result: ${res.data.result}`, 'success')
    } catch (err) {
      showToast(err.response?.data?.error || 'Verification request failed.', 'error')
    } finally {
      setVerifying(false)
    }
  }

  const reverifyPayment = async (payment) => {
    const paymentTxnId = payment.txn_id || payment.algo_tx_id || payment.reference_number
    try {
      setReverifyingId(payment.id)
      await api.post(`/payments/${payment.id}/verify-chain`, { algo_tx_id: paymentTxnId })
      if (onPaid) await onPaid()
    } catch (err) {
      showToast(err.response?.data?.error || 'Unable to re-verify this transaction.', 'error')
    } finally {
      setReverifyingId('')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 p-4" style={{ backdropFilter: 'blur(4px)' }}>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.18 }}
        className="max-h-[92vh] w-full max-w-5xl overflow-auto rounded-xl border border-[#E5E7EB] bg-white shadow-xl"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#E5E7EB] bg-white px-6 py-4">
          <div className="flex items-center gap-3">
            <div>
              <h3 className="text-lg font-semibold text-[#111827]">Receivable Profile</h3>
              <p className="text-sm text-[#6B7280]">{invoice.invoice_number}</p>
            </div>
            <StatusBadge status={invoice.status} />
          </div>
          <div className="flex gap-2">
            {invoice.portal_token && (
              <button onClick={() => {
                const url = `${window.location.origin}/portal/${invoice.portal_token}`
                navigator.clipboard.writeText(url)
                if (window.showToast) window.showToast('Magic link copied to clipboard!', 'success')
              }}
                className="rounded-md border border-[#E5E7EB] bg-white px-3 py-1.5 text-sm font-medium text-emerald-600 hover:bg-emerald-50 transition-colors">
                Copy Magic Link
              </button>
            )}
            <button onClick={handleDownloadPDF} disabled={downloading}
              className="rounded-md border border-[#E5E7EB] bg-white px-3 py-1.5 text-sm font-medium text-[#111827] hover:bg-gray-50 disabled:opacity-50 transition-colors">
              {downloading ? 'Preparing…' : 'Download PDF'}
            </button>
            <button onClick={onClose}
              className="rounded-md border border-[#E5E7EB] bg-white px-3 py-1.5 text-sm font-medium text-[#111827] hover:bg-gray-50 transition-colors">
              Close
            </button>
          </div>
        </div>

        <div className="space-y-6 p-6">

          {/* Trust Layer Action Bar */}
          {(canAccept || canDispute || isAnchored) && (
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-3">
              <span className="text-xs font-medium text-[#6B7280] uppercase tracking-wide mr-1">Trust Actions:</span>

              {canAccept && (
                <button onClick={handleAccept} disabled={accepting}
                  className="inline-flex items-center gap-1.5 rounded-md bg-[#2563EB] px-3.5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors">
                  {accepting ? (
                    <><svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg> Accepting…</>
                  ) : (
                    <><svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg> Accept Invoice</>
                  )}
                </button>
              )}

              {(canAccept || canPay) && (
                <button
                  onClick={handleDispute} disabled={disputing}
                  className="rounded-md border border-[#E5E7EB] bg-white px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
                >
                  {disputing ? 'Processing…' : 'Query Term'}
                </button>
              )}

              {isAnchored && (
                <button onClick={handleVerify} disabled={verifying}
                  className="inline-flex items-center gap-1.5 rounded-md border border-[#2563EB] bg-white px-3.5 py-2 text-sm font-semibold text-[#2563EB] hover:bg-blue-50 disabled:opacity-50 transition-colors">
                  {verifying ? (
                    <><svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg> Verifying…</>
                  ) : (
                    <><svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"/></svg> Verify on Algorand</>
                  )}
                </button>
              )}

              {/* Live verification result */}
              {verifyResult && (
                <VerificationBadge invoice={invoice} verifyResult={verifyResult} />
              )}
            </div>
          )}

          {/* Acceptance details */}
          {invoice.accepted_at && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 flex items-center gap-3">
              <svg className="h-4 w-4 text-[#2563EB] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="text-sm">
                <span className="font-semibold text-[#2563EB]">Accepted</span>
                <span className="text-blue-700"> on {formatDateTime(invoice.accepted_at)}</span>
                {invoice.accepted_by && (
                  <span className="text-blue-600"> by <span className="font-mono text-xs">{invoice.accepted_by}</span></span>
                )}
              </div>
            </div>
          )}

          {/* Financial Snapshot */}
          <Section title="Financial Snapshot">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <InfoItem label="Client"           value={invoice.client_name || '-'} />
              <InfoItem label="Issue Date"       value={formatDate(invoice.issue_date || invoice.created_at)} />
              <InfoItem label="Due Date"         value={formatDate(invoice.due_date)} />
              <InfoItem label="Total Amount"     value={formatCurrency(invoice.total_amount)} />
              <InfoItem label="Amount Received"  value={formatCurrency(invoice.paid_amount)}  highlight="green" />
              <InfoItem label="Amount Pending"   value={formatCurrency(invoice.outstanding_amount)} highlight="red" />
              {invoice.metadata?.payment_mode && (
                <InfoItem label="Preferred Payment Mode" value={invoice.metadata.payment_mode} />
              )}
            </div>
          </Section>

          {/* Payment History */}
          <Section title="Payment History">
            {canPay && <div className="mb-3"><AlgoPaymentButton invoice={invoice} onPaid={onPaid} /></div>}
            {!canPay && invoice.status !== 'paid' && (
              <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-700 font-medium">
                Payments can only be recorded after the invoice is accepted.
              </div>
            )}
            {payments && payments.length > 0 ? (
              <div className="overflow-x-auto rounded-lg border border-[#E5E7EB]">
                <table className="min-w-full divide-y divide-[#E5E7EB] text-sm">
                  <thead>
                    <tr className="bg-[#F9FAFB] text-left text-[#6B7280]">
                      <th className="py-3 pl-4 pr-3 font-medium">Date</th>
                      <th className="py-3 px-3 font-medium">Method</th>
                      <th className="py-3 px-3 font-medium">Reference</th>
                      <th className="py-3 px-3 font-medium">Source</th>
                      <th className="py-3 px-3 font-medium">Transaction</th>
                      <th className="py-3 px-3 font-medium">Action</th>
                      <th className="py-3 pl-3 pr-4 text-right font-medium">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E7EB] bg-white">
                    {payments.map((payment) => (
                      <tr key={payment.id}>
                        <td className="py-3 pl-4 pr-3 text-[#111827]">{formatDate(payment.payment_date)}</td>
                        <td className="py-3 px-3 text-[#6B7280] capitalize">{payment.payment_method || '-'}</td>
                        <td className="py-3 px-3 text-[#6B7280]">{payment.reference_number || '-'}</td>
                        <td className="py-3 px-3"><PaymentSourceBadge source={payment.source} method={payment.payment_method} /></td>
                        <td className="py-3 px-3">{(payment.source === 'algorand' || payment.payment_method === 'algo') ? <TxnLink txnId={payment.txn_id || payment.algo_tx_id || payment.reference_number} /> : '-'}</td>
                        <td className="py-3 px-3">
                          {(payment.source === 'algorand' || payment.payment_method === 'algo') ? (
                            <button onClick={() => reverifyPayment(payment)} disabled={reverifyingId === payment.id}
                              className="rounded border border-[#E5E7EB] bg-white px-2 py-1 text-xs font-medium text-[#2563EB] hover:bg-blue-50 disabled:opacity-50 transition-colors">
                              {reverifyingId === payment.id ? 'Verifying…' : 'Re-verify'}
                            </button>
                          ) : '-'}
                        </td>
                        <td className="py-3 pl-3 pr-4 text-right font-semibold text-[#111827]">{formatCurrency(payment.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-[#E5E7EB] p-6 text-center">
                <p className="text-sm text-[#6B7280]">No payment receipts have been recorded yet.</p>
              </div>
            )}
          </Section>

          {/* Blockchain Verification */}
          <Section title="Blockchain Verification">
            <div className="rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-[#6B7280]">Anchor State</span>
                <VerificationBadge invoice={invoice} verifyResult={verifyResult} loading={verifying} />
              </div>
              <div className="rounded border border-[#E5E7EB] bg-white p-3">
                <span className="block text-xs font-medium text-[#6B7280] mb-1">Transaction ID</span>
                <span className="font-mono text-xs text-[#111827] break-all">
                  {txId && !txId.startsWith('PENDING_') ? txId : '—  Not anchored yet'}
                </span>
              </div>
              <div className="rounded border border-[#E5E7EB] bg-white p-3">
                <span className="block text-xs font-medium text-[#6B7280] mb-1">Cryptographic Hash (SHA-256)</span>
                <span className="font-mono text-xs text-[#111827] break-all">{hash || '—'}</span>
              </div>
              {explorerUrl && (
                <a href={explorerUrl} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1 text-sm font-medium text-[#2563EB] hover:underline">
                  View transaction on Algorand Explorer
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                  </svg>
                </a>
              )}
            </div>
          </Section>

          {/* Audit Timeline */}
          <Section title="Audit Timeline">
            <div className="space-y-3">
              {timeline.map((item, index) => {
                const dotColor =
                  item.type === 'invoice.accepted' ? 'bg-[#2563EB]' :
                  item.type === 'invoice.anchored' ? 'bg-[#16A34A]' :
                  item.type === 'invoice.disputed' ? 'bg-orange-500' :
                  item.type.startsWith('payment') ? 'bg-[#F59E0B]' :
                  'bg-[#6B7280]'

                return (
                  <div key={`${item.type}-${item.at}-${index}`}
                    className="relative pl-7 before:absolute before:left-2.5 before:top-2 before:h-2 before:w-2 before:rounded-full before:content-[''] after:absolute after:bottom-[-12px] after:left-[13px] after:top-[12px] after:w-px after:bg-[#E5E7EB] after:content-[''] last:after:hidden"
                    style={{ '--dot-color': dotColor }}
                  >
                    <span className={`absolute left-2.5 top-2 h-2 w-2 rounded-full ${dotColor}`} />
                    <div className="rounded-lg border border-[#E5E7EB] bg-white p-4">
                      <p className="text-sm font-semibold text-[#111827]">{item.label}</p>
                      <p className="mt-0.5 text-xs text-[#6B7280]">{formatDateTime(item.at)}</p>
                      <TimelineMeta meta={item.meta} />
                    </div>
                  </div>
                )
              })}
              {timeline.length === 0 && (
                <p className="text-sm text-[#6B7280] italic">No historical events recorded.</p>
              )}
            </div>
          </Section>

          <Section title="Payment Timeline">
            <PaymentTimeline payments={payments} />
          </Section>

        </div>
      </motion.div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <section>
      <h4 className="mb-3 text-xs font-semibold tracking-widest text-[#6B7280] uppercase">{title}</h4>
      {children}
    </section>
  )
}

function InfoItem({ label, value, highlight }) {
  const isGreen = highlight === 'green'
  const isRed   = highlight === 'red'
  return (
    <div className={`rounded-lg border bg-white p-4 ${isGreen ? 'border-green-200' : isRed ? 'border-red-200' : 'border-[#E5E7EB]'}`}>
      <p className="text-xs font-medium uppercase tracking-wider text-[#6B7280]">{label}</p>
      <p className={`mt-1 text-xl font-semibold ${isGreen ? 'text-[#16A34A]' : isRed ? 'text-[#DC2626]' : 'text-[#111827]'}`}>{value}</p>
    </div>
  )
}

function TimelineMeta({ meta }) {
  if (!meta) return null
  const entries = Object.entries(meta).filter(([, v]) => v !== null && v !== undefined && v !== '')
  if (entries.length === 0) return null
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {entries.map(([key, value]) => (
        <span key={key} className="inline-flex items-center rounded border border-[#E5E7EB] bg-[#F9FAFB] px-2 py-0.5 text-xs font-medium text-[#6B7280]">
          {key}: {key.includes('amount') ? formatCurrency(value) : String(value)}
        </span>
      ))}
    </div>
  )
}

export default InvoiceDetailModal
