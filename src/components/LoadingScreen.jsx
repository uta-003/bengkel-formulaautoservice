// Komponen Loading Screen dengan animasi bengkel
export function LoadingScreen({ message = 'Memuat data...' }) {
  return (
    <div className="flex flex-col items-center justify-center py-24">
      {/* Ilustrasi Bengkel SVG */}
      <div className="relative w-40 h-40">
        {/* Gedung bengkel */}
        <svg viewBox="0 0 120 120" className="w-full h-full">
          {/* Atap */}
          <polygon points="60,15 10,45 110,45" fill="#1e3a5f" className="animate-pulse" />
          {/* Dinding */}
          <rect x="20" y="45" width="80" height="55" fill="#f0f4f8" stroke="#cbd5e1" strokeWidth="2" rx="4" />
          {/* Pintu garasi */}
          <rect x="35" y="60" width="50" height="40" rx="4" fill="#1e293b" />
          {/* Jalur garasi */}
          <rect x="45" y="55" width="30" height="5" rx="2" fill="#94a3b8" />
          {/* Lampu atas */}
          <circle cx="60" cy="25" r="4" fill="#fbbf24">
            <animate attributeName="opacity" values="1;0.3;1" dur="1.5s" repeatCount="indefinite" />
          </circle>

          {/* Mobil di dalam garasi */}
          <g>
            <animateTransform attributeName="transform" type="translate" values="0,0; 0,2; 0,0" dur="1s" repeatCount="indefinite" />
            {/* Body mobil */}
            <rect x="42" y="72" width="36" height="12" rx="4" fill="#3b82f6" />
            <rect x="48" y="67" width="24" height="8" rx="3" fill="#3b82f6" />
            {/* Kaca */}
            <rect x="52" y="69" width="8" height="4" rx="1" fill="#93c5fd" />
            <rect x="62" y="69" width="8" height="4" rx="1" fill="#93c5fd" />
            {/* Ban */}
            <circle cx="50" cy="85" r="5" fill="#1e293b" />
            <circle cx="70" cy="85" r="5" fill="#1e293b" />
          </g>

          {/* Toolbox / Kunci */}
          <g>
            <animateTransform attributeName="transform" type="rotate" values="0 60 90; 360 60 90" dur="2s" repeatCount="indefinite" />
            {/* Kunci pas */}
            <path d="M 62,86 L 68,80" stroke="#f59e0b" strokeWidth="3" strokeLinecap="round" />
            <circle cx="69" cy="79" r="4" fill="none" stroke="#f59e0b" strokeWidth="2" />
            <rect x="58" y="86" width="5" height="8" rx="1" fill="#f59e0b" />
          </g>
        </svg>

        {/* Loading spinner overlay */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-20 h-20 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
        </div>
      </div>

      {/* Teks loading */}
      <p className="mt-6 text-lg font-semibold text-gray-700">{message}</p>
      <div className="mt-3 flex items-center gap-2">
        <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  )
}

// Versi full-screen untuk initial load
export function FullScreenLoader({ message = 'Memuat aplikasi...' }) {
  return (
    <div className="fixed inset-0 z-[100] bg-white/95 backdrop-blur-sm flex items-center justify-center">
      <div className="text-center">
        <svg className="mx-auto" viewBox="0 0 120 120" width="120" height="120">
          {/* Logo ring */}
          <circle cx="60" cy="60" r="55" fill="none" stroke="#3b82f6" strokeWidth="3" strokeDasharray="8 6">
            <animateTransform attributeName="transform" type="rotate" values="0 60 60; 360 60 60" dur="2s" repeatCount="indefinite" />
          </circle>

          {/* Logo Unit Check */}
          <rect x="25" y="45" width="70" height="30" rx="6" fill="#3b82f6" />
          <rect x="35" y="35" width="50" height="20" rx="4" fill="#2563eb" />
          <text x="60" y="64" textAnchor="middle" fontSize="14" fontWeight="bold" fill="white" fontFamily="sans-serif">UNIT CHECK</text>

          {/* Wrench */}
          <g transform="translate(60 90)">
            <animateTransform attributeName="transform" type="translate" values="60 90; 60 86; 60 90" dur="1s" repeatCount="indefinite" />
            <path d="M-6 0 L-6 -10 Q-6 -14 -2 -14 L7 -14 Q10 -14 10 -10 L10 -7 Q10 -4 7 -4 L-3 -4" fill="none" stroke="#f59e0b" strokeWidth="3.5" strokeLinecap="round" />
          </g>
        </svg>

        <p className="mt-4 text-lg font-semibold text-gray-700">{message}</p>
        <div className="mt-2 h-1.5 w-40 bg-gray-200 rounded-full mx-auto overflow-hidden">
          <div className="h-full bg-blue-500 rounded-full animate-loading-bar" />
        </div>
      </div>
    </div>
  )
}