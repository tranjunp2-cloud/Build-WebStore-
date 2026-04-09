---
phase: "01"
title: Environment Detection
status: pending
estimate: 30m
---

# Phase 1: Environment Detection

## Muc tieu

Them env var `NEXT_PUBLIC_APP_ENV` va tao utility `isStaging()` de dung o ca client va server.

## Tasks

### 1.1 Them env var vao .env example files

**Files:**
- `.env.example` — them `NEXT_PUBLIC_APP_ENV=` (empty default)
- `.env.production.example` — them `NEXT_PUBLIC_APP_ENV=production`

**Gia tri hop le:** `staging` | `production` | empty (default = production behavior)

### 1.2 Tao utility `src/lib/env.ts`

```typescript
/**
 * Check if current environment is staging.
 * Works on both client (NEXT_PUBLIC_*) and server.
 * Default: false (production behavior khi khong set)
 */
export function isStaging(): boolean {
  return process.env.NEXT_PUBLIC_APP_ENV === 'staging'
}

/**
 * Server-only guard — throw neu khong phai staging.
 * Dung trong API routes de double protect.
 */
export function assertStaging(): void {
  if (!isStaging()) {
    throw new Error('This action is only available in staging environment')
  }
}
```

### 1.3 Cau hinh staging env

- Tren GitHub Secrets (staging): set `NEXT_PUBLIC_APP_ENV=staging`
- Tren production: set `NEXT_PUBLIC_APP_ENV=production` (hoac khong set — default safe)
- Local dev: them vao `.env.local` neu can test

## Verification

- [ ] `isStaging()` tra ve `true` khi `NEXT_PUBLIC_APP_ENV=staging`
- [ ] `isStaging()` tra ve `false` khi empty hoac `production`
- [ ] `assertStaging()` throw error khi khong phai staging
- [ ] `.env.example` va `.env.production.example` da co var moi
