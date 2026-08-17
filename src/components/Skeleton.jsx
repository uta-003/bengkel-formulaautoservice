// Loading Skeleton Component Modern dengan efek shimmer
export function SkeletonLoader({ count = 1, height = 'h-10', className = '' }) {
  return (
    <>
      {Array(count).fill(0).map((_, i) => (
        <div key={i} className={`relative overflow-hidden ${height} ${className} bg-gray-100 dark:bg-gray-800 rounded-lg`}>
          <div className="absolute inset-0 animate-shimmer-skeleton bg-gradient-to-r from-transparent via-white/50 to-transparent" />
        </div>
      ))}
    </>
  )
}

export function TableSkeleton({ rows = 5, cols = 5 }) {
  return (
    <div className="space-y-3">
      {Array(rows).fill(0).map((_, i) => (
        <div key={i} className="flex gap-3">
          {Array(cols).fill(0).map((_, j) => (
            <div key={j} className="relative flex-1 h-10 bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden">
              <div className="absolute inset-0 animate-shimmer-skeleton bg-gradient-to-r from-transparent via-white/50 to-transparent" />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

export function CardSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 space-y-4">
      <div className="relative h-6 bg-gray-100 dark:bg-gray-800 rounded w-1/3 overflow-hidden">
        <div className="absolute inset-0 animate-shimmer-skeleton bg-gradient-to-r from-transparent via-white/50 to-transparent" />
      </div>
      <div className="space-y-2">
        <div className="relative h-4 bg-gray-100 dark:bg-gray-800 rounded overflow-hidden">
          <div className="absolute inset-0 animate-shimmer-skeleton bg-gradient-to-r from-transparent via-white/50 to-transparent" />
        </div>
        <div className="relative h-4 bg-gray-100 dark:bg-gray-800 rounded w-5/6 overflow-hidden">
          <div className="absolute inset-0 animate-shimmer-skeleton bg-gradient-to-r from-transparent via-white/50 to-transparent" />
        </div>
      </div>
    </div>
  )
}