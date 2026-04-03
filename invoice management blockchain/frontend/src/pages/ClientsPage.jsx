import { useEffect, useState } from 'react'
import api from '../api/client'
import { SkeletonRow } from '../components/Skeletons'

function ClientsPage({ refreshToken }) {
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      try {
        const res = await api.get('/clients')
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
  }, [refreshToken])

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">My Clients</h2>
        <p className="text-sm text-gray-400">Keep your customer contact details in one place.</p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        {loading ? (
          <div>
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </div>
        ) : clients.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-base font-medium text-gray-700">No clients added yet</p>
            <p className="text-sm text-gray-400">Add a client while creating your first invoice.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead>
                <tr className="bg-gray-50/50 text-left text-gray-500">
                  <th className="py-3 pl-6 pr-4 font-semibold">Name</th>
                  <th className="py-3 px-4 font-semibold">Company</th>
                  <th className="py-3 px-4 font-semibold">Phone</th>
                  <th className="py-3 px-4 font-semibold">Email</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {clients.map((client) => (
                  <tr key={client.id} className="transition-colors hover:bg-gray-50/50">
                    <td className="py-4 pl-6 pr-4 font-medium text-gray-900">{client.name}</td>
                    <td className="py-4 px-4 text-gray-600">{client.company_name || '-'}</td>
                    <td className="py-4 px-4 text-gray-500">{client.phone || '-'}</td>
                    <td className="py-4 px-4 text-gray-500">{client.email || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      </div>
    </section>
  )
}

export default ClientsPage
