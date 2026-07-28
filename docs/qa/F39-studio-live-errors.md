# F39 Studio Live Errors — QA Cases

## Scope

Verify the read-on-demand Sentry/Vercel inbox and Sentry-only manual promotion flow inside the existing `/studio/issues` surface. Vercel promotion, production-provider, and staging checks remain hard gates.

## Automated Cases

| ID | Auto | Severity | Acceptance criteria | Expected result |
|---|---|---|---|---|
| TC-F39-AC01 | [x] AUTO | Critical | AC-01, AC-03 | Provider adapters normalize qualifying list rows and return an explicit empty success |
| TC-F39-AC04 | [x] AUTO | Blocker | AC-04, AC-05 | Provider failures remain non-empty errors and each UI source can retry independently |
| TC-F39-AC06 | [x] AUTO | Critical | AC-06–AC-08 | Active custom domain and platform slug resolve; missing, inactive, or unmatched hosts return `Unknown` |
| TC-F39-AC09 | [x] AUTO | Critical | AC-09, AC-10 | Every supported category returns exactly two checks plus an escalation condition; unmatched evidence uses provider-first guidance |
| TC-F39-AC11 | [x] AUTO | Blocker | AC-11 | Only allowlisted normalized fields survive; secrets, personal data, query data, native payload fields, and extra frames are excluded |
| TC-F39-AC12 | [x] AUTO | Blocker | AC-12, AC-15 | Promotion refetches provider evidence server-side and creates no partial issue on provider failure |
| TC-F39-AC13 | [x] AUTO | Blocker | AC-13 | Existing exact relation returns the existing issue; a concurrent unique violation returns the winning issue |
| TC-F39-AC14 | [ ] BLOCKED | Blocker | AC-02, AC-14 | Exact cross-provider persistence waits for a stable server-authoritative Vercel item-refetch contract |
| TC-F39-GATE-01 | [x] AUTO | Blocker | Delivery gate | Vercel promotion and submitted cross-provider persistence are rejected or ignored until a stable server refetch contract passes live verification |
| TC-F39-E2E.01 | [x] AUTO | Blocker | AC-01, AC-04, AC-09, AC-12 | Browser shows partial-source state, retries one provider, opens safe detail, and submits provider identity for promotion |

## Manual Staging Gates

| ID | Auto | Severity | Acceptance criteria | Procedure |
|---|---|---|---|---|
| TC-F39-M01 | [ ] MANUAL | Blocker | AC-01, AC-03–AC-05 | Use real staging Sentry and Vercel credentials; verify success, empty, rate-limit, unauthorized, and timeout states independently |
| TC-F39-M02 | [ ] MANUAL | Blocker | AC-06–AC-11 | Inject a non-sensitive canary event; verify tenant honesty, no raw payload, no email/IP/token/query/body leakage, and deterministic guidance |
| TC-F39-M03 | [ ] MANUAL | Blocker | AC-12, AC-13, AC-15, AC-16 | Promote one Sentry issue twice and concurrently; verify one durable runtime issue, no persistence before promotion, and normal issue lifecycle after creation. Vercel/cross-provider promotion stays blocked |
| TC-F39-M04 | [ ] MANUAL | Critical | FR-01, FR-06 | Verify Tracked Issues stays usable when both providers fail and no `/studio/logs` route was introduced |
| TC-F39-M05 | [ ] MANUAL | Blocker | RBAC | Verify unauthenticated and non-super-admin browser sessions cannot open Live Errors or call either F39 API |

## Required Environment

- Authenticated `super-admin` Playwright state for `TC-F39-E2E.01`.
- Server-only Sentry organization, project, production environment, and read token for manual smoke.
- Server-only Vercel token, team, and project identifiers after the Runtime Logs delivery spike passes.
- Migrated staging database with `template_issues_runtime_related_id_uniq` verified by `db-setup.js --migrate-only`.
- Promotion staging checks are Sentry-only until the Vercel stable-refetch gate is approved.

## Unresolved Questions

- Real Vercel Runtime Logs contract is not verified in this workspace because provider credentials are unavailable.
- Staging super-admin credentials and provider canary ownership are not configured locally.
