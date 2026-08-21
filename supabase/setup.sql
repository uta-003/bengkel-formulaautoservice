-- ============================================================
-- SETUP LENGKAP DATABASE SUPABASE - Bengkel Formula Auto Service
-- ============================================================
-- File ini membuat SEMUA tabel + SEED DATA awal.
-- Cara pakai: Buka Supabase Dashboard > SQL Editor > New Query
--             Paste seluruh isi file ini > Run
-- Aman dijalankan berulang kali (idempotent).
-- ============================================================

-- ============================================
-- TABEL: suppliers
-- ============================================
CREATE TABLE IF NOT EXISTS public.suppliers (
  id BIGSERIAL PRIMARY KEY,
  kode TEXT UNIQUE,
  nama TEXT NOT NULL,
  kontak TEXT,
  telepon TEXT,
  email TEXT,
  alamat TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- TABEL: spareparts
-- ============================================
CREATE TABLE IF NOT EXISTS public.spareparts (
  id BIGSERIAL PRIMARY KEY,
  kode TEXT UNIQUE,
  nama TEXT NOT NULL,
  kategori TEXT,
  merk TEXT,
  supplier_id BIGINT REFERENCES public.suppliers(id) ON DELETE SET NULL,
  harga_beli NUMERIC DEFAULT 0,
  harga_jual NUMERIC DEFAULT 0,
  stok INTEGER DEFAULT 0,
  stok_minimum INTEGER DEFAULT 0,
  lokasi TEXT,
  barcode TEXT UNIQUE,
  satuan TEXT DEFAULT 'pcs',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- TABEL: transactions
-- ============================================
CREATE TABLE IF NOT EXISTS public.transactions (
  id BIGSERIAL PRIMARY KEY,
  tipe TEXT NOT NULL CHECK (tipe IN ('MASUK', 'KELUAR')),
  nomor TEXT UNIQUE,
  sparepart_id BIGINT REFERENCES public.spareparts(id) ON DELETE SET NULL,
  supplier_id BIGINT REFERENCES public.suppliers(id) ON DELETE SET NULL,
  jumlah INTEGER NOT NULL DEFAULT 0,
  harga_satuan NUMERIC DEFAULT 0,
  total NUMERIC DEFAULT 0,
  tanggal TIMESTAMPTZ DEFAULT now(),
  keterangan TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- TABEL: stock_movements
-- ============================================
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id BIGSERIAL PRIMARY KEY,
  sparepart_id BIGINT REFERENCES public.spareparts(id) ON DELETE SET NULL,
  tipe TEXT NOT NULL CHECK (tipe IN ('MASUK', 'KELUAR')),
  jumlah INTEGER NOT NULL DEFAULT 0,
  stok_sebelum INTEGER DEFAULT 0,
  stok_sesudah INTEGER DEFAULT 0,
  tanggal TIMESTAMPTZ DEFAULT now(),
  referensi_id BIGINT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- TABEL: scan_history
-- ============================================
CREATE TABLE IF NOT EXISTS public.scan_history (
  id BIGSERIAL PRIMARY KEY,
  barcode TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('FOUND', 'NOT_FOUND')),
  sparepart_id BIGINT REFERENCES public.spareparts(id) ON DELETE SET NULL,
  sparepart_name TEXT,
  scanned_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- TABEL: users
-- ============================================
CREATE TABLE IF NOT EXISTS public.users (
  id BIGSERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  nama TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'STAFF' CHECK ("role" IN ('ADMIN', 'STAFF')),
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- TABEL: audit_log
-- ============================================
CREATE TABLE IF NOT EXISTS public.audit_log (
  id BIGSERIAL PRIMARY KEY,
  "timestamp" TIMESTAMPTZ DEFAULT now(),
  "user" TEXT,
  "role" TEXT,
  action TEXT NOT NULL,
  detail TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- TABEL: customers
-- ============================================
CREATE TABLE IF NOT EXISTS public.customers (
  id BIGSERIAL PRIMARY KEY,
  kode TEXT UNIQUE,
  nama TEXT NOT NULL,
  telepon TEXT,
  email TEXT,
  alamat TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- TABEL: vehicles
-- ============================================
CREATE TABLE IF NOT EXISTS public.vehicles (
  id BIGSERIAL PRIMARY KEY,
  customer_id BIGINT REFERENCES public.customers(id) ON DELETE CASCADE,
  plat_nomor TEXT NOT NULL,
  merk TEXT,
  tipe TEXT,
  tahun TEXT,
  warna TEXT,
  km_terakhir INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- TABEL: mechanics
-- ============================================
CREATE TABLE IF NOT EXISTS public.mechanics (
  id BIGSERIAL PRIMARY KEY,
  kode TEXT UNIQUE,
  nama TEXT NOT NULL,
  keahlian TEXT,
  telepon TEXT,
  email TEXT,
  tarif_per_jam NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'AKTIF' CHECK (status IN ('AKTIF', 'TIDAK_AKTIF')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- TABEL: service_packages
-- ============================================
CREATE TABLE IF NOT EXISTS public.service_packages (
  id BIGSERIAL PRIMARY KEY,
  kode TEXT UNIQUE,
  nama TEXT NOT NULL,
  deskripsi TEXT,
  harga NUMERIC DEFAULT 0,
  estimasi_durasi INTEGER DEFAULT 0,
  kategori TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- TABEL: work_orders
-- ============================================
CREATE TABLE IF NOT EXISTS public.work_orders (
  id BIGSERIAL PRIMARY KEY,
  nomor_wo TEXT UNIQUE,
  customer_id BIGINT REFERENCES public.customers(id) ON DELETE SET NULL,
  vehicle_id BIGINT REFERENCES public.vehicles(id) ON DELETE SET NULL,
  mechanic_id BIGINT REFERENCES public.mechanics(id) ON DELETE SET NULL,
  service_package_id BIGINT REFERENCES public.service_packages(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'CANCELLED', 'DELIVERED')),
  km_masuk INTEGER DEFAULT 0,
  km_keluar INTEGER DEFAULT 0,
  keluhan TEXT,
  catatan TEXT,
  estimasi_biaya NUMERIC DEFAULT 0,
  total_biaya NUMERIC DEFAULT 0,
  total_labor NUMERIC DEFAULT 0,
  total_parts NUMERIC DEFAULT 0,
  tanggal_masuk TIMESTAMPTZ DEFAULT now(),
  tanggal_selesai TIMESTAMPTZ DEFAULT NULL,
  tanggal_kirim TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- TABEL: wo_items
-- ============================================
CREATE TABLE IF NOT EXISTS public.wo_items (
  id BIGSERIAL PRIMARY KEY,
  work_order_id BIGINT REFERENCES public.work_orders(id) ON DELETE CASCADE,
  sparepart_id BIGINT REFERENCES public.spareparts(id) ON DELETE SET NULL,
  jumlah INTEGER NOT NULL DEFAULT 0,
  harga_satuan NUMERIC DEFAULT 0,
  total NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- TABEL: wo_labor
-- ============================================
CREATE TABLE IF NOT EXISTS public.wo_labor (
  id BIGSERIAL PRIMARY KEY,
  work_order_id BIGINT REFERENCES public.work_orders(id) ON DELETE CASCADE,
  mechanic_id BIGINT REFERENCES public.mechanics(id) ON DELETE SET NULL,
  jam DECIMAL(5,2) DEFAULT 0,
  tarif_per_jam NUMERIC DEFAULT 0,
  total NUMERIC DEFAULT 0,
  keterangan TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- TABEL: warranties
-- ============================================
CREATE TABLE IF NOT EXISTS public.warranties (
  id BIGSERIAL PRIMARY KEY,
  kode TEXT UNIQUE,
  customer_id BIGINT REFERENCES public.customers(id) ON DELETE SET NULL,
  vehicle_id BIGINT REFERENCES public.vehicles(id) ON DELETE SET NULL,
  work_order_id BIGINT REFERENCES public.work_orders(id) ON DELETE SET NULL,
  sparepart_id BIGINT REFERENCES public.spareparts(id) ON DELETE SET NULL,
  jenis TEXT NOT NULL CHECK (jenis IN ('SERVICE', 'SPAREPART')),
  judul TEXT NOT NULL,
  deskripsi TEXT,
  tanggal_mulai TIMESTAMPTZ DEFAULT now(),
  tanggal_berakhir TIMESTAMPTZ DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'AKTIF' CHECK (status IN ('AKTIF', 'EXPIRED', 'CLAIMED', 'CANCELLED')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- TABEL: invoices
-- ============================================
CREATE TABLE IF NOT EXISTS public.invoices (
  id BIGSERIAL PRIMARY KEY,
  nomor_invoice TEXT UNIQUE,
  work_order_id BIGINT REFERENCES public.work_orders(id) ON DELETE SET NULL,
  customer_id BIGINT REFERENCES public.customers(id) ON DELETE SET NULL,
  vehicle_id BIGINT REFERENCES public.vehicles(id) ON DELETE SET NULL,
  total_labor NUMERIC DEFAULT 0,
  total_parts NUMERIC DEFAULT 0,
  total_biaya NUMERIC DEFAULT 0,
  diskon NUMERIC DEFAULT 0,
  pajak NUMERIC DEFAULT 0,
  grand_total NUMERIC DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PAID', 'CANCELLED', 'PARTIAL')),
  tanggal_invoice TIMESTAMPTZ DEFAULT now(),
  tanggal_bayar TIMESTAMPTZ DEFAULT NULL,
  metode_bayar TEXT CHECK (metode_bayar IN ('TUNAI', 'TRANSFER', 'KARTU', 'E_WALLET', 'KREDIT')),
  keterangan TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- TABEL: vehicle_qr_codes
-- ============================================
CREATE TABLE IF NOT EXISTS public.vehicle_qr_codes (
  id BIGSERIAL PRIMARY KEY,
  vehicle_id BIGINT REFERENCES public.vehicles(id) ON DELETE CASCADE,
  qr_code TEXT UNIQUE,
  qr_data TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- ENSURE COLUMNS (idempotent untuk tabel lama)
-- ============================================
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS kode TEXT;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS kontak TEXT;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS telepon TEXT;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS alamat TEXT;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE public.spareparts ADD COLUMN IF NOT EXISTS satuan TEXT DEFAULT 'pcs';
ALTER TABLE public.spareparts ADD COLUMN IF NOT EXISTS lokasi TEXT;
ALTER TABLE public.spareparts ADD COLUMN IF NOT EXISTS barcode TEXT;
ALTER TABLE public.spareparts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS nomor TEXT;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS keterangan TEXT;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE public.stock_movements ADD COLUMN IF NOT EXISTS referensi_id BIGINT;
ALTER TABLE public.stock_movements ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE public.scan_history ADD COLUMN IF NOT EXISTS sparepart_name TEXT;
ALTER TABLE public.scan_history ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE public.audit_log ADD COLUMN IF NOT EXISTS detail TEXT;
ALTER TABLE public.audit_log ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS alamat TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS warna TEXT;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE public.mechanics ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.mechanics ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE public.service_packages ADD COLUMN IF NOT EXISTS kategori TEXT;
ALTER TABLE public.service_packages ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS catatan TEXT;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE public.wo_items ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.wo_labor ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.warranties ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS keterangan TEXT;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.vehicle_qr_codes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_spareparts_supplier_id ON public.spareparts (supplier_id);
CREATE INDEX IF NOT EXISTS idx_spareparts_kategori ON public.spareparts (kategori);
CREATE INDEX IF NOT EXISTS idx_spareparts_barcode ON public.spareparts (barcode);
CREATE INDEX IF NOT EXISTS idx_transactions_sparepart_id ON public.transactions (sparepart_id);
CREATE INDEX IF NOT EXISTS idx_transactions_supplier_id ON public.transactions (supplier_id);
CREATE INDEX IF NOT EXISTS idx_transactions_tanggal ON public.transactions (tanggal DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_tipe ON public.transactions (tipe);
CREATE INDEX IF NOT EXISTS idx_stock_movements_sparepart_id ON public.stock_movements (sparepart_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_tanggal ON public.stock_movements (tanggal DESC);
CREATE INDEX IF NOT EXISTS idx_scan_history_scanned_at ON public.scan_history (scanned_at DESC);
CREATE INDEX IF NOT EXISTS idx_scan_history_barcode ON public.scan_history (barcode);
CREATE INDEX IF NOT EXISTS idx_users_username ON public.users (username);
CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON public.audit_log ("timestamp" DESC);
CREATE INDEX IF NOT EXISTS idx_customers_kode ON public.customers (kode);
CREATE INDEX IF NOT EXISTS idx_vehicles_customer_id ON public.vehicles (customer_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_plat_nomor ON public.vehicles (plat_nomor);
CREATE INDEX IF NOT EXISTS idx_mechanics_kode ON public.mechanics (kode);
CREATE INDEX IF NOT EXISTS idx_mechanics_status ON public.mechanics (status);
CREATE INDEX IF NOT EXISTS idx_service_packages_kode ON public.service_packages (kode);
CREATE INDEX IF NOT EXISTS idx_service_packages_kategori ON public.service_packages (kategori);
CREATE INDEX IF NOT EXISTS idx_work_orders_nomor ON public.work_orders (nomor_wo);
CREATE INDEX IF NOT EXISTS idx_work_orders_customer_id ON public.work_orders (customer_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_vehicle_id ON public.work_orders (vehicle_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_mechanic_id ON public.work_orders (mechanic_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_status ON public.work_orders (status);
CREATE INDEX IF NOT EXISTS idx_work_orders_tanggal_masuk ON public.work_orders (tanggal_masuk DESC);
CREATE INDEX IF NOT EXISTS idx_wo_items_work_order_id ON public.wo_items (work_order_id);
CREATE INDEX IF NOT EXISTS idx_wo_items_sparepart_id ON public.wo_items (sparepart_id);
CREATE INDEX IF NOT EXISTS idx_wo_labor_work_order_id ON public.wo_labor (work_order_id);
CREATE INDEX IF NOT EXISTS idx_wo_labor_mechanic_id ON public.wo_labor (mechanic_id);
CREATE INDEX IF NOT EXISTS idx_warranties_kode ON public.warranties (kode);
CREATE INDEX IF NOT EXISTS idx_warranties_vehicle_id ON public.warranties (vehicle_id);
CREATE INDEX IF NOT EXISTS idx_warranties_status ON public.warranties (status);
CREATE INDEX IF NOT EXISTS idx_invoices_nomor ON public.invoices (nomor_invoice);
CREATE INDEX IF NOT EXISTS idx_invoices_work_order_id ON public.invoices (work_order_id);
CREATE INDEX IF NOT EXISTS idx_invoices_customer_id ON public.invoices (customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices (status);
CREATE INDEX IF NOT EXISTS idx_invoices_tanggal_invoice ON public.invoices (tanggal_invoice DESC);
CREATE INDEX IF NOT EXISTS idx_vehicle_qr_codes_vehicle_id ON public.vehicle_qr_codes (vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_qr_codes_qr_code ON public.vehicle_qr_codes (qr_code);

-- ============================================
-- ROW LEVEL SECURITY + POLICIES
-- (anon key dipakai langsung oleh aplikasi, jadi policy terbuka)
-- ============================================
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'suppliers','spareparts','transactions','stock_movements','scan_history',
    'users','audit_log','customers','vehicles','mechanics','service_packages',
    'work_orders','wo_items','wo_labor','warranties','invoices','vehicle_qr_codes'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "Allow all operations on %s" ON public.%I', t, t);
    EXECUTE format('CREATE POLICY "Allow all operations on %s" ON public.%I FOR ALL USING (true) WITH CHECK (true)', t, t);
  END LOOP;
END $$;

-- ============================================
-- TRIGGER updated_at otomatis
-- ============================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'suppliers','spareparts','transactions','stock_movements','scan_history',
    'users','audit_log','customers','vehicles','mechanics','service_packages',
    'work_orders','wo_items','wo_labor','warranties','invoices','vehicle_qr_codes'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trigger_update_%s_updated_at ON public.%I', t, t);
    EXECUTE format('CREATE TRIGGER trigger_update_%s_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()', t, t);
  END LOOP;
END $$;

-- ============================================
-- REALTIME PUBLICATION (agar semua perangkat sinkron instan)
-- ============================================
DROP PUBLICATION IF EXISTS supabase_realtime;
CREATE PUBLICATION supabase_realtime FOR TABLE
  public.suppliers,
  public.spareparts,
  public.transactions,
  public.stock_movements,
  public.scan_history,
  public.users,
  public.audit_log,
  public.customers,
  public.vehicles,
  public.mechanics,
  public.service_packages,
  public.work_orders,
  public.wo_items,
  public.wo_labor,
  public.warranties,
  public.invoices,
  public.vehicle_qr_codes;

-- ============================================================
-- SEED DATA AWAL
-- ============================================================

-- ---- USERS (password sudah di-hash sesuai authService) ----
INSERT INTO public.users (username, password, nama, "role", email)
VALUES
  ('admin', 'h_g10hvh_8', 'Admin Utama', 'ADMIN', 'admin@example.com'),
  ('staff', 'h_ll42mq_8', 'Staff Gudang', 'STAFF', 'staff@example.com')
ON CONFLICT (username) DO NOTHING;

-- ---- SUPPLIERS ----
INSERT INTO public.suppliers (kode, nama, kontak, telepon, email, alamat)
SELECT * FROM (VALUES
  ('SUP-001', 'PT Auto Parts Indonesia', 'Budi Santoso', '081234567801', 'sales@autoparts.co.id', 'Jl. Industri Raya No. 10, Jakarta'),
  ('SUP-002', 'CV Sumber Sparepart', 'Andi Wijaya', '081234567802', 'cv.sumber@gmail.com', 'Jl. Pasar Baru No. 25, Bandung'),
  ('SUP-003', 'Tokyo Parts Nusantara', 'Kenji Tanaka', '081234567803', 'kenji@tokyoparts.id', 'Jl. Gajah Mada No. 88, Surabaya'),
  ('SUP-004', 'Bengkel Supply Jaya', 'Rudi Hartono', '081234567804', 'supply.jaya@yahoo.com', 'Jl. Merdeka No. 45, Semarang')
) AS v(kode, nama, kontak, telepon, email, alamat)
WHERE NOT EXISTS (SELECT 1 FROM public.suppliers);

-- ---- SPAREPARTS ----
INSERT INTO public.spareparts (kode, nama, kategori, merk, supplier_id, harga_beli, harga_jual, stok, stok_minimum, lokasi, barcode, satuan)
SELECT * FROM (VALUES
  ('SP-001', 'Filter Oli Toyota Avanza', 'Filter', 'Toyota', (SELECT id FROM public.suppliers WHERE kode='SUP-001'), 35000, 55000, 40, 10, 'Rak A1', '8991002100015', 'pcs'),
  ('SP-002', 'Filter Udara Honda Brio', 'Filter', 'Honda', (SELECT id FROM public.suppliers WHERE kode='SUP-001'), 45000, 70000, 25, 8, 'Rak A2', '8991002100022', 'pcs'),
  ('SP-003', 'Busi Iridium NGK', 'Kelistrikan', 'NGK', (SELECT id FROM public.suppliers WHERE kode='SUP-003'), 85000, 125000, 60, 15, 'Rak B1', '8991002100039', 'pcs'),
  ('SP-004', 'Oli Mesin Castrol 10W-40', 'Oli', 'Castrol', (SELECT id FROM public.suppliers WHERE kode='SUP-002'), 185000, 245000, 50, 12, 'Rak C1', '8991002100046', 'liter'),
  ('SP-005', 'Kampas Rem Depan Daihatsu', 'Rem', 'Daihatsu', (SELECT id FROM public.suppliers WHERE kode='SUP-003'), 220000, 320000, 18, 6, 'Rak B2', '8991002100053', 'set'),
  ('SP-006', 'Aki GS Astra 45Ah', 'Kelistrikan', 'GS Astra', (SELECT id FROM public.suppliers WHERE kode='SUP-004'), 750000, 950000, 10, 4, 'Gudang D', '8991002100060', 'pcs'),
  ('SP-007', 'V-Belt Mitsubishi', 'Transmisi', 'Mitsubishi', (SELECT id FROM public.suppliers WHERE kode='SUP-002'), 65000, 95000, 30, 10, 'Rak A3', '8991002100077', 'pcs'),
  ('SP-008', 'Shock Breaker Belakang Suzuki', 'Suspensi', 'Suzuki', (SELECT id FROM public.suppliers WHERE kode='SUP-003'), 380000, 520000, 12, 5, 'Gudang D', '8991002100084', 'pcs'),
  ('SP-009', 'Filter AC Universal', 'Filter', 'Denso', (SELECT id FROM public.suppliers WHERE kode='SUP-001'), 55000, 85000, 35, 10, 'Rak A4', '8991002100091', 'pcs'),
  ('SP-010', 'Oli Gardan 85W-140', 'Oli', 'Shell', (SELECT id FROM public.suppliers WHERE kode='SUP-002'), 95000, 135000, 22, 8, 'Rak C2', '8991002100107', 'liter')
) AS v(kode, nama, kategori, merk, supplier_id, harga_beli, harga_jual, stok, stok_minimum, lokasi, barcode, satuan)
WHERE NOT EXISTS (SELECT 1 FROM public.spareparts);

-- ---- CUSTOMERS ----
INSERT INTO public.customers (kode, nama, telepon, email, alamat)
SELECT * FROM (VALUES
  ('CUS-001', 'Ahmad Fauzi', '081298765401', 'ahmad.fauzi@gmail.com', 'Jl. Melati No. 12, Jakarta Timur'),
  ('CUS-002', 'Siti Rahayu', '081298765402', 'siti.rahayu@gmail.com', 'Jl. Kenanga No. 8, Depok'),
  ('CUS-003', 'Bambang Pratomo', '081298765403', 'bambang.p@yahoo.com', 'Jl. Anggrek No. 21, Bekasi'),
  ('CUS-004', 'Dewi Lestari', '081298765404', 'dewi.lestari@gmail.com', 'Jl. Mawar No. 5, Tangerang'),
  ('CUS-005', 'Agus Salim', '081298765405', 'agus.salim@gmail.com', 'Jl. Dahlia No. 17, Bogor')
) AS v(kode, nama, telepon, email, alamat)
WHERE NOT EXISTS (SELECT 1 FROM public.customers);

-- ---- VEHICLES ----
INSERT INTO public.vehicles (customer_id, plat_nomor, merk, tipe, tahun, warna, km_terakhir)
SELECT * FROM (VALUES
  ((SELECT id FROM public.customers WHERE kode='CUS-001'), 'B1234ABC', 'Toyota', 'Avanza G', '2019', 'Putih', 45000),
  ((SELECT id FROM public.customers WHERE kode='CUS-002'), 'B5678DEF', 'Honda', 'Brio Satya', '2021', 'Merah', 28000),
  ((SELECT id FROM public.customers WHERE kode='CUS-003'), 'B9012GHI', 'Suzuki', 'Ertiga GL', '2018', 'Silver', 72000),
  ((SELECT id FROM public.customers WHERE kode='CUS-004'), 'B3456JKL', 'Daihatsu', 'Xenia R', '2020', 'Hitam', 35000),
  ((SELECT id FROM public.customers WHERE kode='CUS-005'), 'B7890MNO', 'Mitsubishi', 'Xpander Ultimate', '2022', 'Biru', 15000)
) AS v(customer_id, plat_nomor, merk, tipe, tahun, warna, km_terakhir)
WHERE NOT EXISTS (SELECT 1 FROM public.vehicles);

-- ---- MECHANICS ----
INSERT INTO public.mechanics (kode, nama, keahlian, telepon, email, tarif_per_jam, status)
SELECT * FROM (VALUES
  ('MEC-001', 'Joko Susilo', 'Engine & Transmission', '081377780001', 'joko@fas.co.id', 50000, 'AKTIF'),
  ('MEC-002', 'Hendra Gunawan', 'Electrical & AC', '081377780002', 'hendra@fas.co.id', 45000, 'AKTIF'),
  ('MEC-003', 'Slamet Riyadi', 'Underchassis & Rem', '081377780003', 'slamet@fas.co.id', 40000, 'AKTIF'),
  ('MEC-004', 'Wayan Saputra', 'General Service', '081377780004', 'wayan@fas.co.id', 35000, 'AKTIF')
) AS v(kode, nama, keahlian, telepon, email, tarif_per_jam, status)
WHERE NOT EXISTS (SELECT 1 FROM public.mechanics);

-- ---- SERVICE PACKAGES ----
INSERT INTO public.service_packages (kode, nama, deskripsi, harga, estimasi_durasi, kategori)
SELECT * FROM (VALUES
  ('PKG-001', 'Service Ringan', 'Ganti oli mesin, filter oli, cek 20 titik', 250000, 60, 'Maintenance'),
  ('PKG-002', 'Service Berat', 'Tune up lengkap, ganti busi, filter udara, cek mesin menyeluruh', 750000, 180, 'Maintenance'),
  ('PKG-003', 'Servis AC Mobil', 'Cuci evaporator, isi freon, cek kebocoran', 350000, 120, 'AC'),
  ('PKG-004', 'Balancing & Spooring', 'Setinggi roda dan balance 4 ban', 400000, 90, 'Ban & Roda'),
  ('PKG-005', 'Ganti Kampas Rem', 'Pembongkaran dan pemasangan kampas rem depan/belakang', 300000, 90, 'Rem')
) AS v(kode, nama, deskripsi, harga, estimasi_durasi, kategori)
WHERE NOT EXISTS (SELECT 1 FROM public.service_packages);

-- ============================================================
-- SELESAI - Database siap digunakan dari semua perangkat
-- ============================================================