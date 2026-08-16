// API Service untuk komunikasi dengan backend
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'
const DEFAULT_TIMEOUT = 5000

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
      if (error instanceof ApiError) throw error
      // Network error - server tidak tersedia
      throw new ApiError(`Koneksi ke server gagal untuk ${endpoint}`, 0, endpoint)
    } finally {
      clearTimeout(timeoutId)
    }
  }

  // Health check
  async health() {
    return this.request('/health')
  }

  // Units
  async getUnits() {
    return this.request('/units')
  }

  // Spareparts
  async getSpareparts() {
    return this.request('/spareparts')
  }

  async getSparepartById(id) {
    return this.request(`/spareparts/${id}`)
  }

  async createSparepart(data) {
    return this.request('/spareparts', {
      method: 'POST',
      body: JSON.stringify(data)
    })
  }

  async updateSparepart(id, data) {
    return this.request(`/spareparts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    })
  }

  async deleteSparepart(id) {
    return this.request(`/spareparts/${id}`, {
      method: 'DELETE'
    })
  }

  // Suppliers
  async getSuppliers() {
    return this.request('/suppliers')
  }

  async getSupplierById(id) {
    return this.request(`/suppliers/${id}`)
  }

  async createSupplier(data) {
    return this.request('/suppliers', {
      method: 'POST',
      body: JSON.stringify(data)
    })
  }

  async updateSupplier(id, data) {
    return this.request(`/suppliers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    })
  }

  async deleteSupplier(id) {
    return this.request(`/suppliers/${id}`, {
      method: 'DELETE'
    })
  }

  // Tickets
  async createTicket(ticketData) {
    return this.request('/tickets', {
      method: 'POST',
      body: JSON.stringify(ticketData)
    })
  }

  async trackTicket(ticketNumber) {
    return this.request(`/tickets/track/${ticketNumber}`)
  }

  async getTickets() {
    return this.request('/tickets')
  }

  async getTicketById(id) {
    return this.request(`/tickets/${id}`)
  }

  async updateTicket(id, data) {
    return this.request(`/tickets/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    })
  }

  async deleteTicket(id) {
    return this.request(`/tickets/${id}`, {
      method: 'DELETE'
    })
  }

  // Export
  async exportExcel() {
    try {
      const response = await fetch(`${API_BASE_URL}/export/excel`)
      if (!response.ok) throw new ApiError('Failed to export', response.status, '/export/excel')
      return response.blob()
    } catch (error) {
      if (error instanceof ApiError) throw error
      throw new ApiError('Koneksi ke server gagal untuk export', 0, '/export/excel')
    }
  }
}

export const apiService = new ApiService()
export { ApiError }