---
title: "Fix #1270: Access Revoked dialog false-positive"
description: "Add retry/grace-period logic to eliminate spurious force_logout from transient null user or stale tenant cache"
status: pending
priority: P1
effort: 1.5h
branch: staging
tags: [bug, auth, session, cms, dashboard]
created: 2026-06-18
---

# Fix #1270: Access Revoked Dialog False-Positive

## Context
- Issue: https://github.com/primeproduction/ech-prime-web-v2/issues/1270
- Root cause: 3 false-positive triggers in session-check flow
- Added in commit `669c8b6f` (SSO integration feat)

## Root Causes

| # | Cause | Where |
|---|-------|-------|
| 1 | `getCurrentUser()` transient null (HMR/token-refresh/race) → immediate `force_logout` | `route.ts:10-14` |
| 2 | `user.tenants[0]` stale/unpopulated → empty tenantId → `force_logout` before DB re-verify | `route.ts:22-30` |
| 3 | Frontend: 1 `force_logout` → dialog immediately, no retry counter | `TenantAccessWatcher.tsx:24-27` |

## Phases

| Phase | File | Status | Effort |
|-------|------|--------|--------|
| [Phase 01 — Backend](./phase-01-backend-session-check.md) | `src/app/api/auth/session-check/route.ts` | pending | 45m |
| [Phase 02 — Frontend](./phase-02-frontend-tenant-watcher.md) | `src/components/dashboard/TenantAccessWatcher.tsx` | pending | 45m |

## Validation Summary

**Validated:** 2026-06-18
**Questions asked:** 4

### Confirmed Decisions
- **Retry cap**: Cap 3 lần `retry: true` liên tiếp → escalate as force_logout: Unauthenticated
- **Grace period scope**: Chỉ `Removed from workspace` cần 2-hit; `subscription_expired` + `Account suspended` show dialog ngay lập tức
- **Timing**: Giữ nguyên 5s startup / 8s retry / 12s grace
- **Interval in grace**: Block 60s interval trong grace period (clearInterval khi vào, startPolling khi ra)

### Action Items (đã apply vào phase-02)
- [x] Thêm `retryCountRef` (cap 3 lần retry:true)
- [x] Tách logic force_logout: immediate show vs 2-hit counter theo reason
- [x] Grace period entry: `clearInterval` + `inGracePeriodRef=true`
- [x] Grace period exit: `startPolling()` + `inGracePeriodRef=false`

## Verify Criteria
- Login → use dashboard 30min, switch tabs → NO spurious dialog
- HMR reload in dev → NO dialog
- Real revocation: owner removes user → dialog still appears correctly
- subscription_expired + Account suspended → dialog still appears immediately (first occurrence)
