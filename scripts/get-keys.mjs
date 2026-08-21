// Ambil API keys untuk kedua project
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN
const PROJECTS = ['dyruuzzrdknwjcjakmif', 'nsxwpsepuqrdbyuqjbsj']

for (const ref of PROJECTS) {
  console.log(`\n=== ${ref} ===`)
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/api-keys`, {
    headers: { Authorization: `Bearer ${ACCESS_TOKEN}` }
  })
  if (!res.ok) {
    console.error('Gagal:', res.status, await res.text())
    continue
  }
  const keys = await res.json()
  for (const k of keys) {
    console.log(`- [${k.type}] name=${k.name}`)
    console.log(`  key: ${k.api_key}`)
  }
}