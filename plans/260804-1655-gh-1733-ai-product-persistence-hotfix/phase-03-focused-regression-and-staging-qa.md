# Phase 03 — Focused Regression and Staging QA

**Status:** implemented — awaiting staging QA · **Priority:** P1 · **Migration:** No · **Depends:** Phases 01–02

## Goal

Prove only the issue's required behavior: preview → confirm → real Product save → Draft list, plus the GH-1410 safeguards and actionable failure contract. CI bot owns staging verification.

## Files

**Modify**

- `e2e/products.spec.ts`
- `src/app/api/e2e/ensure-test-user/route.ts`
- `src/__tests__/api/e2e-ensure-test-user.test.ts`
- `docs/qa/F08-product-crud.md`

No changes to `package.json`, Vitest config, database migrations, or GitHub workflows are planned. Editing `e2e/products.spec.ts` already triggers the existing staging E2E workflow, which already runs `products.spec.ts`.

## Focused Regression Matrix

| Scope | Evidence |
|-------|----------|
| GH-1410 tenant write/read normalization | Existing + updated unit tests |
| GH-1410 auto-commit and independent verification | Phase 01 action tests |
| GH-1733 actionable error/reference/loading | Phase 02 component tests |
| Exactly once for same mounted preview ID | Action replay test + Playwright row count |
| Preview → Approve → Draft visibility | Real staging Playwright `TC-F08-04-101/126` |

## Playwright

- Keep AI parsing deterministic by mocking only `/api/ai/products-bulk-parse`, including a valid `generationId`.
- Use the real review UI, `saveAiProductAction`, staging database, Draft filter, and fresh Product detail/list read.
- Ensure the fixture reaches Approve. Prefer an already provisioned active category; if unavailable, minimally extend the existing secret-guarded provisioning route to derive the bot tenant and idempotently ensure one fixed category.
- If provisioning changes, test missing/wrong secret, no mutation before authorization, tenant derivation from the provisioned user, and rejection of arbitrary tenant/category input.
- Confirm two previews create exactly two unique Draft rows. Retry one preview with the same stable ID and confirm row count/ID does not change.
- Clean Product fixtures through existing dashboard helpers. A setup failure, concurrency cancellation, or test that never clicks Approve is not persistence evidence.

## Verification Commands

```bash
npm test -- src/__tests__/api/ai.test.ts src/__tests__/unit/actions/save-product-action.test.ts src/__tests__/unit/payload/category-row-lock.test.ts src/__tests__/unit/dashboard/bulk-create-save.test.tsx
npm run typecheck
npx playwright test e2e/products.spec.ts --grep "TC-F08-04-101|TC-F08-04-126"
```

## Verification Evidence

- Focused Phase 1–3 regression suites: **143/143 passed**.
- Secret-guarded E2E provisioning route suite: **8/8 passed in three consecutive runs**.
- Targeted lint and `git diff --check`: passed.
- `npx playwright test e2e/products.spec.ts --list`: passed; the Phase 3 scenarios are discovered.
- Real staging Playwright was not run because safe staging credentials are unset in this checkout.
- Sentry correlation and a staging run URL remain pending for the same reason.
- `src/__tests__/api/ai.test.ts` collection and repository-wide typecheck are blocked by dependencies missing from the installed `node_modules`.
## Acceptance and Rollout

- [ ] Focused unit tests and typecheck pass before merge.
- [ ] PR title follows Conventional Commits/story convention and body uses `Relates to #1733`, never `Closes #1733`.
- [ ] CI bot's post-merge staging run reaches Approve and shows the exact new rows under Draft.
- [ ] A handled failure produces one sanitized Sentry event that can be found by the UI reference ID.
- [ ] Issue evidence records the staging run URL; the reporter performs no privileged staging operation.
- [x] No schema, env, new route, or unrelated CI infrastructure change is included.
