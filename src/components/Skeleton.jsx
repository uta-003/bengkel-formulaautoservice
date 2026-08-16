// Loading Skeleton Component
export function SkeletonLoader({ count = 1, height = 'h-10' }) {
  return (
    <>
      {Array(count).fill(0).map((_, i) => (
        <div key={i} className={`${height} bg-gray-200 rounded animate-pulse`} />
      ))}
    </>
  )
}

export function TableSkeleton({ rows = 5, cols = 5 }) {
  return (
    <div className="space-y-2">
      {Array(rows).fill(0).map((_, i) => (
        <div key={i} className="flex gap-2">
          {Array(cols).fill(0).map((_, j) => (
            <div key={j} className="flex-1 h-10 bg-gray-200 rounded animate-pulse" />
          ))}
        </div>
      ))}
    </div>
  )
}

export function CardSkeleton() {
  return (
    <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
      <div className="h-6 bg-gray-200 rounded w-1/3 animate-pulse" />
      <div className="space-y-2">
        <div className="h-4 bg-gray-200 rounded animate-pulse" />
        <div className="h-4 bg-gray-200 rounded w-5/6 animate-pulse" />
      </div>
    </div>
  )
}
