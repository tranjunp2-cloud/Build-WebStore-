# Phase 04 — Verification + Smoke Tests

**Status:** pending
**Effort:** 1.5h
**Depends on:** Phase 03 (CI must inject SENTRY_AUTH_TOKEN; Vercel runtime DSN set)
**Blocks:** none (final phase before merge to staging)

## Goal

Prove Sentry actually captures events end-to-end on staging. Wire AI gen entry-point span (1 file change), add a temporary test endpoint, deploy, verify dashboard, then remove test endpoint before merging to main.

## Files to create (temporary)

| File | Purpose | Lifetime |
|------|---------|----------|
| `src/app/api/sentry-test/route.ts` | Throws on GET — proves server capture | Removed before main merge |

## Files to create (permanent)

| File | Purpose |
|------|---------|
| `src/__tests__/unit/lib/ai/sentry-spans.test.ts` | Unit test for `withSentrySpan` wrapper |

## Files to modify

| File | Change |
|------|--------|
| `src/lib/ai/generate-site.ts` (or whichever is the actual `generateSite` entry — search first) | Wrap top-level call in `withSentrySpan('ai.generateSite', ...)` |

## Pre-flight: locate AI gen entry point

```bash
# Find the public entry-point function (called by API route, not internal helper)
grep -rn "export async function generateSite\|export const generateSite" src/lib/ai/
grep -rn "from '@/lib/ai/generate-site'" src/app/api/
```

Acceptance: identify exactly one entry point. If multiple, instrument only the one called from `src/app/api/ai/generate/route.ts` (or equivalent). Defer `editSection`/`bulkParse` per plan.md open Q.

## Implementation steps

### 1. Create `src/__tests__/unit/lib/ai/sentry-spans.test.ts`

```ts
import { describe, it, expect, vi } from 'vitest'
import * as Sentry from '@sentry/nextjs'
import { withSentrySpan } from '@/lib/ai/sentry-spans'

vi.mock('@sentry/nextjs', () => ({
  startSpan: vi.fn((_opts, fn) => fn()),
}))

describe('withSentrySpan', () => {
  it('returns the inner function result', async () => {
    const result = await withSentrySpan('test.op', async () => 42)
    expect(result).toBe(42)
    expect(Sentry.startSpan).toHaveBeenCalledWith(
      { name: 'test.op', op: 'ai' },
      expect.any(Function),
    )
  })

  it('propagates thrown errors', async () => {
    const err = new Error('boom')
    await expect(
      withSentrySpan('test.fail', async () => {
        throw err
      }),
    ).rejects.toBe(err)
  })

  it('passes opts.name and op:ai to Sentry.startSpan', async () => {
    await withSentrySpan('ai.generateSite', async () => null)
    expect(Sentry.startSpan).toHaveBeenLastCalledWith(
      expect.objectContaining({ name: 'ai.generateSite', op: 'ai' }),
      expect.any(Function),
    )
  })
})
```

TC mapping: not in `docs/qa/F*.md` yet — this is monitoring infrastructure. Add new TC-IDs in `docs/qa/F00-monitoring.md` if QC requests; otherwise reference as `TC-MONITORING-01..03` inline.

### 2. Wrap AI gen entry point

In the identified entry file (e.g. `src/lib/ai/generate-site.ts`):

```ts
import { withSentrySpan } from './sentry-spans'

// Original:
// export async function generateSite(input: GenInput): Promise<Site> { ... }

// Becomes:
export async function generateSite(input: GenInput): Promise<Site> {
  return withSentrySpan('ai.generateSite', () => generateSiteImpl(input))
}

async function generateSiteImpl(input: GenInput): Promise<Site> {
  // ... original body unchanged ...
}
```

Minimal-diff pattern: rename existing function to `Impl`, add 4-line wrapper. KISS.

### 3. Create `src/app/api/sentry-test/route.ts` (TEMPORARY)

```ts
import * as Sentry from '@sentry/nextjs'
import { NextResponse } from 'next/server'

/**
 * TEMPORARY — remove before merging to main.
 * Phase 04 verification: triggers a server error to confirm Sentry capture.
 */
export async function GET() {
  if (process.env.NODE_ENV === 'production' && process.env.SENTRY_ENVIRONMENT !== 'staging') {
    return NextResponse.json({ error: 'disabled' }, { status: 404 })
  }
  Sentry.captureMessage('sentry-test endpoint hit', 'info')
  throw new Error('Sentry verification — intentional throw from /api/sentry-test')
}
```

Guard prevents prod use. Returns 404 in production scope.

### 4. Run local validation

```bash
npm run typecheck
npm run lint
npm run test -- sentry-spans
npm run dev  # Ctrl+C after homepage loads cleanly
npm run build  # confirm Sentry plugin runs (or skips silently without token)
```

All must pass before pushing.

### 5. Push branch + open PR

```bash
git checkout -b feat/sentry-integration
git add -A
git commit -m "feat(monitoring): integrate sentry for error tracking + tracing"
git push -u origin feat/sentry-integration
gh pr create --base staging --title "feat(monitoring): integrate sentry for error tracking + tracing" \
  --body-file <(cat <<'EOF'
## Story
- **Relates to:** #<issue-id>
- **Ticket / Story ID:** N/A (infra)
- **Mô tả ngắn:** Wire @sentry/nextjs into Next.js 15 + Payload pipeline with source-map upload, tunnel route, and AI gen span instrumentation.

## Changes
- [x] Add `@sentry/nextjs@10.50.0`
- [x] 7 new files (3 SDK configs, 2 instrumentation hooks, global-error, span helper)
- [x] Wrap `next.config.ts` with `withSentryConfig`
- [x] Exclude `/sentry-tunnel` from middleware matcher
- [x] Env placeholders + CI source-map upload secrets
- [x] Wrap `generateSite()` in Sentry span
- [x] Temp `/api/sentry-test` route (will remove pre-prod-merge)

**API / Contract thay đổi:**
- [x] Breaking change: Không

## Checklist
- [x] **9-Point Done**: typecheck + lint clean, build green
- [x] **TypeScript / lint:** tsc --noEmit pass
- [x] **Test:** unit tests for sentry-spans helper
- [x] **Security:** no secrets committed; sendDefaultPii=false; payload-token cookie scrubbed in beforeSend

## Test Steps
1. After CI green + staging deploy: `curl https://web-v2.dev.ecommercehub.my/api/sentry-test` → 500
2. Open Sentry dashboard staging project → see "Sentry verification — intentional throw" within 60s
3. Visit `https://web-v2.dev.ecommercehub.my/builder` → trigger gen → check Sentry trace shows `ai.generateSite` span with nested PG queries
4. `curl -I https://web-v2.dev.ecommercehub.my/_next/static/chunks/main-*.js.map` → 404 (no source maps leaked)

## Ghi chú
- Source-map upload requires GH secrets `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` (see plans/260504-1146-sentry-integration/phase-03-env-and-ci.md)
- Vercel runtime vars (`SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ENVIRONMENT`) must be set in BOTH `Production` and `Custom: staging` scopes before merge
- Plan: `plans/260504-1146-sentry-integration/`
EOF
)
```

### 6. Post-staging-deploy verification (manual)

After `deploy-staging` job goes green and alias rolls over:

```bash
# 1. Server capture
curl -i https://web-v2.dev.ecommercehub.my/api/sentry-test
# Expect: 500 + body. Within 60s, Sentry dashboard shows event.

# 2. Source maps not leaked
curl -I https://web-v2.dev.ecommercehub.my/_next/static/chunks/main-app.js.map
# Expect: 404

# 3. Tunnel route reachable (not redirected by middleware)
curl -i -X POST https://web-v2.dev.ecommercehub.my/sentry-tunnel
# Expect: 200 or 400 (Sentry handler), NOT 308/302 (would mean middleware rewrote it)

# 4. Existing endpoints unbroken
curl -i https://web-v2.dev.ecommercehub.my/api/health
# Expect: 200

# 5. AI gen span (manual): use the builder UI or:
curl -i -X POST https://web-v2.dev.ecommercehub.my/api/ai/generate \
  -H 'Content-Type: application/json' \
  -d '{"prompt":"coffee shop in Hanoi"}'
# Then check Sentry → Performance → look for `ai.generateSite` transaction with PG spans
```

### 7. Remove temp test route + open follow-up PR

After verification screenshots posted to PR conversation:

```bash
git rm src/app/api/sentry-test/route.ts
git commit -m "chore(monitoring): remove sentry-test endpoint after verification"
git push
```

Same PR — squash on merge to keep history clean.

## Acceptance criteria

- [ ] `npm run test` green (3 new tests pass)
- [ ] `npm run typecheck` + `npm run lint` green
- [ ] CI all green on PR
- [ ] Staging deploy succeeds (alias rollover step passes)
- [ ] `curl /api/sentry-test` → 500 within 60s, event visible in Sentry staging project
- [ ] Source map URL → 404 on staging
- [ ] `/sentry-tunnel` POST → 200 or 400 (NOT 3xx)
- [ ] `/api/health`, `/dashboard` (after login), `/builder` all 200 (no regression)
- [ ] AI gen span `ai.generateSite` visible in Sentry trace with ≥1 nested PG span
- [ ] No new errors in Sentry from Payload admin panel (`/admin/*`) idle browse
- [ ] Test route removed in follow-up commit before merge to staging
- [ ] PR description has all 5 verification screenshots

## Risks specific to this phase

| Risk | Mitigation |
|------|------------|
| `Sentry.postgresIntegration` produces no spans (wrong API for 10.50.0) | If verification step 5 shows no PG spans, swap to `Sentry.prismaIntegration()` style or manual `Sentry.startSpan` around `payload.find` calls — defer if not blocking |
| Test endpoint accidentally deployed to prod | Guard in route returns 404 unless `SENTRY_ENVIRONMENT=staging`; also removed before main merge |
| AI gen span double-wraps existing telemetry (`capture-generation.ts`) | Read `src/lib/ai/capture-generation.ts` first; if it already wraps, instrument at HTTP boundary instead (route handler) |
| Source-map upload fails on first CI run (project doesn't exist yet) | Sentry SDK soft-fails; logs warning but build succeeds. Verify Sentry project created BEFORE first CI run |
| Vercel build cold cache + Sentry plugin → > 6min build (timeout 15min) | Acceptable; first build only. Subsequent cached builds < 3min |
| PII in error payloads (user prompts contain real business names) | `beforeSend` scrubs cookies; prompts in `event.extra` may still leak — review one staging event for PII before main merge |

## Rollback

If staging proves unstable:

1. **Quick disable** — Vercel Dashboard → unset `SENTRY_DSN` for staging scope. SDK no-ops. No redeploy needed (env hot-reload on next cold start).
2. **Full revert** — `git revert <merge-commit>` on staging; redeploy.
3. **Code-level kill switch** — env var `SENTRY_ENABLED=false` not implemented (YAGNI; unset DSN is enough).

## Post-merge

- Update `docs/architecture/_OVERVIEW.md` — add monitoring layer entry
- Update `docs/CHANGELOG.md` — `### Added — Sentry error monitoring + AI gen tracing`
- Owner: docs-manager (separate task)
- No `docs/qa/F*.md` update needed (infra change, no user-facing TC)

## Status update

```bash
ck plan check 04 --start
ck plan check 04
```
