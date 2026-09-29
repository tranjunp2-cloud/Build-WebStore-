# Phase 1 — Safe escalation contract and persistence

## Files

- Modify `src/collections/TemplateIssues.ts`
- Modify `scripts/db-setup.js`
- Create `src/lib/ai/generation-issue-escalation.ts`
- Modify/add unit tests under `src/__tests__/unit/ai/`

## Implementation

1. Add nullable `dedupeKey` text field to `template-issues`; it is only set by
   the generation escalation service, never accepted from generic issue form.
2. Add additive `ALTER TABLE ... ADD COLUMN IF NOT EXISTS dedupe_key` and a
   partial unique index `WHERE dedupe_key IS NOT NULL`. Migration must run twice
   and must not use `DROP`.
3. Build a pure service that consumes only
   `serializeAdminGenerationDetail()` + `buildGenerationTicketIncidentSnapshot()`.
   It must reject absent incident and policies other than `create_ticket` /
   `open_ticket`.
4. Derive `dedupeKey` from retry-root ID, phase, category, normalized code,
   location type/key and validation state; use a SHA-256 digest, never raw data.
5. Render a bounded plain-text issue description from the safe snapshot:
   generation/root IDs, site/user IDs, trace ID, incident location/cause/impact,
   recovery reason and retry lineage. Do not include user email, form values,
   prompt, raw technical message, headers, stack or provider response.
6. Set category `ai-quality`; severity derives from safe category/policy via an
   explicit map. Do not infer it from Vietnamese display copy.

## Success criteria

- Duplicate requests yield same existing issue even under a unique-violation race.
- A different normalized incident creates a new issue.
- Snapshot test proves forbidden raw fields never reach title, description or key.
