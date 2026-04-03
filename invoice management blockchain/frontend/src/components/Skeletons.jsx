export function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-xl border border-slate-700 bg-slate-800 p-6">
      <div className="mb-3 h-3 w-1/3 rounded bg-slate-700" />
      <div className="mb-2 h-8 w-1/2 rounded bg-slate-700" />
      <div className="h-2 w-1/4 rounded bg-slate-700" />
    </div>
  )
}

export function SkeletonRow() {
  return (
    <div className="flex animate-pulse gap-4 border-b border-slate-700 px-4 py-3">
      <div className="h-3 w-1/4 rounded bg-slate-700" />
      <div className="h-3 w-1/3 rounded bg-slate-700" />
      <div className="ml-auto h-3 w-1/6 rounded bg-slate-700" />
    </div>
  )
}
