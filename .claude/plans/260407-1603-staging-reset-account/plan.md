---
feature: Staging Reset Account
status: in-progress
created: 2026-04-07
estimated: 4h
branch: feat/staging-reset-account
phases:
  - id: phase-01
    title: Environment Detection
    status: pending
    estimate: 30m
  - id: phase-02
    title: Reset Account API
    status: pending
    estimate: 2h
  - id: phase-03
    title: Settings UI
    status: pending
    estimate: 1.5h
---

# Staging Reset Account

## Mục tiêu

Cho phep QA team reset tai khoan ve trang thai "moi toanh" tren staging, khong can tao account moi. Chi hien thi tren staging, khong bao gio xuất hien tren production.

## Pham vi

- **Reset = xoa TOAN BO tenants + data**, GIU NGUYEN user account (email, password, name)
- Cascade delete: Analytics > Orders > Subscriptions > Products > Pages > Media (+ S3) > Templates > Sites > **Tenants**
- Xoa tenant membership khoi user.tenants array
- User redirect ve /onboarding de tao tenant + store moi tu dau
- Staging-only: double guard (client + server)
- Delete strategy: Payload Local API (trigger hooks, auto S3 cleanup)

## Phases

| # | Phase | File | Est. | Status |
|---|-------|------|------|--------|
| 1 | [Environment Detection](./phase-01-env-detection.md) | env utility + .env files | 30m | pending |
| 2 | [Reset Account API](./phase-02-reset-api.md) | Next.js API route | 2h | pending |
| 3 | [Settings UI](./phase-03-settings-ui.md) | Dashboard settings page | 1.5h | pending |

## Out of Scope

- Hard delete user account (chi xoa data + tenants)
- Production reset (KHONG BAO GIO)
- Admin bulk reset (chi user tu reset chinh minh)

## Risks

- Media files tren S3 can xoa cung — Payload API se trigger hooks auto-delete
- FK constraints co the block delete neu thu tu sai — plan da dinh thu tu cascade
- Xoa tenant = mat slug cu — QA phai chon slug moi khi onboard lai

## Validation Summary

**Validated:** 2026-04-07
**Questions asked:** 4

### Confirmed Decisions
- Reset scope: ALL tenants cua user (khong chon tung cai)
- Post-reset redirect: /onboarding (giong account moi)
- Delete strategy: Payload Local API (trigger hooks, S3 cleanup)
- Tenant handling: XOA TENANT LUON (khong giu lai, user tao moi tu dau)

### Action Items
- [x] Update plan.md — scope thay doi: xoa tenant thay vi giu
- [ ] Update phase-02: cascade delete bao gom xoa tenant + clear user.tenants array
- [ ] Update phase-03: redirect /onboarding thay vi /dashboard
