import { describe, it, expect } from 'vitest'
import { validators, validateForm } from '../src/services/validators'

describe('Validators', () => {
  describe('required', () => {
    it('mengembalikan null jika value ada', () => {
      expect(validators.required('hello', 'Nama')).toBeNull()
    })

    it('mengembalikan error jika value kosong', () => {
      expect(validators.required('', 'Nama')).toBe('Nama wajib diisi')
      expect(validators.required(null, 'Nama')).toBe('Nama wajib diisi')
      expect(validators.required(undefined, 'Nama')).toBe('Nama wajib diisi')
    })

    it('menangani whitespace', () => {
      expect(validators.required('   ', 'Nama')).toBe('Nama wajib diisi')
    })
  })

  describe('email', () => {
    it('mengembalikan null untuk email valid', () => {
      expect(validators.email('test@example.com')).toBeNull()
    })

    it('mengembalikan error untuk email tidak valid', () => {
      expect(validators.email('invalid-email')).toBe('Email tidak valid')
    })

    it('mengembalikan null untuk email kosong', () => {
      expect(validators.email('')).toBeNull()
      expect(validators.email(null)).toBeNull()
    })
  })

  describe('number', () => {
    it('mengembalikan null untuk angka valid', () => {
      expect(validators.number(123)).toBeNull()
      expect(validators.number('456')).toBeNull()
    })

    it('mengembalikan error untuk non-angka', () => {
      expect(validators.number('abc', 'Harga')).toBe('Harga harus berupa angka')
    })
  })

  describe('positiveNumber', () => {
    it('mengembalikan null untuk angka positif', () => {
      expect(validators.positiveNumber(10)).toBeNull()
      expect(validators.positiveNumber('50')).toBeNull()
    })

    it('mengembalikan error untuk angka negatif', () => {
      expect(validators.positiveNumber(-5, 'Stok')).toBe('Stok harus angka positif')
    })

    it('mengembalikan error untuk non-angka', () => {
      expect(validators.positiveNumber('abc', 'Stok')).toBe('Stok harus angka positif')
    })
  })

  describe('phone', () => {
    it('mengembalikan null untuk nomor Indonesia valid', () => {
      expect(validators.phone('081234567890')).toBeNull()
      expect(validators.phone('+6281234567890')).toBeNull()
    })

    it('mengembalikan error untuk nomor tidak valid', () => {
      expect(validators.phone('12345')).toBe('Nomor telepon tidak valid')
    })
  })
})

describe('validateForm', () => {
  it('mengembalikan object kosong jika semua valid', () => {
    const form = { nama: 'Andi', email: 'andi@example.com' }
    const errors = validateForm(form, {
      nama: (val) => validators.required(val, 'Nama'),
      email: (val) => validators.email(val)
    })
    expect(Object.keys(errors).length).toBe(0)
  })

  it('mengembalikan error per field', () => {
    const form = { nama: '', email: 'invalid' }
    const errors = validateForm(form, {
      nama: (val) => validators.required(val, 'Nama'),
      email: (val) => validators.email(val)
    })
    expect(errors.nama).toBe('Nama wajib diisi')
    expect(errors.email).toBe('Email tidak valid')
  })
})