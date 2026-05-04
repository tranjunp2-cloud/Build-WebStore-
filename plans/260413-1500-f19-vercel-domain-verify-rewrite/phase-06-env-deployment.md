# Phase 06 — Env vars + deployment + backfill

## Context
- Parent: [plan.md](./plan.md)
- Depends on: phases 01–05 merged
- Vercel docs:
  - https://vercel.com/docs/projects/environment-variables
  - https://vercel.com/account/settings/tokens
  - https://vercel.com/docs/cli/env

## Overview
- Date: 2026-04-13
- Description: Wire up env vars in `.env.example` + Vercel project, generate the access token, write a one-shot backfill script for existing tenant domains, run staging smoke test.
- Priority: P0
- Implementation status: pending
- Review status: pending

## Key insights
- The `VERCEL_TOKEN` MUST be created manually by an account owner (haynoikonike) — Claude/agents cannot generate Vercel personal access tokens. Token creation URL: https://vercel.com/account/settings/tokens. Scope to the team that owns the `prime-web` project; full account scope (only option).
- `VERCEL_PROJECT_ID` and `VERCEL_TEAM_ID` are visible in `vercel project ls` output or in the project's Settings → General page.
- Vercel rate limit on `addProjectDomain` = 100/hr per team (researcher-02 §5). If we have >100 existing tenants, backfill must throttle to ~1 add per 36 seconds with sleep + log.
- Staging and production should share the SAME Vercel project (the one already serving prime-web) — domains added to that project route immediately.

## Requirements
- `.env.example`, `.env.staging.example`, `.env.production.example` updated with new vars + comment marking old vars REMOVED.
- Vercel envs added via `vercel env add` for `preview` (= staging) and `production` environments.
- Backfill script at `scripts/backfill-vercel-domains.ts`.
- Staging smoke test executed and screenshots captured.

## Architecture
```
.env.example                      # template
.env.staging.example              # adds NEXT_PUBLIC_* values for staging
.env.production.example           # adds NEXT_PUBLIC_* values for prod

scripts/backfill-vercel-domains.ts
  ↓ uses payload local API to list all tenant.customDomains
  ↓ for each: call addProjectDomain with try/catch
  ↓ on 409 (already exists) → fetch via getProjectDomain
  ↓ persist vercelDomainId on Payload row
  ↓ rate-limit: 1 call / 40 sec (safe under 100/hr)
  ↓ log progress to stdout, write summary to ./tmp/backfill-report.json
```

New vars:
- `VERCEL_TOKEN` (server, secret)
- `VERCEL_TEAM_ID` (server)
- `VERCEL_PROJECT_ID` (server)
- `VERCEL_APEX_A_RECORD` (server, default `76.76.21.21`)
- `VERCEL_CNAME_TARGET` (server, default `cname.vercel-dns.com`)
- `NEXT_PUBLIC_VERCEL_APEX_IP` (client mirror)
- `NEXT_PUBLIC_VERCEL_CNAME_TARGET` (client mirror)

Removed (mark with `# REMOVED 2026-04-13: replaced by VERCEL_*`):
- `SERVER_IP`, `NEXT_PUBLIC_SERVER_IP`
- `DO_API_TOKEN`, `DO_APP_ID`
- `NEXT_PUBLIC_CNAME_TARGET` (replaced)

## Related code files
- New: `scripts/backfill-vercel-domains.ts`
- Modify: `.env.example`
- Modify: `.env.staging.example`
- Modify: `.env.production.example`
- Reference: `src/lib/vercel/domains.ts` (phase 01)
- Reference: `src/collections/Tenants.ts` (phase 02)

## Implementation steps
1. **[MANUAL — haynoikonike]** Generate token at https://vercel.com/account/settings/tokens. Name: `f19-domains-staging-prod`. Scope: prime-web team. Copy value securely.
2. **[MANUAL — haynoikonike]** Run `vercel project ls` from repo root to confirm `VERCEL_PROJECT_ID` and `VERCEL_TEAM_ID`. Or read from Vercel dashboard project settings.
3. **[MANUAL — haynoikonike]** Add envs:
   ```
   vercel env add VERCEL_TOKEN preview
   vercel env add VERCEL_TOKEN production
   vercel env add VERCEL_TEAM_ID preview
   vercel env add VERCEL_TEAM_ID production
   vercel env add VERCEL_PROJECT_ID preview
   vercel env add VERCEL_PROJECT_ID production
   vercel env add NEXT_PUBLIC_VERCEL_APEX_IP preview
   vercel env add NEXT_PUBLIC_VERCEL_APEX_IP production
   vercel env add NEXT_PUBLIC_VERCEL_CNAME_TARGET preview
   vercel env add NEXT_PUBLIC_VERCEL_CNAME_TARGET production
   ```
4. Update `.env.example` and the two `.env.*.example` files: add new vars (with placeholder values) and mark old vars REMOVED.
5. Write `scripts/backfill-vercel-domains.ts`: load Payload, query all tenants with non-empty `customDomains`, for each row call `addProjectDomain`, swallow 409, store `vercelDomainId`, sleep 40s between calls.
6. Dry-run backfill against staging DB: `pnpm tsx scripts/backfill-vercel-domains.ts --dry-run`.
7. Real-run on staging: `pnpm tsx scripts/backfill-vercel-domains.ts`.
8. Deploy `fix/F19-vercel-domain-verify` branch via PR → staging via Vercel preview.
9. Smoke test on staging:
   1. Login as test tenant.
   2. Add `test.example.com` (or owned test domain).
   3. Verify TXT card appears.
   4. Add TXT to DNS, click Verify, confirm transition to active.
   5. Check Vercel dashboard → project → Domains tab → confirm domain present.
   6. Check Payload → tenant → confirm `vercelDomainId` populated.
10. Capture screenshots, attach to PR.

## Todo
- [ ] [MANUAL] Create `VERCEL_TOKEN` at vercel.com/account/settings/tokens
- [ ] [MANUAL] Confirm `VERCEL_PROJECT_ID` + `VERCEL_TEAM_ID`
- [ ] [MANUAL] `vercel env add` × 10 (5 vars × 2 envs)
- [ ] Update `.env.example` with new vars + REMOVED comments
- [ ] Update `.env.staging.example`
- [ ] Update `.env.production.example`
- [ ] Write `scripts/backfill-vercel-domains.ts` with rate limiting + dry-run
- [ ] Dry-run backfill on staging
- [ ] Real backfill on staging
- [ ] Deploy preview, run smoke test, attach screenshots
- [ ] Backfill on production (after merge to main)

## Success criteria
- Staging deploy boots without env errors.
- Issue #558 string never appears in logs.
- Smoke test passes end-to-end.
- All existing staging tenant domains have `vercelDomainId` set after backfill.
- No `429` errors during backfill (rate limiting works).

## Risk assessment
- Medium-high during the cutover window. Mitigation:
  - Run backfill during low-traffic window.
  - Backfill is idempotent (409 swallow) so safe to re-run.
  - Keep DO env vars in Vercel project for 24h post-deploy as rollback insurance, then delete.
- Edge: token leak. Mitigation: token is full-account-scope; rotate immediately if leaked. Treat as P0 secret.

## Security considerations
- `VERCEL_TOKEN` is a write credential to the entire Vercel team. Store ONLY in Vercel envs and 1Password — never in git, never in logs, never in client bundles.
- Confirm `NEXT_PUBLIC_*` vars contain only the public DNS constants (IP + CNAME), never the token.
- Backfill script must run server-side only; add `import 'server-only'` or guard with `if (typeof window !== 'undefined') throw`.
- Audit Vercel access logs after deploy to confirm only the service account is calling the domains API.

## Next steps
- Phase 07 verifies QA test cases and closes the issue.

## Open questions
- Should the backfill report be uploaded to Lark for archival? Recommend: yes, as a one-time artifact.
- Do we want a feature flag (`F19_USE_VERCEL_DOMAINS=true`) to gate the new code path for safer rollback? Recommend: NO — DO is already broken (issue #558), there's nothing to fall back to.
