// Hook untuk mendengarkan perubahan data realtime dari Supabase
// Setiap kali data berubah (dari perangkat ini atau perangkat lain),
// komponen yang menggunakan hook ini akan otomatis me-refresh data

import { useEffect, useRef, useState, useCallback } from 'react'
import { db } from '../services/database'

/**
 * Hook untuk meng-automatiskan refresh data ketika ada perubahan dari realtime.
 *
 * @param {string} table Nama tabel database (dari db.keys)
 * @param {Function} fetchData Callback async untuk mengambil data
 * @param {Array} deps Dependencies untuk useCallback
 * @returns {{ data, loading, error, reload }}
 */
export function useRealtimeData(table, fetchData, deps = []) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)
  const dataRef = useRef(null)

  // Simpan ref untuk fetchData agar tidak kebablasan
  const fetchDataRef = useRef(fetchData)
  fetchDataRef.current = fetchData

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const result = await fetchDataRef.current()
      dataRef.current = result
      setData(result)
      setError(null)
    } catch (err) {
      console.error(`[Realtime] Gagal memuat data ${table}:`, err)
      setError(err)
    } finally {
      if (!silent) setLoading(false)
      setLastUpdated(Date.now())
    }
  }, [table])

  const reload = useCallback(() => loadData(false), [loadData])

  // Load initial data + subscribe ke perubahan
  useEffect(() => {
    loadData()

    // Listen untuk perubahan data dari db layer (local + realtime)
    const handleDBChange = (e) => {
      const { table: changedTable } = e.detail || {}
      // Refresh jika tabel yang berubah sama dengan yang dipantau
      if (!changedTable || changedTable === table) {
        // Silent refresh (tidak spinner)
        loadData(true)
      }
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Selalu refresh saat tab kembali fokus
        loadData(true)
      }
    }

    window.addEventListener(db.changeEvent, handleDBChange)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener(db.changeEvent, handleDBChange)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [table, loadData])

  return { data, loading, error, reload, lastUpdated }
}

/**
 * Hook untuk men-return status koneksi Supabase.
 */
export function useSyncStatus() {
  const [status, setStatus] = useState('online')

  useEffect(() => {
    const handleStatus = (e) => {
      setStatus(e.detail?.status || 'online')
    }
    window.addEventListener(db.syncEvent, handleStatus)
    return () => window.removeEventListener(db.syncEvent, handleStatus)
  }, [])

  return status
}