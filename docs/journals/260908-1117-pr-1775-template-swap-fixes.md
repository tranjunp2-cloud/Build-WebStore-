# PR 1775 — Issue 191 scope and verification

## Scope

US-F07-05: apply a template while preserving equivalent user text, images and translations; omit unmatched sections with notice and recovery; roll back failed swaps; render the new template promptly.

Retained changes:
- Content mapping preserves block identity, explicit empty values, media and canonical translations.
- Optimistic and committed snapshots use the same theme and preserve renderable media.
- Existing editor history includes canonical blocks and locale content for recovery.
- Apply and Save share transaction locks to prevent interleaved writes; the editor waits for a stable saved draft before swapping.
- Template picker loading/error/retry/mobile states and regression tests support this flow.

## Removed from this PR

Quota concurrency and its DB index migration/tests, new-site gallery and creation refactors, shared validation/save response refactors, global AppShell provider, connectivity/toolbar hydration fixes, generic save-success timer cleanup, editor-data concurrency optimization, and template usage-count/diagnostic refactors are outside the retained scope.

The user also requested removal of QA screenshots and changes to environment examples and Playwright projects. QueryProvider is scoped to the editor. Touch-visible template actions are opt-in for the editor picker; public gallery behavior remains unchanged.

## Verification

Before the latest hunk-level cleanup, the reduced implementation passed 12,190 tests (seven skipped), typecheck, lint and production build. Build logged a non-fatal local Postgres connection refusal, so it does not verify live database behavior.

Earlier scoped Chrome QA used isolated site 3655/page 23317 and a real uploaded image. With Apply held for five seconds, the new snapshot rendered in 179 ms; Hero image and navigation logo remained visible while pending, after success and after reload. The computed palette did not change when the response arrived. These results predate the final scope cleanup and are not a fresh UI test of it.

See the [UI retest report](../../plans/reports/260909-pr1775-ui-retest.md) for earlier invalid-target, translation and slow-API observations. Full 10+ swaps and Chrome/Safari/Edge latest-two-version acceptance remain unverified.

## Next steps

Final hunk-level cleanup: 12,192 tests passed, seven skipped, zero failures; typecheck and lint passed (existing warnings). Production build exited 0 with 112/112 pages generated, with the same non-fatal local Postgres connection refusal noted above.

The retained acceptance spec now lives at `e2e/gh-191-template-swap.spec.ts` so the existing chromium project discovers it without modifying Playwright configuration. `npx playwright test e2e/gh-191-template-swap.spec.ts --project=chromium --list` passed. Its explicit opt-in fixture gate remains; discovery is not execution.

No fresh browser QA or claim of full issue DoD/cross-browser sign-off for this cleanup. No commit or push performed.
