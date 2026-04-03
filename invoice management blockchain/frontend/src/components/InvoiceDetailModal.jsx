import { useState } from 'react'
import { formatCurrency, formatDate, formatDateTime } from '../utils/format'
import { getToken } from '../api/auth'

function InvoiceDetailModal({ invoice, timeline, payments, onAnchor, onClose, anchoring }) {
  const [downloading, setDownloading] = useState(false)
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
      alert('Unable to download invoice PDF.')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
      <div className="max-h-[90vh] w-full max-w-5xl overflow-auto rounded-xl border border-slate-700 bg-slate-900 p-5">
        <div className="mb-4 flex items-center justify-between border-b border-slate-700 pb-3">
          <div>
            <h3 className="text-lg font-semibold text-white">Invoice Detail</h3>
            <p className="mt-1 text-sm text-slate-400">{invoice.invoice_number}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleDownloadPDF}
              disabled={downloading}
              className="rounded-md border border-slate-600 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-50"
            >
              {downloading ? 'Generating PDF...' : 'Download PDF'}
            </button>
            <button onClick={onClose} className="rounded-md border border-slate-600 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800">
              Close
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <Section title="Invoice Information">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <InfoItem label="Client" value={invoice.client_name || '-'} />
              <InfoItem label="Issue Date" value={formatDate(invoice.issue_date || invoice.created_at)} />
              <InfoItem label="Due Date" value={formatDate(invoice.due_date)} />
              <InfoItem label="Total" value={formatCurrency(invoice.total_amount)} />
              <InfoItem label="Amount Received" value={formatCurrency(invoice.paid_amount)} />
              <InfoItem label="Amount Pending" value={formatCurrency(invoice.outstanding_amount)} />
            </div>
          </Section>

          <Section title="Client Details">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <InfoItem label="Client Name" value={invoice.client_name || '-'} />
              <InfoItem label="Email" value={invoice.client_email || '-'} />
              <InfoItem label="Phone" value={invoice.client_phone || '-'} />
              <InfoItem label="Status" value={invoice.status || '-'} />
            </div>
          </Section>

          <Section title="Payment History">
            {payments && payments.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700 text-left text-slate-400">
                      <th className="pb-2 pr-4">Date</th>
                      <th className="pb-2 pr-4">Method</th>
                      <th className="pb-2 pr-4">Reference</th>
                      <th className="pb-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((payment) => (
                      <tr key={payment.id} className="border-b border-slate-800">
                        <td className="py-2 pr-4 text-slate-300">{formatDate(payment.payment_date)}</td>
                        <td className="py-2 pr-4 text-slate-300">{payment.payment_method || '-'}</td>
                        <td className="py-2 pr-4 text-slate-300">{payment.reference_number || '-'}</td>
                        <td className="py-2 text-right text-slate-100">{formatCurrency(payment.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-slate-400">No payments recorded.</p>
            )}
          </Section>

          <Section title="Verification Status">
            <div className="space-y-2 text-sm text-slate-300">
              <p>
                Current Status: <span className="font-medium text-white">{verified ? 'Verified on Algorand' : 'Unverified'}</span>
              </p>
              <p className="break-all">Transaction ID: <span className="font-mono text-xs text-slate-200">{txId || '-'}</span></p>
              <p className="break-all">Hash: <span className="font-mono text-xs text-slate-200">{hash || '-'}</span></p>
              {explorerUrl && (
                <a href={explorerUrl} target="_blank" rel="noreferrer" className="inline-block text-sm text-slate-300 underline">
                  View Transaction
                </a>
              )}
              {!verified && (
                <button
                  onClick={() => onAnchor(invoice.id)}
                  disabled={anchoring}
                  className="rounded-md bg-slate-100 px-3 py-2 text-sm font-medium text-slate-900 hover:bg-white disabled:opacity-50"
                >
                  {anchoring ? 'Verifying...' : 'Verify Invoice'}
                </button>
              )}
            </div>
          </Section>

          <Section title="Timeline">
            <div className="space-y-2">
              {timeline.map((item, index) => (
                <div key={`${item.type}-${item.at}-${index}`} className="rounded-md border border-slate-700 bg-slate-800 p-3">
                  <p className="text-sm font-medium text-white">{item.label}</p>
                  <p className="text-xs text-slate-400">{formatDateTime(item.at)}</p>
                  <TimelineMeta meta={item.meta} />
                </div>
              ))}
              {timeline.length === 0 && <p className="text-sm text-slate-400">No timeline events available.</p>}
            </div>
          </Section>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <section className="rounded-lg border border-slate-700 bg-slate-800 p-4">
      <h4 className="mb-3 text-sm font-semibold text-white">{title}</h4>
      {children}
    </section>
  )
}

function InfoItem({ label, value }) {
  return (
    <div className="rounded-md border border-slate-700 bg-slate-900 p-3">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-medium text-slate-100">{value}</p>
    </div>
  )
}

function TimelineMeta({ meta }) {
  if (!meta) return null
  const entries = Object.entries(meta).filter(([, value]) => value !== null && value !== undefined && value !== '')
  if (entries.length === 0) return null

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {entries.map(([key, value]) => (
        <span key={key} className="rounded border border-slate-600 bg-slate-900 px-2 py-1 text-[11px] text-slate-300">
          {key}: {key.includes('amount') ? formatCurrency(value) : String(value)}
        </span>
      ))}
    </div>
  )
}

export default InvoiceDetailModal
