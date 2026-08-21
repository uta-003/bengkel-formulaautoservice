// Verifikasi tabel + data di project gudangbengkel
const SUPABASE_URL = 'https://dyruuzzrdknwjcjakmif.supabase.co'
const KEY = 'sb_publishable_JuFWMmVwsX0ZJQtqt1bVaw_LB9LM-Ef'

const TABLES = [
  'suppliers', 'spareparts', 'transactions', 'stock_movements',
  'scan_history', 'users', 'audit_log',
  'customers', 'vehicles', 'mechanics', 'service_packages',
  'work_orders', 'wo_items', 'wo_labor', 'warranties',
  'invoices', 'vehicle_qr_codes'
]

async function countRows(table) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*`, {
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      Prefer: 'count=exact'
    }
  })
  if (!res.ok) return { ok: false, error: (await res.json()).message }
  const data = await res.json()
  const range = res.headers.get('content-range') || ''
  const total = range.split('/')[1] || String(data.length)
  return { ok: true, total: Number(total), sample: data[0] || null }
}

async function main() {
  console.log('=== VERIFIKASI DATABASE gudangbengkel ===')
  let allOk = true
  for (const t of TABLES) {
    const r = await countRows(t)
    if (r.ok) {
      console.log(`[OK] ${t}: ${r.total} baris`)
      if (r.sample && ['users','suppliers','spareparts','customers'].includes(t)) {
        console.log(`     contoh: ${JSON.stringify(r.sample).slice(0, 150)}`)
      }
    } else {
      allOk = false
      console.log(`[GAGAL] ${t}: ${r.error}`)
    }
  }
  console.log(allOk ? '=== SEMUA TABEL OK ===' : '=== ADA MASALAH ===')
}

main()