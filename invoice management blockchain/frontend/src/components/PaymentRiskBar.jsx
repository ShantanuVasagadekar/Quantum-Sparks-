export function PaymentRiskBar({ score }) {
  const safeScore = Math.max(0, Math.min(100, Number(score || 0)))
  const label = safeScore < 31 ? 'Low Risk' : safeScore < 61 ? 'Moderate Risk' : 'High Risk'
  const color = safeScore < 31 ? 'bg-green-500' : safeScore < 61 ? 'bg-amber-400' : 'bg-red-500'

  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-gray-400">
        <span>Payment Risk</span>
        <span>{label}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
        <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${safeScore}%` }} />
      </div>
    </div>
  )
}

export default PaymentRiskBar
