-- Schema tambahan untuk fitur baru:
-- 1. retur (retur barang ke supplier / dari customer)
-- 2. stock_opnames + stock_opname_items (stock opname / penyesuaian stok)
-- 3. invoice_payments (riwayat pembayaran parsial invoice)
-- 4. Kolom tambahan invoices: jumlah_dibayar, sisa_bayar
-- Jalankan di Supabase SQL Editor setelah service_schema.sql

-- ============================================
-- ALTER: invoices - kolom pembayaran parsial
-- ============================================
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS jumlah_dibayar NUMERIC DEFAULT 0;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS sisa_bayar NUMERIC DEFAULT 0;

-- ============================================
-- ALTER: spareparts - durasi garansi sparepart (bulan, 0 = tanpa garansi)
-- ============================================
ALTER TABLE public.spareparts ADD COLUMN IF NOT EXISTS garansi_bulan INTEGER DEFAULT 0;

-- ============================================
-- ALTER: work_orders - flag proses stok & garansi otomatis
-- mencegah pengurangan stok ganda saat status COMPLETED
-- ============================================
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS stok_diproses BOOLEAN DEFAULT false;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS garansi_dibuat BOOLEAN DEFAULT false;

-- ============================================
-- TABEL: returns (retur barang)
-- tipe: KE_SUPPLIER (retur barang masuk yang cacat/salah)
--       DARI_CUSTOMER (retur penjualan/barang keluar)
-- status: PENDING, APPROVED, REJECTED, SELESAI
-- ============================================
CREATE TABLE IF NOT EXISTS public.returns (
  id BIGSERIAL PRIMARY KEY,
  nomor_retur TEXT UNIQUE,
  tipe TEXT NOT NULL CHECK (tipe IN ('KE_SUPPLIER', 'DARI_CUSTOMER')),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'SELESAI')),
  sparepart_id BIGINT REFERENCES public.spareparts(id) ON DELETE SET NULL,
  supplier_id BIGINT REFERENCES public.suppliers(id) ON DELETE SET NULL,
  customer_id BIGINT REFERENCES public.customers(id) ON DELETE SET NULL,
  work_order_id BIGINT REFERENCES public.work_orders(id) ON DELETE SET NULL,
  transaction_id BIGINT REFERENCES public.transactions(id) ON DELETE SET NULL,
  jumlah INTEGER NOT NULL DEFAULT 0,
  harga_satuan NUMERIC DEFAULT 0,
  total NUMERIC DEFAULT 0,
  alasan TEXT,
  catatan TEXT,
  tanggal_retur TIMESTAMPTZ DEFAULT now(),
  tanggal_selesai TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- TABEL: stock_opnames (sesi stock opname)
-- status: DRAFT, SELESAI, DIBATALKAN
-- ============================================
CREATE TABLE IF NOT EXISTS public.stock_opnames (
  id BIGSERIAL PRIMARY KEY,
  kode_opname TEXT UNIQUE,
  nama_petugas TEXT,
  kategori_filter TEXT,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SELESAI', 'DIBATALKAN')),
  total_item INTEGER DEFAULT 0,
  total_selisih INTEGER DEFAULT 0,
  total_nilai_selisih NUMERIC DEFAULT 0,
  catatan TEXT,
  tanggal_opname TIMESTAMPTZ DEFAULT now(),
  tanggal_selesai TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- TABEL: stock_opname_items (detail hitungan per sparepart)
-- selisih = stok_fisik - stok_sistem
-- ============================================
CREATE TABLE IF NOT EXISTS public.stock_opname_items (
  id BIGSERIAL PRIMARY KEY,
  opname_id BIGINT REFERENCES public.stock_opnames(id) ON DELETE CASCADE,
  sparepart_id BIGINT REFERENCES public.spareparts(id) ON DELETE SET NULL,
  stok_sistem INTEGER NOT NULL DEFAULT 0,
  stok_fisik INTEGER NOT NULL DEFAULT 0,
  selisih INTEGER NOT NULL DEFAULT 0,
  nilai_selisih NUMERIC DEFAULT 0,
  sudah_disesuaikan BOOLEAN DEFAULT false,
  catatan TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- TABEL: invoice_payments (riwayat pembayaran invoice)
-- metode: TUNAI, TRANSFER, KARTU, E_WALLET, KREDIT
-- ============================================
CREATE TABLE IF NOT EXISTS public.invoice_payments (
  id BIGSERIAL PRIMARY KEY,
  invoice_id BIGINT REFERENCES public.invoices(id) ON DELETE CASCADE,
  jumlah NUMERIC NOT NULL DEFAULT 0,
  metode_bayar TEXT CHECK (metode_bayar IN ('TUNAI', 'TRANSFER', 'KARTU', 'E_WALLET', 'KREDIT')),
  referensi TEXT,
  keterangan TEXT,
  tanggal_bayar TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- ENSURE COLUMNS (idempotent)
-- ============================================
ALTER TABLE public.returns ADD COLUMN IF NOT EXISTS nomor_retur TEXT;
ALTER TABLE public.returns ADD COLUMN IF NOT EXISTS tipe TEXT NOT NULL DEFAULT 'KE_SUPPLIER';
ALTER TABLE public.returns ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'PENDING';
ALTER TABLE public.returns ADD COLUMN IF NOT EXISTS sparepart_id BIGINT REFERENCES public.spareparts(id) ON DELETE SET NULL;
ALTER TABLE public.returns ADD COLUMN IF NOT EXISTS supplier_id BIGINT REFERENCES public.suppliers(id) ON DELETE SET NULL;
ALTER TABLE public.returns ADD COLUMN IF NOT EXISTS customer_id BIGINT REFERENCES public.customers(id) ON DELETE SET NULL;
ALTER TABLE public.returns ADD COLUMN IF NOT EXISTS work_order_id BIGINT REFERENCES public.work_orders(id) ON DELETE SET NULL;
ALTER TABLE public.returns ADD COLUMN IF NOT EXISTS transaction_id BIGINT REFERENCES public.transactions(id) ON DELETE SET NULL;
ALTER TABLE public.returns ADD COLUMN IF NOT EXISTS jumlah INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.returns ADD COLUMN IF NOT EXISTS harga_satuan NUMERIC DEFAULT 0;
ALTER TABLE public.returns ADD COLUMN IF NOT EXISTS total NUMERIC DEFAULT 0;
ALTER TABLE public.returns ADD COLUMN IF NOT EXISTS alasan TEXT;
ALTER TABLE public.returns ADD COLUMN IF NOT EXISTS catatan TEXT;
ALTER TABLE public.returns ADD COLUMN IF NOT EXISTS tanggal_retur TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.returns ADD COLUMN IF NOT EXISTS tanggal_selesai TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE public.returns ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.returns ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE public.stock_opnames ADD COLUMN IF NOT EXISTS kode_opname TEXT;
ALTER TABLE public.stock_opnames ADD COLUMN IF NOT EXISTS nama_petugas TEXT;
ALTER TABLE public.stock_opnames ADD COLUMN IF NOT EXISTS kategori_filter TEXT;
ALTER TABLE public.stock_opnames ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'DRAFT';
ALTER TABLE public.stock_opnames ADD COLUMN IF NOT EXISTS total_item INTEGER DEFAULT 0;
ALTER TABLE public.stock_opnames ADD COLUMN IF NOT EXISTS total_selisih INTEGER DEFAULT 0;
ALTER TABLE public.stock_opnames ADD COLUMN IF NOT EXISTS total_nilai_selisih NUMERIC DEFAULT 0;
ALTER TABLE public.stock_opnames ADD COLUMN IF NOT EXISTS catatan TEXT;
ALTER TABLE public.stock_opnames ADD COLUMN IF NOT EXISTS tanggal_opname TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.stock_opnames ADD COLUMN IF NOT EXISTS tanggal_selesai TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE public.stock_opnames ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.stock_opnames ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE public.stock_opname_items ADD COLUMN IF NOT EXISTS opname_id BIGINT REFERENCES public.stock_opnames(id) ON DELETE CASCADE;
ALTER TABLE public.stock_opname_items ADD COLUMN IF NOT EXISTS sparepart_id BIGINT REFERENCES public.spareparts(id) ON DELETE SET NULL;
ALTER TABLE public.stock_opname_items ADD COLUMN IF NOT EXISTS stok_sistem INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.stock_opname_items ADD COLUMN IF NOT EXISTS stok_fisik INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.stock_opname_items ADD COLUMN IF NOT EXISTS selisih INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.stock_opname_items ADD COLUMN IF NOT EXISTS nilai_selisih NUMERIC DEFAULT 0;
ALTER TABLE public.stock_opname_items ADD COLUMN IF NOT EXISTS sudah_disesuaikan BOOLEAN DEFAULT false;
ALTER TABLE public.stock_opname_items ADD COLUMN IF NOT EXISTS catatan TEXT;
ALTER TABLE public.stock_opname_items ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE public.invoice_payments ADD COLUMN IF NOT EXISTS invoice_id BIGINT REFERENCES public.invoices(id) ON DELETE CASCADE;
ALTER TABLE public.invoice_payments ADD COLUMN IF NOT EXISTS jumlah NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE public.invoice_payments ADD COLUMN IF NOT EXISTS metode_bayar TEXT;
ALTER TABLE public.invoice_payments ADD COLUMN IF NOT EXISTS referensi TEXT;
ALTER TABLE public.invoice_payments ADD COLUMN IF NOT EXISTS keterangan TEXT;
ALTER TABLE public.invoice_payments ADD COLUMN IF NOT EXISTS tanggal_bayar TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.invoice_payments ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_returns_nomor ON public.returns (nomor_retur);
CREATE INDEX IF NOT EXISTS idx_returns_tipe ON public.returns (tipe);
CREATE INDEX IF NOT EXISTS idx_returns_status ON public.returns (status);
CREATE INDEX IF NOT EXISTS idx_returns_sparepart_id ON public.returns (sparepart_id);
CREATE INDEX IF NOT EXISTS idx_returns_supplier_id ON public.returns (supplier_id);
CREATE INDEX IF NOT EXISTS idx_returns_customer_id ON public.returns (customer_id);
CREATE INDEX IF NOT EXISTS idx_returns_tanggal ON public.returns (tanggal_retur DESC);

CREATE INDEX IF NOT EXISTS idx_stock_opnames_kode ON public.stock_opnames (kode_opname);
CREATE INDEX IF NOT EXISTS idx_stock_opnames_status ON public.stock_opnames (status);
CREATE INDEX IF NOT EXISTS idx_stock_opnames_tanggal ON public.stock_opnames (tanggal_opname DESC);

CREATE INDEX IF NOT EXISTS idx_stock_opname_items_opname_id ON public.stock_opname_items (opname_id);
CREATE INDEX IF NOT EXISTS idx_stock_opname_items_sparepart_id ON public.stock_opname_items (sparepart_id);

CREATE INDEX IF NOT EXISTS idx_invoice_payments_invoice_id ON public.invoice_payments (invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_payments_tanggal ON public.invoice_payments (tanggal_bayar DESC);

CREATE INDEX IF NOT EXISTS idx_spareparts_garansi_bulan ON public.spareparts (garansi_bulan);
CREATE INDEX IF NOT EXISTS idx_work_orders_stok_diproses ON public.work_orders (stok_diproses);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE public.returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_opnames ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_opname_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations on returns" ON public.returns;
DROP POLICY IF EXISTS "Allow all operations on stock_opnames" ON public.stock_opnames;
DROP POLICY IF EXISTS "Allow all operations on stock_opname_items" ON public.stock_opname_items;
DROP POLICY IF EXISTS "Allow all operations on invoice_payments" ON public.invoice_payments;

CREATE POLICY "Allow all operations on returns" ON public.returns FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on stock_opnames" ON public.stock_opnames FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on stock_opname_items" ON public.stock_opname_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on invoice_payments" ON public.invoice_payments FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- REALTIME PUBLICATION (tambahkan tabel baru)
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
    public.vehicle_qr_codes,
    public.returns,
    public.stock_opnames,
    public.stock_opname_items,
    public.invoice_payments;
COMMIT;