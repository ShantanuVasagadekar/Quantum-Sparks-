import { useState, useEffect } from 'react'
import api from '../api/client'

function ProfilePage() {
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    business_name: '',
    owner_name: '',
    gst_number: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    algo_wallet_address: ''
  })

  useEffect(() => {
    fetchProfile()
  }, [])

  async function fetchProfile() {
    try {
      const res = await api.get('/auth/me')
      setForm((prev) => ({
        ...prev,
        ...res.data
      }))
    } catch (err) {
      setError('Failed to fetch profile info.')
    } finally {
      setFetching(false)
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const payload = { ...form }
      if (!payload.gst_number) delete payload.gst_number
      await api.put('/auth/profile', payload)
      setSuccess('Profile updated successfully.')
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to update profile.')
    } finally {
      setLoading(false)
    }
  }

  const handleInput = (key) => (e) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }))
  }

  if (fetching) return <div className="p-4">Loading profile...</div>

  const indianStates = [
    "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal", "Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Lakshadweep", "Puducherry"
  ];

  return (
    <section className="space-y-6 max-w-4xl mx-auto">
      <div className="mb-2 border-b border-gray-200 pb-4">
        <h2 className="text-2xl font-bold text-gray-900">Business Profile</h2>
        <p className="mt-1 text-sm text-gray-500">Update your business details and GST information.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden p-6">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          
          <label className="block text-sm font-medium leading-6 text-gray-900">
            Business Name <span className="text-red-500">*</span>
            <input required value={form.business_name || ''} onChange={handleInput('business_name')} className="mt-2 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" />
          </label>
          
          <label className="block text-sm font-medium leading-6 text-gray-900">
            Owner Name
            <input value={form.owner_name || ''} onChange={handleInput('owner_name')} className="mt-2 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" />
          </label>
          
          <label className="block text-sm font-medium leading-6 text-gray-900">
            GST Number (22AAAAA0000A1Z5)
            <input value={form.gst_number || ''} onChange={handleInput('gst_number')} placeholder="Optional valid GST" className="mt-2 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" />
          </label>
          
          <label className="block text-sm font-medium leading-6 text-gray-900">
            Phone Number
            <input value={form.phone || ''} onChange={handleInput('phone')} className="mt-2 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" />
          </label>
          
          <label className="block text-sm font-medium leading-6 text-gray-900 md:col-span-2">
            Address
            <input value={form.address || ''} onChange={handleInput('address')} className="mt-2 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" />
          </label>

          <label className="block text-sm font-medium leading-6 text-gray-900">
            City
            <input value={form.city || ''} onChange={handleInput('city')} className="mt-2 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" />
          </label>

          <label className="block text-sm font-medium leading-6 text-gray-900">
            State <span className="text-red-500">* (Required for GST rules)</span>
            <select required value={form.state || ''} onChange={handleInput('state')} className="mt-2 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500">
              <option value="" disabled>Select state</option>
              {indianStates.map(st => <option key={st} value={st}>{st}</option>)}
            </select>
          </label>

          <label className="block text-sm font-medium leading-6 text-gray-900">
            Pincode
            <input value={form.pincode || ''} onChange={handleInput('pincode')} className="mt-2 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" />
          </label>

          <label className="block text-sm font-medium leading-6 text-gray-900">
            Algorand Wallet Address
            <input value={form.algo_wallet_address || ''} onChange={handleInput('algo_wallet_address')} className="mt-2 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" />
          </label>

        </div>

        {error && <p className="text-sm font-medium text-red-600">{error}</p>}
        {success && <p className="text-sm font-medium text-green-600">{success}</p>}

        <div className="flex justify-end border-t border-gray-200 pt-5">
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Save Profile'}
          </button>
        </div>
      </form>
    </section>
  )
}

export default ProfilePage
