---
title: "GH-1293 — SSO Step Status Sync"
description: "PWv2 notifies SSO API when user completes 3 Web Store onboarding steps so Unifi Hub updates progress from 0 of 3"
status: pending
priority: P2-High
effort: 4h
branch: fix/GH-1293-sso-step-status-sync
tags: [sso, unifi-hub, onboarding, step-status, cron]
created: 2026-06-22
issue: https://github.com/primeproduction/ech-prime-web-v2/issues/1293
blockedBy: []
blocks: []
---

# GH-1293 — SSO Step Status Sync

## Problem

PWv2 không gọi `PATCH /api/v1/product/8/step-status` lên SSO API sau khi user hoàn thành 3 bước Web Store. Unifi Hub đọc step statuses từ SSO API → mãi hiển thị "0 of 3".

## Root Cause

- SSO API đã sẵn sàng (endpoint + idempotent + schema)
- PWv2 nhận password plaintext khi provision nhưng discard ngay (line 120)
- Không có outbound call nào từ PWv2 → SSO API
- Không có env var cho SSO API base URL (server-side) hay encryption key

## Design

**Pattern:** Mirror SSO API's `users.key_string` — lưu encrypted password tại provision, decrypt để login SSO API khi cần.

```
Provision (line 120, currently discards):
  password (plaintext) → encrypt(AES-256) → Users.keyString

Step complete:
  Users.email + decrypt(Users.keyString) → POST /api/v1/login → Bearer token
  → PATCH /api/v1/product/8/step-status { stepN_status: 1 }
  → failure → sso_step_events (retry queue)

Vercel Cron (*/1 * * * *):
  pending events → retry → mark completed/failed
```

**SSO API endpoints (unchanged):**
- `POST /api/v1/login` → Bearer token (auth with user email + password)
- `PATCH /api/v1/product/8/step-status` → `{ step1_status: 1 }` | `{ step2_status: 1 }` | `{ step3_status: 1 }`
- Product ID `8` = `PRIME_WEB_V2_TYPE` constant (confirmed from SSO codebase)
- Idempotent: SSO skips if step already = 1

## Phase Table

| # | Phase | Effort | Dependency | Status |
|---|-------|--------|------------|--------|
| 01 | [Schema + Env](./phase-01-schema-env.md) | 0.5h | None | pending |
| 02 | [SSO Client + Triggers](./phase-02-sso-client-triggers.md) | 2.5h | Phase 01 | pending |
| 03 | [Retry Cron](./phase-03-retry-cron.md) | 1h | Phase 01 | pending |

## Files Modified

| File | Phase | Change |
|------|-------|--------|
| `src/collections/Users.ts` | 01 | Add `keyString` field (hidden) |
| `scripts/db-setup.js` | 01 | Add `ALTER TABLE users ADD COLUMN key_string` migration |
| `.env.example` + staging/production examples | 01 | Add `SSO_ENCRYPTION_KEY` |
| `src/app/api/v1/sso/provision/route.ts` | 02 | Store encrypted keyString instead of discarding password |
| `src/lib/sso/sso-api-client.ts` | 02 | **NEW** — encrypt/decrypt, SSO login, notifyStepComplete |
| `src/app/api/ai/apply-template/route.ts` | 02 | Trigger step 1 after template applied |
| `src/app/api/sites/[siteId]/shipping-config/route.ts` | 02 | Trigger step 2 after shipping saved |
| `src/collections/Products.ts` | 02 | Trigger step 3 in afterChange (create + active) |
| `src/app/api/cron/process-sso-steps/route.ts` | 03 | **NEW** — retry cron |
| `vercel.json` | 03 | Add cron entry `*/1 * * * *` |

## Env Vars

| Var | Status | Note |
|-----|--------|------|
| `NEXT_PUBLIC_SSO_BASE_URL` | Already set ✅ | `https://sso.dev.ecommercehub.my` — reuse for API calls |
| `CRON_SECRET` | Already set ✅ | Reuse for cron endpoint auth |
| `SSO_ENCRYPTION_KEY` | **New** | 32-byte AES-256 key |

## Unresolved

1. `NEXT_PUBLIC_SSO_BASE_URL` → `/api/v1/login` needs to work (same domain as web? confirm with SSO team)
2. User đã provision trước khi có `keyString` → `keyString` = null → cần fallback hoặc migration
3. Max retry = 5 → sau đó alert hay log only?
