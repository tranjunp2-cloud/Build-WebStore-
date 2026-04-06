---
title: "Optimize session-check polling performance"
description: "Fix excessive /api/auth/session-check calls — double DB query + 15s polling causing DB pressure at scale"
status: pending
priority: P1
effort: 1.5h
branch: staging-2
tags: [performance, auth, polling, database]
created: 2026-04-06
---

# Session-Check Performance Optimization

## Problem

Endpoint `/api/auth/session-check` đang gọi **quá nhiều** và **quá tốn**:

1. **Double DB query**: `getCurrentTenantId()` gọi `getCurrentUser()` lần 2 → mỗi request = 2-4 DB queries
2. **15s polling**: TenantAccessWatcher poll mỗi 15 giây + focus event (không debounce)
3. **Zero caching**: `cache: 'no-store'` + không có Cache-Control header
4. **Scale concern**: 100 users = 800-1,600 DB queries/min chỉ cho session check

## Impact Assessment

| Metric | Current | After Fix | Improvement |
|--------|---------|-----------|-------------|
| DB queries/call | 2-4 | 1 | 50-75% |
| Polls/min/user | 4+ | 1 | 75% |
| 100 users (queries/min) | 800-1,600 | 100 | **90%+** |
| 1,000 users (queries/min) | 8,000-16,000 | 1,000 | **90%+** |

## Phases

| Phase | Description | Effort | Status |
|-------|-------------|--------|--------|
| [Phase 01](./phase-01-quick-wins.md) | Fix double query + reduce polling + debounce | 30m | completed |
| [Phase 02](./phase-02-caching.md) | Add response caching + server-side cache | 1h | pending |

## Files to Modify

- `src/app/api/auth/session-check/route.ts` — fix double getCurrentUser
- `src/components/dashboard/TenantAccessWatcher.tsx` — reduce polling, add visibility check
- `src/lib/auth.ts` — add overload accepting user param (optional)

## Research

- [Endpoint Analysis](./research/researcher-01-endpoint-analysis.md)
- [Optimization Options](./research/researcher-02-optimization-options.md)
