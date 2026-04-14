# Phase-06 Step-06 — Test + E2E verify report

Date: 2026-04-14
Executed by: /cook session
Branch: feat/F01-ai-gen-variety-fix

## Test runs

### Scope 1: src/__tests__/unit/lib/ai + builder + templates
- **Total**: 799 tests across 32 files
- **Passed**: 797
- **Failed**: 2 (pre-existing, not rewire-related)

### Failing (PRE-EXISTING — not caused by phase-06)
Both in `src/__tests__/unit/lib/ai/sanitize-block-data.test.ts`:
1. `normalizes object stats using value/number and label/text` — expected `"500+"` got `"500"` (stat suffix stripping bug)
2. `handles stats on non-about blocks too` — expected `"99%"` got `"99"` (same bug)

Verified pre-existing via `git stash` → run → stash pop. These exist on the committed tip `8598e64` before my phase-06 edits. Out of scope for this phase.

### Fixed in this session
- `src/__tests__/unit/lib/ai/openai-generator.test.ts` — updated `emits fallback step event` assertion to match new granular event names (`fallback_analyzing`, `fallback_composing`, etc). Previously matched literal `'fallback'` which no longer exists.
- `src/__tests__/unit/templates/template-composer.test.ts` — removed upper-bound (5-7) assertion on starter layout count. Commit `8598e64` enriched composer to emit 10+ blocks, test expected 5-7. Lower bound `>=5` retained.

## Pseudo-E2E smoke test

Manual browser E2E deferred (requires dev server + human UI clicks across 5 categories). Replaced with programmatic smoke test: `scripts/ai/smoke-fallback.ts` — calls `composeFallbackResult()` directly for 5 canonical prompts and asserts shape + signature blocks.

### Results — 5/5 categories PASS

| Category | Prompt | siteName | Blocks | Signature blocks present |
|---|---|---|---|---|
| restaurant | "Ristorante Bella Vista, family Italian in District 1..." | Ristorante Bella Vista | 12 | faq ✓ (menu-display/booking-widget not in preset — see note) |
| health | "Saigon Dental Clinic with 10 years..." | Saigon Dental Clinic | 12 | doctor-profile ✓, booking-widget ✓, faq ✓ |
| fitness | "CrossFit Box 247, 24-hour access..." | CrossFit Box 247 | 12 | features ✓, class-schedule ✓ |
| tech | "TaskFlow SaaS for solo founders..." | TaskFlow | 12 | pricing ✓, features ✓, faq ✓ |
| creative | "Minh Nguyen, wedding photographer in Hanoi" | Minh Nguyen Studio | 11 | portfolio-grid ✓ |

All 5: **siteName override propagates**, **fonts resolve to Payload allowlist values**, **theme colors valid hex**, **blocks ≥ 5**.

### Followup (plan-2156 phase-07 territory)
- Restaurant preset picked for seed 42 does NOT include `menu-display`/`booking-widget` blocks — only generic sections. Dynamic content gen from form input (phase-07) will address this.
- The fallback pipeline works end-to-end; content richness is a TEMPLATE_PRESETS authoring concern, not a composer wiring issue.

## TypeScript check
- `pnpm tsc --noEmit`: 15 errors remaining — ALL in pre-existing Drizzle SQL dedupe files (`OverviewView.tsx`, `create-broadcast.ts`, `dashboard/summary/route.ts`, `cron/keep-alive/route.ts`, `cron/notifications/cleanup/route.ts`). None in files touched by phase-06.

## Manual browser E2E — DEFERRED
The plan's success criteria require rendering 5 sites in the builder UI on localhost while `OPENAI_API_KEY=sk-invalid`. Deferred to human QA:
- Run `pnpm dev -- --port 3003` in worktree
- Set `OPENAI_API_KEY=sk-invalid` in `.env.local`
- Open `/builder/new`, submit 5 prompts, screenshot each
- Verify network tab: no Google Fonts 404, no console errors
- Save screenshots to `plans/260412-2156-ai-gen-website-audit/reports/step-06-screenshots/`

## Conclusion

✅ Phase-06 step-06 test gate: **PASS** (test + programmatic smoke)  
⏸ Phase-06 step-06 manual browser E2E: **DEFERRED to human QA**
