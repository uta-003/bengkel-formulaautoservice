import { describe, it, expect } from 'vitest'
import { formatRupiah, formatDate, formatDateTime } from '../src/utils/format'

// Normalisasi non-breaking space untuk assertion (karena Intl.NumberFormat id-ID menggunakan \u00A0)
function normalizeRupiah(str) {
  return str.replace(/\u00A0/g, ' ')
}

describe('formatRupiah', () => {
  it('memformat angka menjadi Rupiah', () => {
    expect(normalizeRupiah(formatRupiah(1000000))).toBe('Rp 1.000.000')
  })

  it('memformat angka 0', () => {
    expect(normalizeRupiah(formatRupiah(0))).toBe('Rp 0')
  })

  it('menangani undefined/null', () => {
    expect(normalizeRupiah(formatRupiah(undefined))).toBe('Rp 0')
    expect(normalizeRupiah(formatRupiah(null))).toBe('Rp 0')
  })

  it('menangani string numerik', () => {
    expect(normalizeRupiah(formatRupiah('50000'))).toBe('Rp 50.000')
  })

  it('membulatkan angka desimal', () => {
    expect(normalizeRupiah(formatRupiah(1000.4))).toBe('Rp 1.000')
    expect(normalizeRupiah(formatRupiah(1000.6))).toBe('Rp 1.001')
  })
})

describe('formatDate', () => {
  it('memformat tanggal dengan benar', () => {
    expect(formatDate('2026-01-15')).toBe('15 Januari 2026')
  })

  it('mengembalikan dash jika input kosong', () => {
    expect(formatDate('')).toBe('-')
    expect(formatDate(null)).toBe('-')
    expect(formatDate(undefined)).toBe('-')
  })

  it('mengembalikan dash jika tanggal tidak valid', () => {
    expect(formatDate('invalid-date')).toBe('-')
  })
})

describe('formatDateTime', () => {
  it('memformat tanggal dan waktu', () => {
    const result = formatDateTime('2026-01-15T10:30:00')
    expect(result).toContain('15 Januari 2026')
    expect(result).toContain('10.30')
  })

  it('mengembalikan dash jika input kosong', () => {
    expect(formatDateTime('')).toBe('-')
    expect(formatDateTime(null)).toBe('-')
  })
})