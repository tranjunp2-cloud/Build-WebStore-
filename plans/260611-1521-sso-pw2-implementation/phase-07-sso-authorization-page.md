---
title: "Phase 07 — SSO Authorization Page"
effort: 1h
status: pending
dependsOn: []
blocks: []
sourceplan: SSO↔PW2 login redirect handoff (conversation analysis)
note: "Independent of other phases. No schema change, no new env var."
---

# Phase 07 — SSO Authorization Page

## Overview

Landing page nhận user từ SSO sau khi đăng nhập, mint JWT có `mfa_verified: true`, set cookie, redirect `/dashboard`. Hoàn toàn độc lập với các phases khác — không schema change, không env var mới.

## Context Links

- UI source: `src/app/(frontend)/onboarding/_components/WelcomeScreenClient.tsx` (replicate)
- UI wrapper bg: `src/app/(frontend)/onboarding/page.tsx:53` (`bg-[#0B1120]`)
- Cookie pattern: `src/app/api/auth/logout/route.ts` (`response.cookies.set`)
- JWT mint pattern: `src/collections/Users.ts:204-219` (jose `SignJWT`, `mfa_verified: true`)
- JWT verify pattern: `src/middleware.ts:256-258` (jose `jwtVerify`, same `PAYLOAD_SECRET`)
- i18n keys: `src/i18n/locales/{en,ms}.json` → `onboarding.welcome.title` / `.subtitle`
- Figma node: 30771:16978

## Key Insight — Why this page exists

Middleware (`src/middleware.ts:273`) gate protected routes: token PHẢI có `mfa_verified === true`. Token trả về từ `POST /api/users/login` (Payload default login) KHÔNG có field này → user bị đẩy sang `/verify-otp`. Page này mint JWT MỚI có `mfa_verified: true` (giống bypass trong `Users.ts:204-219`) để user vào thẳng dashboard, skip OTP.

## Data Flow

```
SSO: POST /api/users/login (email+pw) → Payload JWT (v2_token, NO mfa_verified)
SSO: build redirect_url = PW2_DOMAIN/sso/authorization?v2_token=<jwt>
Browser → GET /sso/authorization?v2_token=xxx
    └─ page.tsx (Server) reads searchParams.v2_token → renders SsoAuthorizationClient
        └─ Client useEffect:
            ├─ no v2_token → window.location.href = '/login?error=invalid_token'
            └─ fetch GET /api/auth/sso-session?v2_token=xxx
                └─ Route Handler:
                    ├─ jwtVerify(v2_token, PAYLOAD_SECRET) → { id, email }
                    ├─ SignJWT({ id, email, collection:'users', mfa_verified:true }) 24h
                    ├─ response.cookies.set('payload-token', newToken, ...)
                    └─ { ok: true }  | on error → 401 { error:'invalid_token' }
            ├─ ok → window.location.href = '/dashboard'
            └─ else → window.location.href = '/login?error=invalid_token'
```

`window.location.href` (full reload) — KHÔNG dùng `router.push`. Cookie vừa set phải có mặt khi middleware re-evaluate `/dashboard`; soft nav không gửi cookie mới qua middleware reliably.

## Middleware Path Check

`/sso` KHÔNG nằm trong `protectedPaths` hay `authPaths` → pass through không bị auth guard. `/api/auth/sso-session` cũng pass (API routes không bị frontend guard). **Verify trước implement:** grep `protectedPaths` + `authPaths` trong `src/middleware.ts` confirm `/sso` absent. Nếu có → cần whitelist.

---

## 7a — Route Handler `GET /api/auth/sso-session`

**File:** `src/app/api/auth/sso-session/route.ts` — CREATE

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { SignJWT, jwtVerify } from 'jose'

export async function GET(req: NextRequest) {
    try {
        const v2Token = req.nextUrl.searchParams.get('v2_token')
        if (!v2Token) {
            return NextResponse.json({ error: 'invalid_token' }, { status: 401 })
        }

        const secret = process.env.PAYLOAD_SECRET
        if (!secret) throw new Error('PAYLOAD_SECRET is required')
        const secretKey = new TextEncoder().encode(secret)

        // Verify incoming token (same key as middleware) — rejects forged tokens
        const { payload: decoded } = await jwtVerify(v2Token, secretKey)
        const id = decoded.id
        const email = decoded.email
        if (!id || !email) {
            return NextResponse.json({ error: 'invalid_token' }, { status: 401 })
        }

        // Mint new token WITH mfa_verified — mirrors Users.ts:204-219 bypass
        const newToken = await new SignJWT({
            id,
            email,
            collection: 'users',
            mfa_verified: true,
        })
            .setProtectedHeader({ alg: 'HS256' })
            .setIssuedAt()
            .setExpirationTime('24h')
            .sign(secretKey)

        const response = NextResponse.json({ ok: true })
        response.cookies.set('payload-token', newToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 86400,
        })
        return response
    } catch (error) {
        console.error('[V2][SSO Session Error]', error)
        return NextResponse.json({ error: 'invalid_token' }, { status: 401 })
    }
}
```

**Notes:**
- `jwtVerify` (KHÔNG decode-only) — bắt buộc verify signature để chặn forged token. Cùng `PAYLOAD_SECRET` key như middleware → token v1 sign được middleware verify lại.
- `alg: 'HS256'` + 24h exp — khớp Users.ts bypass và middleware expectation.
- Cookie attrs khớp logout route (`httpOnly`, `secure` prod-only, `sameSite:'lax'`, `path:'/'`).
- Mọi error (missing token, verify fail, missing claims) → uniform `401 invalid_token` (không leak lý do).

---

## 7b — Server Component `page.tsx`

**File:** `src/app/sso/authorization/page.tsx` — CREATE

```typescript
import { SsoAuthorizationClient } from './_components/SsoAuthorizationClient'

export const dynamic = 'force-dynamic'

export default async function SsoAuthorizationPage({
    searchParams,
}: {
    searchParams: Promise<{ v2_token?: string }>
}) {
    const { v2_token } = await searchParams
    return (
        <div className="flex min-h-[100dvh] w-full flex-col items-center justify-center bg-[#0B1120] m-0 p-0 relative">
            <SsoAuthorizationClient v2Token={v2_token} />
        </div>
    )
}
```

**Notes:**
- `searchParams` là Promise (Next.js 15) → `await`.
- `force-dynamic` — không cache (token per-request).
- Bg wrapper `bg-[#0B1120]` copy từ onboarding `page.tsx:53` cho layout đồng nhất.
- KHÔNG auth-check server-side ở đây (user chưa có valid PW2 cookie yet — đó là điều page này tạo ra).

---

## 7c — Client Component `SsoAuthorizationClient.tsx`

**File:** `src/app/sso/authorization/_components/SsoAuthorizationClient.tsx` — CREATE

Replicate `WelcomeScreenClient` (logo + heading + sparkle divider) nhưng THAY TOÀN BỘ buttons section (Create Store + Skip) bằng `Loader2` spinner.

```typescript
'use client'

import { useEffect } from 'react'
import Image from 'next/image'
import { Loader2 } from 'lucide-react'
import { useI18n } from '@/i18n'

export function SsoAuthorizationClient({ v2Token }: { v2Token?: string }) {
    const { t } = useI18n()

    useEffect(() => {
        if (!v2Token) {
            window.location.href = '/login?error=invalid_token'
            return
        }
        fetch(`/api/auth/sso-session?v2_token=${encodeURIComponent(v2Token)}`)
            .then((res) => res.json())
            .then((data) => {
                window.location.href = data?.ok ? '/dashboard' : '/login?error=invalid_token'
            })
            .catch(() => {
                window.location.href = '/login?error=invalid_token'
            })
    }, [v2Token])

    return (
        <main className="flex flex-1 w-full max-w-2xl flex-col justify-center items-center px-6 text-center">
            <div className="flex flex-col items-center w-full max-w-[345px] sm:max-w-md gap-[48px]">
                {/* Logo (copy từ WelcomeScreenClient) */}
                <div className="flex items-center justify-center gap-3">
                    <Image
                        src="/assets/builder/builder-logo.png"
                        alt="PrimeWeb Logo"
                        width={48}
                        height={48}
                        priority
                        className="w-[48px] h-[48px] object-contain drop-shadow-[0_0_24px_rgba(59,130,246,0.6)] !p-0 !m-0"
                    />
                    <span className="text-[30px] font-bold tracking-tight leading-[1.2]">
                        <span className="text-[#F8FAFC]">Prime</span>
                        <span className="bg-gradient-to-br from-blue-500 to-teal-400 bg-clip-text text-transparent">Web</span>
                    </span>
                </div>

                <div className="flex flex-col items-center w-full gap-[32px]">
                    {/* Header (copy) */}
                    <div className="flex flex-col items-center gap-4">
                        <h1 className="text-[36px] font-bold text-[#F8FAFC] leading-[1.11]">
                            {t.onboarding.welcome.title}
                        </h1>
                        <p className="text-[18px] text-[#64748B] leading-[1.55] max-w-xl">
                            {t.onboarding.welcome.subtitle}
                        </p>
                    </div>

                    {/* Sparkle divider (copy) */}
                    <div className="flex items-center justify-center gap-2 w-full">
                        <div className="h-1 w-[80px] rounded-full bg-gradient-to-r from-transparent via-blue-500/30 to-blue-500/30"></div>
                        <div className="flex h-[24px] w-[24px] items-center justify-center bg-slate-800/40 rounded-full">
                            <Image src="/assets/builder/sparkle.svg" alt="Sparkle" width={24} height={24} />
                        </div>
                        <div className="h-1 w-[80px] rounded-full bg-gradient-to-l from-transparent via-teal-400/30 to-teal-400/30"></div>
                    </div>

                    {/* Loading (REPLACES buttons section) */}
                    <div className="flex flex-col items-center w-full gap-6">
                        <Loader2 className="h-8 w-8 animate-spin text-blue-400" aria-label="Authorizing" />
                    </div>
                </div>
            </div>
        </main>
    )
}
```

**Notes:**
- `Loader2 animate-spin` thay cho `<Link href="/builder/new">` + skip link.
- `encodeURIComponent(v2Token)` — JWT chứa `.` an toàn nhưng vẫn encode cho đúng chuẩn query.
- Reuse i18n keys hiện có (`onboarding.welcome.title/subtitle`) — KHÔNG thêm key mới (DRY, YAGNI).
- `useEffect` deps `[v2Token]` — chạy once trên mount.

---

## Related Code Files

**Create:**
- `src/app/api/auth/sso-session/route.ts`
- `src/app/sso/authorization/page.tsx`
- `src/app/sso/authorization/_components/SsoAuthorizationClient.tsx`

**Read for context (no edit):**
- `src/collections/Users.ts:204-219`, `src/middleware.ts:243-280`, `src/app/api/auth/logout/route.ts`, `src/app/(frontend)/onboarding/_components/WelcomeScreenClient.tsx`

**No schema change. No env var. No migration.**

## Todo

- [x] Verify `/sso` absent từ `protectedPaths` + `authPaths` trong `src/middleware.ts`
- [x] Tạo `src/app/api/auth/sso-session/route.ts`
- [x] Tạo `src/app/sso/authorization/page.tsx`
- [x] Tạo `src/app/sso/authorization/_components/SsoAuthorizationClient.tsx`
- [x] Confirm i18n keys `onboarding.welcome.title/subtitle` tồn tại trong `en.json` + `ms.json`
- [x] `pnpm tsc --noEmit` passes (no errors in new files)
- [ ] `pnpm build` passes (CI)

## Success Criteria

- GET `/sso/authorization?v2_token=<valid>` → loading screen → cookie `payload-token` set với `mfa_verified:true` → redirect `/dashboard`, NO `/verify-otp` bounce
- Resulting cookie verify được bởi middleware (`jwtVerify` pass, `mfa_verified===true`) → `/dashboard` không redirect login
- Missing `v2_token` → redirect `/login?error=invalid_token`
- Invalid/forged `v2_token` → Route Handler `401 invalid_token` → client redirect `/login?error=invalid_token`
- UI khớp Figma 30771:16978 (logo + heading + sparkle + spinner), bg `#0B1120`, responsive mobile
- `pnpm tsc --noEmit` + `pnpm build` passes

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Soft-nav cookie không propagate → middleware vẫn thấy old token | Med | High | Dùng `window.location.href` (full reload) thay `router.push` ở cả 3 redirect paths |
| `/sso` lọt vào auth guard → redirect loop | Low | High | Verify path absent trong middleware trước implement (Todo #1) |
| `searchParams` không await (Next 15) → build error | Med | Med | `await searchParams` — đã encode trong spec |
| `PAYLOAD_SECRET` lệch giữa v1 sign & v2 verify | Low | High | Cùng env var `PAYLOAD_SECRET`; nếu fail → 401 (fail-closed, không crash) |
| v2_token leak qua URL/referrer/logs | Med | Med | Token short-lived; `/dashboard` redirect strip query; KHÔNG log token value. Out-of-scope: one-time token exchange (YAGNI sprint này) |

## Security Considerations

- `jwtVerify` (verify signature) — KHÔNG decode-only → chặn forged token mint quyền truy cập.
- Cookie `httpOnly` + `secure` (prod) + `sameSite:'lax'` → chống XSS đọc token, CSRF cơ bản.
- Uniform `401 invalid_token` cho mọi failure → không leak (token expired vs forged vs missing claim).
- KHÔNG log `v2_token` value (chỉ log error object). v2_token trong URL → ephemeral, redirect ngay sau handoff.

## Rollback Plan

3 file mới, không sửa file cũ, không migration → xoá 3 file + revert plan.md là rollback hoàn toàn. Không cascade (không phase nào depend Phase 07).

## Next Steps / Dependencies

- Depends: none (independent).
- SSO-side build redirect_url với `?v2_token=` — repo `sso-api` (ngoài scope, coordinate với TM team).
- Test: thêm TC-IDs vào `docs/qa/F-SSO-PW2.md` (happy path + missing token + forged token).
