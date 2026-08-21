import { formatRupiah } from '../utils/format'
import { INVOICE_STATUS_LABELS, METODE_BAYAR_LABELS } from '../services/invoiceService'

// Komponen cetak invoice (nota) untuk customer
// Dirender tersembunyi di halaman, tampil hanya saat window.print() dipanggil
function InvoicePrint({ invoice, payments = [] }) {
  if (!invoice) return null

  const sisa = Number(invoice.sisaBayar ?? Math.max((invoice.grandTotal || 0) - (invoice.jumlahDibayar || 0), 0))
  const dibayar = Number(invoice.jumlahDibayar || 0)

  return (
    <div className="print-area" aria-hidden="true">
      <div className="print-page bg-white text-black">
        {/* Kop surat */}
        <div className="flex items-start justify-between border-b-2 border-black pb-3 mb-4">
          <div className="flex items-center gap-3">
            <img
              src="/favicon.svg"
              alt="Logo FAS"
              className="w-12 h-12 object-contain"
            />
            <div>
              <h1 className="text-lg font-bold uppercase">FAS</h1>
              <p className="text-[11px]">Bengkel Spesialis Mobil & Servis Terpercaya</p>
              <p className="text-[11px]">Jl. Contoh Alamat No. 123, Kota | Telp: 0812-3456-7890</p>
            </div>
          </div>
          <div className="text-right">
            <h2 className="text-xl font-bold uppercase tracking-wide">Invoice</h2>
            <p className="text-sm font-semibold">{invoice.nomorInvoice}</p>
            <p className="text-[11px]">
              Tanggal: {invoice.tanggalInvoice ? new Date(invoice.tanggalInvoice).toLocaleDateString('id-ID') : '-'}
            </p>
            <p className="text-[11px] font-semibold">
              Status: {INVOICE_STATUS_LABELS[invoice.status] || invoice.status}
            </p>
          </div>
        </div>

        {/* Info pelanggan & kendaraan */}
        <div className="grid grid-cols-2 gap-4 mb-4 text-[12px]">
          <div className="border border-gray-400 rounded p-3">
            <p className="font-bold uppercase text-[10px] mb-1 text-gray-600">Pelanggan</p>
            <p className="font-semibold">{invoice.customer?.nama || '-'}</p>
            <p>{invoice.customer?.telepon || '-'}</p>
            <p>{invoice.customer?.alamat || '-'}</p>
          </div>
          <div className="border border-gray-400 rounded p-3">
            <p className="font-bold uppercase text-[10px] mb-1 text-gray-600">Kendaraan</p>
            <p className="font-semibold">{invoice.vehicle?.platNomor || '-'}</p>
            <p>{[invoice.vehicle?.merk, invoice.vehicle?.tipe, invoice.vehicle?.tahun].filter(Boolean).join(' ') || '-'}</p>
            {invoice.workOrder && (
              <p>No. WO: {invoice.workOrder.nomorWo}</p>
            )}
          </div>
        </div>

        {/* Rincian biaya */}
        <table className="w-full border-collapse text-[12px] mb-4">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-400 px-2 py-1.5 text-left w-8">No</th>
              <th className="border border-gray-400 px-2 py-1.5 text-left">Uraian</th>
              <th className="border border-gray-400 px-2 py-1.5 text-right w-24">Jumlah</th>
              <th className="border border-gray-400 px-2 py-1.5 text-right w-28">Harga</th>
              <th className="border border-gray-400 px-2 py-1.5 text-right w-28">Total</th>
            </tr>
          </thead>
          <tbody>
            {invoice.workOrder?.servicePackage && (
              <tr>
                <td className="border border-gray-400 px-2 py-1.5">1</td>
                <td className="border border-gray-400 px-2 py-1.5">
                  Jasa Servis: {invoice.workOrder.servicePackage.nama}
                </td>
                <td className="border border-gray-400 px-2 py-1.5 text-right">1</td>
                <td className="border border-gray-400 px-2 py-1.5 text-right">{formatRupiah(invoice.totalLabor || 0)}</td>
                <td className="border border-gray-400 px-2 py-1.5 text-right">{formatRupiah(invoice.totalLabor || 0)}</td>
              </tr>
            )}
            {(invoice.workOrder?.items || []).map((item, idx) => (
              <tr key={item.id || idx}>
                <td className="border border-gray-400 px-2 py-1.5">{(invoice.workOrder?.servicePackage ? 2 : 1) + idx}</td>
                <td className="border border-gray-400 px-2 py-1.5">
                  Sparepart: {item.sparepart?.nama || '-'} {item.sparepart?.kode ? `(${item.sparepart.kode})` : ''}
                </td>
                <td className="border border-gray-400 px-2 py-1.5 text-right">{item.jumlah}</td>
                <td className="border border-gray-400 px-2 py-1.5 text-right">{formatRupiah(item.hargaSatuan || 0)}</td>
                <td className="border border-gray-400 px-2 py-1.5 text-right">{formatRupiah(item.total || 0)}</td>
              </tr>
            ))}
            {(!invoice.workOrder?.servicePackage && (!invoice.workOrder?.items || invoice.workOrder.items.length === 0)) && (
              <tr>
                <td className="border border-gray-400 px-2 py-1.5">1</td>
                <td className="border border-gray-400 px-2 py-1.5">Jasa Servis</td>
                <td className="border border-gray-400 px-2 py-1.5 text-right">-</td>
                <td className="border border-gray-400 px-2 py-1.5 text-right">-</td>
                <td className="border border-gray-400 px-2 py-1.5 text-right">{formatRupiah(invoice.totalLabor || 0)}</td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Ringkasan pembayaran */}
        <div className="flex justify-end mb-4">
          <table className="text-[12px] w-64">
            <tbody>
              <tr>
                <td className="py-0.5">Subtotal Jasa</td>
                <td className="py-0.5 text-right font-medium">{formatRupiah(invoice.totalLabor || 0)}</td>
              </tr>
              <tr>
                <td className="py-0.5">Subtotal Sparepart</td>
                <td className="py-0.5 text-right font-medium">{formatRupiah(invoice.totalParts || 0)}</td>
              </tr>
              <tr>
                <td className="py-0.5">Diskon</td>
                <td className="py-0.5 text-right font-medium">- {formatRupiah(invoice.diskon || 0)}</td>
              </tr>
              <tr>
                <td className="py-0.5">Pajak</td>
                <td className="py-0.5 text-right font-medium">{formatRupiah(invoice.pajak || 0)}</td>
              </tr>
              <tr className="border-t border-black">
                <td className="py-1 font-bold">Grand Total</td>
                <td className="py-1 text-right font-bold">{formatRupiah(invoice.grandTotal || 0)}</td>
              </tr>
              <tr>
                <td className="py-0.5">Sudah Dibayar</td>
                <td className="py-0.5 text-right font-medium">{formatRupiah(dibayar)}</td>
              </tr>
              <tr className="border-t border-black">
                <td className="py-1 font-bold">Sisa Tagihan</td>
                <td className="py-1 text-right font-bold">{formatRupiah(sisa)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Riwayat pembayaran */}
        {payments.length > 0 && (
          <div className="mb-4">
            <p className="font-bold uppercase text-[10px] mb-1 text-gray-600">Riwayat Pembayaran</p>
            <table className="w-full border-collapse text-[11px]">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-400 px-2 py-1 text-left">Tanggal</th>
                  <th className="border border-gray-400 px-2 py-1 text-left">Metode</th>
                  <th className="border border-gray-400 px-2 py-1 text-left">Keterangan</th>
                  <th className="border border-gray-400 px-2 py-1 text-right">Jumlah</th>
                </tr>
              </thead>
              <tbody>
                {payments.map(p => (
                  <tr key={p.id}>
                    <td className="border border-gray-400 px-2 py-1">{new Date(p.tanggalBayar).toLocaleDateString('id-ID')}</td>
                    <td className="border border-gray-400 px-2 py-1">{METODE_BAYAR_LABELS[p.metodeBayar] || p.metodeBayar || '-'}</td>
                    <td className="border border-gray-400 px-2 py-1">{p.keterangan || p.referensi || '-'}</td>
                    <td className="border border-gray-400 px-2 py-1 text-right">{formatRupiah(p.jumlah || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Catatan & tanda tangan */}
        <div className="flex justify-between items-end mt-8 text-[12px]">
          <div className="max-w-[55%]">
            {invoice.keterangan && (
              <p><span className="font-semibold">Catatan:</span> {invoice.keterangan}</p>
            )}
            <p className="mt-6 text-[10px] text-gray-600">
              Terima kasih atas kepercayaan Anda. Barang yang sudah dibeli tidak dapat ditukar kecuali ada perjanjian.
            </p>
          </div>
          <div className="text-center">
            <p className="mb-12">Hormat Kami,</p>
            <div className="border-t border-black w-40 pt-1">
              <p className="font-semibold">FAS</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default InvoicePrint