import { useEffect, useState } from 'react'
import api from '../api/client'

const initialLineItem = { description: '', quantity: 1, unit_price: 0 }

function InvoiceForm({ onSuccess }) {
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    client_name: '',
    invoice_number: `INV-${Date.now().toString().slice(-6)}`,
    title: '',
    description: '',
    issue_date: new Date().toISOString().slice(0, 10),
    due_date: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    tax_amount: 0,
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
  const total = subtotal + Number(form.tax_amount || 0) - Number(form.discount_amount || 0)

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
        tax_amount: Number(form.tax_amount || 0),
        discount_amount: Number(form.discount_amount || 0),
        total_amount: Number(total.toFixed(2)),
        line_items: form.line_items.map((item) => ({
          description: item.description,
          quantity: Number(item.quantity),
          unit_price: Number(item.unit_price)
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
    <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-slate-700 bg-slate-900 p-5">
      <FormSection title="Client">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Field label="Client Name" required>
            <input
              required
              value={form.client_name || ''}
              onChange={(e) => setForm((prev) => ({ ...prev, client_name: e.target.value }))}
              placeholder="e.g. Acme Labs"
              className="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500"
            />
          </Field>

          <Field label="Invoice Number" required>
            <input
              required
              value={form.invoice_number}
              onChange={(e) => setForm((prev) => ({ ...prev, invoice_number: e.target.value }))}
              className="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100"
            />
          </Field>

          <Field label="Title" className="md:col-span-2">
            <input
              value={form.title}
              onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
              className="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100"
              placeholder="Monthly consulting services"
            />
          </Field>
        </div>
      </FormSection>

      <FormSection title="Items">
        <div className="space-y-3">
          {form.line_items.map((item, index) => (
            <div key={`${index}-${item.description}`} className="grid grid-cols-1 gap-3 rounded-md border border-slate-700 bg-slate-800 p-3 md:grid-cols-4">
              <Field label="Description" required className="md:col-span-2">
                <input
                  required
                  value={item.description}
                  onChange={(e) => updateLineItem(index, 'description', e.target.value)}
                  className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100"
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
                  className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100"
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
                  className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                />
              </Field>
            </div>
          ))}

          <button
            type="button"
            onClick={() => setForm((prev) => ({ ...prev, line_items: [...prev.line_items, { ...initialLineItem }] }))}
            className="rounded-md border border-slate-600 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
          >
            Add Line Item
          </button>
        </div>
      </FormSection>

      <FormSection title="Summary">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Field label="Issue Date">
            <input
              type="date"
              value={form.issue_date}
              onChange={(e) => setForm((prev) => ({ ...prev, issue_date: e.target.value }))}
              className="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100"
            />
          </Field>

          <Field label="Due Date" required>
            <input
              type="date"
              required
              value={form.due_date}
              onChange={(e) => setForm((prev) => ({ ...prev, due_date: e.target.value }))}
              className="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100"
            />
          </Field>

          <Field label="Tax Amount">
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.tax_amount}
              onChange={(e) => setForm((prev) => ({ ...prev, tax_amount: e.target.value }))}
              className="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100"
            />
          </Field>

          <Field label="Discount Amount">
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.discount_amount}
              onChange={(e) => setForm((prev) => ({ ...prev, discount_amount: e.target.value }))}
              className="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100"
            />
          </Field>
        </div>

        <div className="mt-3 rounded-md border border-slate-700 bg-slate-800 p-4">
          <div className="flex items-center justify-between text-sm text-slate-300">
            <span>Subtotal</span>
            <span>₹ {subtotal.toFixed(2)}</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-xl font-semibold text-white">
            <span>Total</span>
            <span>₹ {total.toFixed(2)}</span>
          </div>
        </div>
      </FormSection>

      {error && <p className="text-sm text-red-300">{error}</p>}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-slate-100 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-white disabled:opacity-50"
        >
          {loading ? 'Submitting...' : 'Create Invoice'}
        </button>
      </div>
    </form>
  )
}

function FormSection({ title, children }) {
  return (
    <section className="rounded-lg border border-slate-700 bg-slate-800 p-4">
      <h3 className="text-sm font-semibold text-white">{title}</h3>
      <div className="mt-3">{children}</div>
    </section>
  )
}

function Field({ label, required, className = '', children }) {
  return (
    <label className={`text-sm text-slate-300 ${className}`}>
      <span className="mb-1 block">
        {label}
        {required ? <span className="text-red-300"> *</span> : null}
      </span>
      {children}
    </label>
  )
}

export default InvoiceForm
