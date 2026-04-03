import { useEffect, useState } from 'react'
import api from '../api/client'

const initialLineItem = { description: '', quantity: 1, unit_price: 0, gst_percent: 0 }

function InvoiceForm({ onSuccess }) {
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    client_id: '',
    invoice_number: `INV-${Date.now().toString().slice(-6)}`,
    title: '',
    description: '',
    issue_date: new Date().toISOString().slice(0, 10),
    due_date: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    discount_amount: 0,
    line_items: [initialLineItem]
  })

  useEffect(() => {
    api.get('/clients').then((res) => setClients(res.data)).catch(() => setClients([]))
  }, [])

  const subtotal = form.line_items.reduce(
    (sum, item) => sum + Number(item.quantity || 0) * Number(item.unit_price || 0),
    0
  )
  const total = subtotal - Number(form.discount_amount || 0)

  function updateLineItem(index, key, value) {
    setForm((prev) => {
      const nextLineItems = [...prev.line_items]
      nextLineItems[index] = { ...nextLineItems[index], [key]: value }
      return { ...prev, line_items: nextLineItems }
    })
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setLoading(true)
    setError('')

    try {
      const payload = {
        ...form,
        discount_amount: Number(form.discount_amount || 0),
        line_items: form.line_items.map((item) => ({
          description: item.description,
          quantity: Number(item.quantity),
          unit_price: Number(item.unit_price),
          gst_percent: Number(item.gst_percent)
        }))
      }

      await api.post('/invoices', payload)
      onSuccess()
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to create invoice.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <FormSection title="Client Details">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Client" required>
            <select
              required
              value={form.client_id || ''}
              onChange={(e) => setForm((prev) => ({ ...prev, client_id: e.target.value }))}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            >
              <option value="" disabled>Select an existing client</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name} {c.state ? `(${c.state})` : '(No State)'}</option>)}
            </select>
          </Field>

          <Field label="Invoice Number" required>
            <input
              required
              value={form.invoice_number}
              onChange={(e) => setForm((prev) => ({ ...prev, invoice_number: e.target.value }))}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </Field>

          <Field label="Title" className="md:col-span-2">
            <input
              value={form.title}
              onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              placeholder="Monthly consulting services"
            />
          </Field>
        </div>
      </FormSection>

      <FormSection title="Line Items">
        <div className="space-y-3">
          {form.line_items.map((item, index) => (
            <div key={`${index}-${item.description}`} className="grid grid-cols-1 gap-3 rounded-md border border-gray-200 bg-gray-50/50 p-4 md:grid-cols-4">
              <Field label="Description" required className="md:col-span-2">
                <input
                  required
                  value={item.description}
                  onChange={(e) => updateLineItem(index, 'description', e.target.value)}
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              </Field>

              <Field label="Quantity" required>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  required
                  value={item.quantity}
                  onChange={(e) => updateLineItem(index, 'quantity', e.target.value)}
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              </Field>

              <Field label="Rate" required>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={item.unit_price}
                  onChange={(e) => updateLineItem(index, 'unit_price', e.target.value)}
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              </Field>

              <Field label="GST %" required>
                <input
                  type="number"
                  min="0"
                  step="1"
                  required
                  value={item.gst_percent}
                  onChange={(e) => updateLineItem(index, 'gst_percent', e.target.value)}
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              </Field>
            </div>
          ))}

          <button
            type="button"
            onClick={() => setForm((prev) => ({ ...prev, line_items: [...prev.line_items, { ...initialLineItem }] }))}
            className="rounded-md bg-white px-3.5 py-2 text-sm font-semibold text-gray-700 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 mt-2"
          >
            + Add Line Item
          </button>
        </div>
      </FormSection>

      <FormSection title="Summary & Dates">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Issue Date">
            <input
              type="date"
              value={form.issue_date}
              onChange={(e) => setForm((prev) => ({ ...prev, issue_date: e.target.value }))}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </Field>

          <Field label="Due Date" required>
            <input
              type="date"
              required
              value={form.due_date}
              onChange={(e) => setForm((prev) => ({ ...prev, due_date: e.target.value }))}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </Field>

          <Field label={<span>Tax Amount <span className="text-gray-500 text-xs font-normal ml-1">(Calculated automatically on backend via GST rules)</span></span>}>
            <input
              type="text"
              disabled
              value="Will be computed automatically"
              className="w-full rounded-md border border-gray-300 bg-gray-100 px-3 py-2 text-sm text-gray-500 shadow-sm"
            />
          </Field>

          <Field label="Discount Amount">
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.discount_amount}
              onChange={(e) => setForm((prev) => ({ ...prev, discount_amount: e.target.value }))}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </Field>
        </div>

        <div className="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-5">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>Subtotal</span>
            <span className="font-medium text-gray-900">₹ {subtotal.toFixed(2)}</span>
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-gray-200 pt-3 text-lg font-bold text-gray-900">
            <span>Estimated Total (without tax)</span>
            <span>₹ {total.toFixed(2)}</span>
          </div>
        </div>
      </FormSection>

      {error && <p className="text-sm font-medium text-red-600">{error}</p>}

      <div className="flex justify-end border-t border-gray-200 pt-5">
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
        >
          {loading ? 'Saving Invoice...' : 'Save & Publish Invoice'}
        </button>
      </div>
    </form>
  )
}

function FormSection({ title, children }) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <div className="border-b border-gray-200 bg-gray-50/50 px-6 py-4">
        <h3 className="text-base font-semibold text-gray-900">{title}</h3>
      </div>
      <div className="p-6">{children}</div>
    </section>
  )
}

function Field({ label, required, className = '', children }) {
  return (
    <label className={`block text-sm font-medium leading-6 text-gray-900 ${className}`}>
      <span className="mb-1.5 block">
        {label}
        {required ? <span className="text-red-500 ml-1">*</span> : null}
      </span>
      {children}
    </label>
  )
}

export default InvoiceForm
