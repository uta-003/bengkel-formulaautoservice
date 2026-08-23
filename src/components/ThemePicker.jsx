import { useState } from 'react'
import { Check, Palette, X } from 'lucide-react'
import { THEMES, applyTheme, getSavedTheme } from '../services/themeService'
import { toastService } from '../services/toastService'

/**
 * Grid pemilih tema warna.
 * Dipakai di halaman Pengaturan (mode "grid") dan
 * di header Layout (mode "popover").
 */
export function ThemePicker({ onThemeChange }) {
  const [activeTheme, setActiveTheme] = useState(getSavedTheme())

  const handleSelect = (themeId) => {
    const theme = applyTheme(themeId)
    setActiveTheme(theme.id)
    toastService.success(`Tema "${theme.name}" diterapkan`)
    if (onThemeChange) onThemeChange(theme)
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {THEMES.map((theme) => {
        const isActive = activeTheme === theme.id
        return (
          <button
            key={theme.id}
            onClick={() => handleSelect(theme.id)}
            className={`relative h-full flex flex-col items-center justify-start gap-2 p-4 pt-5 rounded-2xl border-2 transition-all hover:shadow-md touch-target ${
              isActive
                ? 'border-brand-500 bg-brand-50 shadow-sm'
                : 'border-gray-200 bg-white hover:border-brand-300'
            }`}
          >
            {isActive && (
              <span className="absolute top-2 right-2 w-5 h-5 bg-brand-600 text-white rounded-full flex items-center justify-center shadow-sm">
                <Check className="w-3 h-3" />
              </span>
            )}
            {/* Swatch gradient preview */}
            <span
              className="w-12 h-12 rounded-full shadow-inner border border-black/10 shrink-0"
              style={{
                background: `linear-gradient(135deg, ${theme.swatch[0]} 0%, ${theme.swatch[1]} 55%, ${theme.swatch[2]} 100%)`
              }}
            />
            <span className="text-sm font-semibold text-gray-800 text-center leading-tight">{theme.name}</span>
            <span className="text-[11px] text-gray-500 text-center leading-snug line-clamp-2">{theme.description}</span>
          </button>
        )
      })}
    </div>
  )
}

/**
 * Tombol palette di header dengan popover pemilih tema cepat.
 */
export function ThemeQuickToggle() {
  const [open, setOpen] = useState(false)
  const [activeTheme, setActiveTheme] = useState(getSavedTheme())

  const handleSelect = (themeId) => {
    const theme = applyTheme(themeId)
    setActiveTheme(theme.id)
    setOpen(false)
    toastService.success(`Tema "${theme.name}" diterapkan`)
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(prev => !prev)}
        className={`p-2 rounded-lg transition-colors touch-target ${
          open ? 'text-brand-600 bg-brand-50' : 'text-gray-500 hover:text-brand-600 hover:bg-brand-50'
        }`}
        title="Ganti tema warna"
        aria-label="Ganti tema warna"
        aria-expanded={open}
      >
        <Palette className="w-4 h-4" />
      </button>

      {open && (
        <>
          {/* Overlay untuk menutup popover */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

          {/* Popover - mobile: fixed di bawah header agar selalu presisi muat layar;
              desktop: absolute menempel kanan tombol */}
          <div className="animate-dropdown-in fixed sm:absolute inset-x-2 sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 top-[72px] w-auto sm:w-80 bg-white rounded-2xl shadow-xl shadow-black/10 border border-gray-200 z-50 overflow-hidden">
            {/* Header popover */}
            <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50/80">
              <div className="flex items-center gap-2 min-w-0">
                <span className="shrink-0 w-7 h-7 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center">
                  <Palette className="w-4 h-4" />
                </span>
                <p className="text-sm font-bold text-gray-800 leading-none">Tema Warna</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 -mr-1 shrink-0 text-gray-400 hover:text-gray-700 hover:bg-gray-200/70 rounded-lg transition-colors"
                aria-label="Tutup"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Daftar tema - tinggi baris konsisten & sejajar presisi */}
            <ul className="p-2 max-h-[min(22rem,55vh)] overflow-y-auto thin-scrollbar space-y-1">
              {THEMES.map((theme) => {
                const isActive = activeTheme === theme.id
                return (
                  <li key={theme.id}>
                    <button
                      onClick={() => handleSelect(theme.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors text-left ${
                        isActive ? 'bg-brand-50 ring-1 ring-brand-200' : 'hover:bg-gray-50 active:bg-gray-100'
                      }`}
                    >
                      <span
                        className="w-9 h-9 rounded-full shrink-0 border border-black/10 shadow-inner"
                        style={{
                          background: `linear-gradient(135deg, ${theme.swatch[0]} 0%, ${theme.swatch[1]} 55%, ${theme.swatch[2]} 100%)`
                        }}
                      />
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-semibold text-gray-800 truncate leading-tight">{theme.name}</span>
                        <span className="block text-[11px] text-gray-500 truncate leading-tight mt-0.5">{theme.description}</span>
                      </span>
                      {/* Slot kanan berukuran tetap agar semua baris sejajar presisi */}
                      <span className="shrink-0 w-5 h-5 flex items-center justify-center">
                        {isActive && (
                          <span className="w-5 h-5 bg-brand-600 text-white rounded-full flex items-center justify-center">
                            <Check className="w-3 h-3" />
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        </>
      )}
    </div>
  )
}

export default ThemePicker