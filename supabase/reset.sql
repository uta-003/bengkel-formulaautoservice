-- RESET DATABASE: Hapus semua tabel sebelum menjalankan schema.sql
-- ⚠️ PERINGATAN: Semua data yang ada akan HAPUS PERMANEN!
-- Jalankan file ini DULU di Supabase SQL Editor, lalu jalankan schema.sql

-- Hapus trigger dulu (jika ada)
DROP TRIGGER IF EXISTS trigger_update_suppliers_updated_at ON public.suppliers;
DROP TRIGGER IF EXISTS trigger_update_spareparts_updated_at ON public.spareparts;
DROP TRIGGER IF EXISTS trigger_update_transactions_updated_at ON public.transactions;
DROP TRIGGER IF EXISTS trigger_update_stock_movements_updated_at ON public.stock_movements;
DROP TRIGGER IF EXISTS trigger_update_scan_history_updated_at ON public.scan_history;
DROP TRIGGER IF EXISTS trigger_update_users_updated_at ON public.users;
DROP TRIGGER IF EXISTS trigger_update_audit_log_updated_at ON public.audit_log;

-- Hapus publication realtime
DROP PUBLICATION IF EXISTS supabase_realtime;

-- Hapus tabel dalam urutan yang benar (child dulu, parent terakhir)
DROP TABLE IF EXISTS public.audit_log;
DROP TABLE IF EXISTS public.scan_history;
DROP TABLE IF EXISTS public.stock_movements;
DROP TABLE IF EXISTS public.transactions;
DROP TABLE IF EXISTS public.spareparts;
DROP TABLE IF EXISTS public.suppliers;
DROP TABLE IF EXISTS public.users;