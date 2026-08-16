import { describe, it, expect } from 'vitest'
import { rbacService, Permissions, Roles } from '../src/services/rbacService'

describe('RBAC Service', () => {
  describe('hasPermission', () => {
    it('ADMIN memiliki semua permissions', () => {
      Object.values(Permissions).forEach(permission => {
        expect(rbacService.hasPermission(Roles.ADMIN, permission)).toBe(true)
      })
    })

    it('STAFF memiliki permission untuk melihat sparepart', () => {
      expect(rbacService.hasPermission(Roles.STAFF, Permissions.VIEW_SPAREPART)).toBe(true)
    })

    it('STAFF dapat membuat transaksi', () => {
      expect(rbacService.hasPermission(Roles.STAFF, Permissions.CREATE_TRANSACTION)).toBe(true)
    })

    it('STAFF tidak dapat akses settings', () => {
      expect(rbacService.hasPermission(Roles.STAFF, Permissions.ACCESS_SETTINGS)).toBe(false)
    })

    it('STAFF tidak dapat membuat user', () => {
      expect(rbacService.hasPermission(Roles.STAFF, Permissions.CREATE_USER)).toBe(false)
    })

    it('Role tidak dikenal tidak punya permission', () => {
      expect(rbacService.hasPermission('SUPER_USER', Permissions.VIEW_SPAREPART)).toBe(false)
    })

    it('User tanpa role tidak punya permission', () => {
      expect(rbacService.hasPermission(null, Permissions.VIEW_SPAREPART)).toBe(false)
      expect(rbacService.hasPermission(undefined, Permissions.VIEW_SPAREPART)).toBe(false)
    })
  })

  describe('hasAnyPermission', () => {
    it('mengembalikan true jika user punya salah satu permission', () => {
      expect(rbacService.hasAnyPermission(Roles.STAFF, [
        Permissions.CREATE_USER,
        Permissions.VIEW_SPAREPART
      ])).toBe(true)
    })

    it('mengembalikan false jika user tidak punya permission apapun', () => {
      expect(rbacService.hasAnyPermission(Roles.STAFF, [
        Permissions.CREATE_USER,
        Permissions.DELETE_USER
      ])).toBe(false)
    })
  })

  describe('hasAllPermissions', () => {
    it('mengembalikan true jika user punya semua permissions', () => {
      expect(rbacService.hasAllPermissions(Roles.ADMIN, [
        Permissions.VIEW_SPAREPART,
        Permissions.ACCESS_SETTINGS
      ])).toBe(true)
    })

    it('mengembalikan false jika user kurang satu permission', () => {
      expect(rbacService.hasAllPermissions(Roles.STAFF, [
        Permissions.VIEW_SPAREPART,
        Permissions.ACCESS_SETTINGS
      ])).toBe(false)
    })
  })

  describe('Helper methods', () => {
    it('canAccessSettings hanya untuk admin', () => {
      expect(rbacService.canAccessSettings(Roles.ADMIN)).toBe(true)
      expect(rbacService.canAccessSettings(Roles.STAFF)).toBe(false)
    })

    it('canCreateSparepart hanya untuk admin', () => {
      expect(rbacService.canCreateSparepart(Roles.ADMIN)).toBe(true)
      expect(rbacService.canCreateSparepart(Roles.STAFF)).toBe(false)
    })

    it('canCreateTransaction untuk semua role aktif', () => {
      expect(rbacService.canCreateTransaction(Roles.ADMIN)).toBe(true)
      expect(rbacService.canCreateTransaction(Roles.STAFF)).toBe(true)
    })
  })
})