// Theme Service - Sistem tema warna FAS
// Mengelola pilihan tema warna aplikasi.
// Tema diterapkan dengan mengubah atribut data-theme pada elemen <html>,
// sehingga seluruh CSS variable brand (--color-brand-*) ikut berubah otomatis.

const THEME_STORAGE_KEY = 'app_theme'

// Daftar tema yang tersedia
export const THEMES = [
  {
    id: 'merah',
    name: 'Merah FAS',
    description: 'Tema default klasik',
    swatch: ['#ff5252', '#d60000', '#a70000'],
    metaColor: '#a70000'
  },
  {
    id: 'biru',
    name: 'Biru Samudra',
    description: 'Tenang & profesional',
    swatch: ['#60a5fa', '#2563eb', '#1d4ed8'],
    metaColor: '#1d4ed8'
  },
  {
    id: 'hijau',
    name: 'Hijau Hutan',
    description: 'Segar & natural',
    swatch: ['#34d399', '#059669', '#047857'],
    metaColor: '#047857'
  },
  {
    id: 'ungu',
    name: 'Ungu Royal',
    description: 'Elegan & modern',
    swatch: ['#a78bfa', '#7c3aed', '#6d28d9'],
    metaColor: '#6d28d9'
  },
  {
    id: 'oranye',
    name: 'Oranye Senja',
    description: 'Enerjik & hangat',
    swatch: ['#fb923c', '#ea580c', '#c2410c'],
    metaColor: '#c2410c'
  },
  {
    id: 'tosca',
    name: 'Tosca Laut',
    description: 'Kalem & menyegarkan',
    swatch: ['#2dd4bf', '#0d9488', '#0f766e'],
    metaColor: '#0f766e'
  },
  {
    id: 'pink',
    name: 'Pink Mawar',
    description: 'Ceria & berani',
    swatch: ['#f472b6', '#db2777', '#be185d'],
    metaColor: '#be185d'
  },
  {
    id: 'slate',
    name: 'Abu Monokrom',
    description: 'Minimalis & netral',
    swatch: ['#94a3b8', '#475569', '#334155'],
    metaColor: '#334155'
  }
]

// Ambil tema yang tersimpan di localStorage (default: merah)
export function getSavedTheme() {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY)
    if (saved && THEMES.some(t => t.id === saved)) return saved
  } catch (e) {
    console.warn('[Theme] Gagal membaca tema tersimpan:', e)
  }
  return 'merah'
}

// Terapkan tema ke dokumen + simpan pilihan
export function applyTheme(themeId) {
  const theme = THEMES.find(t => t.id === themeId) || THEMES[0]
  document.documentElement.setAttribute('data-theme', theme.id)
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme.id)
  } catch (e) {
    console.warn('[Theme] Gagal menyimpan tema:', e)
  }

  // Perbarui warna theme-color pada meta tag (untuk browser mobile/PWA)
  const metaThemeColor = document.querySelector('meta[name="theme-color"]')
  if (metaThemeColor) {
    metaThemeColor.setAttribute('content', theme.metaColor)
  }

  return theme
}

// Inisialisasi tema saat aplikasi dimuat
export function initTheme() {
  return applyTheme(getSavedTheme())
}