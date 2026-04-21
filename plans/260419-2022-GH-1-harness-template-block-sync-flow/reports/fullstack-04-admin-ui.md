# Phase 04 — Fullstack Report: Admin Harness UI

**Status:** DONE
**Date:** 2026-04-19 21:15
**Agent:** fullstack-developer
**Plan phase:** `phase-04-admin-harness-ui.md`

## Files created

| Path | LOC | Purpose |
|------|-----|---------|
| `src/app/(dashboard)/templates-health/page.tsx` | 127 | RSC — lists DB templates with drift badges (green/yellow/red) |
| `src/app/(dashboard)/templates-health/drift-actions.client.tsx` | 75 | Client island — re-seed + run-harness buttons with sonner toasts |
| `src/app/api/admin/harness/gen/route.ts` | 92 | super-admin-only API route — spawns `npx tsx scripts/test-harness/cli.ts --mode=quick` + parses `.harness-out/matrix.json` |

## Files modified (minor)

| Path | Change |
|------|--------|
| `src/components/dashboard/Sidebar.tsx` | Added `ShieldCheck` import, `superAdminOnly` flag on `NavItemConfig`, nav entry "Templates Health" → `/templates-health`, prop `isSuperAdmin` gated via `.filter()` |
| `src/app/(dashboard)/_components/CMSLayoutClient.tsx` | Passes `isSuperAdmin` prop to `DashboardSidebar` |
| `src/app/(dashboard)/layout.tsx` | Computes `isSuperAdmin = typedUser?.roles?.includes('super-admin')` and forwards to CMSLayoutClient |

## Components reused

- `@/components/ui/badge` — `variant="success" | "warning" | "destructive"` maps to green/yellow/red drift states.
- `@/components/ui/button` — `variant="secondary"` (primary action) + `variant="outline"` (secondary action), size `sm`.
- `sonner` `toast.success` / `toast.error` — existing global Toaster already mounted in `CMSLayoutClient`.
- `lucide-react` `ShieldCheck` — matches sidebar icon style.
- Plain HTML `<table>` with Tailwind — project has no shadcn `<Table>` component (verified via `ls src/components/ui/`). Kept inline to avoid a new dep.

## Acceptance verification

- [x] `/templates-health` renders table; empty-state handled (0 rows → friendly message + re-seed CTA).
- [x] Drift badge computed per template: `red` for `unknown-block` or schema-drift with zod issues; `yellow` for `unknown-variant` only; `green` otherwise. Findings grouped by root templateId (strips `:slug` page suffix).
- [x] Re-seed button → `POST /api/templates/seed?v3=true&force=true` → `router.refresh()` on success, toast on error.
- [x] Run-harness button → `POST /api/admin/harness/gen` → toast with `{composed, errors, durationMs}`.
- [x] 403 on non-admin (page redirects to `/dashboard`; API returns `{code:'FORBIDDEN'}`).
- [x] `npx tsc --noEmit` clean.
- [x] `npm run drift:check` — 8/8 pass (no regression).

## Deviations from plan

1. **Route path is `/templates-health` not `/dashboard/templates-health`.** The `(dashboard)` route group strips from the URL (same pattern as existing `/settings`, `/orders`, etc.). Plan text had the wrong path; project convention wins.
2. **No shadcn `<Table>` primitive.** Project only ships badge / button / input / card in `src/components/ui/`. Used plain `<table>` with Tailwind — matches the minimalist pattern. No new deps.
3. **Harness CLI spawn.** `scripts/test-harness/cli.ts` calls `process.exit` directly and exports nothing, so programmatic import isn't viable. Stuck with `spawn('npx', ['tsx', ...])` as task noted. 60s timeout + SIGKILL. Reads `.harness-out/matrix.json` regardless of exit code (CLI writes the file even on partial failure).
4. **RSC page auth double-check.** `(dashboard)/layout.tsx` already guards via `getCurrentUser()` but doesn't redirect unauthenticated users (it only conditionally renders). Added explicit `redirect('/dashboard')` in `templates-health/page.tsx` when user is missing `super-admin` role, matching the pattern in `settings/staff/page.tsx`.
5. **Sidebar thread-through.** Needed to add `isSuperAdmin` prop because `currentUserRole` is per-tenant (`owner/admin/editor/viewer`) while `super-admin` is a top-level platform role. Minimal additive edits to Sidebar, CMSLayoutClient, and layout.tsx.

## Unresolved questions

1. **Harness spawn on Vercel serverless.** `npx tsx` may not work inside a Vercel serverless function (cold-start, no dev deps in runtime bundle). Staging/local should work; production behaviour unverified. Possible follow-up: pre-generate harness output offline, upload to storage, fetch here. Not blocking for PM/QC staging use.
2. **Drift findings on current main.** Phase 02 DB scan could return many findings if DB is seeded with stale data — the UI will show red badges. This is expected per Phase 02 report (800 pre-existing drift findings on TS presets); DB may be similar. UI is read-only and diagnostic — shows truth, doesn't mask.
3. **Page size ~127 lines vs plan target <120.** 7 lines over, all in presentation (header + table header + empty state). Acceptable; splitting into sub-components would cost more than it saves.

**Status:** DONE
**Summary:** Admin dashboard `/templates-health` ships with per-template drift badges, re-seed + run-harness actions, and super-admin nav gate. Typecheck clean, drift test green, no new deps, no schema changes.
