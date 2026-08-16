// Role-Based Access Control (RBAC)
export const Roles = {
  ADMIN: 'ADMIN',
  STAFF: 'STAFF'
}

// Permissions mapping
export const Permissions = {
  // User Management
  VIEW_USERS: 'view_users',
  CREATE_USER: 'create_user',
  UPDATE_USER: 'update_user',
  DELETE_USER: 'delete_user',

  // Sparepart Management
  VIEW_SPAREPART: 'view_sparepart',
  CREATE_SPAREPART: 'create_sparepart',
  UPDATE_SPAREPART: 'update_sparepart',
  DELETE_SPAREPART: 'delete_sparepart',

  // Transactions
  VIEW_TRANSACTIONS: 'view_transactions',
  CREATE_TRANSACTION: 'create_transaction',
  UPDATE_TRANSACTION: 'update_transaction',

  // Reports
  VIEW_REPORTS: 'view_reports',
  EXPORT_REPORTS: 'export_reports',

  // Settings
  ACCESS_SETTINGS: 'access_settings',
  VIEW_AUDIT_LOG: 'view_audit_log'
}

// Role-Permission mapping
const rolePermissions = {
  [Roles.ADMIN]: Object.values(Permissions), // Admin punya semua permission
  [Roles.STAFF]: [
    Permissions.VIEW_SPAREPART,
    Permissions.CREATE_TRANSACTION,
    Permissions.VIEW_TRANSACTIONS,
    Permissions.VIEW_REPORTS,
    Permissions.VIEW_AUDIT_LOG
  ]
}

export const rbacService = {
  hasPermission: (userRole, permission) => {
    if (!userRole) return false
    const permissions = rolePermissions[userRole] || []
    return permissions.includes(permission)
  },

  hasAnyPermission: (userRole, permissions) => {
    return permissions.some(permission => rbacService.hasPermission(userRole, permission))
  },

  hasAllPermissions: (userRole, permissions) => {
    return permissions.every(permission => rbacService.hasPermission(userRole, permission))
  },

  canViewUsers: (userRole) => rbacService.hasPermission(userRole, Permissions.VIEW_USERS),
  canCreateUser: (userRole) => rbacService.hasPermission(userRole, Permissions.CREATE_USER),
  canDeleteUser: (userRole) => rbacService.hasPermission(userRole, Permissions.DELETE_USER),
  canAccessSettings: (userRole) => rbacService.hasPermission(userRole, Permissions.ACCESS_SETTINGS),
  canCreateSparepart: (userRole) => rbacService.hasPermission(userRole, Permissions.CREATE_SPAREPART),
  canCreateTransaction: (userRole) => rbacService.hasPermission(userRole, Permissions.CREATE_TRANSACTION),
  canExportReports: (userRole) => rbacService.hasPermission(userRole, Permissions.EXPORT_REPORTS)
}
