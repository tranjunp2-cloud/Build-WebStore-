# Phase 02 — Protected Inbox and feature-detail API

## Context links

- Parent: [plan.md](plan.md); depends on [Phase 01](phase-01-evidence-read-model-contract.md).
- Docs: UX §6–7; existing health calculator and QA API routes.

## Overview

- Date: 2026-08-10; Description: serve deterministic, evidence-led inbox/detail DTOs; Priority: P1; Implementation status: pending; Review status: pending.

## Key Insights

- Current health endpoint has target state/reason/latest run only; it cannot drive AC-1/2 detail.
- Priority must be server computed: Critical → Needs attention → Watch → Unknown; history is a separate secondary view.

## Requirements

- Super-admin-only endpoints with validated target/cursor/filter inputs and efficient batched queries.
- Return target, reason, latest evidence, suggested next action, TC-ID/fixture/expected/actual/PR/SHA/classification and safe links.
- Return explicit loading-safe empty/error/unknown contracts; never infer Healthy from a missing record.

## Architecture

- Add a typed QA inbox/detail service shared by protected routes; compose run/result/evidence with target registry and health calculator.
- Use opaque cursor pagination for Inbox; use one target detail lookup and explicit evidence availability metadata.

## Related code files

- `src/app/api/admin/qa/project-health/route.ts`, `src/app/api/admin/qa/runs/route.ts`, `src/lib/admin/qa/health-calculator.ts`, `src/lib/admin/qa/target-registry.ts`, `src/lib/admin/qa/contracts.ts`.

## Implementation Steps

1. Specify API response schemas and priority/tie-break/freshness rules.
2. Implement authenticated read services/routes with tenant/access checks and no N+1 reads.
3. Sanitize/select only approved evidence URLs; return expiry and unavailable reason.
4. Add conditional retest capability field only after F40-07/F40-03 contract is live; otherwise expose no completion-claiming CTA.

## Todo list

- [ ] Add request validation and authorization tests.
- [ ] Add cursor/filter and detail DTO endpoints.
- [ ] Verify unknown and expired states.
- [ ] Document F40-03/F40-07 integration gate.

## Success Criteria

- Inbox data is real, ordered and actionable; detail is evidence-led and cannot leak raw CI data.

## Risk Assessment

- Large result joins may regress latency; constrain fields, index query keys and inspect query count.

## Security Considerations

- Enforce super-admin on page and route; validate identifiers; never pass secrets, raw trace paths or untrusted HTML.

## Next steps

- Consume these DTOs in the responsive Studio UI.
