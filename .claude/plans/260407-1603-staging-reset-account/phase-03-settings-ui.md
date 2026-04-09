---
phase: "03"
title: Settings UI
status: pending
estimate: 1.5h
depends_on: ["phase-01", "phase-02"]
---

# Phase 3: Settings UI — Dashboard Settings Page

## Muc tieu

Tao trang `/dashboard/settings` voi profile section va Danger Zone (staging-only Reset Account button).

## File moi

### `src/app/(dashboard)/dashboard/settings/page.tsx`

## Layout

```
┌──────────────────────────────────────┐
│ Settings                    (h1)     │
├──────────────────────────────────────┤
│                                      │
│ ┌─ Profile ────────────────────────┐ │
│ │ Avatar    [image]                │ │
│ │ Name      Nguyen Van A           │ │
│ │ Email     test@primeweb.app      │ │
│ │ Role      admin                  │ │
│ │                    [Edit Profile] │ │
│ └──────────────────────────────────┘ │
│                                      │
│ ── CHI HIEN THI KHI STAGING ──────  │
│                                      │
│ ┌─ Danger Zone (red border) ───────┐ │
│ │ Reset Account                    │ │
│ │ Xoa TOAN BO data + tenant,       │ │
│ │ tra ve trang thai nhu account    │ │
│ │ vua dang ky. Ban se di qua      │ │
│ │ onboarding lai. KHONG the        │ │
│ │ hoan tac.                        │ │
│ │                                  │ │
│ │ Se xoa:                          │ │
│ │ • Tenant (slug, domain, plan)    │ │
│ │ • Sites, Pages                   │ │
│ │ • Products, Orders               │ │
│ │ • Media files (S3)               │ │
│ │ • Templates, Analytics           │ │
│ │ • Subscriptions                  │ │
│ │                                  │ │
│ │              [Reset Account] red │ │
│ └──────────────────────────────────┘ │
└──────────────────────────────────────┘
```

## Components

### 3.1 Settings Page (`page.tsx`)

```
- export const dynamic = 'force-dynamic' (can getPayload)
- Server component: fetch user data tu Payload
- Render ProfileCard + (isStaging ? DangerZoneCard : null)
```

### 3.2 ProfileCard (trong page hoac tach component)

- Hien thi: avatar, firstName + lastName, email, role
- Read-only (Edit Profile button — disabled/coming soon)
- Dung Card component tu shadcn/ui

### 3.3 ResetAccountCard (client component)

```
'use client'

States:
- idle: hien thi button "Reset Account" (variant destructive)
- confirming: hien thi AlertDialog voi input "Nhap RESET de xac nhan"
- loading: button disabled + spinner, goi POST /api/account/reset
- success: toast.success("Da reset!") + router.push('/onboarding')
- error: toast.error(message) + nut "Thu lai"
```

### 3.4 Confirmation Dialog

```
AlertDialog (shadcn/ui):
  Title: "Reset Account?"
  Description: "Hanh dong nay se xoa TOAN BO data + tenant (sites, products,
    orders, media, templates). Ban se phai tao store moi qua onboarding.
    Email va mat khau duoc giu nguyen. Khong the hoan tac."
  Input: placeholder="Nhap RESET de xac nhan"
  Cancel: "Huy"
  Confirm: disabled cho den khi input === "RESET"
    Button text: "Xac nhan Reset" (variant destructive)
    Loading state: spinner + "Dang reset..."
```

### 3.5 API Call

```typescript
const resetAccount = useMutation({
  mutationFn: async () => {
    const res = await fetch('/api/account/reset', { method: 'POST' })
    if (!res.ok) throw new Error((await res.json()).error?.message)
    return res.json()
  },
  onSuccess: (data) => {
    toast.success(`Da reset account! Xoa ${totalRecords(data)} records.`)
    router.push('/onboarding')
  },
  onError: (err) => {
    toast.error(err.message || 'Reset that bai. Thu lai.')
  },
})
```

## 9-Point Checklist

```
[x] 1. LOADING STATE    — Skeleton cho ProfileCard khi loading
[x] 2. EMPTY STATE      — N/A (settings luon co data)
[x] 3. ERROR STATE      — Toast do + "Thu lai" khi reset fail
[x] 4. FORM VALIDATION  — Input phai === "RESET" moi enable confirm
[x] 5. BUTTON STATES    — disabled + spinner khi loading
[x] 6. TOAST FEEDBACK   — Success + Error toast
[x] 7. AUTH REDIRECT    — Server component check auth, redirect /login
[x] 8. MOBILE 375px     — Card stack vertical, button full-width mobile
[x] 9. TYPESCRIPT CLEAN — No any, proper types cho API response
```

## Verification

- [ ] `/dashboard/settings` hien thi profile info dung
- [ ] Danger Zone CHI hien thi khi `isStaging() === true`
- [ ] Danger Zone AN TOAN khi `isStaging() === false` (production)
- [ ] Confirmation dialog yeu cau nhap "RESET"
- [ ] Button disabled khi chua nhap dung "RESET"
- [ ] Loading state hien thi spinner khi dang reset
- [ ] Success: toast + redirect ve /dashboard
- [ ] Error: toast do + co the thu lai
- [ ] Mobile 375px: layout khong vo
- [ ] Sidebar link `/dashboard/settings` navigate dung
