---
title: "Vercel + Neon migration — complete step-by-step"
description: "Migration plan DO→Vercel+Neon với checklist dò lỗi từng bước, ready cho event 200 users"
status: done
priority: P0
effort: 16h
branch: fix/F31-preview-nav-404
tags: [migration, vercel, neon, performance, event]
created: 2026-04-09
---

# Vercel + Neon Migration Plan

## Mục tiêu
Chuyển 2 apps (prime-web-v2 + prime-bot-assistant) từ DO → Vercel + Neon.
Ready cho event 200 concurrent users trong ~1 tháng.

## Architecture: Before → After
```
BEFORE (DO):                          AFTER (Vercel):
┌─────────────┐                       ┌─────────────────┐
│ DO App       │──→ DO Dev DB ($7)    │ Vercel Pro ($20) │
│ professional │    PostgreSQL 16      │ ├─ prime-web-v2  │──→ Neon Free ($0)
│ -xs ($12)   │    512MB              │ └─ prime-bot     │    PostgreSQL 16
└─────────────┘                       └─────────────────┘    512MB + backup
Total: $19/mo                         Total: $20/mo
```

## Phases (7 phases, 4 ngày) — Updated after Prediction Review

| Phase | Description | Effort | Day | Status |
|-------|-------------|--------|-----|--------|
| [Phase 1](phase-01-neon-setup.md) | Setup Neon + migrate data + **test SSL strict** | 2h | 1 | ✅ Done |
| [Phase 2](phase-02-code-changes.md) | Code changes + bỏ Docker deps + **SSE→Polling** | 4h | 1 | 🔄 In Progress |
| [Phase 3](phase-03-vercel-setup.md) | Setup Vercel projects + env vars + deploy | 2h | 2 | ⬜ |
| [Phase 4](phase-04-dns-domains.md) | DNS (Route 53) + wildcard + Stripe webhook | 2h | 2 | ⬜ |
| [Phase 5](phase-05-perf-fixes.md) | Caching (unstable_cache) + AI protection + **Upstash Redis** | 4h | 3 | ⬜ |
| [Phase 6](phase-06-verify-cleanup.md) | E2E test + load test 200 users + cleanup DO | 2h | 4 | ⬜ |

## Rollback Plan
Giữ DO app running **2 tuần** sau migrate (buffer cho event). DNS switch back DO trong 5 phút.

## Prediction Review (2026-04-09)
**Verdict: CAUTION** — 3 adjustments applied:
1. ⚠️ **SSE fix moved to Phase 2** (trước first deploy) — `maxDuration: 300` > Vercel 60s limit
2. ⚠️ **Upstash Redis added** cho distributed rate limiting (in-memory không work trên serverless)
3. ⚠️ **SSL strict test** trong Phase 1 — Neon yêu cầu proper SSL, bỏ `rejectUnauthorized: false`

## Validation Summary

**Validated:** 2026-04-09
**Questions asked:** 5

### Confirmed Decisions
- **DNS**: Route 53 AWS → update CNAME records trực tiếp, không lo Cloudflare SSL conflict
- **DB Structure**: 2 databases riêng biệt → migrate độc lập, prime-web trước, prime-bot sau
- **DB Size**: < 100MB → Neon Free thừa sức (limit 512MB), không cần upgrade
- **Stripe**: Anh tự update webhook URL → thêm vào Phase 4 checklist
- **Event usage**: Full stack (AI Builder + Editor + View) → cần AI rate limit + caching + polling. Đây là worst case.

### Action Items
- [ ] Phase 4: Update DNS instructions cho Route 53 AWS (thay vì Cloudflare)
- [ ] Phase 4: Thêm bước update Stripe webhook URL sau DNS switch
- [ ] Phase 5: AI rate limit = MUST (200 users tạo site cùng lúc)
- [ ] Phase 5: Caching = MUST (editor + view combined load)
- [ ] Phase 1: Migrate prime-web DB trước, prime-bot DB sau (independent)

## Research
- [Migration checklist](research/researcher-01-migration-checklist.md)
- [CI bottlenecks](../260409-1837-cicd-optimization/research/researcher-01-current-bottlenecks.md)
- [Vercel assessment](../260409-1837-cicd-optimization/research/researcher-02-vercel-assessment.md)
- [Performance 200 users](../260409-1940-performance-200-concurrent/plan.md)
