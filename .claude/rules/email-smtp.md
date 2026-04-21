---
name: email-smtp
description: Email/SMTP via AWS SES — Payload sendEmail pattern, custom utility, fallback to stream transport
paths:
  - "src/lib/email/**"
  - "src/payload.config.ts"
---

# Email / SMTP

- SMTP via AWS SES — configured in `src/payload.config.ts` using `MAIL_*` env vars (see `.claude/rules/env-vars.md` for secret list)
- If `MAIL_HOST` env is not set → Payload uses stream transport (logs to console, no crash). Safe dev fallback.
- OTP + welcome email use `payload.sendEmail()` with fire-and-forget `.catch()` pattern
- Custom `sendEmail()` utility at `src/lib/email/send.ts` also uses Payload SMTP

## Patterns

**Fire-and-forget (OTP, welcome, notification):**
```ts
payload.sendEmail({
  to: user.email,
  subject: 'Your OTP',
  html: renderOtpTemplate({ code }),
}).catch((err) => payload.logger.error({ err }, 'sendEmail failed'));
```

**Awaited (critical transactional, e.g., password reset):**
```ts
try {
  await payload.sendEmail({ ... });
} catch (err) {
  // surface to user via UI/error response
  return { error: 'Email delivery failed' };
}
```

## DO NOT

- Block user flow on email delivery for non-critical messages (OTP is non-critical — user can request resend)
- Log full email body — may contain PII
- Import nodemailer directly — always go through `payload.sendEmail()` or `src/lib/email/send.ts`
