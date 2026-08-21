# Unit Check - Sistem Manajemen Sparepart

Aplikasi web untuk mengelola inventori sparepart dengan fitur lengkap: manajemen stok, transaksi barang masuk/keluar, supplier tracking, low stock alert, barcode scanner, dan laporan analisis.

## 🚀 Fitur

- **Dashboard** - Ringkasan inventori, statistik, peringatan stok minimum, transaksi terbaru
- **Manajemen Sparepart** - CRUD sparepart, import/export CSV, search & filter, pagination, durasi garansi per item
- **Barang Masuk** - Catat penerimaan sparepart dari supplier dengan update stok otomatis
- **Barang Keluar** - Catat pengeluaran sparepart dengan validasi stok tersedia
- **Low Stock Alert** - Deteksi sparepart yang stoknya di bawah minimum
- **Manajemen Supplier** - Kelola data supplier sparepart
- **Laporan & Analisis** - Grafik transaksi bulanan, sparepart terlaris, pergerakan stok, **pendapatan servis & faktur**
- **Barcode Scanner** - Scan barcode untuk cek stok dan informasi sparepart
- **Retur Barang** - Retur ke supplier & retur dari pelanggan dengan penyesuaian stok otomatis saat disetujui
- **Stock Opname** - Penghitungan fisik & penyesuaian stok sistem dengan snapshot & catat pergerakan stok
- **Notifikasi Proaktif** - Lonceng notifikasi: stok menipis, garansi segera berakhir, invoice belum dibayar
- **Cetak Invoice & Work Order** - Layout cetak A4 siap pakai (nota customer & surat perintah kerja)
- **Pembayaran Parsial** - Invoice bisa dibayar bertahap dengan riwayat pembayaran lengkap
- **Garansi Otomatis** - Garansi servis (30 hari) & garansi sparepart dibuat otomatis saat WO selesai
- **Integrasi Stok Work Order** - Stok sparepart dikurangi otomatis saat WO selesai (+reversal jika dibatalkan)
- **Klaim Asuransi** - Alur kerja klaim lengkap: Draft → Diajukan → Survey → Disetujui → Dikerjakan → Selesai → Ditagihkan → Dibayar → Tutup (dengan riwayat status, item klaim, dokumen pendukung & master perusahaan asuransi)
- **Backup & Restore** - Export/import seluruh database Supabase ke file JSON
- **PWA** - Aplikasi dapat di-install di HP/PC (manifest + service worker, offline app shell)
- **Pengaturan** - Manajemen pengguna, Role-Based Access Control (RBAC), audit trail

## 👥 Role & Permissions

| Feature | ADMIN | STAFF |
|---------|-------|-------|
| Dashboard | ✅ | ✅ |
| Lihat Sparepart | ✅ | ✅ |
| Tambah/Edit/Hapus Sparepart | ✅ | ❌ |
| Barang Masuk/Keluar | ✅ | ✅ |
| Low Stock Alert | ✅ | ✅ |
| Manajemen Supplier | ✅ | ✅ |
| Laporan & Analisis | ✅ | ✅ |
| Barcode Scanner | ✅ | ✅ |
| Pengaturan (User & Audit) | ✅ | ❌ |

## 🔑 Akun Default

- **Admin**: `admin` / `admin123`
- **Staff**: `staff` / `staff123`

> ⚠️ Password disimpan dalam bentuk hash. Ganti password setelah login pertama.

## 🛠️ Teknologi

- React 19
- Vite 8
- Tailwind CSS 4
- React Router 7
- Lucide React (icons)
- OXLint (linter)
- Supabase sebagai database utama (real-time REST API)
- localStorage hanya untuk cache sementara (sidebar state, dll)

## 📦 Instalasi

```bash
# Install dependencies
npm install

# Jalankan development server
npm run dev

# Build produksi
npm run build

# Jalankan lint
npm run lint
```

## ⚙️ Konfigurasi Environment

Aplikasi ini menggunakan **SATU database Supabase** (project: `gudangbengkel`) untuk semua perangkat.
Baik dibuka dari HP A/B/C maupun PC A/B/C, semua membaca & menulis ke database yang sama,
sehingga data selalu konsisten tanpa selisih (didukung realtime sync).

Konfigurasi sudah tertanam sebagai fallback di `src/services/supabaseClient.js`,
jadi aplikasi tetap terhubung ke database yang benar meski tanpa file `.env`.

Jika ingin override, buat file `.env.local`:

```env
# API (opsional, untuk backend tambahan)
VITE_API_URL=http://localhost:3000/api

# Supabase (wajib untuk database)
VITE_SUPABASE_URL=https://dyruuzzrdknwjcjakmif.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_JuFWMmVwsX0ZJQtqt1bVaw_LB9LM-Ef
```

| Variable | Deskripsi | Default |
|----------|-----------|---------|
| `VITE_API_URL` | URL backend API (opsional) | `http://localhost:3000/api` |
| `VITE_SUPABASE_URL` | URL project Supabase | `https://dyruuzzrdknwjcjakmif.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Anon key Supabase | `sb_publishable_JuFWMmVwsX0ZJQtqt1bVaw_LB9LM-Ef` |

### 🗄️ Setup Database

Skema lengkap + data awal tersedia di `supabase/setup.sql`.
Jalankan sekali di Supabase Dashboard > SQL Editor jika membuat project baru.
Script verifikasi tersedia di folder `scripts/` (`check-db.mjs`, `verify-db.mjs`).

> ⚠️ **Migrasi fitur baru**: jalankan juga `supabase/feature_schema.sql` dan `supabase/insurance_schema.sql`
> di Supabase SQL Editor untuk membuat tabel retur, stock opname, pembayaran invoice,
> klaim asuransi (5 tabel), serta kolom pendukung (`garansi_bulan`, `stok_diproses`,
> `garansi_dibuat`, `jumlah_dibayar`, `sisa_bayar`). Kedua skrip idempotent — aman dijalankan berulang kali.

### 🛡️ Alur Kerja Klaim Asuransi

```
DRAFT ──submit──▶ SUBMITTED ──jadwal survey──▶ SURVEY_SCHEDULED ──input hasil──▶ SURVEYED
   │                    │                                                          │
   │ cancel             │ reject / cancel                                          ├── approve ──▶ APPROVED
   ▼                    ▼                                                          │                  │
CANCELLED            REJECTED ◀────────────────────────────────────────────────────┘                  │ start repair
                                                                                                      ▼
CLOSED ◀──tutup── PAID ◀──catat bayar── INVOICED ◀──tagih── COMPLETED ◀──selesaikan── IN_PROGRESS
                        REJECTED ──tutup──▶ CLOSED
```

| Status | Deskripsi | Aksi yang tersedia |
|--------|-----------|-------------------|
| Draft | Klaim dibuat, data diisi | Ajukan ke asuransi, Batalkan |
| Diajukan | Klaim dikirim ke asuransi | Jadwalkan survey, Tolak, Batalkan |
| Jadwal Survey | Surveyor asuransi dijadwalkan | Input hasil survey, Tolak |
| Sudah Disurvey | Hasil survey tercatat | Setujui (dengan nilai), Tolak |
| Disetujui | Nilai persetujuan ditetapkan | Mulai pengerjaan (+link WO), Tolak |
| Dikerjakan | Servis berjalan (link Work Order) | Selesaikan servis (biaya aktual) |
| Servis Selesai | Biaya aktual final | Tagih ke asuransi (+link invoice) |
| Ditagihkan | Tagihan dikirim ke asuransi | Catat pembayaran |
| Dibayar Asuransi | Pembayaran diterima | Tutup klaim |
| Selesai / Ditolak / Dibatalkan | Klaim selesai | Tutup (untuk ditolak) |

Setiap transisi status otomatis tercatat di tabel `claim_status_history` (siapa, kapan, catatan).

## 🔌 Integrasi Backend

Aplikasi ini mendukung hybrid data source:
- Jika `VITE_API_URL` tersedia dan backend aktif, data diambil dari API
- Jika backend tidak tersedia, aplikasi otomatis fallback ke `localStorage`

Endpoint yang diharapkan:
- `GET/POST/PUT/DELETE /spareparts`
- `GET/POST/PUT/DELETE /suppliers`
- `GET/POST/PUT/DELETE /transactions`
- `GET/POST /tickets`

## 📁 Struktur Proyek

```
src/
├── components/     # Komponen reusable (Layout, Toast, Skeleton, dll)
├── pages/           # Halaman-halaman utama
├── services/        # Service layer (Auth, Sparepart, Supplier, Transaction, RBAC, dll)
├── utils/           # Utility functions (format Rupiah, dll)
└── App.jsx          # Konfigurasi rute & proteksi RBAC
```

## 🔐 Keamanan

- Password di-hash sebelum disimpan di localStorage (untuk auth lokal)
- Role-Based Access Control (RBAC) untuk halaman dan aksi
- Audit trail semua aktivitas penting
- Proteksi route berbasis permission (bukan hanya UI)
- Data inventori (sparepart, supplier, transaksi) tersimpan di Supabase

## 📝 Catatan Pengembangan

- Data inventori persist di **Supabase** (database online)
- localStorage hanya digunakan untuk state UI (sidebar collapsed, dll)
- Gunakan tombol "Reset Data Aplikasi" di sidebar untuk membersihkan cache browser
- Kredensial default tidak lagi ditampilkan di halaman login

## 🧪 Testing

```bash
# Jalankan lint
npm run lint
```

## 📄 Lisensi

MIT
</｜DSML｜tool>
</｜DSML｜tool_output>