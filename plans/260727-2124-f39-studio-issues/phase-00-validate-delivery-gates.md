# Phase 0: Validate Delivery Gates

## Context Links

- [Implementation plan](./plan.md)
- [F39 PRD v4](../../docs/prd/F39-studio-log-issue-tracking.md)

## Overview

- **Priority:** P1
- **Status:** Blocked on live credentials and database access
- **Effort:** 1h
- **Purpose:** Prove provider and persistence assumptions before implementation.

## Key Insights

- Sentry SDK ingestion does not prove read-API credentials or fields.
- Existing Vercel code covers Domains only; Runtime Logs remains a delivery gate.
- The existing DB columns are `varchar`, but exact runtime deduplication still needs a partial unique index.
- AC-09 escalation conditions are now frozen in the PRD and covered by deterministic tests.

## Requirements

### Functional

- Confirm Sentry organization, project, production environment, and a dedicated least-privilege `SENTRY_READ_TOKEN` with `event:read`.
- Resolve the current Vercel production deployment and read qualifying Runtime Logs.
- Inspect live `template_issues.related_type` constraints and runtime duplicates.
- Freeze normalized fields, timeouts, fixture boundaries, and guidance escalation text.

### Non-functional

- Never save provider tokens or raw production payloads in repository artifacts.
- Each spike must terminate within 10 seconds; the Vercel read stops after 5 seconds or 50 accepted rows.

## Related Files

- **Inspect:** `.env.example`, `.env.staging.example`, `.env.production.example`
- **Inspect:** `sentry.server.config.ts`, `src/lib/vercel/domains.ts`
- **Inspect:** `src/collections/TemplateIssues.ts`, `scripts/db-setup.js`
- **Create during implementation only:** redacted/synthetic F39 fixtures under the existing test fixture convention

## Implementation Steps

1. Prove Sentry can list unresolved production issues ordered by latest activity and fetch the latest event for one selected issue.
2. Record which allowlisted fields are actually present; missing host, route, status, request ID, or trace ID remains absent.
3. Resolve the current production Vercel deployment with the configured token/team/project.
4. Read deployment events/runtime rows; keep only error, fatal, and HTTP 5xx evidence; stop after 5 seconds or 50 accepted rows.
5. Record actual timestamp, host, method, path, status, message, deployment, request ID, and trace ID behavior.
6. Test invalid credentials, timeout, rate-limit, and empty-result behavior independently for both sources.
7. Query the live DB schema for `related_type`; verify `runtime` can be written without a new column/table and check for existing runtime duplicates.
8. Define an explicit escalation condition for each guidance category and fold the decision into the PRD/QA contract before Phase 1.
9. Create only synthetic/redacted fixtures and run a token/PII secret scan.

## Todo

- [ ] Sentry list/detail contract passes
- [ ] Vercel bounded production-deployment spike passes
- [x] Independent failure behavior is recorded
- [ ] Live DB accepts `runtime` and has no conflicting duplicates
- [x] Guidance escalation conditions are approved
- [x] Synthetic/redacted fixtures contain no secrets or PII

## Success Criteria

- Both provider contracts and the runtime relation are proven with current evidence.
- If Vercel fails, block two-source release acceptance and keep Vercel promotion disabled; do not substitute scraping, Drain, webhook, or fabricated data.

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Vercel endpoint semantics differ from dashboard Runtime Logs | Two-source AC blocked | Treat the live spike, not endpoint naming, as the gate |
| Sentry omits hostname | Tenant cannot be matched | Return `Unknown` |
| Samples contain secrets | Privacy breach | Retain only allowlisted synthetic/redacted fixtures |

## Next Step

Complete the live gates before release acceptance; code may proceed only behind explicit fail-closed provider gates.
