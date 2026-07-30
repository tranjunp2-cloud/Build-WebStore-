# Phase 2 — Harden Editor Phone Behavior

## Goal

Reuse the existing editor/save flow and close only the AC3 gap: invalid phone input must visibly revert and never save.

Effort: 2h. Status: Completed (2026-07-27).

## Design

Place `isValidBusinessPhone(value)` in the existing client-safe `src/lib/seo/local-business-constants.ts` module. Reuse it in both `SettingsPanel.tsx` and the Zod refinement in `src/lib/validations/sites.ts`.

Rules:

- trim before checking;
- empty is valid so the field can be cleared;
- non-empty must contain at least one digit;
- an optional `+` is allowed only at the start, followed by digits, ASCII spaces, hyphens, parentheses, and dots; embedded tabs/newlines are invalid.

```text
contact field blur
├─ phone invalid → toast → restore server-confirmed phone → return, no request
└─ valid field → normalize → sparse field PATCH
   ├─ component guard → disable sibling contact inputs in the mounted panel
   ├─ parent mutex → reject overlap across panel rerenders/remounts
   ├─ success → merge only that field into parent state
   └─ failure → restore that server-confirmed field; parent state unchanged
```

## Changes

| Status | File | Change |
|---|---|---|
| [x] | `src/lib/seo/local-business-constants.ts` | Added the dependency-free shared predicate, including ASCII-space-only formatting |
| [x] | `src/lib/validations/sites.ts` | Replaced the duplicated server regex with the shared predicate |
| [x] | `src/components/editor/SettingsPanel.tsx` | Added one sparse transactional lifecycle for phone/email/address, canonicalized email/address before save, restored each confirmed value on failure, consumed the parent pending flag across remounts, added stable selectors, and persisted normalized legacy country on structured-address edits |
| [x] | `src/components/editor/CompactEditorLayout.tsx` | Propagated the parent-owned contact pending flag to compact `SettingsPanel` mounts |
| [x] | `src/app/(editor)/editor/[siteId]/page.tsx` | Added a parent-owned contact mutex, standalone contact patches, owner-safe release, and commit-after-success behavior for all contact fields so the guard survives panel rerenders/remounts and synchronous setup failures |
| [x] | `src/__tests__/unit/lib/validations/misc-validations.test.ts` | Covered valid, empty, misplaced-plus, alphabetic, mixed, punctuation-only, tab/newline, and raw-markup values before sanitization; retained trimmed output for accepted values |
| [x] | `src/__tests__/unit/editor/settings-panel.test.tsx` | Covered sparse contact payloads, canonical email/address values, legacy-invalid sibling isolation, pending guards, and phone/email/address restoration |
| [x] | Compact layout regression suites | Updated required-prop fixtures and directly covered compact pending propagation |
| [x] | `src/__tests__/unit/editor/publish-flow.test.tsx` | Covered failed phone/email parent-state isolation, later-save isolation, and parent mutex behavior across rerenders |

When any structured-address edit is saved, retain existing values and persist `country: siteLocalBusiness.country?.trim() || 'MY'` so missing and whitespace-only legacy values do not merely display an unpersisted default.

## Guardrails

- Server validation remains authoritative.
- Do not import Zod or another server-oriented module into the client bundle.
- Do not change `Sites.ts`, the save route, or `db-setup.js`.
- Do not redesign the general autosave/concurrency model; serialization is scoped to the contact group in one editor instance.
- Existing unrelated settings retain optimistic behavior. Contact fields commit only after `response.ok`, so failure cannot contaminate parent state or a later contact payload.
- Cross-tab/multi-user conflict resolution remains a broader pre-existing architecture concern and is not claimed here.
- Do not treat client request timeout as a failed mutation. A later narrow follow-up performs one authoritative `/editor-data` re-read after an asynchronous contact PATCH transport rejection and accepts success only when every attempted field matches. If the outcome remains unknown, contact fields stay locked until reload; timeout/CAS conflict handling remains outside scope.
- Browser AC3 coverage must still start from a value confirmed by save response plus reload; component/integration regressions are not browser persistence proof.

## Exit Criteria

- [x] Invalid phone displays feedback, restores the prior rendered valid value immediately, and returns before the save request.
- [x] Phone/email/address send sparse field payloads and enter parent state only after success.
- [x] Email/address use the server-equivalent canonical value for validation, request payload, rendered input, and committed parent state.
- [x] While a contact save is pending, sibling contact saves are guarded in the panel and rejected by a parent mutex across rerenders/remounts.
- [x] A failed contact save restores the confirmed field, does not enter parent state, and cannot be persisted by a later contact save.
- [x] The next address edit persists the default country for legacy data.
- [x] Client and server validation reuse the same predicate.
- [x] Targeted validation and regression tests pass, and there is no schema/migration diff.

## Completion Evidence

- Targeted validation and regression suites: 131/131 tests passed (`misc-validations` 50 + `SettingsPanel` 30 + `publish-flow` 13 + score 15 + compact layout 23).
- `npm run typecheck`: passed.
- `npm run lint`: passed with warnings only and no errors.
- `npm run build`: passed; Next.js compiled and generated all 113 pages.
- `git diff --check`: passed.
- No Payload collection, schema, migration, save-route, or runtime score change is present.

The browser-level proof of a confirmed persisted phone after reload, followed by invalid input with no PATCH and immediate restore, remains Phase 3 work. The 131/131 gate contains component and parent-integration regressions, not a real-browser E2E acceptance claim.
