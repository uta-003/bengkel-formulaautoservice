// Toast/Notification System
let toastCallbacks = []

export const toastService = {
  subscribe: (callback) => {
    toastCallbacks.push(callback)
    return () => {
      toastCallbacks = toastCallbacks.filter(cb => cb !== callback)
    }
  },

  show: (message, type = 'info', duration = 3000) => {
    const id = Math.random().toString(36).substr(2, 9)
    toastCallbacks.forEach(cb => cb({ id, message, type, duration }))
    if (duration > 0) {
      setTimeout(() => toastService.dismiss(id), duration)
    }
    return id
  },

  success: (message, duration) => toastService.show(message, 'success', duration),
  error: (message, duration) => toastService.show(message, 'error', duration),
  warning: (message, duration) => toastService.show(message, 'warning', duration),
  info: (message, duration) => toastService.show(message, 'info', duration),

  dismiss: (id) => {
    toastCallbacks.forEach(cb => cb({ id, remove: true }))
  }
}
