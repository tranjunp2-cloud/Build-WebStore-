---
title: Block Registry → Template Wiring & Admin Harness Change Propagation
author: researcher-02
date: 2026-04-19
---

## Short answer
**NO auto-propagation.** Blocks thay đổi → templates stale trong DB + harness matrix cache cho tới khi manual re-seed / re-gen. Drift chỉ bắt được qua variant-pool validator (11 blocks, CI test).

## 1. Block registry

- **Manual registration** `src/blocks/registry.ts:121-174` — mỗi block map slug → `{component, schema, meta}`
- **Variants hardcoded** trong block's `config.ts` meta, e.g. `src/blocks/hero/config.ts:48-55`:
  ```ts
  heroMeta = { type: 'hero', variants: ['centered','split-left','split-right','fullscreen','video',...], defaultVariant: 'centered' }
  ```
- API: `getComponent`, `getSchema`, `getBlockMeta`, `validate` (`registry.ts:178-224`)

## 2. Template definitions & block refs

- Payload `Templates` collection `src/collections/Templates.ts:20-114` — fields: `defaultBlocks` (legacy JSON), `templatePages[]` (multi-page with `layout: json`)
- TS sources: `src/lib/ai/seed-templates.ts`, `template-definitions.ts`, `template-composer.ts`
- Block ref shape (JSON): `{blockType, variant, ...props}` — by slug, not by object identity

## 3. Variant management

- **Pools**: `src/lib/ai/variant-pool-validator.ts:51-63` + `category-requirements.ts` — 11 blocks expose `{category → variants[]}` (e.g. `restaurant: ['split-left','magazine',...]`)
- **Selection**: `template-composer.ts:58-68` — `selectVariant(blockType, seed, category)` đọc live `blockRegistry.getBlockMeta(blockType).variants`, filter broken, hash % length → deterministic pick
- **Content fallback**: `variant-validation.ts:20-39` — nếu variant yêu cầu 6+ items mà chỉ có 2 → fallback variant đơn giản hơn

## 4. Admin harness flow

- CLI-only: `npm run harness:gen` → `scripts/test-harness/compose-runner.ts:17-80` → `.harness-out/matrix.json`
- Route `src/app/test-harness/[fixtureId]/page.harness.tsx:1-105` đọc matrix.json, flatten blocks, render qua `<SiteRenderer>`
- **Matrix KHÔNG re-fetch từ registry khi render** — đã frozen tại thời điểm `harness:gen`
- SiteRenderer `src/components/site-renderer/SiteRenderer.tsx:81-195` — `getComponent(blockType)` null → silent skip

## 5. Change propagation matrix

| Change | Effect |
|--------|--------|
| Add new variant | Templates cũ ignore; pool phải add thủ công để mới dùng |
| Remove variant | Harness composer fallback defaultVariant (silent); DB templates stale |
| Rename variant | **BREAKS silently** — templates ref old name → registry miss → block null |
| Add required prop (schema) | Composer validate fail → composerError; DB templates thiếu prop → render undefined |
| Change Zod constraint | Validated tại compose-time; DB templates bypass |

**Admin template list trong Payload admin**: không auto-sync, không re-validate.

## 6. Drift detection (hiện có)

- **variant-pool-validator** (CI test) `src/__tests__/unit/ai/variant-pool-validation.test.ts:14-46`:
  - Check 11 blocks: features, testimonials, about, cta, stats, newsletter, team, faq, gallery, pricing, service-cards
  - Catches: pool value ↔ block enum mismatch
  - **KHÔNG catch**: stale DB templates với removed variants, schema drift (new required props), dead refs trong Payload Templates
- **CI `ai-harness.yml`** `.github/workflows/ai-harness.yml:14-60`: label `run-harness` trigger matrix gen 210 fixtures + structural guards + composerError capture. Không có drift report vs DB.

## 7. Regenerate flow (manual)

1. Dev sửa block (`src/blocks/{type}/**`)
2. `npm run harness:gen` → matrix.json refresh
3. `POST /api/templates/seed?v3=true&force=true` → xóa + reseed DB templates
4. Admin UI load templates mới

**Không có auto-trigger trên deploy hay code change.**

## Unresolved questions

1. Payload schema inference cho JSON field `layout` — freeform hay validate? Appears freeform (xem `defaultBlocks: any[]`)
2. Variant enum có export JSON schema cho editor UI ngoài không, hay chỉ runtime read registry?
3. Migration story khi rename variant — có DB migration path không? (Hiện tại: không, silent break)
4. Pool validator chỉ 11 blocks — tại sao? Footer/carousel không được coi là variant-critical?
5. Payload có thể expose variants như computed field / relationship để auto-populate dropdowns không code change?

## Citations

- `src/blocks/registry.ts:112-224`
- `src/blocks/hero/config.ts:43-55`
- `src/collections/Templates.ts:20-114`
- `src/lib/ai/template-composer.ts:58-68`
- `src/lib/ai/variant-pool-validator.ts:51-82`
- `src/__tests__/unit/ai/variant-pool-validation.test.ts:14-46`
- `src/components/site-renderer/SiteRenderer.tsx:81-195`
- `src/app/test-harness/[fixtureId]/page.harness.tsx:1-105`
- `scripts/test-harness/compose-runner.ts:17-80`
- `.github/workflows/ai-harness.yml:14-60`
