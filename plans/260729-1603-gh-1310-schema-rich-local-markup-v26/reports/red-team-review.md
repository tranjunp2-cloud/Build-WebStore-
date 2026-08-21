# Red-team review — US-F37-02 v2.6

## Summary

Three hostile lenses reviewed all plan phases: Security Adversary, Assumption Destroyer, and Failure Mode Analyst. Overlaps were deduplicated and capped at 15 material findings.

## Adjudication

| # | Finding | Severity | Disposition | Rationale |
|---|---|---|---|---|
| 1 | Old Schema-40 plan remains active | Critical | Accept | Two active plans can route cook to the obsolete contract. It was first cancelled, then removed during cleanup. |
| 2 | Public E2E sits in authenticated `e2e/` | High | Accept | AGENTS requires `tests/*.spec.ts`; the public test belongs in a narrow unauthenticated project matcher. |
| 3 | “Points earned” lacks a production caller | Critical | Accept (modified) | US02 proves generation plus pure scoring in production code; #1312 owns live aggregation/display. The plan must state that boundary instead of implying Dashboard visibility. |
| 4 | Scorer accepts untrusted/mismatched context | Critical | Accept | One same-snapshot artifact must bind the canonical strict node and validated subtype evidence. |
| 5 | Taxonomy has no concrete annex/approver | High | Accept | UI, validation, emission, and tests cannot proceed from an unspecified product mapping. |
| 6 | Sparse writes validate fragments | Critical | Accept | AC-04 requires validation of effective persisted state, not just the request fragment. |
| 7 | Collection invariant misses non-route writes | High | Accept | Payload Admin/REST/GraphQL/Local API must enforce the same pair invariant. |
| 8 | Client autosave ordering is underspecified | High | Accept | Preserve #1708 sequencing and add request identity/stale-response/rollback tests. |
| 9 | Add server-wide optimistic concurrency/CAS | High | Reject | Cross-tab lost updates predate US02 and would expand schema/API scope. US02 still validates effective state and preserves the accepted client mutex. |
| 10 | Legacy hydration auto-select is ambiguous | High | Accept | Auto-select only on seller category action; never mutate old rows on mount. |
| 11 | Persist mapping version per row | Medium | Reject | PRD requires a versioned snapshot, not a per-row version field. Freeze v2.6 and require compatibility/migration policy for removals. |
| 12 | Fixture is not reproducible | High | Accept | Add a manifest, immutable expectations, preflight command, owner, and lifecycle. |
| 13 | Legacy/duplicate nodes create Frankenstein score | Critical | Accept | Score only one canonical strict node; weak nodes never enter the score artifact. |
| 14 | URL/telephone/Organization predicates are vague | High | Accept | Deterministic trimming, URL, node selection, and failure rules are required. Domain ownership itself stays outside this story. |
| 15 | DOM-only XSS assertion is insufficient | High | Accept | Keep serializer unit tests and inspect raw HTML with a malicious sentinel before DOM parsing. |

## Applied files

- `plan.md`
- `phase-00-sync-authoritative-contract-and-dependencies.md`
- `phase-01-persist-and-validate-schema-subtype.md`
- `phase-02-emit-schema-and-score-35.md`
- `phase-03-verify-storefront-and-handoff.md`
- obsolete Schema-40 plan artifact (cancelled during review, later removed during cleanup)
