const STATUS_CONFIG = {
  draft: { dot: 'bg-gray-400', bg: 'bg-gray-50', text: 'text-gray-700', ring: 'ring-gray-500/10', label: 'Draft' },
  sent: { dot: 'bg-blue-400', bg: 'bg-blue-50', text: 'text-blue-700', ring: 'ring-blue-700/10', label: 'Sent' },
  partial: { dot: 'bg-yellow-400', bg: 'bg-yellow-50', text: 'text-yellow-800', ring: 'ring-yellow-600/20', label: 'Partly Paid' },
  paid: { dot: 'bg-green-400', bg: 'bg-green-50', text: 'text-green-700', ring: 'ring-green-600/20', label: 'Paid' },
  overdue: { dot: 'bg-red-400', bg: 'bg-red-50', text: 'text-red-700', ring: 'ring-red-600/10', label: 'Overdue' },
  cancelled: { dot: 'bg-gray-400', bg: 'bg-gray-100', text: 'text-gray-600', ring: 'ring-gray-500/10', label: 'Cancelled' }
}

export function StatusBadge({ status }) {
  const state = STATUS_CONFIG[status] || STATUS_CONFIG.draft
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${state.bg} ${state.text} ${state.ring}`}>
      <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${state.dot}`} />
      {state.label}
    </span>
  )
}

export default StatusBadge
