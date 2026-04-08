---
phase: "02"
title: Reset Account API
status: pending
estimate: 2h
depends_on: ["phase-01"]
---

# Phase 2: Reset Account API

## Muc tieu

Tao `POST /api/account/reset` endpoint de cascade delete toan bo data + XOA TENANT LUON, giu nguyen user account (email, password, name). User se di qua onboarding lai.

## File moi

### `src/app/api/account/reset/route.ts`

## Logic chi tiet

### 2.1 Auth + Environment Guard

```
1. assertStaging() — throw 403 neu khong phai staging
2. Get current user tu Payload (getPayload + headers)
3. Neu chua login → 401
4. Lay danh sach tenant IDs tu user.tenants
5. Neu khong co tenant → tra ve success (nothing to reset)
```

### 2.2 Cascade Delete — THU TU BAT BUOC

Phai delete theo thu tu nay de tranh FK constraint errors:

```
For each tenantId in user.tenants:

  Step 1: Analytics     (where: { tenant: { equals: tenantId } })
  Step 2: Orders        (where: { tenant: { equals: tenantId } })
  Step 3: Subscriptions (where: { tenant: { equals: tenantId } })
  Step 4: Products      (where: { tenant: { equals: tenantId } })
  Step 5: Pages         — can query Sites truoc, roi delete Pages by site IDs
  Step 6: Media         — delete records + goi S3 delete cho tung file
  Step 7: Templates     (where: { tenant: { equals: tenantId } })
  Step 8: Sites         (where: { tenant: { equals: tenantId } })
  Step 9: Tenants       — delete tenant record
  Step 10: Clear user.tenants array (remove tenant membership)
```

**LUU Y:** Dung Payload Local API (`payload.delete`) voi `where` filter, KHONG dung raw SQL.

### 2.3 Payload Delete Pattern

```typescript
// Xoa tat ca records cua 1 collection theo tenant
async function clearCollection(
  payload: Payload,
  collection: string,
  tenantId: string
) {
  // Payload khong co deleteMany — phai find roi delete tung cai
  const { docs } = await payload.find({
    collection,
    where: { tenant: { equals: tenantId }, deletedAt: { exists: false } },
    limit: 0, // get all
  })

  for (const doc of docs) {
    await payload.delete({
      collection,
      id: doc.id,
    })
  }

  return docs.length
}
```

**Alternative:** Neu Payload co `payload.db.drizzle` hoac raw query, co the dung bulk delete de nhanh hon. Nhung Payload Local API an toan hon (trigger hooks, cascade).

### 2.4 Media + S3 Cleanup

```
Media collection co field: url, filename, mimeType
Khi delete Media doc qua Payload API:
  - Payload SHOULD auto-delete file tu storage adapter
  - Neu khong → manually call S3 delete
  - Staging: acceptable neu orphan files — khong critical
```

### 2.5 Xoa Tenant + Clear User Membership

```typescript
// Step 9: Xoa tenant record
await payload.delete({
  collection: 'tenants',
  id: tenantId,
})

// Step 10: Clear user.tenants array
await payload.update({
  collection: 'users',
  id: userId,
  data: {
    tenants: [], // xoa toan bo tenant membership
  },
})
```

### 2.6 Response Format

```typescript
// Success
{
  success: true,
  data: {
    resetAt: '2026-04-07T10:00:00Z',
    tenantsReset: ['tenant-id-1'],
    collectionsCleared: {
      analytics: 15,
      orders: 8,
      subscriptions: 1,
      products: 24,
      pages: 12,
      media: 45,
      templates: 3,
      sites: 2,
    }
  }
}

// Error — khong phai staging
{ success: false, error: { code: 'FORBIDDEN', message: 'Reset only available in staging' } }

// Error — chua login
{ success: false, error: { code: 'AUTH_REQUIRED', message: 'Login required' } }
```

## Security

- **Double guard:** `assertStaging()` (server) + UI chi hien thi khi `isStaging()` (client)
- **Tenant isolation:** Chi reset tenant cua user dang login, KHONG cho phep truyen tenantId tu request body
- **No hard delete user:** User record (email, password, roles) KHONG bi anh huong
- **Logging:** Log action vao console (staging khong can audit table)

## Verification

- [ ] `POST /api/account/reset` tra ve 403 khi `NEXT_PUBLIC_APP_ENV !== 'staging'`
- [ ] Tra ve 401 khi chua login
- [ ] Cascade delete dung thu tu, khong FK error
- [ ] Tenant record da bi xoa (khong con trong DB)
- [ ] User.tenants array = [] (khong con membership)
- [ ] User account khong bi anh huong (email, password con nguyen)
- [ ] Response tra ve so luong records da xoa cho tung collection
- [ ] Media files duoc xoa tu S3 (hoac acceptable orphan)
