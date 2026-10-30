# Phase 01 — Implementation

**Priority:** P1 · **Status:** done · **Effort:** ~1h

## Context
- `src/collections/Users.ts` L185-190 (`auth.maxLoginAttempts=5`, `lockTime=15min`), L255-259 (`hooks`), L168 `isAccountLocked()` (423 on lock, GH-2053)
- Payload 3.79.0: `auth/operations/resetPassword.js` (hook order: beforeOperation → beforeValidate → db.updateOne → beforeLogin/afterLogin → commit → **afterOperation**), `collections/operations/utilities/update.js` (beforeChange collection hook runs before password hash; result written in one `db.updateOne`)
- Payload auth fields `loginAttempts` (number, hidden), `lockUntil` (date, hidden) — no field access, so hook data is persisted.

## Files
- **Create** `src/lib/auth/clear-login-lock-on-password-change.ts`
- **Modify** `src/collections/Users.ts` (hooks registration + comment on `lockTime`)
- Already modified (keep): `src/i18n/locales/en.json`, `src/i18n/locales/ms.json`, `docs/qa/F02-auth.md` (TC-F02.45 text)

## Steps
1. New module, two exports:
   ```ts
   /** Clears Payload's login lock whenever a password is set via payload.update (SSO reset, Profile, admin). */
   export const clearLoginLockOnPasswordUpdate: CollectionBeforeChangeHook = ({ data, operation }) => {
       if (operation !== 'update' || typeof data?.password !== 'string' || !data.password) return data
       return { ...data, loginAttempts: 0, lockUntil: null }
   }

   /** Payload's reset-password op neither runs beforeChange nor clears the lock — do it after a successful reset. */
   export const clearLoginLockAfterPasswordReset: CollectionAfterOperationHook = async ({ operation, result, req, collection }) => {
       if (operation !== 'resetPassword') return result
       const id = result?.user?.id
       if (id == null) return result
       try {
           await req.payload.db.updateOne({ collection: collection.slug, id, data: { loginAttempts: 0, lockUntil: null }, req, returning: false })
       } catch (err) {
           req.payload.logger.error({ err, userId: id }, '[auth] clear login lock after password reset failed')
       }
       return result
   }
   ```
   (Exact types: check `CollectionAfterOperationHook` generic narrows `result` for `resetPassword`; cast minimally if needed.)
2. `Users.ts` hooks:
   ```ts
   beforeChange: [setAuditFields, clearLoginLockOnPasswordUpdate],
   afterOperation: [clearLoginLockAfterPasswordReset],
   ```
3. Comment on `lockTime`: `// 15 min — keep in sync with i18n auth.errors.accountLocked copy`.
4. `npx tsc --noEmit` (or project typecheck script) + `npm run lint` on touched files.

## Todo
- [x] Create hooks module (<60 lines, JSDoc)
- [x] Register hooks in Users.ts
- [x] lockTime ↔ copy comment
- [x] Typecheck + lint clean

## Success criteria
- Locked user resets via email → logs in with new password immediately (gets OTP step, no 423).
- SSO reset of locked user → login works immediately.
- Update without `password` (e.g. profile name) → `loginAttempts`/`lockUntil` untouched.
- Invalid/expired reset token → still 403, lock untouched.

## Risks
| Risk | Mitigation |
|---|---|
| Hidden auth fields dropped by field-level beforeChange | Verify in phase 02 manual QA via psql (`lock_until` becomes NULL) |
| afterOperation runs after commit → separate write | Acceptable: idempotent; failure only logs, user falls back to 15-min wait |
| Brute force via reset | Reset requires email-token (proves inbox ownership); SSO needs super-admin; Profile needs current password. Industry-standard to unlock on reset. |
| `payload.update` with password from migration scripts | Migration writers use `db.create` with `loginAttempts: 0` — unaffected |

## Security
No new endpoint, no new input. Unlock only after an already-authorized password change.
