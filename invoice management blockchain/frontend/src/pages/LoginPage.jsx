import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/client'
import { setToken } from '../api/auth'

export default function LoginPage() {
  const navigate = useNavigate()
  const [isSignup, setIsSignup] = useState(false)
  const [form, setForm] = useState({ email: '', password: '', business_name: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const endpoint = isSignup ? '/auth/signup' : '/auth/login'
      const body = isSignup ? form : { email: form.email, password: form.password }
      const res = await api.post(endpoint, body)
      setToken(res.data.token)
      navigate('/')
    } catch (err) {
      setError(err.response?.data?.error || 'Request failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-sm rounded-xl border border-slate-700 bg-slate-900 p-6">
        <h1 className="mb-1 text-2xl font-semibold text-white">
          {isSignup ? 'Create Account' : 'Sign In'}
        </h1>
        <p className="mb-6 text-sm text-slate-400">
          {isSignup ? 'Register to start tracking invoices' : 'Enter your credentials'}
        </p>

        {error && (
          <div className="mb-4 rounded-md border border-red-900 bg-red-950/50 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-400 focus:border-slate-500 focus:outline-none"
          />
          <input
            type="password"
            placeholder="Password (min 8 chars)"
            required
            minLength={8}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-400 focus:border-slate-500 focus:outline-none"
          />

          {isSignup && (
            <input
              type="text"
              placeholder="Business Name"
              required
              value={form.business_name}
              onChange={(e) => setForm({ ...form, business_name: e.target.value })}
              className="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-400 focus:border-slate-500 focus:outline-none"
            />
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-slate-100 py-2 text-sm font-medium text-slate-900 hover:bg-white disabled:opacity-50"
          >
            {loading ? 'Please wait...' : isSignup ? 'Sign Up' : 'Sign In'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-slate-400">
          {isSignup ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button
            onClick={() => { setIsSignup(!isSignup); setError('') }}
            className="text-slate-200 underline hover:text-white"
          >
            {isSignup ? 'Sign In' : 'Sign Up'}
          </button>
        </p>
      </div>
    </div>
  )
}
