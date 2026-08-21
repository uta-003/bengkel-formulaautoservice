-- Schema tambahan untuk modul Service/Repair & Sparepart
-- Tabel: customers, vehicles, mechanics, work_orders, wo_items, wo_labor,
--        service_packages, warranties, invoices, vehicle_qr_codes
-- Jalankan di Supabase SQL Editor setelah schema.sql utama

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
  estimasi_durasi INTEGER DEFAULT 0, -- dalam menit
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
-- TABEL: wo_items (sparepart yang dipakai dalam work order)
-- ============================================
CREATE TABLE IF NOT EXISTS public.wo_items (
  id BIGSERIAL PRIMARY KEY,
  work_order_id BIGINT REFERENCES public.work_orders(id) ON DELETE CASCADE,
  sparepart_id BIGINT REFERENCES public.spareparts(id) ON DELETE SET NULL,
  jumlah INTEGER NOT NULL DEFAULT 0,
  harga_satuan NUMERIC DEFAULT 0,
  total NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- TABEL: wo_labor (biaya tenaga kerja)
-- ============================================
CREATE TABLE IF NOT EXISTS public.wo_labor (
  id BIGSERIAL PRIMARY KEY,
  work_order_id BIGINT REFERENCES public.work_orders(id) ON DELETE CASCADE,
  mechanic_id BIGINT REFERENCES public.mechanics(id) ON DELETE SET NULL,
  jam DECIMAL(5,2) DEFAULT 0,
  tarif_per_jam NUMERIC DEFAULT 0,
  total NUMERIC DEFAULT 0,
  keterangan TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
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
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- ENSURE COLUMNS (idempotent)
-- ============================================
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS kode TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS nama TEXT NOT NULL DEFAULT '';
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS telepon TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS alamat TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS customer_id BIGINT REFERENCES public.customers(id) ON DELETE CASCADE;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS plat_nomor TEXT NOT NULL DEFAULT '';
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS merk TEXT;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS tipe TEXT;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS tahun TEXT;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS warna TEXT;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS km_terakhir INTEGER DEFAULT 0;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE public.mechanics ADD COLUMN IF NOT EXISTS kode TEXT;
ALTER TABLE public.mechanics ADD COLUMN IF NOT EXISTS nama TEXT NOT NULL DEFAULT '';
ALTER TABLE public.mechanics ADD COLUMN IF NOT EXISTS keahlian TEXT;
ALTER TABLE public.mechanics ADD COLUMN IF NOT EXISTS telepon TEXT;
ALTER TABLE public.mechanics ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.mechanics ADD COLUMN IF NOT EXISTS tarif_per_jam NUMERIC DEFAULT 0;
ALTER TABLE public.mechanics ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'AKTIF';
ALTER TABLE public.mechanics ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.mechanics ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE public.service_packages ADD COLUMN IF NOT EXISTS kode TEXT;
ALTER TABLE public.service_packages ADD COLUMN IF NOT EXISTS nama TEXT NOT NULL DEFAULT '';
ALTER TABLE public.service_packages ADD COLUMN IF NOT EXISTS deskripsi TEXT;
ALTER TABLE public.service_packages ADD COLUMN IF NOT EXISTS harga NUMERIC DEFAULT 0;
ALTER TABLE public.service_packages ADD COLUMN IF NOT EXISTS estimasi_durasi INTEGER DEFAULT 0;
ALTER TABLE public.service_packages ADD COLUMN IF NOT EXISTS kategori TEXT;
ALTER TABLE public.service_packages ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.service_packages ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS nomor_wo TEXT;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS customer_id BIGINT REFERENCES public.customers(id) ON DELETE SET NULL;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS vehicle_id BIGINT REFERENCES public.vehicles(id) ON DELETE SET NULL;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS mechanic_id BIGINT REFERENCES public.mechanics(id) ON DELETE SET NULL;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS service_package_id BIGINT REFERENCES public.service_packages(id) ON DELETE SET NULL;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'OPEN';
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS km_masuk INTEGER DEFAULT 0;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS km_keluar INTEGER DEFAULT 0;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS keluhan TEXT;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS catatan TEXT;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS estimasi_biaya NUMERIC DEFAULT 0;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS total_biaya NUMERIC DEFAULT 0;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS total_labor NUMERIC DEFAULT 0;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS total_parts NUMERIC DEFAULT 0;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS tanggal_masuk TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS tanggal_selesai TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS tanggal_kirim TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE public.wo_items ADD COLUMN IF NOT EXISTS work_order_id BIGINT REFERENCES public.work_orders(id) ON DELETE CASCADE;
ALTER TABLE public.wo_items ADD COLUMN IF NOT EXISTS sparepart_id BIGINT REFERENCES public.spareparts(id) ON DELETE SET NULL;
ALTER TABLE public.wo_items ADD COLUMN IF NOT EXISTS jumlah INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.wo_items ADD COLUMN IF NOT EXISTS harga_satuan NUMERIC DEFAULT 0;
ALTER TABLE public.wo_items ADD COLUMN IF NOT EXISTS total NUMERIC DEFAULT 0;
ALTER TABLE public.wo_items ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE public.wo_labor ADD COLUMN IF NOT EXISTS work_order_id BIGINT REFERENCES public.work_orders(id) ON DELETE CASCADE;
ALTER TABLE public.wo_labor ADD COLUMN IF NOT EXISTS mechanic_id BIGINT REFERENCES public.mechanics(id) ON DELETE SET NULL;
ALTER TABLE public.wo_labor ADD COLUMN IF NOT EXISTS jam DECIMAL(5,2) DEFAULT 0;
ALTER TABLE public.wo_labor ADD COLUMN IF NOT EXISTS tarif_per_jam NUMERIC DEFAULT 0;
ALTER TABLE public.wo_labor ADD COLUMN IF NOT EXISTS total NUMERIC DEFAULT 0;
ALTER TABLE public.wo_labor ADD COLUMN IF NOT EXISTS keterangan TEXT;
ALTER TABLE public.wo_labor ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE public.warranties ADD COLUMN IF NOT EXISTS kode TEXT;
ALTER TABLE public.warranties ADD COLUMN IF NOT EXISTS customer_id BIGINT REFERENCES public.customers(id) ON DELETE SET NULL;
ALTER TABLE public.warranties ADD COLUMN IF NOT EXISTS vehicle_id BIGINT REFERENCES public.vehicles(id) ON DELETE SET NULL;
ALTER TABLE public.warranties ADD COLUMN IF NOT EXISTS work_order_id BIGINT REFERENCES public.work_orders(id) ON DELETE SET NULL;
ALTER TABLE public.warranties ADD COLUMN IF NOT EXISTS sparepart_id BIGINT REFERENCES public.spareparts(id) ON DELETE SET NULL;
ALTER TABLE public.warranties ADD COLUMN IF NOT EXISTS jenis TEXT NOT NULL DEFAULT 'SERVICE';
ALTER TABLE public.warranties ADD COLUMN IF NOT EXISTS judul TEXT NOT NULL DEFAULT '';
ALTER TABLE public.warranties ADD COLUMN IF NOT EXISTS deskripsi TEXT;
ALTER TABLE public.warranties ADD COLUMN IF NOT EXISTS tanggal_mulai TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.warranties ADD COLUMN IF NOT EXISTS tanggal_berakhir TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.warranties ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'AKTIF';
ALTER TABLE public.warranties ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.warranties ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS nomor_invoice TEXT;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS work_order_id BIGINT REFERENCES public.work_orders(id) ON DELETE SET NULL;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS customer_id BIGINT REFERENCES public.customers(id) ON DELETE SET NULL;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS vehicle_id BIGINT REFERENCES public.vehicles(id) ON DELETE SET NULL;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS total_labor NUMERIC DEFAULT 0;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS total_parts NUMERIC DEFAULT 0;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS total_biaya NUMERIC DEFAULT 0;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS diskon NUMERIC DEFAULT 0;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS pajak NUMERIC DEFAULT 0;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS grand_total NUMERIC DEFAULT 0;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'PENDING';
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS tanggal_invoice TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS tanggal_bayar TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS metode_bayar TEXT;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS keterangan TEXT;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE public.vehicle_qr_codes ADD COLUMN IF NOT EXISTS vehicle_id BIGINT REFERENCES public.vehicles(id) ON DELETE CASCADE;
ALTER TABLE public.vehicle_qr_codes ADD COLUMN IF NOT EXISTS qr_code TEXT;
ALTER TABLE public.vehicle_qr_codes ADD COLUMN IF NOT EXISTS qr_data TEXT;
ALTER TABLE public.vehicle_qr_codes ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- ============================================
-- INDEXES
-- ============================================
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
CREATE INDEX IF NOT EXISTS idx_warranties_tanggal_berakhir ON public.warranties (tanggal_berakhir);
CREATE INDEX IF NOT EXISTS idx_invoices_nomor ON public.invoices (nomor_invoice);
CREATE INDEX IF NOT EXISTS idx_invoices_work_order_id ON public.invoices (work_order_id);
CREATE INDEX IF NOT EXISTS idx_invoices_customer_id ON public.invoices (customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices (status);
CREATE INDEX IF NOT EXISTS idx_invoices_tanggal_invoice ON public.invoices (tanggal_invoice DESC);
CREATE INDEX IF NOT EXISTS idx_vehicle_qr_codes_vehicle_id ON public.vehicle_qr_codes (vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_qr_codes_qr_code ON public.vehicle_qr_codes (qr_code);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mechanics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wo_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wo_labor ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warranties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_qr_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations on customers" ON public.customers;
DROP POLICY IF EXISTS "Allow all operations on vehicles" ON public.vehicles;
DROP POLICY IF EXISTS "Allow all operations on mechanics" ON public.mechanics;
DROP POLICY IF EXISTS "Allow all operations on service_packages" ON public.service_packages;
DROP POLICY IF EXISTS "Allow all operations on work_orders" ON public.work_orders;
DROP POLICY IF EXISTS "Allow all operations on wo_items" ON public.wo_items;
DROP POLICY IF EXISTS "Allow all operations on wo_labor" ON public.wo_labor;
DROP POLICY IF EXISTS "Allow all operations on warranties" ON public.warranties;
DROP POLICY IF EXISTS "Allow all operations on invoices" ON public.invoices;
DROP POLICY IF EXISTS "Allow all operations on vehicle_qr_codes" ON public.vehicle_qr_codes;

CREATE POLICY "Allow all operations on customers" ON public.customers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on vehicles" ON public.vehicles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on mechanics" ON public.mechanics FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on service_packages" ON public.service_packages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on work_orders" ON public.work_orders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on wo_items" ON public.wo_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on wo_labor" ON public.wo_labor FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on warranties" ON public.warranties FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on invoices" ON public.invoices FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on vehicle_qr_codes" ON public.vehicle_qr_codes FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- REALTIME PUBLICATION
-- ============================================
BEGIN;
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
COMMIT;