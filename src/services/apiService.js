// API Service untuk komunikasi dengan backend
import { supabase } from './supabaseClient'

const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/+$/, '')
const DEFAULT_TIMEOUT = 10000

class ApiError extends Error {
  constructor(message, status = 0, endpoint = '') {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.endpoint = endpoint
  }
}

class ApiService {
  async request(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    }

    // Tambahkan timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT)

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new ApiError(
          errorData.message || `HTTP ${response.status}: ${response.statusText}`,
          response.status,
          endpoint
        )
      }

      return await response.json()
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new ApiError(`Request timeout untuk ${endpoint}`, 0, endpoint)
      }
      if (error instanceof ApiError) {
        throw error
      }
      // Network error seperti "Failed to fetch" - tampilkan pesan yang ramah
      const message = error.message === 'Failed to fetch'
        ? 'Tidak dapat terhubung ke server. Periksa koneksi internet Anda.'
        : `Koneksi ke server gagal untuk ${endpoint}`
      throw new ApiError(message, 0, endpoint)
    } finally {
      clearTimeout(timeoutId)
    }
  }

  // Health check
  async health() {
    return this.request('/health')
  }

  // Spareparts - using Supabase
  async getSpareparts() {
    try {
      const { data, error } = await supabase.from('spareparts').select('*')
      if (error) throw error
      return data
    } catch (error) {
      console.warn('Supabase gagal, fallback ke API lokal:', error.message)
      return this.request('/spareparts')
    }
  }

  async getSparepartById(id) {
    try {
      const { data, error } = await supabase.from('spareparts').select('*').eq('id', id).single()
      if (error) throw error
      return data
    } catch (error) {
      console.warn('Supabase getById gagal, fallback ke API lokal:', error.message)
      return this.request(`/spareparts/${id}`)
    }
  }

  async createSparepart(data) {
    try {
      const { data: result, error } = await supabase.from('spareparts').insert(data).select().single()
      if (error) throw error
      return result
    } catch (error) {
      console.warn('Supabase create gagal, fallback ke API lokal:', error.message)
      return this.request('/spareparts', {
        method: 'POST',
        body: JSON.stringify(data)
      })
    }
  }

  async updateSparepart(id, data) {
    try {
      const { data: result, error } = await supabase.from('spareparts').update(data).eq('id', id).select().single()
      if (error) throw error
      return result
    } catch (error) {
      console.warn('Supabase update gagal, fallback ke API lokal:', error.message)
      return this.request(`/spareparts/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      })
    }
  }

  async deleteSparepart(id) {
    try {
      const { error } = await supabase.from('spareparts').delete().eq('id', id)
      if (error) throw error
      return true
    } catch (error) {
      console.warn('Supabase delete gagal, fallback ke API lokal:', error.message)
      return this.request(`/spareparts/${id}`, {
        method: 'DELETE'
      })
    }
  }

  // Suppliers - using Supabase
  async getSuppliers() {
    try {
      const { data, error } = await supabase.from('suppliers').select('*')
      if (error) throw error
      return data
    } catch (error) {
      console.warn('Supabase getSuppliers gagal, fallback ke API lokal:', error.message)
      return this.request('/suppliers')
    }
  }

  async getSupplierById(id) {
    try {
      const { data, error } = await supabase.from('suppliers').select('*').eq('id', id).single()
      if (error) throw error
      return data
    } catch (error) {
      console.warn('Supabase getSupplierById gagal, fallback ke API lokal:', error.message)
      return this.request(`/suppliers/${id}`)
    }
  }

  async createSupplier(data) {
    try {
      const { data: result, error } = await supabase.from('suppliers').insert(data).select().single()
      if (error) throw error
      return result
    } catch (error) {
      console.warn('Supabase createSupplier gagal, fallback ke API lokal:', error.message)
      return this.request('/suppliers', {
        method: 'POST',
        body: JSON.stringify(data)
      })
    }
  }

  async updateSupplier(id, data) {
    try {
      const { data: result, error } = await supabase.from('suppliers').update(data).eq('id', id).select().single()
      if (error) throw error
      return result
    } catch (error) {
      console.warn('Supabase updateSupplier gagal, fallback ke API lokal:', error.message)
      return this.request(`/suppliers/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      })
    }
  }

  async deleteSupplier(id) {
    try {
      const { error } = await supabase.from('suppliers').delete().eq('id', id)
      if (error) throw error
      return true
    } catch (error) {
      console.warn('Supabase deleteSupplier gagal, fallback ke API lokal:', error.message)
      return this.request(`/suppliers/${id}`, {
        method: 'DELETE'
      })
    }
  }

  // Export - menggunakan Supabase sebagai sumber data utama
  async exportExcel() {
    try {
      const { data, error } = await supabase.from('spareparts').select('*')
      if (error) throw error
      // Convert to CSV format
      const headers = ['Kode', 'Nama', 'Kategori', 'Merk', 'Harga Beli', 'Harga Jual', 'Stok', 'Stok Min', 'Barcode']
      const rows = data.map(sp => [
        sp.kode,
        sp.nama,
        sp.kategori,
        sp.merk,
        sp.hargaBeli,
        sp.hargaJual,
        sp.stok,
        sp.stokMinimum,
        sp.barcode || ''
      ])
      return { headers, rows }
    } catch (error) {
      if (error instanceof ApiError) throw error
      throw new ApiError('Koneksi ke server gagal untuk export', 0, '/export/excel')
    }
  }
}

export const apiService = new ApiService()
export { ApiError }