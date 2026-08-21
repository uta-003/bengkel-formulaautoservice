// Supabase client service
// SATU database untuk semua perangkat (HP A/B/C, PC A/B/C):
// Project Supabase "gudangbengkel" - https://dyruuzzrdknwjcjakmif.supabase.co
// Semua perangkat yang membuka aplikasi ini akan membaca & menulis ke database yang sama,
// sehingga data selalu konsisten tanpa selisih (didukung realtime sync).
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://dyruuzzrdknwjcjakmif.supabase.co'
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_JuFWMmVwsX0ZJQtqt1bVaw_LB9LM-Ef'

// Create a single instance of the Supabase client
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
})