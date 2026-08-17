import { useEffect, useState } from 'react'
import { X, AlertCircle, CheckCircle, AlertTriangle, Info } from 'lucide-react'
import { toastService } from '../services/toastService'

function Toast({ message, type, onDismiss }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 3000)
    return () => clearTimeout(timer)
  }, [onDismiss])

  const styles = {
    success: 'bg-green-50 border-green-200 text-green-800',
    error: 'bg-red-50 border-red-200 text-red-800',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    info: 'bg-brand-50 border-brand-200 text-brand-800'
  }

  const icons = {
    success: <CheckCircle className="w-5 h-5" />,
    error: <AlertCircle className="w-5 h-5" />,
    warning: <AlertTriangle className="w-5 h-5" />,
    info: <Info className="w-5 h-5" />
  }

  return (
    <div className={`border rounded-lg p-4 flex items-start gap-3 ${styles[type]}`}>
      {icons[type]}
      <div className="flex-1">
        <p className="font-medium">{message}</p>
      </div>
      <button
        onClick={onDismiss}
        className="text-current opacity-50 hover:opacity-100"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}

export function ToastContainer() {
  const [toasts, setToasts] = useState([])

  useEffect(() => {
    const unsubscribe = toastService.subscribe((toast) => {
      if (toast.remove) {
        setToasts(prev => prev.filter(t => t.id !== toast.id))
      } else {
        setToasts(prev => [...prev, toast])
      }
    })
    return unsubscribe
  }, [])

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2 max-w-sm">
      {toasts.map(toast => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          onDismiss={() => toastService.dismiss(toast.id)}
        />
      ))}
    </div>
  )
}
