# Kebijakan Keamanan (Security Policy)

## Melaporkan Kerentanan

Jika Anda menemukan kerentanan keamanan pada aplikasi ini, mohon **jangan** buat issue publik.
Laporkan langsung kepada pemilik repositori melalui kontak privat.

Harap sertakan:
- Deskripsi kerentanan dan dampaknya
- Langkah reproduksi (step-by-step)
- Versi/commit yang terdampak

## Ringkasan Arsitektur Keamanan

### 1. Autentikasi & Sesi
- Password di-hash dengan **PBKDF2-SHA256 (100.000 iterasi)** + salt acak per pengguna
  (`src/utils/crypto.js`, Web Crypto API).
- Hash legacy lama dimigrasikan otomatis ke format baru saat login berhasil.
- Sesi login memiliki **masa berlaku 12 jam** dan token acak; sesi kedaluwarsa otomatis dibersihkan.
- **Rate limiting login**: akun dikunci 5 menit setelah 5 kali percobaan gagal; semua percobaan
  gagal tercatat di audit log.

### 2. Otorisasi (RBAC)
- Kontrol akses berbasis peran: `ADMIN` (akses penuh) dan `STAFF` (terbatas)
  (`src/services/rbacService.js`).
- Route dilindungi `ProtectedRoute` + `PermissionRoute` di `src/App.jsx`.

### 3. Keamanan Database (Supabase)
- Row Level Security (RLS) aktif di semua tabel.
- `supabase/security_hardening.sql` menambahkan:
  - CHECK constraints (stok/harga non-negatif, jumlah transaksi positif, dll.)
  - Trigger proteksi **admin terakhir** tidak dapat dihapus/diturunkan rolenya
  - Trigger **audit log immutable** (hanya INSERT)

> ⚠️ **Catatan penting RLS**: Aplikasi saat ini memakai sistem auth kustom tanpa Supabase Auth,
> sehingga request datang sebagai role `anon` dan kebijakan RLS bersifat permisif agar aplikasi
> berfungsi. Untuk keamanan maksimal, migrasikan ke Supabase Auth lalu terapkan template
> kebijakan ketat yang tersedia di bagian bawah `supabase/security_hardening.sql`.

### 4. Keamanan Transport & Browser
- Security headers via `vercel.json`:
  - Content-Security-Policy (membatasi sumber script/style/koneksi)
  - X-Frame-Options: DENY (anti clickjacking)
  - X-Content-Type-Options: nosniff
  - Referrer-Policy, HSTS, Permissions-Policy (kamera hanya same-origin untuk scanner)
- Input divalidasi & disanitasi sebelum disimpan (`src/utils/validation.js`).

### 5. Keamanan Repositori (GitHub)
- File `.env*` **tidak** di-commit (kecuali `.env.example` yang hanya berisi placeholder).
- Kredensial Supabase wajib diatur via environment variables:
  - Development: file `.env.local` (lokal saja)
  - Production: dashboard Vercel → Project Settings → Environment Variables
- Dependabot aktif untuk update dependensi otomatis (`.github/dependabot.yml`).

## Praktik Keamanan untuk Kontributor

1. **Jangan pernah** commit kredensial, API key, atau data pelanggan.
2. Jalankan `npm audit` secara berkala dan tanggapi temuan high/critical.
3. Simpan password hanya dalam bentuk hash PBKDF2 — tidak pernah plain text.
4. Setiap operasi sensitif (login gagal, hapus user, dll.) harus tercatat di audit log.
5. Gunakan branch + pull request; jangan push langsung ke `main`.

## Rotasi Kunci

Jika kunci publishable/anon Supabase pernah terekspos di tempat publik:
1. Generate key baru di Supabase Dashboard → Settings → API.
2. Perbarui environment variables di Vercel dan `.env.local` semua perangkat.
3. Revoke key lama.