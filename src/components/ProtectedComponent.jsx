import { authService } from '../services/authService'
import { rbacService } from '../services/rbacService'

// Component untuk protect berdasarkan permission
export function ProtectedComponent({ permission, children, fallback = null }) {
  const user = authService.getCurrentUser()
  
  if (!user || !rbacService.hasPermission(user.role, permission)) {
    return fallback || (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
        Anda tidak memiliki akses ke fitur ini.
      </div>
    )
  }

  return children
}

// Wrapper untuk button yang disabled berdasarkan permission
export function ProtectedButton({ permission, children, ...props }) {
  const user = authService.getCurrentUser()
  const hasPermission = user && rbacService.hasPermission(user.role, permission)

  return (
    <button
      {...props}
      disabled={!hasPermission || props.disabled}
      className={`${props.className} ${!hasPermission ? 'opacity-50 cursor-not-allowed' : ''}`}
      title={!hasPermission ? 'Anda tidak memiliki akses' : props.title}
    >
      {children}
    </button>
  )
}
