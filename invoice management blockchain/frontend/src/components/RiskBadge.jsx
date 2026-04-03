const classes = {
  'Low Risk': 'bg-emerald-900/30 text-emerald-300 border-emerald-700',
  'Medium Risk': 'bg-amber-900/30 text-amber-300 border-amber-700',
  'High Risk': 'bg-rose-900/30 text-rose-300 border-rose-700'
}

function levelFromScore(score) {
  if (Number(score) < 31) return 'Low Risk'
  if (Number(score) < 61) return 'Medium Risk'
  return 'High Risk'
}

function RiskBadge({ riskLevel, riskScore, showBar = false }) {
  const level = riskLevel || levelFromScore(riskScore)
  const style = classes[level] || classes['Low Risk']
  return (
    <div>
      <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${style}`}>
        Payment Risk
        <span className="opacity-80">{riskScore}</span>
      </span>
      {showBar && (
        <>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-700">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                Number(riskScore) < 31 ? 'bg-emerald-400' : Number(riskScore) < 61 ? 'bg-amber-400' : 'bg-rose-400'
              }`}
              style={{ width: `${Math.max(0, Math.min(100, Number(riskScore || 0)))}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-slate-400">{level}</p>
        </>
      )}
    </div>
  )
}

export default RiskBadge
