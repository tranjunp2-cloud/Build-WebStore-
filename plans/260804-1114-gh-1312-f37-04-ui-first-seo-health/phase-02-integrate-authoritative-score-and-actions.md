# Phase 02: Integrate the Authoritative Score and Actions

## Context Links

- Plan: [GH-1312 F37-04 UI-first SEO Health](./plan.md)
- Research: [Contract and dependency audit](./research/contract-dependency-audit.md)
- PR #1728 handoff: `plans/260729-1603-gh-1310-schema-rich-local-markup-v26/reports/issue-1312-schema-score-handoff.md` after merge
- Product formula: `docs/prd/F37-local-seo-search-performance.md` §5
- Action contract: `docs/prd/F37-local-seo-search-performance.md` §12.3

## Overview

- **Priority:** P0
- **Status:** implementation complete; post-scout correctness/security hardening tracked in Phase 3
- **Effort:** 12h
- **Description:** Replace the legacy score/API/dashboard path atomically and activate only action destinations that demonstrably open the correct Editor state.

<!-- Updated: Red Team Session 1 -->

## Entry Gate

- PR #1728 is merged into `staging`, including `generateSchemaGenerationArtifact()` and `calculateSchemaScore()`.
- Branch is rebased/merged from that `staging`; conflicts are resolved before implementation.
- Record the accepted staging merge SHA and #1728 artifact fixture/version; invalidate evidence if either changes.
- Business 20 helper from PR #1708 and AI route facts from PR #1719 remain present.
- The exact PRD `20/35/15/30` contract is unchanged.
- Phase 1 fixture manifest has a named owner and passing reset/preflight.
- Audit every overlapping #1728 path and rerun its subtype/save/JSON-LD/scorer suites before editing.

## Requirements

### Functional

- Score equals Business 20 + Schema 35 + AI 15 + Technical 30, clamped 0–100.
- Generate the Schema artifact once from one immutable site snapshot; pass that exact artifact to the Schema scorer.
- Eligible metadata: visible/non-deleted pages, active products, published blogs.
- Empty eligible sets earn zero; coverage formulas use floor exactly as PRD §5.
- Content Quality loads real page layouts; Technical SEO uses verification 3 plus proportional indexability 3.
- API preserves 401/403/404/429/500 behavior and returns no partial/stale score on failure.
- Root issues derive from missing source fields, deduplicate downstream metrics, and exclude platform-only signals.
- Dashboard fetches the authenticated endpoint via a client wrapper with loading/error/retry.
- AI Fix accepts only missing title/description items. Local Business fields are never submitted.
- Every seller-owned action in the Phase 1 catalog ships and works end to end, including Search verification. Platform-only rows are the sole omissions.
- Initial response contains bounded aggregate issue groups, not record rows or full fix context. Metadata fix details load on demand through an authenticated validated request.

### Non-functional

- No loopback requests to public robots/sitemap/llms routes.
- Paginate eligible records to exhaustion in deterministic order. A safety or timeout ceiling returns no score; never truncate into an inflated score.
- Keep server-only evaluation out of client bundles.
- Return stable issue codes/actions, not translated copy or arbitrary URLs.
- Score API p95 is below 2s at representative volume and stays within `maxDuration <= 60`.

## Consistency and Failure Taxonomy

- Prefer a read-only repeatable-read transaction. Otherwise capture site/content revision fingerprints, evaluate, verify unchanged fingerprints, retry once, then return no score.
- Return `evaluatedAt` and a revision token; artifact, buckets, and issues belong to the same accepted read.
- Auth, tenant, snapshot, pagination, or aggregate failures return no score. Expected sitemap/llms unavailability is a valid result that withholds only 5/1; unexpected evaluator failure returns no score.
- Share typed crawler/sitemap/llms predicates between public routes and score evaluation; never infer route reachability from site status alone.
- Runtime-validate score ranges, exactly four bucket keys, issue code/owner/action pairs, bounded IDs/counts, revision token, and detail shapes. Invalid responses become an error state with no number.

## Architecture

```text
authorized site + eligible records
        │
        ├─ Business 7/8/5
        ├─ one SchemaGenerationArtifact ── calculateSchemaScore()
        ├─ trusted AI facts 9/5/1
        └─ metadata/content/verification/indexability 30
                         │
                         ▼
            calculateLocalSeoScore()
                         │
          root-field issue derivation/dedupe
                         │
                         ▼
 authenticated validated score API → latest-request client → Phase 1 card
                                      └─ allowlisted action router
```

## Related Code Files

- **Modify:** `<worktree-1>/src/lib/seo/local-seo-score.ts` — atomic pure aggregate and exact sub-breakdowns.
- **Create:** `<worktree-1>/src/lib/seo/local-seo-evaluation.ts` — server-only signal collection/orchestration and root issue derivation.
- **Create:** `<worktree-1>/src/lib/seo/local-seo-score-contract.ts` — runtime score/detail schemas.
- **Create/Modify:** `<worktree-1>/src/lib/seo/public-discovery-facts.ts` and public discovery routes — shared typed AI facts.
- **Modify:** `<worktree-1>/src/app/api/sites/[siteId]/local-seo-score/route.ts` — thin authenticated/rate-limited/tenant-scoped endpoint.
- **Create:** `<worktree-1>/src/components/dashboard/revamp/seo-health-client.tsx` — fetch, retry, semantic routing, AI modal state.
- **Modify:** `<worktree-1>/src/components/dashboard/revamp/seo-health.tsx` — sole runtime wrapper around the Phase 1 card.
- **Modify:** `<worktree-1>/src/app/(dashboard)/dashboard/page.tsx` — pass `siteId`; remove legacy server SEO fetch.
- **Retire after consumer check:** `<worktree-1>/src/lib/dashboard/seo-data.ts` — remove duplicated legacy score path or reduce to shared metadata helpers.
- **Modify:** `<worktree-1>/src/app/(editor)/editor/[siteId]/page.tsx` — parse `settingsTab`, `section`, `focus`, and existing `pageId`/`publish`.
- **Modify:** `<worktree-1>/src/components/editor/SettingsPanel.tsx` — activate tab, expand section, scroll, and focus the target.
- **Modify only as required:** `<worktree-1>/src/components/editor/local-business/**` — stable focus targets.
- **Modify:** `<worktree-1>/src/__tests__/unit/seo/local-seo-score.test.ts`.
- **Modify:** `<worktree-1>/src/__tests__/api/local-seo-score.test.ts`.
- **Create:** `<worktree-1>/src/__tests__/unit/dashboard/seo-health-client.test.tsx`.
- **Modify/Create as required:** focused Editor requested-tab/deep-link tests under `<worktree-1>/src/__tests__/unit/editor/`.

## Implementation Steps

1. Rebase onto post-#1728 `staging`; run the upstream focused score/schema suites before editing.
2. Define exact pure inputs/results and invariant max constants in `local-seo-score.ts`.
3. Assemble one consistent authorized evaluation via transaction or revision-fingerprint retry; paginate records to exhaustion.
4. Call `generateSchemaGenerationArtifact(snapshot)` once, then `calculateSchemaScore(artifact)` once.
5. Compute Technical 30 from exact eligible denominators and real layouts. Do not reuse legacy OG/slug/CWV/mobile/HTTPS deductions.
6. Derive a finite catalog of aggregate root issues; dedupe address/schema, phone/schema telephone, and publish/sitemap/llms.
7. Sort issues by internal impact and stable code, but return all unresolved issues.
8. Preserve security/error gates; runtime-validate aggregate and on-demand metadata detail responses.
9. Add latest-request-wins keyed by `siteId` and generation; abort on retry/site change/unmount and ignore late completions.
10. Use client `cache: no-store` and API `Cache-Control: private, no-store`; clear ready data on each request/failure.
11. Route semantic actions exhaustively. Editor waits for hydration, activates tab, expands section, waits for layout, scrolls, focuses, acknowledges consumption, and shows a safe fallback.
12. Make AI mutation single-flight; load/validate the unique metadata set on demand, block duplicate submits, report partial failure, abort old score reads, and refetch only after settlement.
13. Replace runtime `SeoHealth` and remove Score History. Keep legacy code unreferenced for one release as a revert aid, never as displayed fallback.
14. Canary the fixture tenant and define error/latency thresholds plus exact revert owner/commit.
15. Run pure, API, race, Editor deep-link, scale, typecheck, lint, build, and diff checks.

## Todo

- [x] Pass the post-#1728 code/contract/regression gate.
- [ ] Complete the owned staging fixture preflight for p95/browser evidence; require reset/checksum only if Apply is included.
- [x] Implement exact 20/35/15/30 pure aggregation.
- [x] Assemble complete eligible inputs without N+1/caps.
- [x] Prove transaction/revision consistency and explicit failure taxonomy.
- [x] Freeze and runtime-validate score/detail contracts.
- [x] Consume one canonical Schema artifact.
- [x] Derive/dedupe/sort all root issues.
- [x] Preserve API auth, tenant, rate-limit, and error behavior.
- [x] Wire client loading/error/retry and sole score surface.
- [x] Implement every seller destination and the deep-link readiness coordinator.
- [x] Constrain AI Fix to one validated single-flight metadata lifecycle.
- [x] Add no-store/latest-request-wins behavior.
- [x] Remove the legacy displayed score path.

## Success Criteria

- Full fixture returns 100 with exact bucket maxima 20/35/15/30.
- Independent signal failures deduct only their defined points.
- One missing root field yields one issue even when multiple metrics depend on it.
- API 401/403/error states never become a numeric Dashboard score.
- All supplied unresolved issues render; none are arbitrarily truncated.
- Every seller-owned catalog action reaches, expands, scrolls to, and focuses its destination.
- Representative-volume score API p95 is below 2s; ceilings produce error/no score.
- No platform-managed issue row is seller-visible.
- Focused checks pass with no migration or environment-variable diff.

## Risk Assessment

| Risk | Impact | Mitigation |
|---|---|---|
| PR #1728 remains conflicted or changes contract | Rework/false score | Hard entry gate; rebase and rerun upstream suites |
| Schema score re-derived from DB fields | JSON-LD/score drift | One artifact, one scorer, identity-oriented test |
| Eligible records silently capped | Inflated coverage | Existing pagination helper plus scale test |
| Client receives stale score after failure | Violates AC-03 | Clear ready data on new request/error; no stale fallback |
| Deep-link query is accepted but ignored | Dead CTA | Do not emit action until focus assertion passes |
| AI Fix mutates Local Business | Data corruption | Construct payload exclusively from metadata fix items |
| Concurrent reads mix revisions | Contradictory score/issues | Transaction or fingerprint verification plus bounded retry |
| Large tenant inflates payload/DOM | Timeout or frozen UI | Aggregate issue groups; on-demand paginated fix detail |
| New cutover fails | Dashboard outage | Fixture canary and revert aid; never a legacy-score fallback |

## Security Considerations

- Authenticate before data access and enforce tenant ownership even when `site.tenant` is missing.
- Keep rate limit before expensive aggregation.
- Use explicit fields/depth and never expose site snapshots or raw errors.
- Resolve only known action variants to internal destinations.

## Next Steps

- Continue the reopened Phase 3 from the 2026-08-05 scout findings.
- Preserve the authoritative runtime cutover; do not restore the legacy displayed score as a fallback.
