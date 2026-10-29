# Phase 01 — Implementation

Priority: High | Status: pending

## File ownership
- `src/collections/Users.ts` (send-otp 429 L884-893 only)
- `src/app/(auth)/login/page.tsx`
- `src/lib/auth/login-error-mapper.ts` (new)
- `src/i18n/locales/en.json`, `ms.json` (`auth.errors`, `auth` OTP keys ~L3426-3436)

## Steps
1. **(dropped)** No change to Users.ts login catch — stays `401 Login failed`.
2. **Users.ts send-otp**: compute `retryAfter = Math.ceil((cooldownEnd - Date.now())/1000)`; respond `{errors:[{message:'Please wait before requesting a new code.', code:'OTP_COOLDOWN', retryAfter}]}`, 429, header `Retry-After`. Keep message text (existing test asserts `toContain('Please wait before requesting')`).
3. **login-error-mapper.ts** (pure, no React): 
   - `parseOtpSendFailure(status, body) → {kind:'cooldown', retryAfter} | {kind:'failed'}`.
   - `seedOtpTimers(retryAfter)` writes the two sessionStorage keys (formula in plan.md).
4. **login/page.tsx**: leave login-error if/else (L219-233) as is. Replace L262-266: cooldown → seed timers, info toast, `router.replace('/verify-otp?...')` (reuse existing `returnParam` build — move that computation above the send-otp block); failed → new `otpSendFailed` toast; catch keeps `connection`.
5. **i18n** (en + ms): `auth.otpAlreadySentTitle/Desc`, `auth.errors.otpSendFailed`; change `auth.errors.incorrect` to the neutral text in plan.md. Keep key names stable.
6. Run `npx tsc --noEmit` + lint on touched files.

## Todo
- [ ] BE send-otp code+retryAfter
- [ ] mapper module
- [ ] login page wiring
- [ ] i18n en/ms
- [ ] tsc + lint

## Risks
- `auth.errors.incorrect` may be reused elsewhere → grep before editing copy.
- Redirecting on cooldown with stale timers → wrong countdown; mitigated by seeding.
