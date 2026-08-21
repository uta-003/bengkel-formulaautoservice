/* Service Worker - Formula Auto Service PWA
 * Strategi cache:
 * - App shell (HTML, CSS, JS, ikon): cache-first dengan revalidate
 * - Navigasi halaman: network-first, fallback ke cache saat offline
 * - API Supabase: TIDAK di-cache (data harus selalu fresh), hanya fallback offline
 */

const CACHE_NAME = 'formula-auto-v2'
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
  '/icons.svg'
]

// Install: cache app shell dasar
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  )
})

// Activate: bersihkan cache versi lama
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  )
})

// Fetch handler
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Jangan intercept non-GET
  if (request.method !== 'GET') return

  // Jangan cache request ke Supabase / API eksternal (data realtime harus fresh)
  if (url.hostname.includes('supabase.co') || url.hostname.includes('supabase.in')) {
    return
  }

  // Navigasi halaman: network-first, fallback cache (offline)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Simpan salinan ke cache
          const copy = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
          return response
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match('/index.html')))
    )
    return
  }

  // Aset statis (js, css, gambar, font): cache-first dengan revalidate di background
  if (
    url.origin === self.location.origin ||
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com')
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const fetchPromise = fetch(request)
          .then((response) => {
            if (response && response.status === 200) {
              const copy = response.clone()
              caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
            }
            return response
          })
          .catch(() => cached)
        return cached || fetchPromise
      })
    )
  }
})