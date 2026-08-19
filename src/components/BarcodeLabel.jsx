import { useEffect, useRef } from 'react'
import JsBarcode from 'jsbarcode'

/**
 * Komponen untuk render dan cetak label barcode sparepart
 * Menggunakan JsBarcode untuk generate barcode EAN-13 yang bisa discan hp
 * Label siap cetak via print browser (CSS print-friendly)
 */
function BarcodeLabel({ sparepart, compact = false }) {
  const barcodeRef = useRef(null)

  useEffect(() => {
    if (barcodeRef.current && sparepart?.barcode) {
      try {
        JsBarcode(barcodeRef.current, sparepart.barcode, {
          format: 'EAN13',
          displayValue: true,
          fontSize: compact ? 10 : 12,
          width: compact ? 1.5 : 2,
          height: compact ? 30 : 40,
          margin: 0,
          textMargin: 2,
          font: 'monospace',
          background: '#ffffff',
          lineColor: '#000000'
        })
      } catch (err) {
        console.warn('Gagal render barcode:', err)
      }
    }
  }, [sparepart?.barcode, compact])

  if (!sparepart) return null

  return (
    <div className={`bg-white ${compact ? 'p-2 rounded border border-gray-200' : 'label-print p-4 rounded-lg border border-gray-200 shadow-sm'}`}>
      <div className="text-center">
        <p className={`font-bold text-gray-900 ${compact ? 'text-[11px]' : 'text-sm'} leading-tight`}>
          {sparepart.nama}
        </p>
        {!compact && (
          <p className="text-xs text-gray-600 mt-0.5">
            {sparepart.kode} • {sparepart.merk}
          </p>
        )}
      </div>

      <div className={`flex justify-center ${compact ? 'mt-1' : 'mt-3'}`}>
        <svg
          ref={barcodeRef}
          className="max-w-full"
        />
      </div>

      {!compact && sparepart.hargaJual && (
        <p className="text-center text-sm font-semibold text-gray-800 mt-2">
          Rp {Number(sparepart.hargaJual).toLocaleString('id-ID')}
        </p>
      )}

      {!compact && (
        <p className="text-center text-xs text-gray-500 mt-1">
          {sparepart.lokasi ? `Lokasi: ${sparepart.lokasi}` : 'Formula Auto Service'}
        </p>
      )}
    </div>
  )
}

export default BarcodeLabel