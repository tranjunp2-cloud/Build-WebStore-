# Phase 07 — Rollout + Metrics + Old Path Coexistence

## Context links
- **Parent**: [plan.md](./plan.md)
- **Depends on**: All phases 01-06 (end-to-end flow complete)

## Overview
- **Date**: 2026-04-15
- **Description**: Launch template-first flow alongside old AI gen path via feature flag. Progressive rollout 10% → 50% → 100%. Measure content quality, user satisfaction, template picks distribution. Old AI gen path kept as fallback + power-user mode.
- **Priority**: P0 (validates entire rebuild)
- **Implementation status**: pending
- **Review status**: not reviewed
- **Effort**: 1 week

## Key Insights
- **Progressive rollout protects users** — 10% early catches bugs before hitting 100% of traffic
- **Keep old path** — not everyone wants a template; power users want "write me something unique". Both paths coexist.
- **Measure leading + lagging metrics** — leading (template picks, wizard completion rate) tells you if users engage; lagging (retention, upgrade rate) tells you if it sticks.

## Requirements
- Feature flag `ENABLE_WIZARD_V2` controls routing:
  - `false` (default): `/builder/new` loads old AI form
  - `true`: `/builder/new` redirects to `/builder/new-v2` wizard
- Gradual rollout via user cohorts:
  - Week 1: 10% of new signups (by user ID hash)
  - Week 2: 50% if metrics pass gates
  - Week 3: 100% if metrics still pass
- Kill switch: instant rollback if error rate spikes
- User-facing "Use classic AI builder" link on wizard step 1 (opt-out)
- Metrics dashboard:
  - Wizard funnel (step_complete / step_abandon per step)
  - Template pick distribution (top 10 templates picked)
  - Content quality subjective rating (post-gen survey: "How do you rate this output? 1-5")
  - Time-to-first-site (wizard vs AI form)
  - Error rate (API failures, personalization errors)
  - Churn comparison (users on wizard vs AI form, return rate after 7 days)

## Architecture

### Feature flag routing
```ts
// src/app/(builder)/builder/new/page.tsx
export default function BuilderNewPage({ searchParams }: Props) {
  const user = await getCurrentUser()
  const cohortPct = hashUserId(user.id) % 100  // 0-99

  const wizardRolloutPct = parseInt(process.env.WIZARD_ROLLOUT_PCT ?? '0', 10)
  const userOptOut = searchParams.classic === 'true'

  if (!userOptOut && cohortPct < wizardRolloutPct) {
    redirect('/builder/new-v2')
  }
  // else render old AI form
}
```

### Metrics collection
- Reuse existing `src/lib/analytics/*` helpers
- New event types: `wizard_started`, `wizard_step_complete`, `wizard_abandoned`, `template_picked`, `template_personalized`, `site_created_via_wizard`
- Post-gen survey: modal after save prompts 1-5 rating + optional text feedback
- Store in new Payload collection `gen-feedback`

### Metrics dashboard
- Admin route `/admin/metrics/template-flow`
- Charts:
  - Funnel: % users completing each step
  - Top templates by pick count
  - Satisfaction histogram
  - Time-to-site (p50, p95)
  - Wizard vs AI form A/B comparison
- Daily snapshot to Lark via existing smart-notify

### Rollout gates
```
Week 1 (10% cohort):
  ✓ Completion rate ≥60% (users who started finish step 5)
  ✓ Error rate ≤2%
  ✓ No P0 bugs reported
  → promote to 50%

Week 2 (50%):
  ✓ Satisfaction ≥4.0 / 5.0 on ≥20 responses
  ✓ Template pick distribution top-10 covers ≥40% of picks (avoids monoculture)
  ✓ Time-to-site p50 ≤5 minutes (vs AI form ~3 minutes — acceptable trade)
  → promote to 100%

Week 3 (100%):
  ✓ All above metrics hold
  ✓ Old AI form usage ≤20% (most users adopt new flow)
  → consider deprecating old form in v1.2
```

## Related code files
- `src/app/(builder)/builder/new/page.tsx` — routing gate
- `src/lib/analytics/*` — existing tracking
- `src/app/(admin)/admin/metrics/*` — metrics dashboards
- `src/collections/GenFeedback.ts` (new) — Payload collection
- `src/components/builder/PostGenFeedbackModal.tsx` (new)

## Implementation Steps
1. Feature flag env var setup (0.5 day):
   - `WIZARD_ROLLOUT_PCT` in Vercel env
   - Routing gate in `/builder/new/page.tsx`
   - Opt-out query param
2. Analytics events wiring (1 day):
   - Define event schema
   - Instrument wizard steps
   - Instrument template pick + personalize
3. Gen feedback collection (1 day):
   - Payload collection
   - Post-gen modal component
   - Submit handler
4. Metrics dashboard (2 days):
   - Funnel chart
   - Top templates chart
   - Satisfaction histogram
   - Time-to-site comparison
   - A/B comparison panel
5. Lark daily notifier (0.5 day):
   - Cron or scheduled fn
   - Summary metrics → Lark webhook
6. Rollout runbook doc (0.5 day):
   - Gate criteria per week
   - Rollback procedure
   - Incident response
7. Week 1 rollout (not in effort estimate — multi-week observation):
   - Set `WIZARD_ROLLOUT_PCT=10`
   - Daily metrics review
8. Week 2 + 3 rollout (conditional on gates passing)

## Todo list
- [ ] Feature flag env + routing
- [ ] Analytics events
- [ ] Gen feedback collection + modal
- [ ] Metrics dashboard
- [ ] Lark daily notifier
- [ ] Rollout runbook
- [ ] Launch week 1 (10%)
- [ ] Evaluate gates → week 2 (50%)
- [ ] Evaluate gates → week 3 (100%)

## Success Criteria
- 10% rollout completes without P0 bugs
- Completion rate ≥60% on wizard flow
- Satisfaction ≥4.0 / 5.0 on ≥20 responses
- Template pick diversity: top 10 templates < 50% of picks (users explore library)
- New flow adoption ≥50% within 3 weeks
- Zero regression in existing AI gen path metrics

## Risk Assessment
- **Low satisfaction** — if users rate new flow <3.5, rebuild failed. Mitigation: pause rollout at 10%, iterate on templates (Phase 03) or wizard UX (Phase 04).
- **Monoculture picks** — top 3 templates get picked 80% → library too small OR wizard not diverse enough. Mitigation: flag for Phase 03 library expansion.
- **Performance regression** — personalization + rank adds latency vs pure template seed. Mitigation: measure p95 at each gate, optimize if >3s end-to-end.
- **Feature flag bug** — wrong cohort assigned. Mitigation: unit test hashUserId, canary test with 1% first.

## Security Considerations
- Feedback collection: sanitize text input, rate limit submissions
- Metrics dashboard: super-admin only access
- Cohort assignment deterministic (hash) to avoid unfair exposure

## Next steps
- Post rollout: write retrospective journal
- If successful: plan v2.0 deprecation of old AI form
- If partially successful: plan v1.2 iteration on weak phases
- If failed: rollback, write postmortem, reassess approach
