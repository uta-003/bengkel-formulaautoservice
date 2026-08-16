// Input Validation Utilities
export const validators = {
  email: (value) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return !value || emailRegex.test(value) ? null : 'Email tidak valid'
  },

  required: (value, fieldName = 'Field') => {
    return !value || value.toString().trim() === '' ? `${fieldName} wajib diisi` : null
  },

  number: (value, fieldName = 'Number') => {
    return isNaN(value) ? `${fieldName} harus berupa angka` : null
  },

  minLength: (value, min, fieldName = 'Field') => {
    return value && value.length < min ? `${fieldName} minimal ${min} karakter` : null
  },

  maxLength: (value, max, fieldName = 'Field') => {
    return value && value.length > max ? `${fieldName} maksimal ${max} karakter` : null
  },

  positiveNumber: (value, fieldName = 'Number') => {
    const num = parseFloat(value)
    return isNaN(num) || num < 0 ? `${fieldName} harus angka positif` : null
  },

  phone: (value) => {
    const phoneRegex = /^(\+62|0)[0-9]{9,12}$/
    return !value || phoneRegex.test(value) ? null : 'Nomor telepon tidak valid'
  }
}

export const validateForm = (data, rules) => {
  const errors = {}
  Object.keys(rules).forEach(field => {
    const rule = rules[field]
    const value = data[field]
    const error = rule(value)
    if (error) errors[field] = error
  })
  return errors
}
