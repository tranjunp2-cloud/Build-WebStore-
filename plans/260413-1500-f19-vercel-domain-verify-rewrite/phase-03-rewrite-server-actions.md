# Phase 03 — Rewrite server actions

## Context
- Parent: [plan.md](./plan.md)
- Depends on: phase 01 (Vercel client), phase 02 (schema fields)
- Vercel docs: see phase 01

## Overview
- Date: 2026-04-13
- Description: Replace every DigitalOcean call site in `src/app/(dashboard)/settings/domains/actions.ts` with calls to the phase-01 Vercel client. Drop `SERVER_IP`, `DO_API_TOKEN`, `DO_APP_ID`. Add new `verification` return shape so UI can render TXT challenges.
- Priority: P0 (this is the bug fix)
- Implementation status: pending
- Review status: pending

## Key insights
- The bug (#558) is purely the env-var guard at L74–77/164–166/253–255. Removing those and routing through `vercelFetch` makes the error disappear AND makes provisioning actually work.
- Vercel's verify state machine is 3-state, not 2: `unverified-needs-txt`, `verified-but-cert-pending`, `active`. We can't observe the middle state directly — see open question.
- `addProjectDomain` may return `verified=true` immediately when DNS is already pointed correctly + no conflict. We must handle that and skip the verify step.
- `dns.resolve4` / `dns.resolveCname` sanity checks are still useful as a pre-flight UX hint ("your DNS doesn't point at us yet") even though Vercel does its own check.
- `setPrimaryDomain` and `clearPrimaryDomain` are platform-agnostic — confirm they don't read `SERVER_IP`/`DO_*` and leave alone.

## Requirements
- All 3 mutating actions (`addCustomDomain`, `removeCustomDomain`, `verifyCustomDomain`) call Vercel.
- Return shape extended: `{ ok, error?, verification?: VercelDomainVerification[] }` so UI can render TXT instructions.
- Env check rewritten to `assertVercelEnv()` (from phase 01); remove all `SERVER_IP`/`DO_*` references in this file.
- `vercelDomainId` + `vercelVerification` persisted on the Payload row.
- DNS pre-flight uses env-driven constants (`VERCEL_APEX_A_RECORD`, `VERCEL_CNAME_TARGET`) with code defaults `76.76.21.21` / `cname.vercel-dns.com`.

## Architecture
State machine after `verifyCustomDomain`:
```
call verifyProjectDomain(domain)
├── 200 + verified=true + !verification
│     → dns.resolve4/resolveCname sanity check
│     → mark Payload row status='active', clear vercelVerification
│     → return { ok: true }
├── 200 + verified=false + verification[]   (rare on /verify; usually surfaced by /add)
│     → persist verification on Payload row
│     → return { ok: false, verification }
├── 400 (no/mismatched TXT)
│     → call getProjectDomain to fetch fresh verification[]
│     → persist + return { ok: false, verification }
└── 4xx/5xx other
      → return { ok: false, error: vercelError.message }
```

`addCustomDomain` flow:
```
validate format / uniqueness (existing)
write Payload row status='pending'
call addProjectDomain(domain)
├── verified=true → status='active', vercelDomainId=name
├── verified=false → keep 'pending', persist verification[]
└── 409 'domain_already_in_use' → rollback Payload row, return user-friendly error
```

`removeCustomDomain` flow:
```
remove from Payload (existing)
call removeProjectDomain(domain) — best-effort, log on 404
revalidatePath
```

## Related code files
- Modify: `src/app/(dashboard)/settings/domains/actions.ts` — entire file rewrite of L26–319
  - L8: delete TODO comment
  - L26–138: `addCustomDomain` — replace L74–117 DO calls
  - L140–215: `removeCustomDomain` — replace L164–195 DO calls
  - L217–319: `verifyCustomDomain` — replace L225, L243, L253–258 SERVER_IP + DO calls
  - L321–351: `setPrimaryDomain` — verify untouched (no DO refs)
  - L354–374: `clearPrimaryDomain` — verify untouched
- Import from phase 01: `src/lib/vercel/domains.ts`
- Import from phase 02: regenerated `payload-types.ts`

## Implementation steps
1. Delete L8 TODO comment.
2. Delete `SERVER_IP`, `DO_API_TOKEN`, `DO_APP_ID` reads at top of file.
3. Add `import { addProjectDomain, verifyProjectDomain, getProjectDomain, removeProjectDomain, VercelDomainsError } from '@/lib/vercel/domains'`.
4. Add module-level constants `const APEX_A = process.env.VERCEL_APEX_A_RECORD ?? '76.76.21.21'`, `const CNAME = process.env.VERCEL_CNAME_TARGET ?? 'cname.vercel-dns.com'`.
5. Rewrite `addCustomDomain`: after Payload write, call `addProjectDomain(domain)`; on success store `vercelDomainId` + status; on `verification` present store + status='pending'; on `VercelDomainsError` rollback Payload row + map `code` → friendly message.
6. Rewrite `removeCustomDomain`: after Payload remove, call `removeProjectDomain(domain)` inside try/catch; swallow 404 (already gone); rethrow others.
7. Rewrite `verifyCustomDomain`: implement state machine above; do `dns.promises.resolve4` for apex (no `.` in subdomain part) or `resolveCname` for subdomain pre-flight; on Vercel verify failure, call `getProjectDomain` to fetch fresh `verification[]` and persist.
8. Update return type union for all 3 actions to include optional `verification: VercelDomainVerification[]`.
9. Verify `setPrimaryDomain` / `clearPrimaryDomain` have zero references to removed envs (per scout they don't, just sanity check).
10. `tsc --noEmit` and `eslint src/app/(dashboard)/settings/domains/actions.ts`.

## Todo
- [ ] Delete L8 TODO + DO_/SERVER_IP env reads
- [ ] Import Vercel client + add APEX_A/CNAME constants
- [ ] Rewrite `addCustomDomain` with rollback on Vercel error
- [ ] Rewrite `removeCustomDomain` with 404 swallow
- [ ] Rewrite `verifyCustomDomain` with 3-state machine
- [ ] Persist `vercelDomainId` + `vercelVerification` on Payload row
- [ ] Extend return shapes with `verification`
- [ ] Sanity check `setPrimaryDomain`/`clearPrimaryDomain` untouched + DO-free
- [ ] tsc + lint clean

## Success criteria
- `grep -r 'SERVER_IP\|DO_API_TOKEN\|DO_APP_ID' src/app/(dashboard)/settings/domains/` returns zero matches.
- Issue #558 error string never produced.
- Manually adding a domain that's not yet pointed at Vercel returns `verification: [{ type: 'TXT', domain, value, reason }]`.
- Manually adding a domain that IS pointed correctly transitions straight to `status='active'`.
- `removeCustomDomain` against an unknown domain returns `{ ok: true }` (idempotent).

## Risk assessment
- Medium. This is the load-bearing change. Mitigation: thorough phase 05 test mocks + phase 06 staging smoke test before prod.
- Edge: rollback after partial Payload write if Vercel `addProjectDomain` fails — must use a try/catch around `payload.update` so we don't leave an orphan row.
- Edge: race condition if user clicks Verify twice fast — Vercel rate limit (~50/hr per team for verify per researcher-02 §5). Mitigate with client-side debounce in phase 04 + server-side `if (status === 'active') return early`.

## Security considerations
- Never bubble raw `VercelDomainsError.message` to the client without scrubbing — it may include URL fragments. Use a `mapError(code) → string` table.
- Confirm action is gated by `requireUser()` / tenant membership (existing in actions.ts) — do NOT remove that.
- Tenant A must not be able to add a domain owned by Tenant B. The Payload uniqueness check + Vercel 409 (`domain_already_in_use`) gives defense in depth — keep both.

## Next steps
- Phase 04 consumes the new return shape to render TXT instructions.
- Phase 05 mocks the Vercel client.

## Open questions
- **SSL polling strategy**: Vercel REST has no explicit cert-status field. After `verified=true` we currently mark `status='active'` immediately, but cert issuance can take seconds-to-minutes more. Options:
  1. (chosen for v1) Mark active on verify; rely on tenant retry if HTTPS doesn't work yet; show a "Cert provisioning, may take 1–2 min" banner.
  2. Add a server-action `pollDomainSslReady(domain)` that does an HTTPS HEAD to `https://${domain}` and only flips `active` on TLS success — more robust but adds latency + complexity.
  Recommend option 1 for this PR; track option 2 as follow-up.
- **dns.resolve fallback**: Should pre-flight DNS check be hard-fail or soft-warn? Recommend soft-warn (log + still call Vercel) since Vercel itself is the source of truth.
- **`apexName` vs `name`** persistence: `vercelDomainId` should store `name` (the exact added domain), not `apexName`, so `www.example.com` and `example.com` are distinct rows.
