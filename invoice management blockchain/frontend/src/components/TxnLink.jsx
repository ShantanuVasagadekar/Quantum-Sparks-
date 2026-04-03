function shortTxn(txnId) {
  if (!txnId || txnId.length < 14) return txnId || '-'
  return `${txnId.slice(0, 8)}...${txnId.slice(-6)}`
}

export default function TxnLink({ txnId }) {
  if (!txnId) return <span>-</span>
  const base = import.meta.env.VITE_ALGO_EXPLORER_BASE_URL || 'https://testnet.algoexplorer.io/tx/'
  return (
    <a href={`${base}${txnId}`} target="_blank" rel="noreferrer" className="font-mono text-xs text-indigo-600 hover:text-indigo-500">
      {shortTxn(txnId)}
    </a>
  )
}
