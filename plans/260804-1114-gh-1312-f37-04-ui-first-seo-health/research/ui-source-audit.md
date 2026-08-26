---
type: researcher
date: 2026-08-04
---

# Researcher Report: US-F37-04 UI Source Audit

## Summary

The existing Dashboard card is reusable, but its data and interactions are legacy. A new presentational card can be built and unit-tested before PR #1728 without changing production behavior.

## Findings

### Current card is the correct shell, not the correct contract

- `src/components/dashboard/revamp/seo-health.tsx` uses the existing gauge/card shell.
- It renders only Meta, Content, and Technical bars.
- It reserves a large region for a non-functional Score History placeholder.
- AI Fix All is based on any missing SEO item, not AI-owned title/description issues.
- Rows expose severity/count/fix type, but no actor or semantic destination.

### Current data cannot power the target UI safely

- `src/lib/dashboard/dashboard-types.ts` has three buckets and title/description/alt issue types only.
- `src/lib/dashboard/seo-data.ts` computes the legacy F03 weighted score.
- `src/app/(dashboard)/dashboard/page.tsx` awaits that server loader and renders the score directly.
- The current local-score API still returns the legacy top-level formula.

### Existing patterns to reuse

- Gauge and status primitives: `src/components/dashboard/revamp/charts.tsx`.
- Card and section tokens: `src/components/dashboard/revamp/atoms.tsx`.
- Loading/error/retry client pattern: `src/components/dashboard/revamp/traffic-performance-client.tsx`.
- Metadata fix modal: `src/components/dashboard/AIFixModal.tsx`.
- Two-column issue CSS and one-column mobile collapse already exist in `dashboard-revamp.css`.

### Canonical design

- PRD §12.3 and `docs/design/F03-dashboard-design.md` agree on one unified card.
- `docs/design/F37-local-seo-wireframes.md` still shows a separate Local SEO card and Google activity; that target is stale.

## Recommendations

1. Add a pure, fixture-driven card and additive types first.
2. Do not import or mount it from production until the endpoint is atomically rewired.
3. Use a semantic action union and callbacks; resolve routes only in the later client wrapper.
4. Render all supplied issues and keep sort/dedupe server-side.
5. Add a direct component test; the current revamp `SeoHealth` lacks one.

## Unresolved Questions

- Qualitative thresholds are not explicitly specified. The evaluation layer should return status rather than making the card infer it.
- Google verification cannot become a visible CTA until its Editor destination exists.
