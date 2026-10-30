---
title: "GH-2053 follow-up — new lockout copy + unlock account after password change"
issue: https://github.com/primeproduction/ech-prime-web-v2/issues/2053
branch: fix/F02-2053-unlock-on-password-reset (base: staging)
status: done (pending commit)
priority: P1
---

# GH-2053 follow-up — lockout copy + unlock on password change

## Problem (verified)
- New copy (already applied in working tree, not committed): "Too many unsuccessful sign-in attempts. Please try again in 15 minutes or reset your password."
- Copy promises "reset your password" as a way out, but **reset does not unlock**. User resets → redirected to `/login` → new password → still `423 ACCOUNT_LOCKED` until 15 min pass.
- Root cause — Payload 3.79.0 source (read from `npm pack payload@3.79.0`):
  - `auth/operations/resetPassword.js`: sets `hash/salt/resetPasswordExpiration` only, never touches `lockUntil` / `loginAttempts`.
  - `collections/operations/utilities/update.js` (`payload.update({ password })`, used by SSO reset, Profile change-password, admin panel): same, no unlock.
  - Lock cleared only by `resetLoginAttempts` on successful login → but login checks lock first (`checkLoginPermission`) → deadlock until `lockUntil` expires.

## Affected paths
| Path | Mechanism | Unlocks today? |
|---|---|---|
| Forgot password → email → `/reset-password` | Payload `resetPassword` op (`/api/users/reset-password`) | ❌ |
| SSO reset `PUT /api/v1/sso/reset-password` (super-admin) | `payload.update({ password })` | ❌ |
| Profile `POST /api/users/me/password` | `payload.update({ password })` | ❌ (user logged in, low impact) |
| Admin panel edits password | `payload.update` | ❌ |

## Approach (KISS — 2 collection hooks, no schema change)
1. `beforeChange` hook: `operation === 'update'` and non-empty `data.password` → add `loginAttempts: 0, lockUntil: null` to the same write. Covers SSO / Profile / admin panel in one atomic `updateOne`.
2. `afterOperation` hook: `operation === 'resetPassword'` and `result.user.id` → `payload.db.updateOne({ lockUntil: null, loginAttempts: 0 })`. Runs only after a **successful** reset (invalid/expired token throws before). Failure is logged, never fails the reset (password already changed; worst case = old 15-min wait).
3. Both hooks in new module `src/lib/auth/clear-login-lock-on-password-change.ts` (Users.ts is 1406 lines — don't grow it); Users.ts only registers them.

Rejected: `beforeValidate` in reset (same hook also fires for normal updates with partial data → ambiguous); `beforeOperation` on reset (runs before token validation → would unlock on a bad token); custom reset endpoint (more code, duplicates Payload).

## Phases
- [phase-01-implementation.md](phase-01-implementation.md) — hooks module + register in Users.ts
- [phase-02-tests-qa-docs.md](phase-02-tests-qa-docs.md) — unit tests, manual QA on local DB, QA doc + CHANGELOG

## Constraints
- No schema change (`login_attempts`, `lock_until` exist) → no `db-setup.js` migration. No env vars.
- 1 branch / 1 PR to `staging`, `Relates to #2053` (never `Closes`). Commit: `fix(auth): unlock account after password reset`. Includes the copy change.
- User reviews diff before any commit.

## Unresolved questions
1. Also unlock on Profile/admin-panel password change? Plan says yes (same hook, no extra cost). Confirm.
2. Malay copy ("Terlalu banyak percubaan log masuk yang tidak berjaya. Sila cuba lagi dalam 15 minit atau tetapkan semula kata laluan anda.") — PO/QC confirm.
3. "15 minutes" is hard-coded in copy; `lockTime` in Users.ts is the source. Add a comment linking both — enough? (Plan: yes.)
