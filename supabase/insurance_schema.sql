-- ============================================================
-- SKEMA FITUR KLAIM ASURANSI
-- Tabel:
--   1. insurance_companies     : master data perusahaan asuransi
--   2. insurance_claims        : data klaim utama + alur status
--   3. claim_items             : rincian item klaim (sparepart/jasa)
--   4. claim_documents         : dokumen pendukung klaim (foto/surat)
--   5. claim_status_history    : riwayat perubahan status klaim
--
-- ALUR STATUS KLAIM:
--   DRAFT -> SUBMITTED -> SURVEY_SCHEDULED -> SURVEYED -> APPROVED
--          -> IN_PROGRESS -> COMPLETED -> INVOICED -> PAID -> CLOSED
--   Cabang: REJECTED (dari SUBMITTED/SURVEY_SCHEDULED/SURVEYED/APPROVED)
--           CANCELLED (dari DRAFT/SUBMITTED)
-- Jalankan di Supabase SQL Editor setelah feature_schema.sql
-- ============================================================

-- ============================================
-- TABEL: insurance_companies (master asuransi)
-- ============================================
CREATE TABLE IF NOT EXISTS public.insurance_companies (
  id BIGSERIAL PRIMARY KEY,
  kode TEXT UNIQUE,
  nama TEXT NOT NULL,
  jenis_asuransi TEXT DEFAULT 'UMUM', -- UMUM / JIWA / KENDARAAN / PROPERTI
  telepon TEXT,
  email TEXT,
  alamat TEXT,
  kontak_person TEXT,
  telepon_kontak TEXT,
  nomor_rekening TEXT,
  catatan TEXT,
  status TEXT NOT NULL DEFAULT 'AKTIF' CHECK (status IN ('AKTIF', 'TIDAK_AKTIF')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- TABEL: insurance_claims (klaim utama)
-- ============================================
CREATE TABLE IF NOT EXISTS public.insurance_claims (
  id BIGSERIAL PRIMARY KEY,
  nomor_klaim TEXT UNIQUE,
  insurance_company_id BIGINT REFERENCES public.insurance_companies(id) ON DELETE SET NULL,
  customer_id BIGINT REFERENCES public.customers(id) ON DELETE SET NULL,
  vehicle_id BIGINT REFERENCES public.vehicles(id) ON DELETE SET NULL,
  work_order_id BIGINT REFERENCES public.work_orders(id) ON DELETE SET NULL,
  invoice_id BIGINT REFERENCES public.invoices(id) ON DELETE SET NULL,

  -- Data polis
  nomor_polis TEXT,
  nama_tertanggung TEXT,

  -- Data kejadian
  jenis_klaim TEXT NOT NULL DEFAULT 'LAINNYA' CHECK (jenis_klaim IN ('KECELAKAAN', 'BANJIR', 'KEHILANGAN', 'KERUSAKAN', 'LAINNYA')),
  tanggal_kejadian TIMESTAMPTZ,
  lokasi_kejadian TEXT,
  deskripsi_kerusakan TEXT,

  -- Nilai biaya
  estimasi_biaya NUMERIC DEFAULT 0,
  approved_amount NUMERIC DEFAULT 0,
  actual_cost NUMERIC DEFAULT 0,
  deductible NUMERIC DEFAULT 0, -- partisipasi pelanggan (uang muka)

  -- Status alur kerja
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN (
    'DRAFT', 'SUBMITTED', 'SURVEY_SCHEDULED', 'SURVEYED', 'APPROVED',
    'REJECTED', 'IN_PROGRESS', 'COMPLETED', 'INVOICED', 'PAID', 'CLOSED', 'CANCELLED'
  )),

  -- Data survey
  surveyor_name TEXT,
  survey_date TIMESTAMPTZ,
  survey_result TEXT,

  -- Penolakan
  rejection_reason TEXT,

  -- Pembayaran asuransi
  payment_method TEXT CHECK (payment_method IS NULL OR payment_method IN ('TRANSFER', 'TUNAI', 'KARTU', 'E_WALLET')),
  payment_reference TEXT,

  -- Timestamp alur kerja
  submitted_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  invoiced_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,

  catatan TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- TABEL: claim_items (rincian item klaim)
-- tipe: PART (sparepart diganti) / LABOR (jasa)
-- ============================================
CREATE TABLE IF NOT EXISTS public.claim_items (
  id BIGSERIAL PRIMARY KEY,
  claim_id BIGINT REFERENCES public.insurance_claims(id) ON DELETE CASCADE,
  sparepart_id BIGINT REFERENCES public.spareparts(id) ON DELETE SET NULL,
  tipe TEXT NOT NULL DEFAULT 'PART' CHECK (tipe IN ('PART', 'LABOR')),
  deskripsi TEXT,
  jumlah INTEGER NOT NULL DEFAULT 1,
  harga_satuan NUMERIC DEFAULT 0,
  total NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- TABEL: claim_documents (dokumen pendukung)
-- tipe_dokumen: FOTO / POLIS / STNK / KTP / LAPORAN_POLISI / SURAT_KLAIM / HASIL_SURVEY / LAINNYA
-- url_dokumen bisa berupa URL gambar/link drive
-- ============================================
CREATE TABLE IF NOT EXISTS public.claim_documents (
  id BIGSERIAL PRIMARY KEY,
  claim_id BIGINT REFERENCES public.insurance_claims(id) ON DELETE CASCADE,
  nama_dokumen TEXT NOT NULL,
  tipe_dokumen TEXT NOT NULL DEFAULT 'LAINNYA' CHECK (tipe_dokumen IN (
    'FOTO', 'POLIS', 'STNK', 'KTP', 'SIM', 'LAPORAN_POLISI', 'SURAT_KLAIM', 'HASIL_SURVEY', 'LAINNYA'
  )),
  url_dokumen TEXT,
  keterangan TEXT,
  uploaded_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- TABEL: claim_status_history (riwayat status)
-- ============================================
CREATE TABLE IF NOT EXISTS public.claim_status_history (
  id BIGSERIAL PRIMARY KEY,
  claim_id BIGINT REFERENCES public.insurance_claims(id) ON DELETE CASCADE,
  status_from TEXT,
  status_to TEXT NOT NULL,
  changed_by TEXT,
  catatan TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- ENSURE COLUMNS (idempotent)
-- ============================================
ALTER TABLE public.insurance_companies ADD COLUMN IF NOT EXISTS kode TEXT;
ALTER TABLE public.insurance_companies ADD COLUMN IF NOT EXISTS nama TEXT NOT NULL DEFAULT '';
ALTER TABLE public.insurance_companies ADD COLUMN IF NOT EXISTS jenis_asuransi TEXT DEFAULT 'UMUM';
ALTER TABLE public.insurance_companies ADD COLUMN IF NOT EXISTS telepon TEXT;
ALTER TABLE public.insurance_companies ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.insurance_companies ADD COLUMN IF NOT EXISTS alamat TEXT;
ALTER TABLE public.insurance_companies ADD COLUMN IF NOT EXISTS kontak_person TEXT;
ALTER TABLE public.insurance_companies ADD COLUMN IF NOT EXISTS telepon_kontak TEXT;
ALTER TABLE public.insurance_companies ADD COLUMN IF NOT EXISTS nomor_rekening TEXT;
ALTER TABLE public.insurance_companies ADD COLUMN IF NOT EXISTS catatan TEXT;
ALTER TABLE public.insurance_companies ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'AKTIF';
ALTER TABLE public.insurance_companies ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.insurance_companies ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE public.insurance_claims ADD COLUMN IF NOT EXISTS nomor_klaim TEXT;
ALTER TABLE public.insurance_claims ADD COLUMN IF NOT EXISTS insurance_company_id BIGINT REFERENCES public.insurance_companies(id) ON DELETE SET NULL;
ALTER TABLE public.insurance_claims ADD COLUMN IF NOT EXISTS customer_id BIGINT REFERENCES public.customers(id) ON DELETE SET NULL;
ALTER TABLE public.insurance_claims ADD COLUMN IF NOT EXISTS vehicle_id BIGINT REFERENCES public.vehicles(id) ON DELETE SET NULL;
ALTER TABLE public.insurance_claims ADD COLUMN IF NOT EXISTS work_order_id BIGINT REFERENCES public.work_orders(id) ON DELETE SET NULL;
ALTER TABLE public.insurance_claims ADD COLUMN IF NOT EXISTS invoice_id BIGINT REFERENCES public.invoices(id) ON DELETE SET NULL;
ALTER TABLE public.insurance_claims ADD COLUMN IF NOT EXISTS nomor_polis TEXT;
ALTER TABLE public.insurance_claims ADD COLUMN IF NOT EXISTS nama_tertanggung TEXT;
ALTER TABLE public.insurance_claims ADD COLUMN IF NOT EXISTS jenis_klaim TEXT NOT NULL DEFAULT 'LAINNYA';
ALTER TABLE public.insurance_claims ADD COLUMN IF NOT EXISTS tanggal_kejadian TIMESTAMPTZ;
ALTER TABLE public.insurance_claims ADD COLUMN IF NOT EXISTS lokasi_kejadian TEXT;
ALTER TABLE public.insurance_claims ADD COLUMN IF NOT EXISTS deskripsi_kerusakan TEXT;
ALTER TABLE public.insurance_claims ADD COLUMN IF NOT EXISTS estimasi_biaya NUMERIC DEFAULT 0;
ALTER TABLE public.insurance_claims ADD COLUMN IF NOT EXISTS approved_amount NUMERIC DEFAULT 0;
ALTER TABLE public.insurance_claims ADD COLUMN IF NOT EXISTS actual_cost NUMERIC DEFAULT 0;
ALTER TABLE public.insurance_claims ADD COLUMN IF NOT EXISTS deductible NUMERIC DEFAULT 0;
ALTER TABLE public.insurance_claims ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'DRAFT';
ALTER TABLE public.insurance_claims ADD COLUMN IF NOT EXISTS surveyor_name TEXT;
ALTER TABLE public.insurance_claims ADD COLUMN IF NOT EXISTS survey_date TIMESTAMPTZ;
ALTER TABLE public.insurance_claims ADD COLUMN IF NOT EXISTS survey_result TEXT;
ALTER TABLE public.insurance_claims ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE public.insurance_claims ADD COLUMN IF NOT EXISTS payment_method TEXT;
ALTER TABLE public.insurance_claims ADD COLUMN IF NOT EXISTS payment_reference TEXT;
ALTER TABLE public.insurance_claims ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;
ALTER TABLE public.insurance_claims ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE public.insurance_claims ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE public.insurance_claims ADD COLUMN IF NOT EXISTS invoiced_at TIMESTAMPTZ;
ALTER TABLE public.insurance_claims ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
ALTER TABLE public.insurance_claims ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;
ALTER TABLE public.insurance_claims ADD COLUMN IF NOT EXISTS catatan TEXT;
ALTER TABLE public.insurance_claims ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.insurance_claims ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE public.claim_items ADD COLUMN IF NOT EXISTS claim_id BIGINT REFERENCES public.insurance_claims(id) ON DELETE CASCADE;
ALTER TABLE public.claim_items ADD COLUMN IF NOT EXISTS sparepart_id BIGINT REFERENCES public.spareparts(id) ON DELETE SET NULL;
ALTER TABLE public.claim_items ADD COLUMN IF NOT EXISTS tipe TEXT NOT NULL DEFAULT 'PART';
ALTER TABLE public.claim_items ADD COLUMN IF NOT EXISTS deskripsi TEXT;
ALTER TABLE public.claim_items ADD COLUMN IF NOT EXISTS jumlah INTEGER NOT NULL DEFAULT 1;
ALTER TABLE public.claim_items ADD COLUMN IF NOT EXISTS harga_satuan NUMERIC DEFAULT 0;
ALTER TABLE public.claim_items ADD COLUMN IF NOT EXISTS total NUMERIC DEFAULT 0;
ALTER TABLE public.claim_items ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE public.claim_documents ADD COLUMN IF NOT EXISTS claim_id BIGINT REFERENCES public.insurance_claims(id) ON DELETE CASCADE;
ALTER TABLE public.claim_documents ADD COLUMN IF NOT EXISTS nama_dokumen TEXT NOT NULL DEFAULT '';
ALTER TABLE public.claim_documents ADD COLUMN IF NOT EXISTS tipe_dokumen TEXT NOT NULL DEFAULT 'LAINNYA';
ALTER TABLE public.claim_documents ADD COLUMN IF NOT EXISTS url_dokumen TEXT;
ALTER TABLE public.claim_documents ADD COLUMN IF NOT EXISTS keterangan TEXT;
ALTER TABLE public.claim_documents ADD COLUMN IF NOT EXISTS uploaded_by TEXT;
ALTER TABLE public.claim_documents ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE public.claim_status_history ADD COLUMN IF NOT EXISTS claim_id BIGINT REFERENCES public.insurance_claims(id) ON DELETE CASCADE;
ALTER TABLE public.claim_status_history ADD COLUMN IF NOT EXISTS status_from TEXT;
ALTER TABLE public.claim_status_history ADD COLUMN IF NOT EXISTS status_to TEXT NOT NULL DEFAULT '';
ALTER TABLE public.claim_status_history ADD COLUMN IF NOT EXISTS changed_by TEXT;
ALTER TABLE public.claim_status_history ADD COLUMN IF NOT EXISTS catatan TEXT;
ALTER TABLE public.claim_status_history ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_insurance_companies_kode ON public.insurance_companies (kode);
CREATE INDEX IF NOT EXISTS idx_insurance_companies_status ON public.insurance_companies (status);

CREATE INDEX IF NOT EXISTS idx_insurance_claims_nomor ON public.insurance_claims (nomor_klaim);
CREATE INDEX IF NOT EXISTS idx_insurance_claims_company_id ON public.insurance_claims (insurance_company_id);
CREATE INDEX IF NOT EXISTS idx_insurance_claims_customer_id ON public.insurance_claims (customer_id);
CREATE INDEX IF NOT EXISTS idx_insurance_claims_vehicle_id ON public.insurance_claims (vehicle_id);
CREATE INDEX IF NOT EXISTS idx_insurance_claims_work_order_id ON public.insurance_claims (work_order_id);
CREATE INDEX IF NOT EXISTS idx_insurance_claims_invoice_id ON public.insurance_claims (invoice_id);
CREATE INDEX IF NOT EXISTS idx_insurance_claims_status ON public.insurance_claims (status);
CREATE INDEX IF NOT EXISTS idx_insurance_claims_nomor_polis ON public.insurance_claims (nomor_polis);
CREATE INDEX IF NOT EXISTS idx_insurance_claims_tanggal_kejadian ON public.insurance_claims (tanggal_kejadian DESC);

CREATE INDEX IF NOT EXISTS idx_claim_items_claim_id ON public.claim_items (claim_id);
CREATE INDEX IF NOT EXISTS idx_claim_items_sparepart_id ON public.claim_items (sparepart_id);

CREATE INDEX IF NOT EXISTS idx_claim_documents_claim_id ON public.claim_documents (claim_id);

CREATE INDEX IF NOT EXISTS idx_claim_status_history_claim_id ON public.claim_status_history (claim_id);
CREATE INDEX IF NOT EXISTS idx_claim_status_history_created ON public.claim_status_history (created_at DESC);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE public.insurance_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insurance_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claim_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claim_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claim_status_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations on insurance_companies" ON public.insurance_companies;
DROP POLICY IF EXISTS "Allow all operations on insurance_claims" ON public.insurance_claims;
DROP POLICY IF EXISTS "Allow all operations on claim_items" ON public.claim_items;
DROP POLICY IF EXISTS "Allow all operations on claim_documents" ON public.claim_documents;
DROP POLICY IF EXISTS "Allow all operations on claim_status_history" ON public.claim_status_history;

CREATE POLICY "Allow all operations on insurance_companies" ON public.insurance_companies FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on insurance_claims" ON public.insurance_claims FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on claim_items" ON public.claim_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on claim_documents" ON public.claim_documents FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on claim_status_history" ON public.claim_status_history FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- REALTIME PUBLICATION (tambahkan tabel klaim asuransi)
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
    public.invoice_payments,
    public.insurance_companies,
    public.insurance_claims,
    public.claim_items,
    public.claim_documents,
    public.claim_status_history;
COMMIT;