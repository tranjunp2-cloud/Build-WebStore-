# Phase 02 — Tests, QA, docs

**Priority:** P1 · **Status:** done · **Depends on:** phase 01

## Files
- **Create** `src/__tests__/unit/auth/clear-login-lock-on-password-change.test.ts`
- **Modify** `docs/qa/F02-auth.md` (new TCs after TC-F02.48), `docs/CHANGELOG.md`, `docs/architecture/F02-auth.md` (one line under Users hooks)

## Unit tests (import from source, AAA, `vi.mock` top-level)
| TC | Case | Expect |
|---|---|---|
| TC-F02.49 | beforeChange, `update` + `password: 'NewPass1!'` | returns data + `loginAttempts: 0`, `lockUntil: null`; other fields kept |
| TC-F02.50 | beforeChange, `update` without password / empty string; `create` with password | data returned unchanged |
| TC-F02.51 | afterOperation `resetPassword` with `result.user.id` | `db.updateOne` called once with `{ id, data: { loginAttempts: 0, lockUntil: null } }`; returns same `result` |
| TC-F02.52 | afterOperation other ops (`login`, `update`, `forgotPassword`) or no user id | `db.updateOne` not called |
| TC-F02.53 | afterOperation, `db.updateOne` rejects | logger.error called, `result` still returned (reset not failed) |
| TC-F02.54 | Wiring | `Users.hooks.beforeChange` includes `clearLoginLockOnPasswordUpdate`; `afterOperation` includes `clearLoginLockAfterPasswordReset` |

Regression: rerun `users-login.test.ts`, `login-page-otp-lockout.test.tsx`, `otp-verification.test.ts`, then full `npm test`.

## Manual QA (local dev DB, before PR) — add as Func TCs in QA doc
| TC | Steps | Expect |
|---|---|---|
| TC-F02.55 | 5 wrong passwords → see new copy → Forgot password → open email link → set new password → login with new password | No 423; goes to OTP step. `psql`: `lock_until IS NULL`, `login_attempts = 0` |
| TC-F02.56 | Lock account → super-admin `PUT /api/v1/sso/reset-password` → login with new password | Login OK immediately |
| TC-F02.57 | Lock account → reset with expired/invalid token | 403 "link expired"; account still locked |
| TC-F02.58 | Locked → wait — (no reset) | Still locked until 15 min (behaviour unchanged) |

psql check: `SELECT email, login_attempts, lock_until FROM users WHERE email = '<test email>';`

## Docs
- QA doc: TC-F02.49–58 rows, link GH-2053.
- CHANGELOG: "fix(auth): lockout copy updated; password reset now unlocks the account immediately (GH-2053)".
- Architecture F02: note both hooks + why (Payload reset does not clear lock).

## Todo
- [x] Unit test file (TC-F02.49–54) green
- [x] Full `npm test` green
- [x] Manual QA on local DB via real Payload script (A: update, B: email reset, C: bad token, N: non-password update) — all pass; browser run of TC-F02.55–58 left to QC
- [x] QA doc + CHANGELOG + architecture line
- [x] code-reviewer pass (report only) — no blockers; 3 low fixes applied (stories copy, req assertion, AAA)
- [ ] User reviews diff → commit `fix(auth): unlock account after password reset` → PR to `staging`, `Relates to #2053`

## Success criteria
All TCs pass; no change to wrong-password (401) / locked (423) responses; reviewer has no critical findings.
