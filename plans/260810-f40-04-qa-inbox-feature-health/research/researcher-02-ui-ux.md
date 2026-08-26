# Researcher 02 — UI/UX and test surface

## Sources

- GitHub issue #1743, `[US-F40-04] QA Inbox and Feature Health Detail`.
- `docs/design/qa-control-center-ux.md` §§2, 4–7, 9.
- Existing `/studio/qa` page and `ProjectHealthClient`.

## Findings

1. QA Inbox is the landing surface and must order `Critical`, `Needs attention`, `Watch`, then `Unknown`, before history.
2. Each item needs target, concrete reason, latest evidence, and a next action; a blank panel or static/demo records is unacceptable.
3. Feature detail must make the failed scenario, fixture, expected/actual, PR/SHA, classification, and approved evidence inspectable without colour-only meaning.
4. Desktop has a dense list/detail layout; at 375px use a stacked card/detail flow, 44px touch targets, no horizontal overflow, and filters in a bottom sheet.
5. Loading/error/empty states must explain the condition. `Unknown`, expired evidence, missing coverage, and manual-pending never look Healthy.
6. Keyboard users need labelled controls; dialogs/drawers must trap focus, close on Escape, and return focus to their trigger. Dynamic status uses polite announcements.
7. Visual comparison must show baseline/current/diff plus threshold and wait for tester confirmation; F40-05 owns any GitHub issue creation.

## Test implications

- Add real-browser Playwright coverage mapped to F40 TC-IDs for priority, detail/evidence, unknown states, mobile, and keyboard flow.
- Test data must be persisted/seeded through approved QA contracts, not mocked client UI.

## Unresolved question

The design contains `Retest smoke`, but issue #1743 cannot truthfully complete that action until the F40-07 manual dispatch contract and unmerged F40-03 dependency are available.
