import { Car } from 'lucide-react'

// Komponen Loading Screen modern dengan tema FAS
export function LoadingScreen({ message = 'Memuat data...', compact = false }) {
  return (
    <div className="relative w-full py-16 sm:py-24 px-4 flex items-center justify-center overflow-hidden">
      {/* Background gradient blobs */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 -left-16 w-48 h-48 sm:w-72 sm:h-72 bg-brand-200/40 rounded-full blur-3xl animate-blob" />
        <div className="absolute bottom-1/4 -right-16 w-48 h-48 sm:w-72 sm:h-72 bg-brand-400/20 rounded-full blur-3xl animate-blob" style={{ animationDelay: '2s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 sm:w-56 sm:h-56 bg-brand-300/20 rounded-full blur-3xl animate-blob" style={{ animationDelay: '4s' }} />
      </div>

      {/* Glassmorphism card */}
      <div className={`relative z-10 ${compact ? 'max-w-xs' : 'max-w-sm'} w-full mx-auto`}>
        <div className="bg-white/70 dark:bg-gray-900/70 backdrop-blur-xl rounded-2xl sm:rounded-3xl shadow-2xl shadow-brand-500/10 border border-white/60 dark:border-gray-700/60 p-6 sm:p-10 text-center">
          {/* Animated logo / icon */}
          <div className="relative w-24 h-24 sm:w-32 sm:h-32 mx-auto">
            {/* Spinning gradient ring */}
            <div className="absolute inset-0 rounded-full animate-spin-slow">
              <div className="absolute inset-0 rounded-full border-4 sm:border-[5px] border-transparent border-t-brand-600 border-r-brand-400 border-b-brand-700 border-l-brand-300" />
            </div>

            {/* Inner glow ring */}
            <div className="absolute inset-2 rounded-full bg-gradient-to-br from-brand-500/10 to-brand-700/10 animate-pulse-slow" />

            {/* Center logo */}
            <div className="absolute inset-5 sm:inset-6 flex items-center justify-center">
              <img
                src="/favicon.svg"
                alt="Logo FAS"
                className="w-full h-full object-contain rounded-xl shadow-md animate-float"
                draggable="false"
              />
            </div>

            {/* Orbit dots */}
            <div className="absolute -inset-2 sm:-inset-3">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2 h-2 sm:w-2.5 sm:h-2.5 bg-brand-500 rounded-full animate-orbit" />
              <div className="absolute bottom-1 left-1/4 w-1.5 h-1.5 sm:w-2 sm:h-2 bg-brand-600 rounded-full animate-orbit" style={{ animationDelay: '0.5s' }} />
              <div className="absolute bottom-2 right-1/4 w-1.5 h-1.5 sm:w-2 sm:h-2 bg-brand-400 rounded-full animate-orbit" style={{ animationDelay: '1s' }} />
            </div>
          </div>

          {/* Message */}
          <div className="mt-6 sm:mt-8 space-y-4">
            <p className="text-base sm:text-lg font-semibold text-gray-800 dark:text-gray-100 bg-clip-text text-transparent bg-gradient-to-r from-brand-600 via-brand-500 to-brand-600 animate-shimmer bg-[length:200%_auto]">
              {message}
            </p>

            {/* Shimmer progress bar */}
            <div className="relative h-1.5 sm:h-2 bg-gray-200/80 dark:bg-gray-700/80 rounded-full overflow-hidden">
              <div className="absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-brand-500 via-brand-400 to-brand-300 rounded-full animate-progress" />
            </div>

            {/* Loading dots */}
            <div className="flex items-center justify-center gap-1.5 sm:gap-2">
              <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-brand-600 rounded-full animate-bounce-soft" style={{ animationDelay: '0ms' }} />
              <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-brand-500 rounded-full animate-bounce-soft" style={{ animationDelay: '150ms' }} />
              <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-brand-300 rounded-full animate-bounce-soft" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Versi full-screen modern untuk initial load
export function FullScreenLoader({ message = 'Menyiapkan aplikasi...' }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden">
      {/* Animated gradient background */}
      <div className="absolute inset-0 bg-gradient-animate bg-[length:400%_400%]">
        <div className="loader-glow-tl absolute inset-0" />
        <div className="loader-glow-br absolute inset-0" />
      </div>

      {/* Floating particles */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[20%] left-[15%] w-2 h-2 sm:w-3 sm:h-3 bg-brand-500/50 rounded-full animate-float" />
        <div className="absolute top-[30%] right-[20%] w-1.5 h-1.5 sm:w-2 sm:h-2 bg-brand-400/50 rounded-full animate-float" style={{ animationDelay: '1s' }} />
        <div className="absolute bottom-[25%] left-[25%] w-3 h-3 sm:w-4 sm:h-4 bg-brand-300/40 rounded-full animate-float" style={{ animationDelay: '2s' }} />
        <div className="absolute bottom-[30%] right-[15%] w-1.5 h-1.5 sm:w-2 sm:h-2 bg-brand-700/50 rounded-full animate-float" style={{ animationDelay: '3s' }} />
        <div className="absolute top-[55%] left-[10%] w-2 h-2 sm:w-2.5 sm:h-2.5 bg-brand-400/40 rounded-full animate-float" style={{ animationDelay: '1.5s' }} />
        <div className="absolute top-[60%] right-[10%] w-2 h-2 sm:w-3 sm:h-3 bg-brand-600/40 rounded-full animate-float" style={{ animationDelay: '2.5s' }} />
      </div>

      {/* Glassmorphism card */}
      <div className="relative z-10 max-w-xs sm:max-w-md w-full mx-4">
        <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/60 dark:border-gray-700/60 p-8 sm:p-12 text-center">
          {/* Logo */}
          <div className="relative w-20 h-20 sm:w-28 sm:h-28 mx-auto">
            {/* Outer ring */}
            <div className="absolute inset-0 rounded-full animate-spin-slow">
              <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-brand-600 border-r-brand-400 border-b-brand-300 border-l-brand-700" />
            </div>
            <div className="absolute inset-1.5 rounded-full border-2 border-transparent border-t-brand-400/60 border-b-brand-600/60 animate-spin-slow-reverse" />

            {/* Logo FAS */}
            <img
              src="/favicon.svg"
              alt="Logo FAS"
              className="absolute inset-3 w-[calc(100%-1.5rem)] h-[calc(100%-1.5rem)] object-contain rounded-xl shadow-lg ring-1 ring-black/5"
              draggable="false"
            />
          </div>

          {/* Text */}
          <h1 className="mt-6 sm:mt-8 text-lg sm:text-2xl font-bold text-gray-800 dark:text-gray-100">
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-brand-700 via-brand-500 to-brand-700 animate-shimmer bg-[length:200%_auto]">
              FAS
            </span>
          </h1>
          <p className="mt-2 text-sm sm:text-base text-gray-600 dark:text-gray-300">{message}</p>

          {/* Progress bar */}
          <div className="mt-6 sm:mt-8">
            <div className="flex items-center justify-between mb-2 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
              <span className="flex items-center gap-1.5">
                <Car className="w-3.5 h-3.5 text-brand-500" />
                Loading
              </span>
              <span className="font-mono animate-pulse-slow">...</span>
            </div>
            <div className="relative h-2 sm:h-2.5 bg-gray-200/70 dark:bg-gray-700/70 rounded-full overflow-hidden">
              <div className="absolute inset-y-0 left-0 w-2/3 bg-gradient-to-r from-brand-600 via-brand-500 to-brand-400 rounded-full animate-loading-bar-modern" />
              {/* Shimmer overlay */}
              <div className="absolute inset-0 animate-shimmer-sweep bg-gradient-to-r from-transparent via-white/50 to-transparent" />
            </div>
          </div>

          {/* Status text */}
          <div className="mt-6 flex items-center justify-center gap-2 text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400">
            <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-brand-500 rounded-full animate-ping-slow" />
            <span>Mohon tunggu sebentar</span>
          </div>
        </div>
      </div>
    </div>
  )
}