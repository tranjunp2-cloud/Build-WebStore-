---
phase: 8
title: "Docs + cross-phase hardening"
status: pending
priority: P1
effort: "8h"
dependencies: [2, 3, 4, 5]
story: US-F43-08
branch: feat/F43-08-billplz-e2e
---

# Phase 8: Docs + hardening pass

## Overview

Route E2E specs live in the phases that own the routes (repo rule: new route → spec in the same PR — P3 owns `tests/checkout-billplz.spec.ts`, P4 owns `tests/webhook-billplz.spec.ts`, P5 owns `tests/checkout-billplz-expiry.spec.ts` + `settings-payments-billplz.spec.ts` if written there). **This phase does NOT re-create them** — it consolidates: `docs/stories/F43` + `docs/qa/F43` TC skeleton, a cross-phase hardening sweep, and a full-suite validation.

## Requirements

- Functional: `docs/stories/F43-billplz-payment-stories.md` (8 US, Gherkin AC, `F36` format) + `docs/qa/F43.md` TC skeleton so QC can map `[x] AUTO` flags; verify every new route from P2–P5 actually shipped its spec.
- Non-functional: secrets never in fixtures/logs; specs that couldn't run without sandbox credentials are `test.skip`/`fixme` with TC-ID + reason — never a fake pass.

### Hardening checklist (from red-team)

- [ ] No `console.log`/`console.error` prints keys, signatures, or full callback bodies
- [ ] `verifyXSignature` uses `timingSafeEqual` + length guard
- [ ] Webhook binds `billplzBillId === params.id` post-verify (replay check)
- [ ] `PAID_AFTER_CANCEL` marker emits on terminal-order paid callback
- [ ] Cancel/refund Stripe predicates exclude `paymentProvider==='billplz'`
- [ ] Amount check in webhook (params.amount vs order total)
- [ ] i18n: all `billplz*` keys present in en+ms (typecheck catches missing)
- [ ] Env vars in both example files + `check-env-vars.js` pass
- [ ] `check-migrations.js` pass
- [ ] Route `maxDuration ≤ 60`; Node runtime where crypto/formData needed

### TC-ID mapping

Map specs to `docs/qa/F43.md` entries — create the QA doc skeleton listing TCs per US (connect, checkout, webhook, expiry, retry, cancel) so QC can map `[x] AUTO` flags per `TEST_CONVENTION.md`.

## Related Code Files

- Create: `docs/qa/F43.md`, `docs/stories/F43-billplz-payment-stories.md` (consolidated US doc — format per `F36` stories file)
- Modify: none expected — this phase verifies/fixes gaps surfaced by the sweep, not new code
- Specs: owned by P2–P5 (verify presence, fill gaps if a phase skipped one)

## Implementation Steps

1. `docs/stories/F43-billplz-payment-stories.md` — 8 US with Gherkin AC (one per phase) + `docs/qa/F43.md` TC skeleton
2. Spec-presence audit: every new route from P2–P5 has a spec in `tests/*.spec.ts` (skipped-with-reason acceptable per existing payment-spec convention)
3. Hardening checklist pass over P2–P5 diffs
4. Full suite run locally where possible; staging-dependent specs marked per convention

## Success Criteria

- [ ] Every new route has its E2E spec (in the owning phase's PR) — audit passes
- [ ] `docs/qa/F43.md` exists with TC-IDs; specs reference them
- [ ] Hardening checklist all green; zero key/signature leakage in any log path
- [ ] CI quality gates pass (`check-migrations`, `check-env-vars`, typecheck, lint)

## Risk Assessment

- Live sandbox credentials in CI → keep secrets in GitHub Secrets (`E2E_*` pattern); specs must degrade to skip when env absent — never hardcode.
- Webhook E2E depends on knowing the exact signature — unit-tested vectors carry the weight; E2E asserts the HTTP contract.
