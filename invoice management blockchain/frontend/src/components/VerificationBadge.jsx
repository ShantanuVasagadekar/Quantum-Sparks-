/**
 * VerificationBadge — shows blockchain anchoring and verification state.
 * Keeps with the "Modern Finance" design: subtle, not flashy.
 */
export default function VerificationBadge({ invoice, verifyResult, loading }) {
  const txId = invoice?.algo_anchor_tx_id || invoice?.anchor_tx_id
  const isPlaceholder = !txId || txId.startsWith('PENDING_')
  const isSimulated  = txId?.startsWith('SIM_')
  const explorerUrl  = invoice?.anchor_explorer_url

  // If a live verification result is passed in, use it
  if (verifyResult) {
    if (verifyResult.result === 'VERIFIED') {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-md border border-green-200 bg-green-50 px-2 py-1 text-xs font-semibold text-[#16A34A]">
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Verified on Algorand
          {explorerUrl && (
            <a href={explorerUrl} target="_blank" rel="noopener noreferrer"
               className="ml-1 underline underline-offset-2 opacity-70 hover:opacity-100">
              View txn
            </a>
          )}
        </span>
      )
    }
    if (verifyResult.result === 'TAMPERED') {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs font-semibold text-[#DC2626]">
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
          </svg>
          TAMPERED — Data Modified
        </span>
      )
    }
    if (verifyResult.result === 'SIMULATED') {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-semibold text-[#F59E0B]">
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
          </svg>
          Simulated (testnet)
        </span>
      )
    }
  }

  if (loading) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-xs font-medium text-gray-500">
        <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
        Verifying…
      </span>
    )
  }

  // Static state from invoice fields (before any live verification)
  if (isPlaceholder) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-xs font-medium text-gray-500">
        <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
        Not Anchored
      </span>
    )
  }

  if (isSimulated) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
        Simulated
        {txId && (
          <span className="ml-1 font-mono text-[10px] opacity-70">{txId.slice(0, 12)}…</span>
        )}
      </span>
    )
  }

  // Real txId present
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-semibold text-[#2563EB]">
      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
      </svg>
      Anchored on Algorand
      {explorerUrl ? (
        <a href={explorerUrl} target="_blank" rel="noopener noreferrer"
           className="ml-1 underline underline-offset-2 opacity-70 hover:opacity-100 font-mono text-[10px]">
          {txId.slice(0, 10)}…
        </a>
      ) : (
        <span className="ml-1 font-mono text-[10px] opacity-60">{txId.slice(0, 10)}…</span>
      )}
    </span>
  )
}
