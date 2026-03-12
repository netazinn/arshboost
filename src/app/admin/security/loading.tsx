// Shown by Next.js while /admin/security awaits getFraudIntelligence()
// (which makes a Supabase call + optional external geo API call).

export default function SecurityLoading() {
  return (
    <main className="flex-1 min-h-0 overflow-y-auto w-full max-w-[1400px] mx-auto px-8 py-10 flex flex-col gap-6">
      {/* Page header skeleton */}
      <div className="flex flex-col gap-2">
        <div className="h-7 w-56 animate-pulse rounded-md bg-[#1a1a1a]" />
        <div className="h-4 w-80 animate-pulse rounded-md bg-[#121212]" />
      </div>

      {/* Filter tab skeletons */}
      <div className="flex items-center gap-2">
        {[80, 96, 160].map(w => (
          <div
            key={w}
            style={{ width: w }}
            className="h-7 animate-pulse rounded-lg bg-[#111]"
          />
        ))}
      </div>

      {/* Table skeleton */}
      <div className="overflow-hidden rounded-xl border border-[#1a1a1a]">
        {/* Header row */}
        <div className="flex items-center gap-4 border-b border-[#1a1a1a] bg-[#0a0a0a] px-5 py-3">
          {[120, 140, 72, 100, 64, 80, 72].map((w, i) => (
            <div key={i} style={{ width: w }} className="h-2.5 animate-pulse rounded bg-[#1a1a1a]" />
          ))}
        </div>

        {/* Body rows */}
        {Array.from({ length: 8 }).map((_, rowIdx) => (
          <div
            key={rowIdx}
            className="flex items-center gap-4 border-b border-[#0f0f0f] px-5 py-4"
            style={{ animationDelay: `${rowIdx * 60}ms` }}
          >
            {/* User cell */}
            <div className="w-[120px] flex flex-col gap-1.5">
              <div className="h-3 w-24 animate-pulse rounded bg-[#1a1a1a]" />
              <div className="h-2 w-32 animate-pulse rounded bg-[#111]" />
              <div className="h-2 w-10 animate-pulse rounded bg-[#0f0f0f]" />
            </div>
            {/* Location cell */}
            <div className="w-[140px] flex flex-col gap-1.5">
              <div className="h-3 w-28 animate-pulse rounded bg-[#1a1a1a]" />
              <div className="h-2 w-20 animate-pulse rounded bg-[#111]" />
            </div>
            {/* Risk cell */}
            <div className="w-[72px]">
              <div className="h-5 w-16 animate-pulse rounded bg-[#111]" />
            </div>
            {/* Device cell */}
            <div className="w-[100px] flex flex-col gap-1.5">
              <div className="h-3 w-20 animate-pulse rounded bg-[#1a1a1a]" />
              <div className="h-2 w-14 animate-pulse rounded bg-[#111]" />
            </div>
            {/* Linked cell */}
            <div className="w-[64px]">
              <div className="h-2 w-3 animate-pulse rounded bg-[#0f0f0f]" />
            </div>
            {/* Last active cell */}
            <div className="w-[80px]">
              <div className="h-2.5 w-16 animate-pulse rounded bg-[#111]" />
            </div>
            {/* Actions cell */}
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 animate-pulse rounded bg-[#111]" />
              <div className="h-7 w-7 animate-pulse rounded bg-[#111]" />
            </div>
          </div>
        ))}
      </div>
    </main>
  )
}
