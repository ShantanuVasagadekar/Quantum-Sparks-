const STATUS_CONFIG = {
  draft:    { dot: 'bg-gray-400',    bg: 'bg-gray-50',   text: 'text-gray-600',   ring: 'ring-gray-200',   label: 'Draft' },
  sent:     { dot: 'bg-blue-400',    bg: 'bg-blue-50',   text: 'text-blue-700',   ring: 'ring-blue-200',   label: 'Sent' },
  accepted: { dot: 'bg-[#2563EB]',   bg: 'bg-blue-50',   text: 'text-[#2563EB]',  ring: 'ring-blue-300',   label: 'Accepted' },
  disputed: { dot: 'bg-orange-500',  bg: 'bg-orange-50', text: 'text-orange-700', ring: 'ring-orange-200', label: 'Queried' },
  partial:  { dot: 'bg-amber-500',   bg: 'bg-amber-50',  text: 'text-amber-700',  ring: 'ring-amber-200',  label: 'Partly Paid' },
  paid:     { dot: 'bg-[#16A34A]',   bg: 'bg-green-50',  text: 'text-[#16A34A]',  ring: 'ring-green-200',  label: 'Paid' },
  overdue:  { dot: 'bg-[#DC2626]',   bg: 'bg-red-50',    text: 'text-[#DC2626]',  ring: 'ring-red-200',    label: 'Overdue' },
  cancelled:{ dot: 'bg-gray-400',    bg: 'bg-gray-100',  text: 'text-gray-500',   ring: 'ring-gray-200',   label: 'Cancelled' },
}

export function StatusBadge({ status }) {
  const state = STATUS_CONFIG[status] || STATUS_CONFIG.draft
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold ring-1 ring-inset ${state.bg} ${state.text} ${state.ring}`}>
      <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${state.dot}`} />
      {state.label}
    </span>
  )
}

export default StatusBadge
