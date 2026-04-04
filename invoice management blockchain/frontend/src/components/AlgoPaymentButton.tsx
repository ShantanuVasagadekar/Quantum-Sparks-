import { useState } from 'react'
import api from '../api/client'
import { useWallet } from '../wallet/useWallet'

let algosdkLoadingPromise: Promise<any> | null = null

function loadBrowserAlgodSdk() {
  if (typeof window === 'undefined') return Promise.reject(new Error('Window is not available'))
  if ((window as any).algosdk) return Promise.resolve((window as any).algosdk)
  if (!algosdkLoadingPromise) {
    algosdkLoadingPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = 'https://cdn.jsdelivr.net/npm/algosdk@3.5.2/dist/browser/algosdk.min.js'
      script.async = true
      script.onload = () => resolve((window as any).algosdk)
      script.onerror = () => reject(new Error('Failed to load Algorand SDK'))
      document.body.appendChild(script)
    })
  }
  return algosdkLoadingPromise
}

function toByteArray(value: any) {
  if (value instanceof Uint8Array) return value
  if (typeof value === 'string') {
    const binary = atob(value)
    return Uint8Array.from(binary, (c) => c.charCodeAt(0))
  }
  return new Uint8Array(value)
}

export default function AlgoPaymentButton({ invoice, onPaid, apiOverride, portalToken }: { invoice: any, onPaid?: () => void, apiOverride?: any, portalToken?: string }) {
  const { isConnected, walletAddress, connectWallet, signTransactions } = useWallet()
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')

  const requestApi = apiOverride || api

  async function handlePay() {
    try {
      setError('')
      setStatus('pending')

      const algosdk: any = await loadBrowserAlgodSdk()
      const algodClient = new algosdk.Algodv2(
        import.meta.env.VITE_ALGO_NODE_TOKEN || '',
        import.meta.env.VITE_ALGO_NODE_URL || 'https://testnet-api.algonode.cloud',
        import.meta.env.VITE_ALGO_NODE_PORT || 443
      )

      const sender = isConnected ? walletAddress : await connectWallet()
      if (!sender) throw new Error('Wallet connection required')

      const receiver = import.meta.env.VITE_ALGO_BUSINESS_WALLET || import.meta.env.VITE_ALGORAND_BUSINESS_WALLET
      if (!receiver) throw new Error('Business wallet address is not configured')

      const amountMicroAlgos = Math.round(Number(invoice.outstanding_amount) * 1_000_000)
      const noteAsBase64 = btoa(String(invoice.id))
      const suggestedParams = await algodClient.getTransactionParams().do()
      const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        from: sender,
        to: receiver,
        amount: amountMicroAlgos,
        note: new TextEncoder().encode(noteAsBase64),
        suggestedParams
      })

      const signed = await signTransactions([[{ txn, signers: [sender] }]])
      const signedBlobs = Array.isArray(signed) ? signed.map(toByteArray) : [toByteArray(signed)]
      const submitResult = await algodClient.sendRawTransaction(signedBlobs).do()

      if (portalToken) {
         await requestApi.post(`/portal/${portalToken}/crypto-pay`, {
           txn_id: submitResult.txId
         })
      } else {
         await requestApi.post('/payments/crypto', {
           invoice_id: invoice.id,
           txn_id: submitResult.txId
         })
      }

      setStatus('confirmed')
      if (onPaid) await onPaid()
    } catch (err: any) {
      setStatus('failed')
      setError(err?.response?.data?.error || err?.message || 'ALGO payment failed')
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handlePay}
        disabled={status === 'pending'}
        className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 disabled:opacity-50"
      >
        {status === 'pending' ? 'Processing ALGO...' : 'Pay with ALGO'}
      </button>
      {status === 'confirmed' ? <span className="text-xs font-medium text-emerald-700">Confirmed</span> : null}
      {status === 'failed' ? <span className="text-xs font-medium text-red-600">{error}</span> : null}
    </div>
  )
}
