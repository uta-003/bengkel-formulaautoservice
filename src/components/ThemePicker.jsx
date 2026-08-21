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
            className={`relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all hover:shadow-md touch-target ${
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
              className="w-12 h-12 rounded-full shadow-inner border border-black/10"
              style={{
                background: `linear-gradient(135deg, ${theme.swatch[0]} 0%, ${theme.swatch[1]} 55%, ${theme.swatch[2]} 100%)`
              }}
            />
            <span className="text-sm font-semibold text-gray-800">{theme.name}</span>
            <span className="text-[11px] text-gray-500 text-center leading-tight">{theme.description}</span>
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
        className="p-2 text-gray-500 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors touch-target"
        title="Ganti tema warna"
      >
        <Palette className="w-4 h-4" />
      </button>

      {open && (
        <>
          {/* Overlay untuk menutup popover */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 z-50 w-64 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <p className="text-sm font-semibold text-gray-800">Tema Warna</p>
              <button
                onClick={() => setOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-2 max-h-72 overflow-y-auto">
              {THEMES.map((theme) => {
                const isActive = activeTheme === theme.id
                return (
                  <button
                    key={theme.id}
                    onClick={() => handleSelect(theme.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left ${
                      isActive ? 'bg-brand-50' : 'hover:bg-gray-50'
                    }`}
                  >
                    <span
                      className="w-7 h-7 rounded-full shrink-0 border border-black/10"
                      style={{
                        background: `linear-gradient(135deg, ${theme.swatch[0]} 0%, ${theme.swatch[1]} 55%, ${theme.swatch[2]} 100%)`
                      }}
                    />
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium text-gray-800 truncate">{theme.name}</span>
                      <span className="block text-[11px] text-gray-500 truncate">{theme.description}</span>
                    </span>
                    {isActive && (
                      <Check className="w-4 h-4 text-brand-600 shrink-0" />
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default ThemePicker