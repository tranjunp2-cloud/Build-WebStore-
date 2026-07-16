# Phase 02 — Frontend error handling + i18n + parse test

## Context Links
- Plan: [plan.md](./plan.md) · GH-1599
- Source: `src/components/dashboard/BulkCreateModal.tsx` — `handleParse` (:240-310), catch (:299-305), throw (:251); reuse `isSkuConflictError` JSON-message pattern (:94-103) and the SKU retry `JSON.parse(err.message)` (:388-392)
- i18n: `src/i18n/locales/en.json` / `ms.json` — `dashboard.products.bulkCreate` block (:1939-1976). Placeholder convention `.replace('{count}', …)` (saveSuccessMany :1973)
- Test pattern: `src/__tests__/unit/dashboard/bulk-create-save.test.tsx` (mock setup :9-55)

## Overview
- Priority: P1 · Status: completed
- Carry `resetAt` through the thrown Error and render a minutes-until-reset toast for the `rateLimitExceeded` code; add both-locale i18n; add a focused handleParse test.

## Key Insights
- **Critical trap:** current catch matches `errBase.message === 'aiQuotaExceeded'`/`'aiTimeout'`. If the throw becomes `JSON.stringify(data)`, those literal-equality branches silently break. Fix = refactor catch to parse the message ONCE into `{error, resetAt}`, then switch on `parsed.error`. Falls back to raw `message` as the code when it isn't JSON (backwards-compat / defensive) — mirrors the try/catch around `JSON.parse` already used at :388-392.
- Reuse existing convention (`throw new Error(JSON.stringify(data))`) — DRY, no new mechanism.
- Minutes = `Math.max(1, Math.ceil((resetAt - Date.now()) / 60000))` so it never shows "0 min"/negative on clock skew.

## Requirements
Functional:
1. On `!res.ok`: `throw new Error(JSON.stringify(data))` (replaces `throw new Error(data.error || 'parseError')`).
2. Catch parses once → `code`, `resetAt`. Branches: `rateLimitExceeded` → countdown toast; `aiQuotaExceeded`; `aiTimeout`; else `parseError`. Keep existing fallback English strings.
3. New i18n key `dashboard.products.bulkCreate.rateLimitExceeded` with `{minutes}` in `en` + `ms`.

Non-functional: keep file diff minimal; no behavior change to the success path or `handleSave`.

## Architecture
Data flow: fetch → non-ok → `throw new Error(JSON.stringify({error, resetAt}))` → catch:
`parsed = safeJsonParse(err.message)`; `code = parsed?.error ?? err.message`; if `code==='rateLimitExceeded'`
compute `minutes` from `parsed.resetAt`, `errMsg = t…rateLimitExceeded.replace('{minutes}', minutes)`;
else map aiQuotaExceeded/aiTimeout/parseError as today → `toast.error(errMsg)`.

## Related Code Files
- Modify: `src/components/dashboard/BulkCreateModal.tsx` (handleParse throw + catch only)
- Modify: `src/i18n/locales/en.json`, `src/i18n/locales/ms.json`
- Create: `src/__tests__/unit/dashboard/bulk-create-parse.test.tsx`

## Implementation Steps
1. BulkCreateModal.tsx:251 — `if (!res.ok) throw new Error(JSON.stringify(data))`.
2. Replace catch (:299-305): parse `err.message` in a try/catch → `parsed`; `const code = parsed?.error ?? errBase.message`.
   - `rateLimitExceeded`: `const mins = Math.max(1, Math.ceil(((parsed?.resetAt ?? Date.now()) - Date.now())/60000)); errMsg = (t…rateLimitExceeded || 'You've used all your AI generation attempts this hour. Try again in {minutes} min.').replace('{minutes}', String(mins))`.
   - `aiQuotaExceeded` / `aiTimeout`: same mapping as today, but keyed off `code` not raw message.
   - default: existing `parseError`.
3. en.json:1951 (after `aiTimeout`) — add `"rateLimitExceeded": "You've used all your AI generation attempts this hour. Try again in {minutes} min."`.
4. ms.json:1951 — add `"rateLimitExceeded": "Anda telah menggunakan semua percubaan penjanaan AI untuk jam ini. Cuba lagi dalam {minutes} minit."`.
5. New test `bulk-create-parse.test.tsx` (copy mock scaffold from bulk-create-save.test.tsx):
   - Mock `global.fetch` → `{ ok:false, status:429, json: async () => ({error:'rateLimitExceeded', resetAt: Date.now()+300000}) }`.
   - Provide `useI18n` mock `t` containing the real `rateLimitExceeded` string (import from `en.json` — do NOT hardcode a copy).
   - Render modal with `initialPrompt` to auto-trigger handleParse; `await waitFor` → assert `mockToastError` called with a string containing "5 min" (matches the computed minutes).
   - Second case: fetch returns `{ok:false,status:500,json:()=>({error:'aiQuotaExceeded'})}` → assert aiQuotaExceeded toast still fires (regression guard for the JSON-throw refactor).
6. Typecheck + `npm test`.

## Todo List
- [x] handleParse throw → `JSON.stringify(data)`
- [x] Refactor catch: parse once, switch on `code`, add rateLimitExceeded branch w/ minutes
- [x] en.json + ms.json `rateLimitExceeded` key
- [x] New bulk-create-parse test: 429 countdown toast + aiQuotaExceeded regression
- [x] Typecheck + tests green

## Success Criteria
- 429 → toast reads "…Try again in 5 min." (computed, not literal).
- aiQuotaExceeded / aiTimeout / parseError toasts unchanged.
- Both locales resolve `rateLimitExceeded`; test imports real i18n string (no reimplementation).

## Risk Assessment
| Risk | L×I | Mitigation |
|------|-----|-----------|
| JSON-throw refactor breaks aiQuotaExceeded/aiTimeout branches | **High**×High | Parse-once + switch on `parsed.error ?? message`; explicit regression test (step 5 case 2). |
| `err.message` not JSON (network error, thrown string) | Med×Med | try/catch around JSON.parse, fall back to `errBase.message` as code (existing convention at :388-392). |
| Negative/zero minutes on clock skew or expired resetAt | Med×Low | `Math.max(1, …)` clamp. |
| ms translation wording review | Low×Low | Provided; flag for PM/locale reviewer in PR. |

## Security Considerations
- No secrets/PII in toast; minutes derived from server `resetAt` only. Toast text passes through i18n, not raw server string → no injection of unescaped server content.

## Next Steps
- After both phases: tester → code-reviewer → docs (CHANGELOG entry for GH-1599) → git-manager PR to `staging`.
