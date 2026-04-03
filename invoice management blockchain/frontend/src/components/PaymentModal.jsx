import { useState } from 'react'
import api from '../api/client'
import { formatCurrency } from '../utils/format'

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-lg rounded-xl border border-slate-700 bg-slate-900 p-5">
        <h3 className="text-lg font-semibold text-white">Add Payment</h3>
        <p className="mt-1 text-sm text-slate-400">
          {invoice.invoice_number} | Amount Pending {formatCurrency(invoice.outstanding_amount)}
        </p>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="text-sm text-slate-300">
            <span className="mb-1 block">Amount</span>
            <input
              type="number"
              min="0"
              step="0.01"
              required
              value={form.amount}
              onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
              className="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100"
            />
          </label>

          <label className="text-sm text-slate-300">
            <span className="mb-1 block">Payment Method</span>
            <select
              value={form.payment_method}
              onChange={(e) => setForm((prev) => ({ ...prev, payment_method: e.target.value }))}
              className="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100"
            >
              <option value="bank">Bank</option>
              <option value="upi">UPI</option>
              <option value="cash">Cash</option>
              <option value="algo">Algo</option>
              <option value="manual">Manual</option>
            </select>
          </label>

          <label className="text-sm text-slate-300 sm:col-span-2">
            <span className="mb-1 block">Reference Number</span>
            <input
              type="text"
              value={form.reference_number}
              onChange={(e) => setForm((prev) => ({ ...prev, reference_number: e.target.value }))}
              className="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100"
            />
          </label>

          <label className="text-sm text-slate-300 sm:col-span-2">
            <span className="mb-1 block">Notes</span>
            <textarea
              rows={3}
              value={form.notes}
              onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
              className="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100"
            />
          </label>
        </div>

        {error && <p className="mt-3 text-sm text-red-300">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md border border-slate-600 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800">
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-slate-100 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-white disabled:opacity-60"
          >
            {loading ? 'Saving...' : 'Save Payment'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default PaymentModal
