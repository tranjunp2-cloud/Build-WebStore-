---
title: "Universal CI/CD Adapter for Bot"
description: "Refactor /api/ci/notify thành universal adapter, hỗ trợ Vercel + GitHub Actions + DO + generic sources"
status: pending
priority: P1
effort: 3h
branch: staging
tags: [ci-cd, bot, vercel, lark, adapter]
created: 2026-04-12
---

# Universal CI/CD Adapter

## Mục tiêu

Biến `/api/ci/notify` trên `prime-bot-assistant` thành **universal CI/CD notification hub** — nhận events từ mọi nguồn (Vercel, GitHub Actions, DigitalOcean, generic), normalize về unified schema, render Lark v2 card, gửi tới đúng group.

## Tại sao

Hiện tại prime-web-v2 có `/api/webhooks/vercel` — adapter tạm, forward Vercel events → Bot. Duplicate logic, khó maintain. Di chuyển adapter logic vào Bot = single source of truth cho CI/CD notifications.

## Architecture

```
┌─────────────────────────────────┐
│        /api/ci/notify           │
│   (universal CI/CD endpoint)    │
├─────────────────────────────────┤
│  Source Detector                │
│  ┌─────────┬─────────┬────────┐│
│  │ Vercel  │ GitHub  │Generic ││
│  │ Adapter │ Actions │Adapter ││
│  │         │ Adapter │        ││
│  └────┬────┴────┬────┴───┬────┘│
│       └─────────┼────────┘     │
│          Normalizer             │
│     → CINotifyPayload          │
├─────────────────────────────────┤
│  Card Builder (existing v5)     │
│  → Lark v2 interactive card     │
├─────────────────────────────────┤
│  Router → CI/CD Lark group      │
└─────────────────────────────────┘
```

## Phases

| # | Phase | Status | File |
|---|-------|--------|------|
| 1 | Adapter framework + Vercel adapter | pending | [phase-01](phase-01-adapter-framework.md) |
| 2 | Update /api/ci/notify route | pending | [phase-02](phase-02-update-route.md) |
| 3 | Vercel webhook setup + remove old handler | pending | [phase-03](phase-03-webhook-setup.md) |
| 4 | Test & verify | pending | [phase-04](phase-04-test-verify.md) |

## Repos affected

| Repo | Changes |
|------|---------|
| `prime-bot-assistant` | Add adapter framework, update route (Phase 1-2) |
| `ech-prime-web-v2` | Remove `/api/webhooks/vercel`, add VERCEL_WEBHOOK_SECRET to Bot (Phase 3) |

## Validation Summary

**Validated:** 2026-04-12
**Questions asked:** 4

### Confirmed Decisions
- **Generic adapter**: Giữ, nhưng BẮT BUỘC Bearer token. Dùng cho curl test hoặc CI khác.
- **Missing VERCEL_WEBHOOK_SECRET**: Reject 401. Không skip verify — buộc config đúng.
- **Multi-project**: Design adapter detect project từ Vercel payload. Mỗi Vercel project add webhook riêng → Bot xử lý tất cả.
- **Migration**: 2 PRs riêng. PR1: Bot adapter (deploy + verify hoạt động). PR2: Xóa old handler trên prime-web-v2.

### Action Items
- [ ] Phase 1: Generic adapter phải require Bearer token (CRON_SECRET)
- [ ] Phase 1: Vercel adapter reject 401 khi thiếu VERCEL_WEBHOOK_SECRET
- [ ] Phase 1: Vercel normalizer phải extract project name từ payload (multi-project ready)
- [ ] Phase 3: Tách thành 2 PRs — Bot changes first, web cleanup second

## Research

- [Bot codebase analysis](research/researcher-01-bot-codebase.md)
- [Web notify & webhooks analysis](research/researcher-02-web-notify.md)
