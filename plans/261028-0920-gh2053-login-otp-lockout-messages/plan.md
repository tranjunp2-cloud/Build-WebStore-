---
title: "GH-2053 login wrong message on OTP cooldown + account lockout"
issue: https://github.com/primeproduction/ech-prime-web-v2/issues/2053
branch: fix/F02-2053-login-otp-lockout-messages (base: staging)
status: pending
priority: P1
---

# GH-2053 — Login: wrong message on OTP cooldown & lockout

## Root cause (verified in code)

| Case | Root cause | Location |
|---|---|---|
| A (429 → "Connection problem") | FE treats every `!otpRes.ok` as network error. BE 429 has no machine-readable code / retry time. | `src/app/(auth)/login/page.tsx` ~L262-266; `src/collections/Users.ts:884-893` |
| B (locked → "Incorrect password") | **Our own** custom `/api/users/login` endpoint swallows every error from `payload.login` into `401 "Login failed"`. FE's `accountLocked` branch (matches Payload's raw lock message) can never fire. NOT (only) a Payload 3.79 change. | `Users.ts:313-316` (catch-all); `login/page.tsx:227-232` |

Pre-existing, unused: i18n `auth.errors.accountLocked` (en/ms L3426), FE `rootErrorMsg` case + `?error=accountLocked` toast.

## Approach (KISS) — decisions locked by user
Q1 ~~neutral message~~ → revised to explicit lock message · Q2 redirect to `/verify-otp` · Q3 no remaining-attempts warning (dropped).

1. **Case B (REVISED after user test): explicit lock message.** Neutral copy showed "locked" even on 1st wrong attempt → rejected. Login catch calls `isAccountLocked()` (find user, `showHiddenFields`, `lockUntil > now`) → `423 {code:'ACCOUNT_LOCKED'}`; wrong password stays `401 Login failed`. FE maps 423/code → `accountLocked` (approved GH-1701 copy, unchanged), no password refocus. `incorrect` copy restored. Trade-off accepted: lock state of an existing email is revealed only after 5 failures (Payload default).
2. **Case A BE** (`Users.ts` send-otp 429): add `code:'OTP_COOLDOWN'` + `retryAfter` (sec, ceil) + `Retry-After` header. Keep message text.
3. **Case A FE**: extract `src/lib/auth/login-error-mapper.ts` (`parseOtpSendFailure`, `seedOtpTimers`).
   - cooldown → seed `sessionStorage`: `otp_resend_end = now + retryAfter*1000`, `otp_expiry_end = now + (retryAfter + 240)*1000` (cooldownEnd = expiry − 4 min); do NOT clear them; info toast (new i18n `otpAlreadySent*`); `router.replace('/verify-otp?...')`.
   - other non-ok → new `otpSendFailed` toast; `connection` only for thrown network errors.
4. **i18n** en + ms. 5. **Tests + QA doc** (phase 02).

## Out of scope
- Remaining-attempts warning (dropped: needs BE to expose per-account state → enumeration/brute-force signal; neutral copy already covers it).
- `verify-otp/page.tsx:187` raw English message on resend 429 (follow-up, can reuse `OTP_COOLDOWN`).

## Open question
- Confirm `accountLocked` copy with PO/QC.
- Cooldown fix: send-otp cooldown now `expiry − OTP_TTL_MS + 60s` (was hard-coded 4 min → 26 min cooldown in dev, SEC-19).

## Phases
- [phase-01-implementation.md](phase-01-implementation.md) — BE + FE + i18n
- [phase-02-tests-and-qa-docs.md](phase-02-tests-and-qa-docs.md) — unit tests, TC-IDs, docs

## Constraints
No schema change → no `db-setup.js` migration. No env vars. Branch → PR to `staging`, `Relates to #2053` (never `Closes`). Commit: `fix(auth): show correct login message on otp cooldown and account lockout`. User reviews diff before commit.
