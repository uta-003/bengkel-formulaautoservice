-- Schema lengkap untuk aplikasi Bengkel Formula Auto Service
-- Jalankan di Supabase SQL Editor

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
  created_at TIMESTAMPTZ DEFAULT now()
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
  created_at TIMESTAMPTZ DEFAULT now()
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
  created_at TIMESTAMPTZ DEFAULT now()
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
  created_at TIMESTAMPTZ DEFAULT now()
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
  created_at TIMESTAMPTZ DEFAULT now()
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
  created_at TIMESTAMPTZ DEFAULT now()
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
  created_at TIMESTAMPTZ DEFAULT now()
);

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

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spareparts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Policy: izinkan semua operasi (sesuaikan dengan kebutuhan auth Anda)
CREATE POLICY "Allow all operations on suppliers" ON public.suppliers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on spareparts" ON public.spareparts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on transactions" ON public.transactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on stock_movements" ON public.stock_movements FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on scan_history" ON public.scan_history FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on users" ON public.users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on audit_log" ON public.audit_log FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- UPDATED_AT TRIGGER (auto-update timestamp)
-- ============================================
-- Tambahkan kolom updated_at jika belum ada
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.spareparts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.stock_movements ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.scan_history ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.audit_log ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Trigger function untuk auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger untuk setiap tabel
CREATE TRIGGER trigger_update_suppliers_updated_at BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trigger_update_spareparts_updated_at BEFORE UPDATE ON public.spareparts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trigger_update_transactions_updated_at BEFORE UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trigger_update_stock_movements_updated_at BEFORE UPDATE ON public.stock_movements FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trigger_update_scan_history_updated_at BEFORE UPDATE ON public.scan_history FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trigger_update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trigger_update_audit_log_updated_at BEFORE UPDATE ON public.audit_log FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- REALTIME PUBLICATION
-- ============================================
-- Aktifkan realtime untuk semua tabel agar perubahan data langsung terlihat di semua perangkat
BEGIN;
  -- Hapus publication lama jika ada (untuk idempotent)
  DROP PUBLICATION IF EXISTS supabase_realtime;
  -- Buat publication baru untuk semua tabel
  CREATE PUBLICATION supabase_realtime FOR TABLE
    public.suppliers,
    public.spareparts,
    public.transactions,
    public.stock_movements,
    public.scan_history,
    public.users,
    public.audit_log;
COMMIT;
