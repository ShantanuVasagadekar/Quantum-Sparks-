import { createContext, useCallback, useEffect, useMemo, useState } from 'react'
import { PeraWalletConnect } from '@perawallet/connect'

const peraWallet = new PeraWalletConnect()
const WALLET_STORAGE_KEY = 'invoice_wallet_address'

export const WalletContext = createContext(null)

export function WalletProvider({ children }) {
  const [walletAddress, setWalletAddress] = useState(() => localStorage.getItem(WALLET_STORAGE_KEY) || '')
  const [isConnecting, setIsConnecting] = useState(false)

  const connectWallet = useCallback(async () => {
    setIsConnecting(true)
    try {
      const accounts = await peraWallet.connect()
      const nextAddress = accounts?.[0] || ''
      setWalletAddress(nextAddress)
      if (nextAddress) {
        localStorage.setItem(WALLET_STORAGE_KEY, nextAddress)
      }
      return nextAddress
    } finally {
      setIsConnecting(false)
    }
  }, [])

  const disconnectWallet = useCallback(() => {
    peraWallet.disconnect()
    setWalletAddress('')
    localStorage.removeItem(WALLET_STORAGE_KEY)
  }, [])

  const signTransactions = useCallback(async (txnGroups) => {
    return peraWallet.signTransaction(txnGroups)
  }, [])

  useEffect(() => {
    let isMounted = true
    peraWallet.reconnectSession().then((accounts) => {
      if (!isMounted) return
      const restoredAddress = accounts?.[0] || ''
      setWalletAddress(restoredAddress)
      if (restoredAddress) {
        localStorage.setItem(WALLET_STORAGE_KEY, restoredAddress)
      }
    }).catch(() => {})
    return () => {
      isMounted = false
    }
  }, [])

  const value = useMemo(() => ({
    isConnected: Boolean(walletAddress),
    walletAddress,
    isConnecting,
    connectWallet,
    disconnectWallet,
    signTransactions
  }), [walletAddress, isConnecting, connectWallet, disconnectWallet, signTransactions])

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
}
