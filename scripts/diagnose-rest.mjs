// Diagnosa mentah: cek respons REST untuk tabel yang dicurigai tidak ada
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://dyruuzzrdknwjcjakmif.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_JuFWMmVwsX0ZJQtqt1bVaw_LB9LM-Ef'
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

const suspects = ['returns', 'stock_opnames', 'invoice_payments', 'insurance_claims']

for (const table of suspects) {
  const { data, error } = await supabase.from(table).select('*').limit(1)
  console.log(`\n--- ${table} ---`)
  console.log('error:', error ? `${error.code || ''} | ${error.message}` : 'null')
  console.log('data:', JSON.stringify(data))
}