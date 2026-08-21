// Cek tabel di semua project Supabase yang ditemukan
const PROJECTS = [
  { name: 'FRONTEND (oapbpywsvgzegrhfhghn)', url: 'https://oapbpywsvgzegrhfhghn.supabase.co', key: 'sb_publishable_2e3hma5Eo6DXz6_i034kDQ_rQl9lOhK' },
  { name: 'BACKEND .env (nsxwpsepuqrdbyuqjbsj)', url: 'https://nsxwpsepuqrdbyuqjbsj.supabase.co', key: 'sb_publishable_Bkriz10c8TbHK-SHzEdEQw_t8Nm3XrT' },
  { name: 'BACKEND .env.local (dyruuzzrdknwjckakmif)', url: 'https://dyruuzzrdknwjckakmif.supabase.co', key: 'sb_publishable_JuFWMmVwsX0ZJQt1bVaw_LB9LM-Ef' }
]

const TABLES = [
  'suppliers', 'spareparts', 'transactions', 'stock_movements',
  'scan_history', 'users', 'audit_log',
  'customers', 'vehicles', 'mechanics', 'service_packages',
  'work_orders', 'wo_items', 'wo_labor', 'warranties',
  'invoices', 'vehicle_qr_codes'
]

async function checkTable(url, key, table) {
  try {
    const res = await fetch(`${url}/rest/v1/${table}?select=*&limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` }
    })
    if (res.ok) {
      const data = await res.json()
      return { exists: true, count: data.length }
    }
    return { exists: false }
  } catch {
    return { exists: false, unreachable: true }
  }
}

async function main() {
  for (const p of PROJECTS) {
    console.log(`\n=== ${p.name} ===`)
    let found = 0
    for (const t of TABLES) {
      const r = await checkTable(p.url, p.key, t)
      if (r.exists) {
        found++
        console.log(`  [OK] ${t}`)
      }
    }
    if (found === 0) console.log('  (tidak ada tabel aplikasi)')
    else console.log(`  Total tabel ditemukan: ${found}/${TABLES.length}`)
  }
}

main()