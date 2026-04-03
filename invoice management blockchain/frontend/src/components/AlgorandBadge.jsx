export default function AlgorandBadge({ show }) {
  if (!show) return null
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-green-50 px-2 py-1 text-xs font-semibold text-green-700 ring-1 ring-inset ring-green-600/20">
      <span>⛓</span>
      Verified on Algorand
    </span>
  )
}
