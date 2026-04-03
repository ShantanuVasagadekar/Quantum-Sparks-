import { formatCurrency, formatDateTime } from '../utils/format'

function TimelineModal({ title, timeline, onClose }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          <button onClick={onClose} className="rounded-md border border-slate-300 px-2 py-1 text-sm">
            Close
          </button>
        </div>

        <div className="mt-5 max-h-[60vh] overflow-auto pr-2">
          <ol className="relative border-s border-slate-200 pl-4">
            {timeline.map((item, index) => (
              <li key={`${item.type}-${item.at}-${index}`} className="mb-5 ms-3">
                <span className="absolute -start-1.5 mt-1.5 h-3 w-3 rounded-full bg-blue-600" />
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                  <p className="mt-1 text-xs text-slate-500">{formatDateTime(item.at)}</p>
                  <TimelineMeta meta={item.meta} />
                </div>
              </li>
            ))}
            {timeline.length === 0 && <p className="text-sm text-slate-500">No timeline events yet</p>}
          </ol>
        </div>
      </div>
    </div>
  )
}

function TimelineMeta({ meta }) {
  if (!meta) return null
  const entries = Object.entries(meta).filter(([, value]) => value !== null && value !== undefined)
  if (entries.length === 0) return null

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {entries.map(([key, value]) => {
        const val = key.includes('amount') ? formatCurrency(value) : String(value)
        return (
          <span key={key} className="rounded-md bg-white px-2 py-1 text-[11px] text-slate-600">
            {key}: {val}
          </span>
        )
      })}
    </div>
  )
}

export default TimelineModal
