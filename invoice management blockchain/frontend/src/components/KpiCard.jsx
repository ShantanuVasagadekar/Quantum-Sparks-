import { formatCurrency } from '../utils/format'

function KpiCard({ label, value, className }) {
  return (
    <div className={`rounded-2xl border border-white/60 bg-white p-4 shadow-sm ${className || ''}`}>
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{formatCurrency(value)}</p>
    </div>
  )
}

export default KpiCard
