# Unit Check - Sistem Manajemen Sparepart

Aplikasi web untuk mengelola inventori sparepart dengan fitur lengkap: manajemen stok, transaksi barang masuk/keluar, supplier tracking, low stock alert, barcode scanner, dan laporan analisis.

## 🚀 Fitur

- **Dashboard** - Ringkasan inventori, statistik, peringatan stok minimum, transaksi terbaru
- **Manajemen Sparepart** - CRUD sparepart, import/export CSV, search & filter, pagination
- **Barang Masuk** - Catat penerimaan sparepart dari supplier dengan update stok otomatis
- **Barang Keluar** - Catat pengeluaran sparepart dengan validasi stok tersedia
- **Low Stock Alert** - Deteksi sparepart yang stoknya di bawah minimum
- **Manajemen Supplier** - Kelola data supplier sparepart
- **Laporan & Analisis** - Grafik transaksi bulanan, sparepart terlaris, pergerakan stok
- **Barcode Scanner** - Scan barcode untuk cek stok dan informasi sparepart
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

Buat file `.env.local`:

```env
# API (opsional, untuk backend tambahan)
VITE_API_URL=http://localhost:3000/api

# Supabase (wajib untuk database)
VITE_SUPABASE_URL=https://oapbpywsvgzegrhfhghn.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_2e3hma5Eo6DXz6_i034kDQ_rQl9lOhK
```

| Variable | Deskripsi | Default |
|----------|-----------|---------|
| `VITE_API_URL` | URL backend API (opsional) | `http://localhost:3000/api` |
| `VITE_SUPABASE_URL` | URL project Supabase | `https://oapbpywsvgzegrhfhghn.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Anon key Supabase | `sb_publishable_2e3hma5Eo6DXz6_i034kDQ_rQl9lOhK` |

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