---
title: "CI/CD Optimization — Parallel Jobs + Vercel Deploy Notify"
description: "Optimize CI from 8.7min→4.5min with parallel jobs, add Vercel deploy→Lark notifications"
status: pending
priority: P1
effort: 3h
branch: staging
tags: [ci, performance, vercel, notifications]
created: 2026-04-11
---

# CI/CD Optimization Plan

## Mục tiêu
1. **CI time 8.7min → 4.5min** — parallel jobs + caching
2. **Vercel deploy → Lark notify** — team biết deploy success/fail

## Phases

| Phase | Description | Effort | Status |
|-------|-------------|--------|--------|
| [Phase 1](phase-01-parallel-ci.md) | Parallel CI jobs + npm/build cache | 2h | ⬜ |
| [Phase 2](phase-02-vercel-deploy-notify.md) | Vercel webhook → Bot/Lark notification | 1h | ⬜ |

## Architecture

### Before (8.7 min, sequential)
```
install (53s) → lint (15s) → typecheck (31s) → test (215s) → build (192s) → metrics
```

### After (4.5 min, parallel)
```
Job 1: quality-check
  install (30s cached) → lint + typecheck (31s)

Job 2: test (needs: quality-check)
  install (30s cached) → test (215s)          ─┐
                                                ├─ song song
Job 3: build (needs: quality-check)             │
  install (30s cached) → build (132s cached) ─┘

Job 4: metrics (needs: test + build, PR only)
  coverage + bundle size comment
```

### Vercel Deploy Notify
```
Vercel deploy finish → Webhook POST → /api/webhooks/vercel
  → Verify signature
  → Call Bot API (smart-notify format)
  → Fallback: Lark webhook direct
  → Team gets Lark message ✅/❌
```

## Validation Summary

**Validated:** 2026-04-11
**Questions asked:** 4

### Confirmed Decisions
- **CI Gate:** Giữ block merge — CI fail (lint/typecheck/test/build) = block PR
- **Lark Group:** CI/CD group (oc_46ee7772) — giống DO deploy notify
- **Bot API:** Vẫn chạy trên DO → dùng Bot AI message first, Lark fallback
- **Notify scope:** Cả success + fail — team biết khi deploy thành công và thất bại

### Action Items
- [ ] Phase 1: Giữ build trong CI (block merge nếu fail)
- [ ] Phase 2: Lark target = CI/CD group webhook
- [ ] Phase 2: Bot API first → Lark fallback
- [ ] Phase 2: Notify cả deployment.ready + deployment.error
