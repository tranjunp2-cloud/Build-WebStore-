# Phase 02 — Tests & QA docs

Priority: High | Status: pending | Depends on: phase 01

## TC-IDs (add to `docs/qa/F02-auth.md` §3.3, after TC-F02.43)
- **TC-F02.44** `Func` — Login đúng trong 60s sau lần gửi OTP trước → sang `/verify-otp`, không báo "Connection problem", countdown resend đúng.
- **TC-F02.45** `Func` — Sai MK 5 lần rồi nhập đúng → thông báo trung tính có nhắc khả năng khóa tạm 15 phút + gợi ý đặt lại mật khẩu; API vẫn 401 `Login failed`.
- **TC-F02.46** `Reg` — Sai MK < 5 lần vẫn báo "Incorrect email or password" (401 `Login failed`).

## Tests (AAA, top-level `vi.mock`, import from source)
1. `src/__tests__/api/users-login.test.ts` — no behavior change; tag existing 401 test with TC-F02.45/46.
2. `src/__tests__/unit/auth/otp-verification.test.ts` — extend cooldown test: body has `code:'OTP_COOLDOWN'`, `retryAfter` within 1..60 (use fake timers), `Retry-After` header (TC-F02.44).
3. `src/__tests__/unit/auth/login-error-mapper.test.ts` (new) — `parseOtpSendFailure` 429+code vs 429 without code vs 500; `seedOtpTimers` sets keys (TC-F02.44).
4. Optional: login page component test (pattern: `sso-authorization-page.test.tsx`) for redirect on cooldown — only if cheap.

## Docs (docs-manager)
- `docs/qa/F02-auth.md`: add TCs + update coverage table.
- `docs/CHANGELOG.md`: fix entry. `docs/architecture/F02*.md`: note new error codes if file exists.
- Docs impact: minor.

## Verify
`npx vitest run src/__tests__/api/users-login.test.ts src/__tests__/unit/auth` then `npm test`; `npx tsc --noEmit`; manual on dev: reproduce Case A (login twice <60s) and B (5 wrong → correct) per issue steps. Then code-reviewer → git-manager (PR to `staging`).

## Todo
- [ ] TC-IDs in QA doc
- [ ] otp-verification + mapper tests (login test only tagged)
- [ ] full suite green
- [ ] changelog
