// Sound Service - menggunakan Web Audio API untuk menghasilkan suara
// Tanpa perlu file audio eksternal

let audioContext = null

function getAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)()
  }
  return audioContext
}

function playTone(frequency, duration, type = 'sine', volume = 0.3) {
  try {
    const ctx = getAudioContext()
    if (ctx.state === 'suspended') {
      ctx.resume()
    }

    const oscillator = ctx.createOscillator()
    const gainNode = ctx.createGain()

    oscillator.type = type
    oscillator.frequency.setValueAtTime(frequency, ctx.currentTime)

    gainNode.gain.setValueAtTime(0, ctx.currentTime)
    gainNode.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.01)
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration)

    oscillator.connect(gainNode)
    gainNode.connect(ctx.destination)

    oscillator.start(ctx.currentTime)
    oscillator.stop(ctx.currentTime + duration)
  } catch (e) {
    // Abaikan error audio (misal browser tidak support)
    console.warn('Sound playback failed:', e)
  }
}

export const soundService = {
  // Sukses - nada naik (2 beep)
  success() {
    playTone(880, 0.15, 'sine', 0.3)
    setTimeout(() => playTone(1320, 0.2, 'sine', 0.3), 150)
  },

  // Error - nada turun (2 beep rendah)
  error() {
    playTone(400, 0.2, 'square', 0.2)
    setTimeout(() => playTone(300, 0.3, 'square', 0.2), 200)
  },

  // Warning - beep tunggal
  warning() {
    playTone(600, 0.3, 'sine', 0.3)
  },

  // Info - beep tunggal pendek
  info() {
    playTone(700, 0.1, 'sine', 0.2)
  },

  // Klik tombol - beep sangat pendek
  click() {
    playTone(1000, 0.05, 'sine', 0.15)
  },

  // Tambah data - nada naik 3x
  add() {
    playTone(660, 0.1, 'sine', 0.3)
    setTimeout(() => playTone(880, 0.1, 'sine', 0.3), 100)
    setTimeout(() => playTone(1100, 0.15, 'sine', 0.3), 200)
  },

  // Edit data - nada naik 2x
  edit() {
    playTone(700, 0.1, 'sine', 0.3)
    setTimeout(() => playTone(900, 0.15, 'sine', 0.3), 120)
  },

  // Hapus data - nada turun
  delete() {
    playTone(500, 0.15, 'sine', 0.3)
    setTimeout(() => playTone(350, 0.2, 'sine', 0.3), 150)
  },

  // Import - nada naik panjang
  import() {
    playTone(500, 0.1, 'sine', 0.3)
    setTimeout(() => playTone(700, 0.1, 'sine', 0.3), 100)
    setTimeout(() => playTone(900, 0.1, 'sine', 0.3), 200)
    setTimeout(() => playTone(1200, 0.2, 'sine', 0.3), 300)
  },

  // Export - nada turun panjang
  export() {
    playTone(1200, 0.1, 'sine', 0.3)
    setTimeout(() => playTone(900, 0.1, 'sine', 0.3), 100)
    setTimeout(() => playTone(700, 0.1, 'sine', 0.3), 200)
    setTimeout(() => playTone(500, 0.2, 'sine', 0.3), 300)
  },

  // Scan barcode - beep cepat
  scan() {
    playTone(1500, 0.08, 'square', 0.2)
    setTimeout(() => playTone(1500, 0.08, 'square', 0.2), 100)
  },

  // Notifikasi umum
  notify() {
    playTone(800, 0.15, 'sine', 0.3)
  }
}