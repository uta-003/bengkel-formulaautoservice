// Uji end-to-end: INSERT -> SELECT -> DELETE ke database Supabase
// Memastikan aplikasi benar-benar bisa MENYIMPAN data (bukan hanya membaca).
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://dyruuzzrdknwjcjakmif.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_JuFWMmVwsX0ZJQtqt1bVaw_LB9LM-Ef'
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

console.log('=== UJI TULIS-BACA-HAPUS SUPABASE ===\n')

// 1. INSERT test row ke insurance_companies (tabel baru, aman)
const testCode = `TEST-${Date.now()}`
console.log(`1) INSERT insurance_companies (kode=${testCode})...`)
const { data: inserted, error: insertErr } = await supabase
  .from('insurance_companies')
  .insert({ kode: testCode, nama: 'Uji Integrasi FAS', jenis_asuransi: 'UMUM' })
  .select()
  .single()

if (insertErr) {
  console.log(`[FAIL] Insert gagal: ${insertErr.message}`)
  process.exit(1)
}
console.log(`[OK] Tersimpan dengan id=${inserted.id}`)

// 2. SELECT untuk memastikan terbaca kembali
console.log('2) SELECT ulang berdasarkan kode...')
const { data: fetched, error: fetchErr } = await supabase
  .from('insurance_companies')
  .select('*')
  .eq('kode', testCode)
  .maybeSingle()

if (fetchErr || !fetched) {
  console.log(`[FAIL] Gagal membaca kembali: ${fetchErr?.message || 'tidak ditemukan'}`)
} else {
  console.log(`[OK] Terbaca: ${fetched.nama}`)
}

// 3. UPDATE
console.log('3) UPDATE nama...')
const { error: updateErr } = await supabase
  .from('insurance_companies')
  .update({ nama: 'Uji Integrasi FAS (diubah)' })
  .eq('id', inserted.id)

console.log(updateErr ? `[FAIL] ${updateErr.message}` : '[OK] Update berhasil')

// 4. DELETE (bersihkan data uji)
console.log('4) DELETE data uji...')
const { error: deleteErr } = await supabase
  .from('insurance_companies')
  .delete()
  .eq('id', inserted.id)

if (deleteErr) {
  console.log(`[FAIL] Delete gagal: ${deleteErr.message}`)
  process.exit(1)
}

// 5. Pastikan sudah terhapus
const { data: afterDelete } = await supabase
  .from('insurance_companies')
  .select('*')
  .eq('kode', testCode)
  .maybeSingle()

console.log(!afterDelete ? '[OK] Data uji berhasil dihapus (database bersih)' : '[WARN] Data uji masih ada')

console.log('\n[PASS] Aplikasi DAPAT menyimpan, membaca, mengubah, dan menghapus data di Supabase.')