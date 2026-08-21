import { formatRupiah } from '../utils/format'
import { WO_STATUS_LABELS } from '../services/workOrderService'

// Komponen cetak work order (surat perintah kerja)
// Dirender tersembunyi di halaman, tampil hanya saat window.print() dipanggil
function WorkOrderPrint({ workOrder }) {
  if (!workOrder) return null

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
            <h2 className="text-xl font-bold uppercase tracking-wide">Work Order</h2>
            <p className="text-sm font-semibold">{workOrder.nomorWo}</p>
            <p className="text-[11px]">
              Masuk: {workOrder.tanggalMasuk ? new Date(workOrder.tanggalMasuk).toLocaleDateString('id-ID') : '-'}
            </p>
            <p className="text-[11px] font-semibold">
              Status: {WO_STATUS_LABELS[workOrder.status] || workOrder.status}
            </p>
          </div>
        </div>

        {/* Info pelanggan, kendaraan, teknisi */}
        <div className="grid grid-cols-3 gap-3 mb-4 text-[12px]">
          <div className="border border-gray-400 rounded p-3">
            <p className="font-bold uppercase text-[10px] mb-1 text-gray-600">Pelanggan</p>
            <p className="font-semibold">{workOrder.customer?.nama || '-'}</p>
            <p>{workOrder.customer?.telepon || '-'}</p>
          </div>
          <div className="border border-gray-400 rounded p-3">
            <p className="font-bold uppercase text-[10px] mb-1 text-gray-600">Kendaraan</p>
            <p className="font-semibold">{workOrder.vehicle?.platNomor || '-'}</p>
            <p>{[workOrder.vehicle?.merk, workOrder.vehicle?.tipe].filter(Boolean).join(' ') || '-'}</p>
            <p>KM Masuk: {workOrder.kmMasuk || 0}{workOrder.kmKeluar ? ` | KM Keluar: ${workOrder.kmKeluar}` : ''}</p>
          </div>
          <div className="border border-gray-400 rounded p-3">
            <p className="font-bold uppercase text-[10px] mb-1 text-gray-600">Teknisi / Paket</p>
            <p className="font-semibold">{workOrder.mechanic?.nama || '-'}</p>
            <p>{workOrder.servicePackage?.nama || '-'}</p>
          </div>
        </div>

        {/* Keluhan */}
        {workOrder.keluhan && (
          <div className="border border-gray-400 rounded p-3 mb-4 text-[12px]">
            <p className="font-bold uppercase text-[10px] mb-1 text-gray-600">Keluhan Pelanggan</p>
            <p>{workOrder.keluhan}</p>
          </div>
        )}

        {/* Rincian sparepart */}
        {(workOrder.items || []).length > 0 && (
          <>
            <p className="font-bold uppercase text-[10px] mb-1 text-gray-600">Rincian Sparepart</p>
            <table className="w-full border-collapse text-[12px] mb-4">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-400 px-2 py-1.5 text-left w-8">No</th>
                  <th className="border border-gray-400 px-2 py-1.5 text-left">Sparepart</th>
                  <th className="border border-gray-400 px-2 py-1.5 text-right w-16">Qty</th>
                  <th className="border border-gray-400 px-2 py-1.5 text-right w-28">Harga</th>
                  <th className="border border-gray-400 px-2 py-1.5 text-right w-28">Total</th>
                </tr>
              </thead>
              <tbody>
                {workOrder.items.map((item, idx) => (
                  <tr key={item.id || idx}>
                    <td className="border border-gray-400 px-2 py-1.5">{idx + 1}</td>
                    <td className="border border-gray-400 px-2 py-1.5">
                      {item.sparepart?.nama || '-'} {item.sparepart?.kode ? `(${item.sparepart.kode})` : ''}
                    </td>
                    <td className="border border-gray-400 px-2 py-1.5 text-right">{item.jumlah}</td>
                    <td className="border border-gray-400 px-2 py-1.5 text-right">{formatRupiah(item.hargaSatuan || 0)}</td>
                    <td className="border border-gray-400 px-2 py-1.5 text-right">{formatRupiah(item.total || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {/* Rincian jasa */}
        {(workOrder.labor || []).length > 0 && (
          <>
            <p className="font-bold uppercase text-[10px] mb-1 text-gray-600">Rincian Jasa / Pekerjaan</p>
            <table className="w-full border-collapse text-[12px] mb-4">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-400 px-2 py-1.5 text-left w-8">No</th>
                  <th className="border border-gray-400 px-2 py-1.5 text-left">Pekerjaan</th>
                  <th className="border border-gray-400 px-2 py-1.5 text-right w-16">Jam</th>
                  <th className="border border-gray-400 px-2 py-1.5 text-right w-28">Tarif/Jam</th>
                  <th className="border border-gray-400 px-2 py-1.5 text-right w-28">Total</th>
                </tr>
              </thead>
              <tbody>
                {workOrder.labor.map((lab, idx) => (
                  <tr key={lab.id || idx}>
                    <td className="border border-gray-400 px-2 py-1.5">{idx + 1}</td>
                    <td className="border border-gray-400 px-2 py-1.5">
                      {lab.keterangan || lab.mechanic?.nama || 'Jasa Servis'}
                    </td>
                    <td className="border border-gray-400 px-2 py-1.5 text-right">{lab.jam}</td>
                    <td className="border border-gray-400 px-2 py-1.5 text-right">{formatRupiah(lab.tarifPerJam || 0)}</td>
                    <td className="border border-gray-400 px-2 py-1.5 text-right">{formatRupiah(lab.total || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {/* Ringkasan biaya */}
        <div className="flex justify-end mb-6">
          <table className="text-[12px] w-64">
            <tbody>
              <tr>
                <td className="py-0.5">Total Sparepart</td>
                <td className="py-0.5 text-right font-medium">{formatRupiah(workOrder.totalParts || 0)}</td>
              </tr>
              <tr>
                <td className="py-0.5">Total Jasa</td>
                <td className="py-0.5 text-right font-medium">{formatRupiah(workOrder.totalLabor || 0)}</td>
              </tr>
              <tr className="border-t border-black">
                <td className="py-1 font-bold">Total Biaya</td>
                <td className="py-1 text-right font-bold">{formatRupiah(workOrder.totalBiaya || 0)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Persetujuan pelanggan */}
        <div className="flex justify-between items-end mt-10 text-[12px]">
          <div className="text-center">
            <p className="mb-12">Pemilik Kendaraan,</p>
            <div className="border-t border-black w-40 pt-1">
              <p className="font-semibold">{workOrder.customer?.nama || '..........................'}</p>
            </div>
          </div>
          <div className="text-center">
            <p className="mb-12">Menyetujui, Teknisi,</p>
            <div className="border-t border-black w-40 pt-1">
              <p className="font-semibold">{workOrder.mechanic?.nama || '..........................'}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default WorkOrderPrint