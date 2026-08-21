// List semua project Supabase yang bisa diakses token
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN

const res = await fetch('https://api.supabase.com/v1/projects', {
  headers: { Authorization: `Bearer ${ACCESS_TOKEN}` }
})
if (!res.ok) {
  console.error('Gagal:', res.status, await res.text())
  process.exit(1)
}
const projects = await res.json()
console.log(`Total project: ${projects.length}`)
for (const p of projects) {
  console.log(`- id: ${p.id} | nama: ${p.name} | region: ${p.region || '-'} | org: ${p.organization_id}`)
}