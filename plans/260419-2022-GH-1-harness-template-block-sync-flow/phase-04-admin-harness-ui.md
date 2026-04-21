# Phase 04 — Admin harness UI (template drift dashboard) [OPTIONAL]

## Context links

- Research: `plans/260419-2022-GH-1-harness-template-block-sync-flow/research/researcher-02-block-registry-template-wiring.md` (§4 admin harness flow — none exists)
- Task brief from researcher-01: confirms no admin harness UI today; harness is CLI-only.
- Phase 02 validator: `src/lib/ai/template-drift-validator.ts`
- Seed endpoint: `POST /api/templates/seed?v3=true&force=true`
- App layout: `src/app/(dashboard)/**` (existing protected area)
- Templates collection: `src/collections/Templates.ts`

## Overview

- **Date:** 2026-04-19
- **Description:** Small dashboard page at `/dashboard/templates-health` listing all Payload templates + per-template drift badge (ok / warn / broken) sourced from Phase 02 validator + Phase 05 version stamp. Buttons: "Regenerate harness" (triggers `harness:gen` via internal API), "Re-seed templates" (calls existing seed endpoint). Target audience: PM + QC.
- **Priority:** P2 (optional — user decides)
- **Implementation status:** completed
- **Review status:** approved (8.5/10 reviewer-07)

## Key Insights

- Researcher-01 confirmed NO existing admin UI → this is greenfield page, no refactor cost.
- Phase 02 already returns `DriftFinding[]` → UI is pure presentation.
- PM/QC currently blind to drift state — surfacing it reduces reliance on dev CLI.
- Re-use shadcn/ui Table + Badge → < 200 line page.

## Requirements

**Functional**
- Route `src/app/(dashboard)/templates-health/page.tsx` (server component).
- Lists each template from Payload `Templates` with columns: slug, category, pages count, drift badge, last seed time (if Phase 05 landed).
- Drift badge: green ok, yellow warn (non-critical Zod content issue), red broken (unknown block/variant or missing required prop).
- "Re-seed" button posts to existing seed endpoint; shows toast on completion.
- "Run harness" button hits a new lightweight API route that execs `harness:gen --mode=quick` as background job (or returns latest `.harness-out/matrix.json` summary).
- Protected by admin role guard (reuse existing middleware).

**Non-functional**
- Page load < 1s on 30 templates.
- No new heavy deps (reuse shadcn + TanStack Query if already in dashboard).

## Architecture

```
/dashboard/templates-health (RSC)
  └─ fetches templates via payload.find({collection: 'templates'})
  └─ runs scanDbTemplates() from Phase 02 inline → DriftFinding[]
  └─ maps findings to per-template badge
  └─ client island: action buttons (re-seed, run harness)
        ├─ POST /api/templates/seed?v3=true&force=true
        └─ POST /api/admin/harness/gen          [NEW route, background]
```

## Related code files

**To create**
- `src/app/(dashboard)/templates-health/page.tsx`
- `src/app/(dashboard)/templates-health/drift-actions.client.tsx` (client island for buttons)
- `src/app/api/admin/harness/gen/route.ts` — auth-gated; spawns harness:gen; returns 202 + job id (or synchronous for simplicity)

**To modify** — none required (pure additive)

**To read for context**
- `src/app/(dashboard)/layout.tsx` — confirm auth guard
- `src/lib/ai/template-drift-validator.ts` — Phase 02 API
- `src/app/api/templates/seed/route.ts`

## Implementation Steps

1. Create RSC page:
   - Fetch templates via Payload Local API.
   - Call `scanDbTemplates(payload)` → group findings by templateId.
   - Render table with shadcn `<Table>` + `<Badge>`.
2. Create client island for action buttons (useMutation + toast).
3. Create `POST /api/admin/harness/gen` route:
   - Auth check (admin role).
   - Exec `node scripts/test-harness/cli.ts --mode=quick` via `child_process.spawn`.
   - Return 202 with logs tail (or 200 with full result if quick mode < 5s).
4. Add nav link in dashboard sidebar (minor edit to sidebar config).
5. Manual QA: seed templates with known-drift variant → page shows red badge.

## Todo List

- [x] RSC page with template list + drift badge
- [x] Client island with action buttons
- [x] Harness-gen API route (admin-only) — *501 gated on Vercel serverless per P1 review fix*
- [x] Sidebar nav link
- [x] Manual QA with drift fixture
- [x] Commit: `feat(admin): templates health dashboard with drift badge`

## Success Criteria

- PM/QC can open page and see red badge if any template stale.
- Clicking "Re-seed" reseeds and badges go green within 30s.
- No drift findings false-positive for content-only issues (Phase 02 classification respected).

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| `harness:gen` takes longer than request timeout | Medium | Low | Background job + 202; poll endpoint for status |
| Non-admin users reach page | Low | High | Reuse `(dashboard)/layout.tsx` auth guard; double-check in API route |
| DB scan slow on large template set | Low | Low | Currently ~30 templates; re-evaluate at 100+ |

## Security Considerations

- Admin-only page + API. Token auth for seed endpoint unchanged.
- Action buttons must CSRF-protect (reuse existing Payload admin CSRF or Next middleware).
- Never expose drift findings to unauthenticated users (they may hint at block internals).

## Next Steps

- Couple with Phase 05 to show per-template `blockSchemaVersion` + "stale since" column.
- Later: add "regen only this template" action if seed endpoint gains per-slug mode.
