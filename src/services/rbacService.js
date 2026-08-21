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
  VIEW_AUDIT_LOG: 'view_audit_log',

  // Service/Repair module
  VIEW_CUSTOMERS: 'view_customers',
  CREATE_CUSTOMER: 'create_customer',
  UPDATE_CUSTOMER: 'update_customer',
  DELETE_CUSTOMER: 'delete_customer',

  VIEW_VEHICLES: 'view_vehicles',
  CREATE_VEHICLE: 'create_vehicle',
  UPDATE_VEHICLE: 'update_vehicle',
  DELETE_VEHICLE: 'delete_vehicle',

  VIEW_MECHANICS: 'view_mechanics',
  CREATE_MECHANIC: 'create_mechanic',
  UPDATE_MECHANIC: 'update_mechanic',
  DELETE_MECHANIC: 'delete_mechanic',

  VIEW_SERVICE_PACKAGES: 'view_service_packages',
  CREATE_SERVICE_PACKAGE: 'create_service_package',
  UPDATE_SERVICE_PACKAGE: 'update_service_package',
  DELETE_SERVICE_PACKAGE: 'delete_service_package',

  VIEW_WORK_ORDERS: 'view_work_orders',
  CREATE_WORK_ORDER: 'create_work_order',
  UPDATE_WORK_ORDER: 'update_work_order',
  DELETE_WORK_ORDER: 'delete_work_order',

  VIEW_WARRANTIES: 'view_warranties',
  CREATE_WARRANTY: 'create_warranty',
  UPDATE_WARRANTY: 'update_warranty',
  DELETE_WARRANTY: 'delete_warranty',

  VIEW_INVOICES: 'view_invoices',
  CREATE_INVOICE: 'create_invoice',
  UPDATE_INVOICE: 'update_invoice',
  DELETE_INVOICE: 'delete_invoice',

  VIEW_QR_CODES: 'view_qr_codes',
  GENERATE_QR_CODE: 'generate_qr_code'
}

// Role-Permission mapping
const rolePermissions = {
  [Roles.ADMIN]: Object.values(Permissions), // Admin punya semua permission
  [Roles.STAFF]: [
    Permissions.VIEW_SPAREPART,
    Permissions.CREATE_TRANSACTION,
    Permissions.VIEW_TRANSACTIONS,
    Permissions.VIEW_REPORTS,
    Permissions.VIEW_AUDIT_LOG,
    // Service/Repair module - STAFF bisa akses penuh
    Permissions.VIEW_CUSTOMERS,
    Permissions.CREATE_CUSTOMER,
    Permissions.UPDATE_CUSTOMER,
    Permissions.DELETE_CUSTOMER,
    Permissions.VIEW_VEHICLES,
    Permissions.CREATE_VEHICLE,
    Permissions.UPDATE_VEHICLE,
    Permissions.DELETE_VEHICLE,
    Permissions.VIEW_MECHANICS,
    Permissions.VIEW_SERVICE_PACKAGES,
    Permissions.VIEW_WORK_ORDERS,
    Permissions.CREATE_WORK_ORDER,
    Permissions.UPDATE_WORK_ORDER,
    Permissions.VIEW_WARRANTIES,
    Permissions.VIEW_INVOICES,
    Permissions.VIEW_QR_CODES,
    Permissions.GENERATE_QR_CODE
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
