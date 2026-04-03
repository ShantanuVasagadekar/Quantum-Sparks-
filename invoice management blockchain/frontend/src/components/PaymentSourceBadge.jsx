export default function PaymentSourceBadge({ source, method }) {
  const isAlgorand = source === 'algorand' || method === 'algo'
  if (isAlgorand) {
    return <span className="inline-flex items-center rounded-md bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-700">Algorand</span>
  }
  return <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700">Manual</span>
}
