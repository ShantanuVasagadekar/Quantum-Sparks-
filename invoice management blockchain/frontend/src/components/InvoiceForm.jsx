import { useEffect, useMemo, useState } from 'react'
import api from '../api/client'

function createLineItem(gst = 0) {
  return {
    _id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    description: '',
    quantity: 1,
    unit_price: 0,
    gst_percent: gst,
  }
}

function InvoiceForm({ onSuccess, invoice }) {
  const [clients, setClients] = useState([])
  const [clientMode, setClientMode] = useState('existing')
  const [clientSearch, setClientSearch] = useState('')
  const [searchingClients, setSearchingClients] = useState(false)
  const [newClient, setNewClient] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    state: '',
    gst_number: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const isEdit = Boolean(invoice)

  const [form, setForm] = useState(() => {
    if (isEdit) {
      return {
        client_id: invoice.client_id || '',
        invoice_number: invoice.invoice_number,
        title: invoice.title || '',
        description: invoice.description || '',
        issue_date: (invoice.issue_date || invoice.created_at || '').slice(0, 10),
        due_date: (invoice.due_date || '').slice(0, 10),
        discount_amount: invoice.discount_amount || 0,
        business_name: invoice.metadata?.business?.business_name || '',
        gst_number: invoice.metadata?.business?.gst_number || '',
        address: invoice.metadata?.business?.address || '',
        email: invoice.metadata?.business?.email || '',
        phone: invoice.metadata?.business?.phone || '',
        default_gst_percent: invoice.line_items?.[0]?.gst_percent || 18,
        terms: invoice.metadata?.terms || '',
        notes: invoice.metadata?.notes || '',
        payment_mode: invoice.metadata?.payment_mode || 'Bank Transfer',
        line_items: invoice.line_items && invoice.line_items.length > 0 
          ? invoice.line_items.map((item) => ({ 
              _id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              ...item 
            }))
          : [createLineItem(18)]
      }
    }
    return {
      client_id: '',
      invoice_number: `INV-${Date.now().toString().slice(-6)}`,
      title: '',
      description: '',
      issue_date: new Date().toISOString().slice(0, 10),
      due_date: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
      discount_amount: 0,
      business_name: '',
      gst_number: '',
      address: '',
      email: '',
      phone: '',
      default_gst_percent: 18,
      terms: '',
      notes: '',
      payment_mode: 'Bank Transfer',
      line_items: [createLineItem(18)]
    }
  })

  useEffect(() => {
    if (isEdit && invoice.client_id && clients.length === 0) {
       // Seed clients if we have an existing selected client
       api.get(`/clients/${invoice.client_id}`).then((res) => {
          setClients([res.data])
       }).catch(() => {})
    }
  }, [isEdit, invoice, clients.length])

  useEffect(() => {
    let cancelled = false
    setSearchingClients(true)
    const timer = setTimeout(async () => {
      try {
        const res = await api.get('/clients', { params: { search: clientSearch } })
        if (!cancelled) {
          setClients((prev) => {
             const existIds = new Set(res.data.map(c => c.id));
             const toKeep = prev.filter(c => c.id === form.client_id && !existIds.has(c.id));
             return [...toKeep, ...res.data];
          })
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setSearchingClients(false)
      }
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [clientSearch, form.client_id])

  useEffect(() => {
    api.get('/auth/me').then((res) => {
      setForm((prev) => ({
        ...prev,
        business_name: prev.business_name || res.data.business_name || '',
        gst_number: prev.gst_number || res.data.gst_number || '',
        address: prev.address || res.data.address || '',
        email: prev.email || res.data.email || '',
        phone: prev.phone || res.data.phone || '',
      }))
    }).catch(() => {})
  }, [])

  const selectedClient = useMemo(() => clients.find((c) => c.id === form.client_id), [clients, form.client_id])

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
      let finalClientId = form.client_id
      if (clientMode === 'new') {
        const createdClient = await api.post('/clients', {
          name: newClient.name,
          email: newClient.email || null,
          phone: newClient.phone || null,
          address: newClient.address || null,
          state: newClient.state || null,
          gst_number: newClient.gst_number || null,
          company_name: newClient.name,
        })
        finalClientId = createdClient.data.id
      }
      if (clientMode === 'existing' && !finalClientId) {
        throw new Error('Please select an existing client.')
      }

      const payload = {
        ...form,
        client_id: finalClientId,
        discount_amount: Number(form.discount_amount || 0),
        line_items: form.line_items.map((item) => ({
          description: item.description,
          quantity: Number(item.quantity),
          unit_price: Number(item.unit_price),
          gst_percent: Number(item.gst_percent)
        })),
        metadata: {
          notes: form.notes || null,
          terms: form.terms || null,
          payment_mode: form.payment_mode || null,
          business: {
            business_name: form.business_name || null,
            gst_number: form.gst_number || null,
            address: form.address || null,
            email: form.email || null,
            phone: form.phone || null,
          }
        }
      }

      if (isEdit) {
        await api.put(`/invoices/${invoice.id}`, payload)
        if (window.showToast) window.showToast('Invoice updated successfully!', 'success')
      } else {
        await api.post('/invoices', payload)
        if (window.showToast) window.showToast('Invoice created successfully!', 'success')
      }
      
      if (onSuccess) onSuccess()
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to create invoice.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <FormSection title="Client Details">
        <div className="mb-4 inline-flex rounded-md border border-gray-300 p-1 text-sm">
          <button type="button" onClick={() => setClientMode('existing')} className={`rounded px-3 py-1.5 ${clientMode === 'existing' ? 'bg-indigo-600 text-white' : 'text-gray-700'}`}>
            Select Existing Client
          </button>
          <button type="button" onClick={() => setClientMode('new')} className={`rounded px-3 py-1.5 ${clientMode === 'new' ? 'bg-indigo-600 text-white' : 'text-gray-700'}`}>
            Add New Client
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {clientMode === 'existing' ? (
            <Field label="Client" required>
              <input
                value={clientSearch}
                onChange={(e) => {
                  setClientSearch(e.target.value)
                  setForm((prev) => ({ ...prev, client_id: '' }))
                }}
                placeholder="Search client by name/email"
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
              <div className="mt-2 max-h-44 overflow-auto rounded-md border border-gray-200">
                {searchingClients ? <p className="p-2 text-xs text-gray-500">Searching...</p> : null}
                {!searchingClients && clients.length === 0 ? <p className="p-2 text-xs text-gray-500">No clients found.</p> : null}
                {clients.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setForm((prev) => ({ ...prev, client_id: c.id }))
                      setClientSearch(`${c.name}${c.email ? ` (${c.email})` : ''}`)
                    }}
                    className={`w-full border-b border-gray-100 px-3 py-2 text-left text-sm hover:bg-gray-50 ${form.client_id === c.id ? 'bg-indigo-50' : ''}`}
                  >
                    <span className="font-medium text-gray-900">{c.name}</span>
                    <span className="ml-2 text-xs text-gray-500">{c.email || 'No email'}</span>
                  </button>
                ))}
              </div>
              {selectedClient ? <p className="mt-1 text-xs text-emerald-700">Selected: {selectedClient.name}</p> : null}
            </Field>
          ) : (
            <>
              <Field label="Client Name" required>
                <input required value={newClient.name} onChange={(e) => setNewClient((p) => ({ ...p, name: e.target.value }))} className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" />
              </Field>
              <Field label="Client Email">
                <input type="email" value={newClient.email} onChange={(e) => setNewClient((p) => ({ ...p, email: e.target.value }))} className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" />
              </Field>
              <Field label="Client Phone">
                <input value={newClient.phone} onChange={(e) => setNewClient((p) => ({ ...p, phone: e.target.value }))} className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" />
              </Field>
              <Field label="Client GST Number">
                <input value={newClient.gst_number} onChange={(e) => setNewClient((p) => ({ ...p, gst_number: e.target.value }))} className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" />
              </Field>
              <Field label="Client Address" className="md:col-span-2">
                <input value={newClient.address} onChange={(e) => setNewClient((p) => ({ ...p, address: e.target.value }))} className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" />
              </Field>
              <Field label="Client State (Required for GST)" required className="md:col-span-2">
                <input required value={newClient.state} onChange={(e) => setNewClient((p) => ({ ...p, state: e.target.value }))} className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" placeholder="e.g. Maharashtra" />
              </Field>
            </>
          )}

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
            <div key={item._id} className="grid grid-cols-1 gap-3 rounded-md border border-gray-200 bg-gray-50/50 p-4 md:grid-cols-4">
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
            onClick={() => setForm((prev) => ({ ...prev, line_items: [...prev.line_items, createLineItem(Number(form.default_gst_percent || 0))] }))}
            className="rounded-md bg-white px-3.5 py-2 text-sm font-semibold text-gray-700 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 mt-2"
          >
            + Add Line Item
          </button>
        </div>
      </FormSection>

      <FormSection title="Business + Tax + Terms">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Business Name" required>
            <input required value={form.business_name} onChange={(e) => setForm((prev) => ({ ...prev, business_name: e.target.value }))} className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" />
          </Field>
          <Field label="GST Number">
            <input value={form.gst_number} onChange={(e) => setForm((prev) => ({ ...prev, gst_number: e.target.value }))} className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" />
          </Field>
          <Field label="Business Email">
            <input type="email" value={form.email} onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))} className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" />
          </Field>
          <Field label="Business Phone">
            <input value={form.phone} onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))} className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" />
          </Field>
          <Field label="Business Address" className="md:col-span-2">
            <input value={form.address} onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))} className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" />
          </Field>
          <Field label="Default GST %" className="md:col-span-2">
            <input type="number" min="0" step="1" value={form.default_gst_percent} onChange={(e) => {
              const next = Number(e.target.value || 0)
              setForm((prev) => ({
                ...prev,
                default_gst_percent: next,
                line_items: prev.line_items.map((item) => ({ ...item, gst_percent: next }))
              }))
            }} className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" />
          </Field>
          <Field label="Preferred Payment Mode" className="md:col-span-2">
            <select value={form.payment_mode} onChange={(e) => setForm((prev) => ({ ...prev, payment_mode: e.target.value }))} className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500">
              <option value="Bank Transfer">Bank Transfer</option>
              <option value="UPI">UPI</option>
              <option value="Cash">Cash</option>
              <option value="Algorand Crypto">Algorand Crypto</option>
              <option value="Other">Other</option>
            </select>
          </Field>
          <Field label="Notes" className="md:col-span-2">
            <textarea rows={3} value={form.notes} onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))} className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" />
          </Field>
          <Field label="Terms" className="md:col-span-2">
            <textarea rows={3} value={form.terms} onChange={(e) => setForm((prev) => ({ ...prev, terms: e.target.value }))} className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" />
          </Field>
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
