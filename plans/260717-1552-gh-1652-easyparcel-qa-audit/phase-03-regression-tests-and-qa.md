# Phase 03 - Regression Tests And QA Validation

## Context

- Plan: [GH-1652 overview](./plan.md)
- Depends on: [Phase 01](./phase-01-canonical-warehouse-contract.md), [Phase 02](./phase-02-settings-workflow-and-ui.md)
- Priority: P1
- Estimate: 6h

## Requirements

- Follow `docs/TEST_CONVENTION.md`: real source imports, top-level mocks, AAA structure, and TC-ID mapping.
- Extend the latest F36 QA document before naming new regression tests; current scan finds IDs through TC-F36.199.
- Cover pure normalization, API authorization/validation, component workflow, localization, OAuth redirect, and real browser responsive behavior.
- Record connected-sandbox persistence UAT because mocked Payload tests cannot prove DB round-trip behavior.

## Related Code Files

- Modify `/Users/levietducprime/Work/ech-prime-web-v2/.claude/worktrees/ech-prime-web-v2-workspace-2/docs/qa/F36-easyparcel-delivery.md` - add GH-1652 regression scenarios using the next free TC IDs.
- Modify `/Users/levietducprime/Work/ech-prime-web-v2/.claude/worktrees/ech-prime-web-v2-workspace-2/src/__tests__/unit/shipping/ep-phone-validation.test.ts` - canonical MY phone and warehouse readiness cases.
- Create `/Users/levietducprime/Work/ech-prime-web-v2/.claude/worktrees/ech-prime-web-v2-workspace-2/src/__tests__/unit/dashboard/pickup-addresses.test.tsx` - form/default/sort/delete/editing behavior.
- Create `/Users/levietducprime/Work/ech-prime-web-v2/.claude/worktrees/ech-prime-web-v2-workspace-2/src/__tests__/unit/dashboard/easyparcel-settings-tab.test.tsx` - dirty/save/failure/confirmation/query cleanup workflow.
- Modify `/Users/levietducprime/Work/ech-prime-web-v2/.claude/worktrees/ech-prime-web-v2-workspace-2/src/__tests__/unit/dashboard/ep-setup-stepper.test.tsx` - editor navigation guard, localized copy, disconnect confirmation.
- Modify `/Users/levietducprime/Work/ech-prime-web-v2/.claude/worktrees/ech-prime-web-v2-workspace-2/src/__tests__/api/easyparcel-oauth-callback.test.ts` - tab-aware success/error redirects.
- Modify `/Users/levietducprime/Work/ech-prime-web-v2/.claude/worktrees/ech-prime-web-v2-workspace-2/src/__tests__/api/tenant-easyparcel-save.test.ts` - sanitization, normalization, default ordering, malformed/oversized input, IDOR.
- Create `/Users/levietducprime/Work/ech-prime-web-v2/.claude/worktrees/ech-prime-web-v2-workspace-2/src/__tests__/unit/localization/f36-easyparcel-settings-i18n.test.ts` - VI/EN/MS key parity and representative copy checks.
- Create `/Users/levietducprime/Work/ech-prime-web-v2/.claude/worktrees/ech-prime-web-v2-workspace-2/e2e/f36-easyparcel-settings.spec.ts` - authenticated tab and responsive browser checks.

## Test Matrix

| Layer | Required scenarios |
|---|---|
| Pure | Phone inputs normalize to `60...`; invalid/all-zero/double-prefix rejected; canonical warehouse is non-mutating, one-default, default-first. |
| API | Wrong tenant 403; malformed/oversized warehouses 400; enabled+incomplete default 400; valid add/edit/delete payload returns canonical settings; no courier or token fields accepted/returned. |
| OAuth | Success and every error path include `tab=easyparcel`; state cookie still cleared. |
| Pickup component | Default first; optional address2 blank is valid; existing address2 survives edit; invalid required fields show errors; phone characters blocked/normalized; delete waits for confirmation; editing callback toggles. |
| Settings component | No request on local mutation; clean Save inactive; dirty Save sends once; editor hides Save; failure stays dirty; success resets snapshot; deleting final active warehouse drafts deactivation. |
| Stepper | Disconnect waits for confirmation; uncommitted editor blocks navigation; activation body remains compatible. |
| i18n | VI/EN/MS EasyParcel shape parity; representative disconnected/setup/management copy switches with locale; no missing-key crash. |
| Playwright | `?tab=easyparcel` opens correct tab; 375/390px disconnected state has `scrollWidth <= clientWidth`; mobile controls visible/tappable; desktop still renders both tabs. |
| Manual sandbox | Connected tenant: add -> Save -> reload; edit/default -> Save -> reload; delete -> Save -> reload; last delete deactivates; OAuth callback lands on tab; light/dark at 390px. |

## Validation Commands

```bash
npx vitest run src/__tests__/unit/shipping/ep-phone-validation.test.ts src/__tests__/unit/dashboard/pickup-addresses.test.tsx src/__tests__/unit/dashboard/easyparcel-settings-tab.test.tsx src/__tests__/unit/dashboard/ep-setup-stepper.test.tsx src/__tests__/unit/localization/f36-easyparcel-settings-i18n.test.ts src/__tests__/api/easyparcel-oauth-callback.test.ts src/__tests__/api/tenant-easyparcel-save.test.ts
npm run typecheck
npx playwright test e2e/f36-easyparcel-settings.spec.ts --project=chromium
git diff --check
```

## QA Notes

- Do not automate the external EasyParcel OAuth provider. Unit-test callback redirects and manually run one sandbox round-trip.
- Playwright can cover the disconnected state with the standard authenticated tenant. Connected warehouse persistence requires a dedicated sandbox tenant/session and must be recorded as UAT rather than hidden behind a skipped test.
- Capture 390px screenshots in light and dark for disconnected, setup, and management states when the fixture is available.

## Todo

- [x] Add/confirm TC mappings in the QA doc.
- [x] Add pure, API, component, and i18n regression tests.
- [x] Add authenticated Playwright tab/mobile coverage.
- [x] Run focused Vitest suites and `git diff --check`.
- [ ] Run authenticated Playwright (blocked: local test account returns 401).
- [ ] Obtain a consistently clean typecheck (blocked by mixed root/worktree AWS SDK type resolution in `s3-presign.ts`).
- [ ] Complete and record connected sandbox persistence/OAuth UAT.

## Execution Record (2026-07-17)

- `npx vitest run`: 614 files passed, 10,622 tests passed.
- `npm run typecheck`: one run passed, but the latest run reproduced the pre-existing mixed root/worktree AWS SDK type mismatch in `src/lib/media/s3-presign.ts`; no changed-file type error was reported.
- `git diff --check`: passed.
- `npx playwright test e2e/f36-easyparcel-settings.spec.ts --project=chromium --list`: 4 tests discovered successfully.
- Authenticated Playwright execution: blocked in setup because the configured local test account returned HTTP 401.
- Connected EasyParcel sandbox persistence/OAuth UAT: pending a sandbox tenant and valid session.

## Success Criteria

- Focused tests and typecheck pass with no skipped new regression.
- Browser test proves no 375/390px horizontal overflow for available deterministic states.
- Connected sandbox UAT proves add/edit/default/delete survive reload.
- Test names reference valid F36 TC IDs and import production logic.
