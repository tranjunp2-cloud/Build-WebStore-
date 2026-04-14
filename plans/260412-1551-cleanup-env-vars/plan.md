---
title: "Cleanup redundant NEXT_PUBLIC_APP_URL env var"
description: "Remove NEXT_PUBLIC_APP_URL (mirrors SERVER_URL), fix staging SERVER_URL value, update all configs"
status: completed
priority: P2
effort: 1h
branch: staging
tags: [cleanup, env-vars, middleware, config]
created: 2026-04-12
---

# Cleanup Env Vars: Remove NEXT_PUBLIC_APP_URL

## Problem

1. **Bug**: `NEXT_PUBLIC_SERVER_URL` trên staging = `web-v2.dev.ecommercehub.my` nhưng `NEXT_PUBLIC_ADMIN_DOMAIN` = `web-cms-v2.dev.ecommercehub.my` → middleware rewrite sai → main domain hiện Payload admin
2. **Redundancy**: `NEXT_PUBLIC_APP_URL` luôn = `NEXT_PUBLIC_SERVER_URL` trong mọi config. Chỉ 1 reference trong source code (`Users.ts:84` CORS list)

## Solution

- Xóa `NEXT_PUBLIC_APP_URL` khỏi toàn bộ codebase
- Fix `NEXT_PUBLIC_SERVER_URL` staging value = `https://web-cms-v2.dev.ecommercehub.my`
- Update Vercel Dashboard env

## Phases

| Phase | Description | Status | Files |
|-------|-------------|--------|-------|
| [Phase 01](./phase-01-remove-app-url.md) | Remove NEXT_PUBLIC_APP_URL from code + configs | ✅ done | 8 files + .do/app.yaml deleted |
| [Phase 02](./phase-02-fix-staging-env.md) | Fix SERVER_URL value + Vercel Dashboard | partial | .env fixed, Vercel manual |

## Research

- [Env var usage analysis](./research/researcher-01-env-usage.md)
- [Domain vars architecture](./research/researcher-02-domain-vars.md)

## Impact

- **Zero functional change** — APP_URL was never used independently
- **Reduces confusion** — 1 var instead of 2 identical ones
- **Fixes routing bug** — staging domain rewrite corrected

## Validation Summary

**Validated:** 2026-04-12
**Questions asked:** 3

### Confirmed Decisions
- **CORS origins**: Xóa `NEXT_PUBLIC_APP_URL` luôn, chỉ dùng `NEXT_PUBLIC_SERVER_URL`. Nếu cần thêm domain → dùng `ALLOWED_ORIGINS` (đã có sẵn)
- **`.do/app.yaml`**: Không dùng nữa, xóa luôn (cả staging + production đã chuyển Vercel)
- **Branch**: Tạo branch `chore/cleanup-env-vars` → PR vào staging

### Action Items
- [ ] Thêm step xóa `.do/app.yaml` vào Phase 01
- [ ] Thêm step xóa `docker-compose*.yml` DO-specific env refs
- [ ] Branch: `chore/cleanup-env-vars` thay vì commit thẳng staging
