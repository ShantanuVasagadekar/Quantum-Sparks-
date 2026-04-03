import { useState } from 'react'
import api from '../api/client'
import { formatCurrency } from '../utils/format'
import { motion } from 'framer-motion'

const defaultForm = {
  amount: '',
  payment_method: 'bank',
  reference_number: '',
  notes: ''
}

function PaymentModal({ invoice, onClose, onSaved }) {
  const [form, setForm] = useState(defaultForm)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (event) => {
    event.preventDefault()
    setLoading(true)
    setError('')

    try {
      await api.post(`/invoices/${invoice.id}/payments`, {
        ...form,
        amount: Number(form.amount)
      })
      await onSaved()
      onClose()
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to record payment.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 p-4 backdrop-blur-sm">
      <motion.form
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.2 }}
        onSubmit={handleSubmit}
        className="w-full max-w-lg rounded-xl border border-gray-200 bg-white p-6 shadow-xl"
      >
        <h3 className="text-xl font-bold text-gray-900">Record Payment</h3>
        <p className="mt-1 text-sm text-gray-500">
          Invoice <span className="font-semibold text-gray-700">{invoice.invoice_number}</span> &mdash; Pending <span className="font-semibold text-red-600">{formatCurrency(invoice.outstanding_amount)}</span>
        </p>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium text-gray-900">
            <span className="mb-1 block">Payment Amount</span>
            <input
              type="number"
              min="0"
              step="0.01"
              required
              value={form.amount}
              onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
              placeholder="0.00"
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </label>

          <label className="block text-sm font-medium text-gray-900">
            <span className="mb-1 block">Payment Method</span>
            <select
              value={form.payment_method}
              onChange={(e) => setForm((prev) => ({ ...prev, payment_method: e.target.value }))}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            >
              <option value="bank">Bank Transfer</option>
              <option value="upi">UPI / Mobile</option>
              <option value="cash">Cash</option>
              <option value="algo">Algorand / Crypto</option>
              <option value="manual">Manual / Other</option>
            </select>
          </label>

          <label className="block text-sm font-medium text-gray-900 sm:col-span-2">
            <span className="mb-1 block">Reference Number (Optional)</span>
            <input
              type="text"
              placeholder="e.g. TXN-12345"
              value={form.reference_number}
              onChange={(e) => setForm((prev) => ({ ...prev, reference_number: e.target.value }))}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </label>

          <label className="block text-sm font-medium text-gray-900 sm:col-span-2">
            <span className="mb-1 block">Internal Notes</span>
            <textarea
              rows={3}
              placeholder="Wire transfer cleared on Wednesday..."
              value={form.notes}
              onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </label>
        </div>

        {error && (
          <div className="mt-4 rounded-md bg-red-50 p-3 shadow-sm border border-red-200">
            <p className="text-sm font-medium text-red-700">{error}</p>
          </div>
        )}

        <div className="mt-8 flex items-center justify-end gap-3 border-t border-gray-200 pt-5">
          <button type="button" onClick={onClose} className="rounded-md bg-white px-3.5 py-2 text-sm font-semibold text-gray-700 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50">
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
          >
            {loading ? 'Processing...' : 'Confirm Payment Receipt'}
          </button>
        </div>
      </motion.form>
    </div>
  )
}

export default PaymentModal
