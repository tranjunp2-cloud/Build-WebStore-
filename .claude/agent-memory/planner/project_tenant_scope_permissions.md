---
name: tenant-scope-and-permissions
description: Multi-tenant scoping uses tenants collection (not sites); PermissionId is a closed union
metadata:
  type: project
---

Tenant scoping in ech-prime-web-v2 settings/email/payment code is on the `tenants` collection, accessed via `getCurrentTenantId()` (`src/lib/auth.ts`). Site-level data lives in `sites` (relationship → `tenants`), but per-seller config (payments, email) attaches to `tenants`.

`PermissionId` (`src/lib/permissions.ts`) is a CLOSED union: `'products' | 'orders' | 'blog' | 'builder' | 'settings'`. Adding a new permission requires editing the type + `ALLOWED_PERMISSIONS` set + role-assignment UI.

**Why:** A plan spec wrongly assumed config FK → `sites(id)` and a new `email_settings` permission. Both are friction points.
**How to apply:** For new per-seller settings, FK to `tenants(id)`, scope via `getCurrentTenantId()`, mirror `Sites.ts` access blocks. Reuse `'settings'` permission unless a real RBAC split is required (YAGNI).
