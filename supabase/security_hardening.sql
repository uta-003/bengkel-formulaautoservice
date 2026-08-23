-- ============================================================
-- SECURITY HARDENING - Bengkel Formula Auto Service
-- Jalankan di Supabase SQL Editor SETELAH schema utama.
-- Script ini IDEMPOTENT (aman dijalankan berulang kali).
--
-- Isi:
--   1. CHECK constraints: validasi data di level database
--   2. Trigger: proteksi admin terakhir tidak bisa dihapus/di-downgrade
--   3. Trigger: audit_log immutable (tidak bisa diubah/dihapus via client)
--   4. Catatan RLS & template kebijakan untuk migrasi Supabase Auth
-- ============================================================

-- ============================================
-- 1. CHECK CONSTRAINTS (validasi integritas data)
-- ============================================
-- Catatan: ALTER TABLE ... ADD CONSTRAINT tidak punya IF NOT EXISTS,
-- jadi gunakan DO block untuk cek sebelum menambah.

DO $$
BEGIN
  -- spareparts: stok & harga tidak boleh negatif
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_spareparts_stok_nonnegatif'
  ) THEN
    ALTER TABLE public.spareparts
      ADD CONSTRAINT chk_spareparts_stok_nonnegatif CHECK (stok >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_spareparts_harga_nonnegatif'
  ) THEN
    ALTER TABLE public.spareparts
      ADD CONSTRAINT chk_spareparts_harga_nonnegatif CHECK (harga_beli >= 0 AND harga_jual >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_spareparts_stokmin_nonnegatif'
  ) THEN
    ALTER TABLE public.spareparts
      ADD CONSTRAINT chk_spareparts_stokmin_nonnegatif CHECK (stok_minimum >= 0);
  END IF;

  -- transactions: jumlah harus positif, harga & total non-negatif
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_transactions_jumlah_positif'
  ) THEN
    ALTER TABLE public.transactions
      ADD CONSTRAINT chk_transactions_jumlah_positif CHECK (jumlah > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_transactions_nilai_nonnegatif'
  ) THEN
    ALTER TABLE public.transactions
      ADD CONSTRAINT chk_transactions_nilai_nonnegatif CHECK (harga_satuan >= 0 AND total >= 0);
  END IF;

  -- stock_movements: jumlah positif
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_stock_movements_jumlah_positif'
  ) THEN
    ALTER TABLE public.stock_movements
      ADD CONSTRAINT chk_stock_movements_jumlah_positif CHECK (jumlah > 0);
  END IF;

  -- users: role hanya ADMIN/STAFF, username tidak kosong
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_users_role_valid'
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT chk_users_role_valid CHECK ("role" IN ('ADMIN', 'STAFF'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_users_username_notblank'
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT chk_users_username_notblank CHECK (length(btrim(username)) >= 3);
  END IF;

  -- invoices: nilai pembayaran tidak boleh negatif
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_invoices_nilai_nonnegatif'
  ) THEN
    ALTER TABLE public.invoices
      ADD CONSTRAINT chk_invoices_nilai_nonnegatif
      CHECK (total_biaya >= 0 AND grand_total >= 0 AND jumlah_dibayar >= 0 AND sisa_bayar >= 0);
  END IF;
END
$$;

-- ============================================
-- 2. PROTEKSI ADMIN TERAKHIR
-- Mencegah penghapusan atau penurunan role
-- satu-satunya user ADMIN (anti lockout).
-- ============================================
CREATE OR REPLACE FUNCTION public.guard_last_admin()
RETURNS TRIGGER AS $$
DECLARE
  admin_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO admin_count
  FROM public.users
  WHERE "role" = 'ADMIN';

  IF TG_OP = 'DELETE' THEN
    IF OLD."role" = 'ADMIN' AND admin_count <= 1 THEN
      RAISE EXCEPTION 'Tidak dapat menghapus satu-satunya admin';
    END IF;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD."role" = 'ADMIN' AND NEW."role" <> 'ADMIN' AND admin_count <= 1 THEN
      RAISE EXCEPTION 'Tidak dapat menurunkan role satu-satunya admin';
    END IF;
    RETURN NEW;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_guard_last_admin ON public.users;
CREATE TRIGGER trigger_guard_last_admin
  BEFORE DELETE OR UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.guard_last_admin();

-- ============================================
-- 3. AUDIT LOG IMMUTABLE
-- Audit log tidak boleh diubah/dihapus dari client
-- agar jejak audit dapat dipercaya.
-- ============================================
CREATE OR REPLACE FUNCTION public.prevent_audit_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_log bersifat immutable (hanya INSERT yang diizinkan)';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_audit_no_update ON public.audit_log;
CREATE TRIGGER trigger_audit_no_update
  BEFORE UPDATE ON public.audit_log
  FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_mutation();

DROP TRIGGER IF EXISTS trigger_audit_no_delete ON public.audit_log;
CREATE TRIGGER trigger_audit_no_delete
  BEFORE DELETE ON public.audit_log
  FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_mutation();

-- ============================================
-- 4. ROW LEVEL SECURITY (RLS)
-- ============================================
-- STATUS SAAT INI:
-- Aplikasi memakai sistem auth kustom (tabel users) TANPA Supabase Auth,
-- sehingga semua request datang sebagai role `anon`. Kebijakan "Allow all"
-- diperlukan agar aplikasi berfungsi.
--
-- REKOMENDASI KEAMANAN LANJUTAN (saat migrasi ke Supabase Auth):
-- Setelah aplikasi menggunakan supabase.auth.signInWithPassword(),
-- ganti kebijakan dengan template di bawah ini. Contoh untuk tabel spareparts:
--
--   DROP POLICY IF EXISTS "Allow all operations on spareparts" ON public.spareparts;
--
--   CREATE POLICY "authenticated_read_spareparts" ON public.spareparts
--     FOR SELECT TO authenticated USING (true);
--
--   CREATE POLICY "authenticated_write_spareparts" ON public.spareparts
--     FOR ALL TO authenticated USING (true) WITH CHECK (true);
--
--   -- Revoke akses anon sepenuhnya:
--   REVOKE ALL ON public.spareparts FROM anon;
--
-- Terapkan pola yang sama untuk tabel lainnya sesuai kebutuhan peran
-- (misal: STAFF tidak boleh menghapus users — gunakan fungsi JWT claim
-- custom atau tabel profil terhubung auth.uid()).
-- ============================================================