const STATUS_CONFIG = {
  draft: { dot: 'bg-slate-400', bg: 'bg-slate-700/40', text: 'text-slate-300', label: 'Draft' },
  sent: { dot: 'bg-blue-400', bg: 'bg-blue-900/30', text: 'text-blue-300', label: 'Sent' },
  partial: { dot: 'bg-amber-400', bg: 'bg-amber-900/30', text: 'text-amber-300', label: 'Partly Paid' },
  paid: { dot: 'bg-emerald-400', bg: 'bg-emerald-900/30', text: 'text-emerald-300', label: 'Paid' },
  overdue: { dot: 'bg-rose-400', bg: 'bg-rose-900/30', text: 'text-rose-300', label: 'Overdue' },
  cancelled: { dot: 'bg-slate-400', bg: 'bg-slate-700/40', text: 'text-slate-300', label: 'Cancelled' }
}

export function StatusBadge({ status }) {
  const state = STATUS_CONFIG[status] || STATUS_CONFIG.draft
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border border-slate-600 px-2.5 py-1 text-xs font-medium ${state.bg} ${state.text}`}>
      <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${state.dot}`} />
      {state.label}
    </span>
  )
}

export default StatusBadge
