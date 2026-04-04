import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import axios from 'axios'
import { formatCurrency, formatDate } from '../utils/format'
import StatusBadge from '../components/StatusBadge'
import AlgoPaymentButton from '../components/AlgoPaymentButton'
import VerificationBadge from '../components/VerificationBadge'
import { useToast } from '../ui/ToastContext'

const PUBLIC_API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  headers: { 'Content-Type': 'application/json' }
})

export default function PortalPage() {
  const { token } = useParams()
  const { showToast } = useToast()
  
  const [invoice, setInvoice] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  const loadInvoice = async () => {
    try {
      const res = await PUBLIC_API.get(`/portal/${token}`)
      setInvoice(res.data)
    } catch (err) {
      setError(err.response?.data?.error || 'Invoice not found or link expired.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadInvoice()
  }, [token])

  const handleDownloadPDF = async () => {
    // Note: PDF generation logic currently relies on auth token but portal could serve it
    // For now, let's keep portal focused on HTML viewing
    window.print()
  }

  const handleAccept = async () => {
    try {
      setActionLoading(true)
      await PUBLIC_API.post(`/portal/${token}/accept`)
      showToast('Terms accepted successfully!', 'success')
      await loadInvoice()
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to accept invoice.', 'error')
    } finally {
      setActionLoading(false)
    }
  }

  const handleDispute = async () => {
    const reason = window.prompt('Enter your reason for disputing this invoice:')
    if (reason === null) return 
    try {
      setActionLoading(true)
      await PUBLIC_API.post(`/portal/${token}/dispute`, { reason })
      showToast('Invoice has been disputed.', 'success')
      await loadInvoice()
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to dispute invoice.', 'error')
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-50">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#2563EB]/30 border-t-[#2563EB]"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-50 p-6">
        <div className="rounded-xl border border-red-200 bg-white p-8 text-center shadow-lg">
          <svg className="mx-auto mb-4 h-12 w-12 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h2 className="text-xl font-bold text-gray-900">Access Denied</h2>
          <p className="mt-2 text-gray-600">{error}</p>
        </div>
      </div>
    )
  }

  if (!invoice) return null

  const canAccept = invoice.status === 'sent' || invoice.status === 'draft'
  const canPay = invoice.status === 'accepted' || invoice.status === 'partial'
  const isAnchored = Boolean(invoice.algo_anchor_tx_id || invoice.anchor_tx_id)

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto max-w-4xl overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-xl"
      >
        {/* Header Block */}
        <div className="border-b border-[#E5E7EB] bg-[#F9FAFB] px-8 py-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-[#6B7280]">Invoice</p>
            <h1 className="mt-1 text-2xl font-bold text-[#111827]">{invoice.invoice_number}</h1>
            <p className="mt-1 text-sm text-[#4B5563]">Issued to: <span className="font-semibold text-gray-900">{invoice.client_name}</span></p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <StatusBadge status={invoice.status} />
            <div className="text-right">
              <p className="text-3xl font-bold text-[#111827]">{formatCurrency(invoice.total_amount)}</p>
              <p className="text-xs text-[#6B7280]">Due by {formatDate(invoice.due_date)}</p>
            </div>
          </div>
        </div>

        {/* Action Bar (Top) */}
        <div className="bg-white px-8 py-5 flex flex-wrap items-center gap-3 border-b border-[#E5E7EB]">
          {canAccept && (
             <button
               onClick={handleAccept} disabled={actionLoading}
               className="rounded-lg bg-[#2563EB] px-5 py-2.5 text-sm font-bold text-white shadow-md hover:bg-blue-700 disabled:opacity-50 transition-all active:scale-95"
             >
               Accept & Sign Electronically
             </button>
          )}
          {(canAccept || canPay) && (
             <button
               onClick={handleDispute} disabled={actionLoading}
               className="rounded-lg border-2 border-red-100 bg-white px-5 py-2.5 text-sm font-bold text-red-600 hover:bg-red-50 disabled:opacity-50 transition-all"
             >
               Dispute Invoice
             </button>
          )}
          {canPay && (
            <div className="ml-auto flex items-center gap-4">
               {invoice.metadata?.payment_mode === 'Algorand Crypto' && (
                 <AlgoPaymentButton 
                    invoice={invoice} 
                    onPaid={loadInvoice} 
                    apiOverride={PUBLIC_API}  
                    portalToken={token}
                 />
               )}
            </div>
          )}
          <button onClick={handleDownloadPDF} className="ml-auto rounded border border-[#E5E7EB] bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Print HTML
          </button>
        </div>

        {/* Invoice Body */}
        <div className="px-8 py-10 space-y-10">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Bill To</p>
              <p className="mt-2 text-sm font-semibold text-gray-900">{invoice.client_name}</p>
            </div>
            <div className="md:text-right">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400">From</p>
              <p className="mt-2 text-sm font-semibold text-gray-900">{invoice.metadata?.business?.business_name || 'Business'}</p>
              <p className="text-sm text-gray-500">{invoice.metadata?.business?.email}</p>
              {invoice.metadata?.business?.gst_number && <p className="text-sm text-gray-500">GST: {invoice.metadata?.business?.gst_number}</p>}
            </div>
          </div>

          <div>
             <table className="min-w-full divide-y divide-[#E5E7EB]">
                <thead>
                  <tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-widest bg-gray-50/50">
                    <th className="py-3 px-4">Description</th>
                    <th className="py-3 px-4 text-center">Qty</th>
                    <th className="py-3 px-4 text-right">Rate</th>
                    <th className="py-3 px-4 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(invoice.line_items || []).map((item, idx) => {
                    const quantity = Number(item.quantity || item.qty || 0)
                    const unit_price = Number(item.unit_price || item.rate || 0)
                    return (
                      <tr key={idx}>
                        <td className="py-4 px-4 text-sm font-medium text-gray-900">{item.description || item.name}</td>
                        <td className="py-4 px-4 text-sm text-gray-500 text-center">{quantity.toFixed(2)}</td>
                        <td className="py-4 px-4 text-sm text-gray-500 text-right">{formatCurrency(unit_price)}</td>
                        <td className="py-4 px-4 text-sm text-gray-900 text-right font-medium">{formatCurrency(quantity * unit_price)}</td>
                      </tr>
                    )
                  })}
                </tbody>
             </table>
             <div className="mt-6 flex justify-end">
               <div className="w-64 space-y-3">
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Taxable Amount</span>
                    <span>{formatCurrency(invoice.subtotal_amount)}</span>
                  </div>
                  {Number(invoice.tax_amount) > 0 && (
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>GST (Tax)</span>
                      <span>{formatCurrency(invoice.tax_amount)}</span>
                    </div>
                  )}
                  {Number(invoice.discount_amount) > 0 && (
                    <div className="flex justify-between text-sm text-red-500">
                      <span>Discount</span>
                      <span>-{formatCurrency(invoice.discount_amount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-gray-200 pt-3 text-lg font-bold text-gray-900">
                    <span>Total</span>
                    <span>{formatCurrency(invoice.total_amount)}</span>
                  </div>
               </div>
             </div>
          </div>

          <div className="rounded-xl bg-blue-50/50 border border-blue-100 p-6">
            <h4 className="text-sm font-bold text-blue-900 mb-2">Payment Details</h4>
            <div className="text-sm text-blue-800 space-y-1">
              <p>Mode: <span className="font-semibold">{invoice.metadata?.payment_mode || 'Bank Transfer'}</span></p>
              {invoice.metadata?.terms && <p className="mt-2 text-gray-600 italic">"{invoice.metadata.terms}"</p>}
            </div>
          </div>

          {canPay && Number(invoice.outstanding_amount) > 0 && (
             <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <h4 className="text-lg font-bold text-gray-900 mb-4">Clear Outstanding Due</h4>
                <div className="flex flex-col gap-4 max-w-sm">
                   <div>
                     <label className="block text-sm font-medium text-gray-700">Amount to Pay</label>
                     <div className="mt-1 relative rounded-md shadow-sm">
                       <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                         <span className="text-gray-500 sm:text-sm">₹</span>
                       </div>
                       <input 
                         type="number" 
                         defaultValue={invoice.outstanding_amount}
                         id="portalPayAmount"
                         className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-8 sm:text-sm border-gray-300 rounded-md"
                       />
                     </div>
                   </div>
                   
                   <div>
                     <label className="block text-sm font-medium text-gray-700">Mode of Payment</label>
                     <select 
                       id="portalPayMode"
                       defaultValue={invoice.metadata?.payment_mode !== 'Algorand Crypto' ? invoice.metadata?.payment_mode : 'Bank Transfer'}
                       className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                     >
                        <option>Bank Transfer</option>
                        <option>UPI</option>
                        <option>Cash</option>
                        <option>Other</option>
                     </select>
                   </div>
                   
                   <div>
                     <label className="block text-sm font-medium text-gray-700">Reference Number / UTR</label>
                     <input 
                       type="text" 
                       id="portalPayRef"
                       placeholder="e.g. UTR123456789"
                       className="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                     />
                   </div>

                   <button
                     onClick={async () => {
                        const amount = document.getElementById('portalPayAmount').value
                        const mode = document.getElementById('portalPayMode').value
                        const ref = document.getElementById('portalPayRef').value
                        if (!amount || amount <= 0) return showToast('Enter valid amount', 'error')

                        try {
                           setActionLoading(true)
                           await PUBLIC_API.post(`/portal/${token}/record-payment`, {
                              amount: Number(amount),
                              payment_mode: mode,
                              reference_number: ref
                           })
                           showToast('Payment recorded successfully!', 'success')
                           await loadInvoice()
                        } catch (err) {
                           showToast(err.response?.data?.error || 'Failed to record payment.', 'error')
                        } finally {
                           setActionLoading(false)
                        }
                     }}
                     disabled={actionLoading}
                     className="mt-2 w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                   >
                     {actionLoading ? 'Recording...' : 'Mark as Paid'}
                   </button>
                </div>
             </div>
          )}

          {isAnchored && (
             <div className="rounded-xl border border-emerald-100 bg-emerald-50/30 p-6 flex flex-col items-center justify-center text-center">
                 <VerificationBadge status="VERIFIED" txId={invoice.algo_anchor_tx_id || invoice.anchor_tx_id} />
                 <p className="mt-3 text-xs text-emerald-700 max-w-xl">
                   This invoice acts as a mathematical, tamper-proof Smart Contract. The mutual terms have been permanently secured on the Algorand Blockchain.
                 </p>
             </div>
          )}

        </div>
      </motion.div>
    </div>
  )
}
