-- Tabel riwayat scan barcode
-- Jalankan di Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.scan_history (
  id BIGSERIAL PRIMARY KEY,
  barcode TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('FOUND', 'NOT_FOUND', 'KELUAR')),
  sparepart_id BIGINT REFERENCES public.spareparts(id) ON DELETE SET NULL,
  sparepart_name TEXT,
  stok_sebelum INTEGER,
  stok_sesudah INTEGER,
  jumlah INTEGER,
  scanned_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index untuk pencarian cepat berdasarkan waktu
CREATE INDEX IF NOT EXISTS idx_scan_history_scanned_at ON public.scan_history (scanned_at DESC);

-- Index untuk pencarian berdasarkan barcode
CREATE INDEX IF NOT EXISTS idx_scan_history_barcode ON public.scan_history (barcode);

-- Enable Row Level Security
ALTER TABLE public.scan_history ENABLE ROW LEVEL SECURITY;

-- Policy: izinkan semua operasi (sesuaikan dengan kebutuhan auth Anda)
CREATE POLICY "Allow all operations on scan_history" ON public.scan_history
  FOR ALL
  USING (true)
  WITH CHECK (true);