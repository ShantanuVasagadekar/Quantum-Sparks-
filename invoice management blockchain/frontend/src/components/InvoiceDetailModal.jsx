import { useState } from 'react'
import { formatCurrency, formatDate, formatDateTime } from '../utils/format'
import { getToken } from '../api/auth'
import api from '../api/client'
import AlgoPaymentButton from './AlgoPaymentButton'
import PaymentSourceBadge from './PaymentSourceBadge'
import PaymentTimeline from './PaymentTimeline'
import AlgorandBadge from './AlgorandBadge'
import TxnLink from './TxnLink'
import { useToast } from '../ui/ToastContext'
import { motion } from 'framer-motion'

function InvoiceDetailModal({ invoice, timeline, payments, onAnchor, onClose, anchoring, onPaid }) {
  const [downloading, setDownloading] = useState(false)
  const [reverifyingId, setReverifyingId] = useState('')
  const { showToast } = useToast()
  const txId = invoice.anchor_tx_id || invoice.algo_anchor_tx_id
  const hash = invoice.anchor_hash || invoice.invoice_hash
  const explorerUrl = invoice.anchor_explorer_url || (txId ? `https://testnet.algoexplorer.io/tx/${txId}` : null)
  const verified = Boolean(txId) && !invoice.anchor_simulated

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 p-4 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.2 }}
        className="max-h-[90vh] w-full max-w-5xl overflow-auto rounded-xl border border-gray-200 bg-white shadow-xl"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white/95 px-6 py-4 backdrop-blur">
          <div>
            <h3 className="text-xl font-bold text-gray-900">Invoice Details</h3>
            <p className="mt-1 text-sm font-medium text-gray-500">{invoice.invoice_number}</p>
          </div>
          <div className="flex gap-3">
            <button onClick={handleDownloadPDF} disabled={downloading} className="rounded-md bg-white px-3.5 py-2 text-sm font-semibold text-gray-700 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:opacity-50">
              {downloading ? 'Preparing PDF...' : 'Download PDF'}
            </button>
            <button onClick={onClose} className="rounded-md bg-white px-3.5 py-2 text-sm font-semibold text-gray-700 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50">Close</button>
          </div>
        </div>

        <div className="space-y-6 p-6">
          <Section title="Financial Snapshot">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <InfoItem label="Client" value={invoice.client_name || '-'} />
              <InfoItem label="Issue Date" value={formatDate(invoice.issue_date || invoice.created_at)} />
              <InfoItem label="Due Date" value={formatDate(invoice.due_date)} />
              <InfoItem label="Total Base Amount" value={formatCurrency(invoice.total_amount)} />
              <InfoItem label="Amount Received" value={formatCurrency(invoice.paid_amount)} highlight="green" />
              <InfoItem label="Amount Pending" value={formatCurrency(invoice.outstanding_amount)} highlight="red" />
            </div>
          </Section>

          <Section title="Client Contact Information">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <InfoItem label="Client Name" value={invoice.client_name || '-'} />
              <InfoItem label="Email" value={invoice.client_email || '-'} />
              <InfoItem label="Phone" value={invoice.client_phone || '-'} />
              <InfoItem label="Status Label" value={invoice.status || '-'} />
            </div>
          </Section>

          <Section title="Payment History">
            <div className="mb-3"><AlgoPaymentButton invoice={invoice} onPaid={onPaid} /></div>
            {payments && payments.length > 0 ? (
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-left text-gray-500">
                      <th className="py-3 pl-4 pr-3 font-semibold">Date</th>
                      <th className="py-3 px-3 font-semibold">Method</th>
                      <th className="py-3 px-3 font-semibold">Reference</th>
                      <th className="py-3 px-3 font-semibold">Source</th>
                      <th className="py-3 px-3 font-semibold">Status</th>
                      <th className="py-3 px-3 font-semibold">Transaction</th>
                      <th className="py-3 px-3 font-semibold">Action</th>
                      <th className="py-3 pl-3 pr-4 text-right font-semibold">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {payments.map((payment) => (
                      <tr key={payment.id}>
                        <td className="py-3 pl-4 pr-3 text-gray-900">{formatDate(payment.payment_date)}</td>
                        <td className="py-3 px-3 text-gray-600 capitalize">{payment.payment_method || '-'}</td>
                        <td className="py-3 px-3 text-gray-600">{payment.reference_number || '-'}</td>
                        <td className="py-3 px-3"><PaymentSourceBadge source={payment.source} method={payment.payment_method} /></td>
                        <td className="py-3 px-3 text-gray-600 capitalize">{payment.status || (payment.algo_verified ? 'confirmed' : 'pending')}</td>
                        <td className="py-3 px-3">{(payment.source === 'algorand' || payment.payment_method === 'algo') ? <TxnLink txnId={payment.txn_id || payment.algo_tx_id || payment.reference_number} /> : '-'}</td>
                        <td className="py-3 px-3">
                          {(payment.source === 'algorand' || payment.payment_method === 'algo') ? (
                            <button onClick={() => reverifyPayment(payment)} disabled={reverifyingId === payment.id} className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-indigo-700 ring-1 ring-inset ring-indigo-300 hover:bg-indigo-50 disabled:opacity-50">
                              {reverifyingId === payment.id ? 'Re-verifying...' : 'Re-verify'}
                            </button>
                          ) : '-'}
                        </td>
                        <td className="py-3 pl-3 pr-4 text-right font-medium text-gray-900">{formatCurrency(payment.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="rounded-lg border border-gray-200 border-dashed p-6 text-center"><p className="text-sm font-medium text-gray-500">No payment receipts have been recorded yet.</p></div>
            )}
          </Section>

          <Section title="Blockchain Verification">
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div className="space-y-3 text-sm text-gray-600">
                <p className="flex items-center gap-2">
                  <span className="font-medium text-gray-900">Current Status:</span>
                  {verified ? <AlgorandBadge show /> : <span className="inline-flex items-center rounded-md bg-yellow-50 px-2 py-1 text-xs font-semibold text-yellow-800 ring-1 ring-inset ring-yellow-600/20">Unverified / Pending</span>}
                </p>
                <div className="break-all rounded bg-white p-2 border border-gray-200">
                  <span className="block text-xs font-semibold text-gray-500 mb-1">Transaction ID</span>
                  <span className="font-mono text-xs text-gray-800">{txId || '-'}</span>
                </div>
                <div className="break-all rounded bg-white p-2 border border-gray-200">
                  <span className="block text-xs font-semibold text-gray-500 mb-1">Cryptographic Hash</span>
                  <span className="font-mono text-xs text-gray-800">{hash || '-'}</span>
                </div>
                <div className="pt-2 flex items-center justify-between">
                  {explorerUrl ? <a href={explorerUrl} target="_blank" rel="noreferrer" className="text-sm font-semibold text-indigo-600 hover:text-indigo-500">View full block details on Explorer &rarr;</a> : <span />}
                  {!verified && (
                    <button onClick={() => onAnchor(invoice.id)} disabled={anchoring} className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50">
                      {anchoring ? 'Verifying...' : 'Push Verification to Chain'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </Section>

          <Section title="Audit Timeline">
            <div className="space-y-4">
              {timeline.map((item, index) => (
                <div key={`${item.type}-${item.at}-${index}`} className="relative pl-6 before:absolute before:left-2 before:top-2 before:h-2 before:w-2 before:rounded-full before:bg-indigo-500 after:absolute after:bottom-[-16px] after:left-[11px] after:top-[12px] after:w-px after:bg-gray-200 last:after:hidden">
                  <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                    <p className="text-sm font-semibold text-gray-900">{item.label}</p>
                    <p className="mt-0.5 text-xs text-gray-500">{formatDateTime(item.at)}</p>
                    <TimelineMeta meta={item.meta} />
                  </div>
                </div>
              ))}
              {timeline.length === 0 && <p className="text-sm text-gray-500 italic">No historical events recorded.</p>}
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
      <h4 className="mb-3 text-sm font-bold tracking-wide text-gray-900 uppercase">{title}</h4>
      {children}
    </section>
  )
}

function InfoItem({ label, value, highlight }) {
  const isGreen = highlight === 'green'
  const isRed = highlight === 'red'
  
  return (
    <div className={`rounded-xl border border-gray-200 bg-white p-4 shadow-sm ${isGreen ? 'border-green-200' : ''} ${isRed ? 'border-red-200' : ''}`}>
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">{label}</p>
      <p className={`mt-1 text-lg font-bold ${isGreen ? 'text-green-700' : isRed ? 'text-red-700' : 'text-gray-900'}`}>{value}</p>
    </div>
  )
}

function TimelineMeta({ meta }) {
  if (!meta) return null
  const entries = Object.entries(meta).filter(([, value]) => value !== null && value !== undefined && value !== '')
  if (entries.length === 0) return null

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {entries.map(([key, value]) => (
        <span key={key} className="inline-flex items-center rounded-md bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10">
          {key}: {key.includes('amount') ? formatCurrency(value) : String(value)}
        </span>
      ))}
    </div>
  )
}

export default InvoiceDetailModal
