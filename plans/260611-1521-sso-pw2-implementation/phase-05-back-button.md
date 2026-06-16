---
title: "Phase 05 — Back Button (SsoPortalLink)"
effort: 1h
status: pending
dependsOn: []
blocks: []
sourceplan: plans/260604-1103-pw2-sso-back-button/phase-01,02
---

# Phase 05 — Back Button (SsoPortalLink)

## Overview

Thêm link "Quay về TM SSO Portal" vào PW2 dashboard header/nav. Hoàn toàn độc lập với các phases khác — có thể implement bất kỳ lúc nào.

## Part A — Env Var

**Files:** `.env.staging.example`, `.env.production.example` — UPDATE

```bash
# TM SSO Portal URL — used by SsoPortalLink component
NEXT_PUBLIC_SSO_PORTAL_URL=
```

**Env rules (CLAUDE.md):**
- Thêm vào Vercel Dashboard (source of truth) — không commit real values
- `NEXT_PUBLIC_` prefix — client-side component cần đọc được
- Staging + prod có URL khác nhau — set trên Vercel Dashboard mỗi environment

## Part B — SsoPortalLink Component

**File:** `src/components/sso-portal-link.tsx` — CREATE

```typescript
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export function SsoPortalLink() {
    const portalUrl = process.env.NEXT_PUBLIC_SSO_PORTAL_URL
    if (!portalUrl) return null

    return (
        <Link
            href={portalUrl}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            target="_self"
        >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">TM SSO Portal</span>
        </Link>
    )
}
```

**Notes:**
- `if (!portalUrl) return null` — graceful fallback nếu env chưa set (staging/local dev)
- `target="_self"` — same tab (nhất quán với PW1 behavior; điều chỉnh nếu audit PW1 cho thấy khác)
- `hidden sm:inline` — ẩn text trên mobile, giữ icon; không block main content
- `lucide-react` — đã có trong shadcn/ui stack, không cần install thêm

## Part C — Tích hợp vào Dashboard Layout

**Step 1:** Audit layout hierarchy:

```bash
find src/app -name "layout.tsx" | head -10
find src/components -name "*header*" -o -name "*nav*" -o -name "*sidebar*" | head -10
```

**Step 2:** Tìm component render header/nav của authenticated dashboard pages.

**Step 3:** Import + thêm `<SsoPortalLink />`:

```typescript
import { SsoPortalLink } from '@/components/sso-portal-link'

// Trong header/nav JSX:
<SsoPortalLink />
```

Đặt ở vị trí visible nhưng không che main content (e.g. góc header, dưới logo, hoặc đầu sidebar).

## Todo

- [ ] Thêm `NEXT_PUBLIC_SSO_PORTAL_URL=` vào `.env.staging.example`
- [ ] Thêm `NEXT_PUBLIC_SSO_PORTAL_URL=` vào `.env.production.example`
- [ ] Nhắc nhở: set giá trị thật trên Vercel Dashboard (staging + prod)
- [ ] Tạo `src/components/sso-portal-link.tsx`
- [ ] Audit dashboard layout — tìm header/nav component
- [ ] Tích hợp `<SsoPortalLink />` vào dashboard layout/header
- [ ] `pnpm tsc --noEmit` passes
- [ ] `pnpm build` passes

## Success Criteria

- Dashboard header/nav có link dẫn về TM SSO Portal
- Link dùng đúng URL từ `NEXT_PUBLIC_SSO_PORTAL_URL`
- `portalUrl` chưa set → component render `null` (không crash)
- Không break layout hiện tại, responsive trên mobile
- `pnpm tsc --noEmit` passes
