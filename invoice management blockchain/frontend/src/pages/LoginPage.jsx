import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import api from '../api/client'
import { setToken } from '../api/auth'
import authIllustration from '../assets/auth-illustration.png'

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
    <div className="flex min-h-screen bg-gray-50 font-sans text-gray-900">
      {/* Left side: Illustration */}
      <div className="hidden w-1/2 flex-col justify-between bg-indigo-50/50 p-12 lg:flex xl:p-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 to-blue-50"></div>
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-16">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600 shadow-sm">
              <span className="text-lg font-bold text-white">IM</span>
            </div>
            <span className="text-xl font-bold tracking-tight text-gray-900">Invoice Hub</span>
          </div>
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="mb-8"
          >
            <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 xl:text-5xl leading-tight">
              Manage your business <br className="hidden xl:block" /> finances seamlessly.
            </h1>
            <p className="mt-4 text-lg text-gray-600 max-w-lg">
              The premier platform for invoice tracking, collections, and financial clarity. Designed for modern SaaS teams.
            </p>
          </motion.div>
        </div>
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="relative z-10 flex-1 flex items-center justify-center mt-8"
        >
          {/* This uses the generated premium abstract illustration */}
          <img 
            src={authIllustration} 
            alt="Dashboard abstract illustration" 
            className="w-full h-auto max-h-[500px] object-contain drop-shadow-2xl opacity-90 mix-blend-multiply"
          />
        </motion.div>
      </div>

      {/* Right side: Auth Form */}
      <div className="flex w-full items-center justify-center px-4 lg:w-1/2 bg-white lg:px-12 xl:px-24">
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, type: 'spring', bounce: 0.3 }}
          className="w-full max-w-sm lg:max-w-md"
        >
          <div className="mb-10 text-left lg:hidden">
             <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-indigo-600 shadow-sm">
              <span className="text-xl font-bold text-white">IM</span>
            </div>
          </div>
          
          <div className="mb-8">
            <h2 className="text-3xl font-extrabold tracking-tight text-gray-900">
              {isSignup ? 'Create Account' : 'Welcome back'}
            </h2>
            <p className="mt-2 text-sm text-gray-500 font-medium">
              {isSignup ? 'Register to start tracking invoices.' : 'Sign in to access your business dashboard.'}
            </p>
          </div>

          <AnimatePresence mode="wait">
            {error && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }} 
                animate={{ opacity: 1, height: 'auto' }} 
                exit={{ opacity: 0, height: 0 }} 
                className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 shadow-sm"
              >
                <p className="font-semibold">{error}</p>
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-gray-700">Email Address</label>
              <input
                type="email"
                placeholder="you@company.com"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full rounded-lg border border-gray-300 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 shadow-sm transition-all focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 placeholder-gray-400"
              />
            </div>
            
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-gray-700">Password</label>
              <input
                type="password"
                placeholder="Min 8 characters"
                required
                minLength={8}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full rounded-lg border border-gray-300 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 shadow-sm transition-all focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 placeholder-gray-400"
              />
            </div>

            <AnimatePresence>
              {isSignup && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <label className="mb-1.5 block text-sm font-semibold text-gray-700 mt-5">Business Name</label>
                  <input
                    type="text"
                    placeholder="Acme Corporation"
                    required
                    value={form.business_name}
                    onChange={(e) => setForm({ ...form, business_name: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 shadow-sm transition-all focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 placeholder-gray-400"
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <div className="pt-4">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-indigo-600 px-4 py-3 text-sm font-bold text-white shadow-md hover:bg-indigo-500 focus:outline-none disabled:opacity-50 transition-colors"
              >
                {loading ? 'Please wait...' : isSignup ? 'Sign Up' : 'Sign In'}
              </motion.button>
            </div>
          </form>

          <p className="mt-8 text-center text-sm font-medium text-gray-500">
            {isSignup ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button
              onClick={() => { setIsSignup(!isSignup); setError('') }}
              className="font-bold text-indigo-600 hover:text-indigo-500 transition-colors"
            >
              {isSignup ? 'Sign in instead' : 'Sign up for free'}
            </button>
          </p>
        </motion.div>
      </div>
    </div>
  )
}

