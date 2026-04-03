import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import api from '../api/client'
import { SkeletonRow } from '../components/Skeletons'

function ClientsPage({ refreshToken }) {
  const location = useLocation()
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', company_name: '', email: '', phone: '', state: '' })
  const [formLoading, setFormLoading] = useState(false)
  const [formError, setFormError] = useState('')
  const [sortBy, setSortBy] = useState('name')
  const [sortDir, setSortDir] = useState('asc')
  const [page, setPage] = useState(1)
  const pageSize = 12

  useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      try {
        const params = new URLSearchParams(location.search)
        const search = params.get('search') || ''
        const res = await api.get('/clients', { params: { search } })
        if (mounted) {
          setClients(res.data)
          setError('')
        }
      } catch (err) {
        if (mounted) {
          setError(err.response?.data?.error || 'Could not load clients')
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }
    load()
    return () => {
      mounted = false
    }
  }, [refreshToken, location.search])

  async function handleCreateClient(e) {
    e.preventDefault()
    setFormLoading(true)
    setFormError('')
    try {
      const res = await api.post('/clients', form)
      setClients(prev => [res.data, ...prev])
      setShowForm(false)
      setForm({ name: '', company_name: '', email: '', phone: '', state: '' })
    } catch (err) {
      setFormError(err.response?.data?.error || 'Unable to create client')
    } finally {
      setFormLoading(false)
    }
  }

  const indianStates = [
    "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal", "Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Lakshadweep", "Puducherry"
  ];

  const sortedClients = [...clients].sort((a, b) => {
    const av = String(a[sortBy] || '')
    const bv = String(b[sortBy] || '')
    if (av < bv) return sortDir === 'asc' ? -1 : 1
    if (av > bv) return sortDir === 'asc' ? 1 : -1
    return 0
  })
  const totalPages = Math.max(1, Math.ceil(sortedClients.length / pageSize))
  const currentRows = sortedClients.slice((page - 1) * pageSize, page * pageSize)

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">My Clients</h2>
          <p className="text-sm text-gray-400">Keep your customer contact details in one place.</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm">
            <option value="name">Sort: Name</option>
            <option value="state">Sort: State</option>
            <option value="email">Sort: Email</option>
          </select>
          <button onClick={() => setSortDir((d) => d === 'asc' ? 'desc' : 'asc')} className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm">
            {sortDir === 'asc' ? 'Asc' : 'Desc'}
          </button>
          <button
            onClick={() => setShowForm(!showForm)}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
          >
            {showForm ? 'Cancel' : '+ Add Client'}
          </button>
        </div>
      </div>

      {showForm && (
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <form onSubmit={handleCreateClient} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="block text-sm font-medium text-gray-700">
                Client Name <span className="text-red-500">*</span>
                <input required value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} className="mt-1 block w-full rounded-md border border-gray-300 py-2 px-3 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:text-sm" />
              </label>
              <label className="block text-sm font-medium text-gray-700">
                State <span className="text-red-500">* (Required for GST)</span>
                <select required value={form.state} onChange={e => setForm(f => ({...f, state: e.target.value}))} className="mt-1 block w-full rounded-md border border-gray-300 py-2 px-3 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:text-sm text-gray-900 bg-white">
                  <option value="" disabled>Select state</option>
                  {indianStates.map(st => <option key={st} value={st}>{st}</option>)}
                </select>
              </label>
              <label className="block text-sm font-medium text-gray-700">
                Company Name
                <input value={form.company_name} onChange={e => setForm(f => ({...f, company_name: e.target.value}))} className="mt-1 block w-full rounded-md border border-gray-300 py-2 px-3 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:text-sm" />
              </label>
              <label className="block text-sm font-medium text-gray-700">
                Email
                <input type="email" value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))} className="mt-1 block w-full rounded-md border border-gray-300 py-2 px-3 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:text-sm" />
              </label>
            </div>
            {formError && <p className="text-sm text-red-600">{formError}</p>}
            <button type="submit" disabled={formLoading} className="rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-gray-800 disabled:opacity-50">
              {formLoading ? 'Saving...' : 'Save Client'}
            </button>
          </form>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        {loading ? (
          <div>
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </div>
        ) : clients.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-base font-medium text-gray-700">
              {(new URLSearchParams(location.search).get('search') || '').trim() ? 'No results found' : 'No clients added yet'}
            </p>
            <p className="text-sm text-gray-400">
              {(new URLSearchParams(location.search).get('search') || '').trim()
                ? 'Try a different keyword.'
                : 'Add a client while creating your first invoice.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead>
                <tr className="bg-gray-50/50 text-left text-gray-500">
                  <th className="py-3 pl-6 pr-4 font-semibold">Name</th>
                  <th className="py-3 px-4 font-semibold">Company</th>
                  <th className="py-3 px-4 font-semibold">Phone</th>
                  <th className="py-3 px-4 font-semibold">State</th>
                  <th className="py-3 px-4 font-semibold">Email</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {currentRows.map((client) => (
                  <tr key={client.id} className="transition-colors hover:bg-gray-50/50">
                    <td className="py-4 pl-6 pr-4 font-medium text-gray-900">{client.name}</td>
                    <td className="py-4 px-4 text-gray-600">{client.company_name || '-'}</td>
                    <td className="py-4 px-4 text-gray-500">{client.phone || '-'}</td>
                    <td className="py-4 px-4 text-gray-500">{client.state || '-'}</td>
                    <td className="py-4 px-4 text-gray-500">{client.email || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
        {sortedClients.length > pageSize && (
          <div className="mt-4 flex items-center justify-end gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm disabled:opacity-50">Previous</button>
            <span className="text-sm text-gray-600">Page {page} of {totalPages}</span>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm disabled:opacity-50">Next</button>
          </div>
        )}
      </div>
    </section>
  )
}

export default ClientsPage
