import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import api from '../api/client'
import { useWallet } from '../wallet/useWallet'

function shortAddress(address) {
  if (!address || address.length < 10) return address || ''
  return `${address.slice(0, 4)}...${address.slice(-3)}`
}

export default function TopBar() {
  const { isConnected, walletAddress, isConnecting, connectWallet, disconnectWallet } = useWallet()
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState('')
  const location = useLocation()
  const navigate = useNavigate()
  const [searchInput, setSearchInput] = useState('')
  const searchEnabled = location.pathname.startsWith('/invoices') || location.pathname.startsWith('/clients')

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    setSearchInput(params.get('search') || '')
  }, [location.search])

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!searchEnabled) return
      const params = new URLSearchParams(location.search)
      if (searchInput.trim()) params.set('search', searchInput.trim())
      else params.delete('search')
      navigate(`${location.pathname}${params.toString() ? `?${params.toString()}` : ''}`, { replace: true })
    }, 300)
    return () => clearTimeout(timeout)
  }, [searchInput, searchEnabled, location.pathname, location.search, navigate])

  async function handleConnect() {
    try {
      setError('')
      const address = await connectWallet()
      if (!address) return
      setSyncing(true)
      await api.patch('/users/me/wallet', { wallet_address: address })
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Unable to connect wallet.')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <header className="h-16 flex-shrink-0 bg-white border-b border-gray-200 flex items-center justify-between px-8 shadow-sm">
      <div className="flex-1 flex items-center">
        <div className="relative w-96">
          <input
            type="text"
            placeholder={searchEnabled ? 'Search invoices or clients...' : 'Search available in Invoices and Clients'}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full h-9 rounded-md border border-gray-300 pl-10 pr-4 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-gray-900 placeholder-gray-500"
            disabled={!searchEnabled}
          />
          <svg className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        </div>
      </div>
      <div className="flex items-center gap-4">
        {error ? <span className="text-xs text-red-600">{error}</span> : null}
        {isConnected ? (
          <>
            <span className="text-sm font-medium text-gray-700">{shortAddress(walletAddress)}</span>
            <button
              onClick={disconnectWallet}
              className="rounded-md bg-white px-3 py-1.5 text-sm font-semibold text-gray-700 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
            >
              Disconnect
            </button>
          </>
        ) : (
          <button
            onClick={handleConnect}
            disabled={isConnecting || syncing}
            className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
          >
            {isConnecting || syncing ? 'Connecting...' : 'Connect Wallet'}
          </button>
        )}
        <NavLink to="/profile" className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center border border-indigo-200 hover:bg-indigo-200 transition-colors" title="My Profile">
          <span className="text-sm font-medium text-indigo-700">⚙️</span>
        </NavLink>
      </div>
    </header>
  )
}
