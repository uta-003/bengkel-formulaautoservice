# Frontend Integration Guide

## ✅ New Features Added

### 1. API Service Layer (`services/apiService.js`)
- Centralized API communication
- Error handling
- Configuration via environment variables

**Usage:**
```javascript
import { apiService } from '@/services/apiService'

// Health check
const health = await apiService.health()

// Get units
const units = await apiService.getUnits()

// Create ticket
const ticket = await apiService.createTicket(ticketData)
```

### 2. Toast/Notification System (`services/toastService.js`)
- Global notification management
- Multiple types: success, error, warning, info
- Auto-dismiss with custom duration

**Usage:**
```javascript
import { toastService } from '@/services/toastService'

toastService.success('Operation successful!')
toastService.error('Something went wrong')
toastService.warning('Are you sure?')
toastService.info('Information message')
```

### 3. Input Validation (`services/validators.js`)
- Reusable validators
- Form validation utility
- Common validation rules

**Usage:**
```javascript
import { validators, validateForm } from '@/services/validators'

// Single field validation
const error = validators.email('test@example.com')

// Form validation
const errors = validateForm(formData, {
  email: (val) => validators.email(val),
  username: (val) => validators.required(val, 'Username')
})
```

**Available Validators:**
- `required(value, fieldName)`
- `email(value)`
- `number(value, fieldName)`
- `minLength(value, min, fieldName)`
- `maxLength(value, max, fieldName)`
- `positiveNumber(value, fieldName)`
- `phone(value)`

### 4. Role-Based Access Control - RBAC (`services/rbacService.js`)
- Permission-based access control
- Role management (ADMIN, STAFF)
- Dynamic permission checking

**Usage:**
```javascript
import { rbacService, Permissions } from '@/services/rbacService'

const hasPermission = rbacService.hasPermission(user.role, Permissions.CREATE_USER)
const canExport = rbacService.canExportReports(user.role)

// Checking multiple permissions
rbacService.hasAnyPermission(user.role, [perm1, perm2])
rbacService.hasAllPermissions(user.role, [perm1, perm2])
```

**Predefined Methods:**
- `canViewUsers(role)`
- `canCreateUser(role)`
- `canDeleteUser(role)`
- `canAccessSettings(role)`
- `canCreateSparepart(role)`
- `canCreateTransaction(role)`
- `canExportReports(role)`

### 5. UI Components

#### ToastContainer (`components/ToastContainer.jsx`)
Add to your root App component to display notifications:
```jsx
<ToastContainer />
```

#### ProtectedComponent (`components/ProtectedComponent.jsx`)
Conditionally render based on permissions:
```jsx
<ProtectedComponent permission={Permissions.DELETE_USER}>
  <button>Delete User</button>
</ProtectedComponent>
```

#### ProtectedButton
Button that disables based on permissions:
```jsx
<ProtectedButton
  permission={Permissions.CREATE_USER}
  onClick={handleCreate}
>
  Create User
</ProtectedButton>
```

#### Skeleton Loaders (`components/Skeleton.jsx`)
Show loading states while fetching:
```jsx
<SkeletonLoader count={5} height="h-10" />
<TableSkeleton rows={5} cols={5} />
<CardSkeleton />
```

## 📝 Updated Components

### Login Page
- Added toast notifications for success/error
- Better error handling

### Pengaturan (Settings) Page
- RBAC enforcement - only admins can access
- Form validation with error display
- Toast notifications for all actions
- Permission checks for create/update/delete operations

## 🔐 Role Permissions

### ADMIN
- All permissions (VIEW_USERS, CREATE_USER, UPDATE_USER, DELETE_USER, etc.)

### STAFF
- VIEW_SPAREPART
- CREATE_TRANSACTION
- VIEW_TRANSACTIONS
- VIEW_REPORTS
- VIEW_AUDIT_LOG

## 🌍 Environment Configuration

Create `.env.local` file:
```
VITE_API_URL=http://localhost:3000/api
```

For production:
```
VITE_API_URL=https://your-api-domain.com/api
```

## 🚀 Integration Checklist

- [x] API Service Layer
- [x] Toast Notification System
- [x] Input Validation
- [x] RBAC System
- [x] UI Components
- [x] Login Integration
- [x] Settings Page Protection
- [ ] Sparepart Page API Integration
- [ ] Transaction Pages API Integration
- [ ] Laporan Page API Integration

## 📚 Next Steps

1. Update remaining pages to use API service
2. Add search/filter/pagination to tables
3. Implement file upload for spareparts
4. Add real-time data refresh
5. Write unit tests
