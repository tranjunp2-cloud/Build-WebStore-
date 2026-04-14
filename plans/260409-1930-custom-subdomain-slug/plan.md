---
title: "Custom subdomain slug — let users choose their own subdomain"
description: "Replace store-{id} with user-chosen brandable subdomain like mybakery.web-v2.dev.ecommercehub.my"
status: pending
priority: P2
effort: 8h
branch: fix/dockerfile-domain-url
tags: [subdomain, slug, onboarding, branding, multi-tenant]
created: 2026-04-09
---

# Custom Subdomain Slug

## Problem
Current: `store-{user_id}` → `store-7.web-v2.dev.ecommercehub.my` — ugly, not brandable.
Goal: `mybakery.web-v2.dev.ecommercehub.my` — user chooses, like Shopify.

## Current State
- Slug auto-generated in `generate-site/route.ts:115` and `apply-template/route.ts`
- Format: `store-${user.id}` — unique but generic
- No UI to edit slug
- No validation for reserved words
- Tenant `slug` field: unique + required + indexed

## Phases

| # | Phase | Status | Effort |
|---|-------|--------|--------|
| 1 | [Smart slug generation from business name](phase-01-smart-slug-gen.md) | pending | 2h |
| 2 | [Slug availability check API](phase-02-slug-check-api.md) | pending | 1h |
| 3 | [Onboarding slug picker UI](phase-03-onboarding-ui.md) | pending | 2h |
| 4 | [Settings page slug editor](phase-04-settings-slug-edit.md) | pending | 2h |
| 5 | [Reserved words + validation](phase-05-validation.md) | pending | 1h |

## Research
- [Current slug system](research/researcher-01-current-slug-system.md)
- [Slug best practices](research/researcher-02-slug-best-practices.md)

## Architecture Overview

```
Onboarding:
  User enters "Rimba Adventure Tours"
  → auto-slug: "rimba-adventure-tours"
  → real-time check: ✅ available
  → user can edit: "rimba-tours" 
  → save as tenant.slug

Settings:
  Current: rimba-tours.web-v2.dev.ecommercehub.my
  → [Change subdomain] → edit → validate → confirm
  → old slug → 301 redirect (grace period 30 days)

API:
  GET /api/slug/check?slug=mybakery → { available: true }
  PATCH /api/tenant/slug → { slug: "mybakery" } (auth required)
```

## Key Files to Modify
- `src/app/api/ai/generate-site/route.ts` — slug generation
- `src/app/api/ai/apply-template/route.ts` — slug generation
- `src/app/(frontend)/onboarding/page.tsx` — add slug picker
- `src/app/(dashboard)/settings/domains/` — add slug editor
- `src/collections/Tenants.ts` — add slug validation hook

## Validation Summary

**Validated:** 2026-04-09
**Questions asked:** 4

### Confirmed Decisions
- **Scope**: Làm full 5 phases (bao gồm Phase 4 — Settings slug editor + 301 redirect + previousSlugs)
- **Collision handling**: Random suffix (e.g. `rimba-tours-7k3`) — đơn giản, universal, không assume location
- **UX Flow**: Slug picker xuất hiện **sau khi nhập business name**, trước khi generate site
- **Existing data**: Giữ nguyên `store-{id}` cho tenants cũ. Chỉ tenant mới có slug đẹp. User cũ đổi qua Settings

### Action Items
- [x] Không cần thay đổi plan — tất cả decisions align với plan hiện tại

## Related Docs (PHẢI ĐỌC trước khi implement)
- **PRD**: `docs/prd/F23-custom-subdomain-slug.md`
- **QA Test Plan**: `docs/qa/F23-custom-subdomain-slug.md` ✅
- **UI Specs**: `docs/design/F23-custom-subdomain-slug.md` ✅

⛔ **Cook PHẢI đọc các docs trên trước khi code.**
