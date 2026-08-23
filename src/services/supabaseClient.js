// Supabase client service
// SATU database untuk semua perangkat (HP A/B/C, PC A/B/C):
// Semua perangkat yang membuka aplikasi ini akan membaca & menulis ke database yang sama,
// sehingga data selalu konsisten tanpa selisih (didukung realtime sync).
//
// KEAMANAN: Kredensial TIDAK di-hardcode di sumber kode.
// Konfigurasi wajib melalui environment variables:
//   - VITE_SUPABASE_URL      : URL project Supabase
//   - VITE_SUPABASE_ANON_KEY : Publishable/anon key (aman untuk frontend,
//                              proteksi data tetap ditangani RLS di server)
// Salin .env.example menjadi .env.local untuk development.
// Untuk production (Vercel), set kedua variabel di Project Settings > Environment Variables.

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    '[Konfigurasi] VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY belum diatur.\n' +
    'Salin .env.example menjadi .env.local lalu isi nilainya (development),\n' +
    'atau set Environment Variables di dashboard Vercel (production).'
  )
}

// Validasi format URL agar gagal cepat dengan pesan jelas
try {
  const parsed = new URL(SUPABASE_URL)
  if (!/^https?:$/.test(parsed.protocol)) throw new Error('protocol')
} catch {
  throw new Error(
    `[Konfigurasi] VITE_SUPABASE_URL tidak valid: "${SUPABASE_URL}". ` +
    'Gunakan format https://<project-ref>.supabase.co'
  )
}

// Create a single instance of the Supabase client
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
})