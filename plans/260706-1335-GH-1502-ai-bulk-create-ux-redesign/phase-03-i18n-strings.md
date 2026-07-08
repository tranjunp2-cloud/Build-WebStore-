# Phase 03 — i18n keys (EN + MS)

## Context Links
- Scout §i18n
- `src/i18n/locales/en.json` L1458-1460 (`aiChatTitle/Placeholder/Btn`), `bulkCreate` block L1689+
- `src/i18n/locales/ms.json` L1458-1460 (parity)
- Note: app locales are **English + Malay** (NOT Vietnamese) — tooltip/pill copy must be EN + MS.

## Overview
- **Priority:** High (blocks UI phases — typecheck fails if UI references missing keys)
- **Status:** completed
- Add/rename keys under `dashboard.products.list`. No code, JSON only. Runs before Phase 04/05.

## Key Insights
- The `t` object is typed from the locale dictionary; referencing a non-existent key fails `typecheck`. So keys land before the components that use them.
- Keep flat discrete keys (`aiChatSuggestion1/2/3`) rather than a JSON array — matches existing flat sibling keys and avoids array-typing surprises in the i18n type. KISS.
- Maintain strict EN/MS key parity (both files get identical key sets).
- Suggestion pills must include realistic RM prices per the issue.

## Requirements
- Rename button label `aiChatBtn`: "Create" → "Generate Drafts" (EN); MS "Cipta" → "Jana Draf".
- Update `aiChatPlaceholder` to hint multi-line multi-product entry.
- Add 3 suggestion-pill strings (EN + MS) with RM examples.
- Add tooltip string for the AI-review dot (EN + MS).

## Related Code Files
- **Modify** `src/i18n/locales/en.json`
- **Modify** `src/i18n/locales/ms.json`

## Proposed keys (under `dashboard.products.list`)
| Key | EN | MS |
|-----|----|----|
| `aiChatBtn` (rename) | `Generate Drafts` | `Jana Draf` |
| `aiChatPlaceholder` (update) | `List several products, one per line — e.g. Leather jacket RM250, Cotton cap RM39` | `Senaraikan beberapa produk, satu setiap baris — cth: Jaket kulit RM250, Topi kapas RM39` |
| `aiChatHint` (new, optional helper under textarea) | `Press ⌘/Ctrl + Enter to generate` | `Tekan ⌘/Ctrl + Enter untuk menjana` |
| `aiChatSuggestion1` | `Leather jacket RM250, cotton cap RM39, canvas tote RM59` | `Jaket kulit RM250, topi kapas RM39, beg tote kanvas RM59` |
| `aiChatSuggestion2` | `Polo shirt RM89 in red and blue, size S M L` | `Baju polo RM89 warna merah dan biru, saiz S M L` |
| `aiChatSuggestion3` | `Sneakers RM199 size 39 40 41, sports socks RM19` | `Kasut sneakers RM199 saiz 39 40 41, stokin sukan RM19` |
| `aiChatSuggestionsLabel` (new, a11y/section label) | `Try an example:` | `Cuba contoh:` |
| `aiReviewTooltip` (new, dot tooltip) | `Created by AI — needs review` | `Dicipta oleh AI — perlu semakan` |
| `aiReviewAriaLabel` (new, dot trigger aria-label) | `AI-created draft pending review` | `Draf ciptaan AI menunggu semakan` |

> Final wording is a suggestion; keep values consistent between the two locales. Do NOT change the `bulkCreate.*` block (already full parity).

## Implementation Steps
1. Edit `en.json` `dashboard.products.list`: rename `aiChatBtn`, update `aiChatPlaceholder`, add the 6 new keys.
2. Mirror identically (translated) in `ms.json`.
3. `npm run typecheck` — confirms the generated i18n type now includes the new keys and both locales are in parity (build fails on missing key in either file).

## Todo List
- [x] EN: rename `aiChatBtn`, update `aiChatPlaceholder`, add 6 new keys
- [x] MS: same key set, Malay values
- [x] typecheck passes (parity enforced)

## Success Criteria
- No hardcoded UI strings needed in Phase 04/05 — every new visible string resolves to a key present in both locales.
- `typecheck` green.

## Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Key present in EN but missing in MS (or vice-versa) | Med | Med | Add to both in same edit; typecheck/parity check catches it |
| JSON syntax error (trailing comma) | Low | Low | Lint/typecheck; edit carefully |
| Wrong language (VI instead of MS) | Low | Med | Locales are EN+MS only — double-check ms.json |

## Security Considerations
- Static copy only; no interpolation of user data. Nothing to sanitize.

## Next Steps
- Unblocks Phase 04 (banner) and Phase 05 (tooltip) which reference these keys.
