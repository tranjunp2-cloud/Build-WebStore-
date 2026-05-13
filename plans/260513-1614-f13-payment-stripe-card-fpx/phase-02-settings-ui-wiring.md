# Phase 02 — Settings UI Wiring

> **Phase A.2** | **Status:** Ready after Phase 01 | **Est:** S (3-4h) | **Owner:** Frontend Dev
> **Depends:** Phase 01 merged
> **Parallel với:** Phase 03

## Context

- Plan: [`plan.md`](./plan.md)
- Design: [`docs/design/F13-payment-gateway-design.md`](../../docs/design/F13-payment-gateway-design.md) §2.1, §8.5
- Current state: `PaymentsFormClient.tsx` line 288-296 — Stripe toggle mocked (`cursor-not-allowed`)

## Overview

Wire mocked "Stripe / Card Gateway" toggle thành functional. Thêm card "FPX (Online Banking)" toggle mới. Both gated bởi `stripeOnboardingComplete` — **disabled + lock icon + tooltip** "Connect Stripe to enable" (D-03). "Connect Stripe →" CTA dẫn flow onboard.

**Architecture decision (D-06):** Extract Stripe toggles (Card + FPX) thành 1 **wrapper component riêng** `<StripePaymentToggles />` — KHÔNG inline edits trong `PaymentsFormClient.tsx` body. Lý do: COD/QR team đang active edit cùng file — wrapper cô lập F13 changes vào file mới → giảm conflict rebase khi Phase 04 hoặc COD/QR PR merge.

## Related code files

| File | Action |
|------|--------|
| `src/app/(dashboard)/settings/payments/stripe-payment-toggles.tsx` | **Create (NEW)** — wrapper component cho Card + FPX toggles (D-06) |
| `src/app/(dashboard)/settings/payments/PaymentsFormClient.tsx` | **Edit (minimal)** — replace mocked Stripe section (line 277-303) với `<StripePaymentToggles />` import + render |
| `src/i18n/locales/en.json`, `src/i18n/locales/ms.json` | Edit — add new strings (Card title/subtitle, FPX, Connect Stripe CTA, tooltip) |
| `src/__tests__/unit/payment/stripe-payment-toggles.test.tsx` | Create — Testing Library tests cho wrapper component |

## Implementation steps

### 0. Create wrapper component `stripe-payment-toggles.tsx` (D-06)

New file `src/app/(dashboard)/settings/payments/stripe-payment-toggles.tsx`:

```typescript
'use client'

import React from 'react'
import { CreditCard, Landmark, Lock } from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useI18n } from '@/i18n'
import { updatePaymentSettings } from './actions'

type Props = {
  initialCard: boolean
  initialFpx: boolean
  stripeOnboardingComplete: boolean
  tenantId: string
}

export function StripePaymentToggles({ initialCard, initialFpx, stripeOnboardingComplete, tenantId }: Props) {
  const [card, setCard] = React.useState(initialCard)
  const [fpx, setFpx] = React.useState(initialFpx)
  const { t } = useI18n()
  const pt = t.dashboard.settings.payments
  const router = useRouter()

  const onboarded = stripeOnboardingComplete

  const handleToggle = async (field: 'payment_card' | 'payment_fpx', value: boolean) => {
    if (!onboarded) {
      toast.error(pt.connectStripeFirst)
      return
    }
    const setter = field === 'payment_card' ? setCard : setFpx
    setter(value)
    const res = await updatePaymentSettings({ [field]: value })
    if (!res.success) {
      setter(!value)  // revert
      toast.error(pt.failSaveSettings)
      return
    }
    toast.success(pt.successSave)
  }

  // Render Connect Stripe empty state if not onboarded
  // Else render Card + FPX toggle cards with Switch
  // ... (see detailed UI section §1-§5 below)
}
```

Wrapper exports default + named. Consumed by `PaymentsFormClient.tsx`.

### 1. Replace mocked Stripe toggle (line 277-303) in `PaymentsFormClient.tsx`

Current code MOCK pattern. Replace với functional pattern giống COD toggle (line 305-351):

```typescript
const [paymentCard, setPaymentCard] = useState(false)
const [paymentFpx, setPaymentFpx] = useState(false)
const [stripeReady, setStripeReady] = useState(false)  // from tenant.stripeOnboardingComplete

// Fetch trong useEffect (existing fetchSettings block)
setPaymentCard(data.payment_card || false)
setPaymentFpx(data.payment_fpx || false)
setStripeReady(data.stripeOnboardingComplete || false)

const handleToggleCard = async (e) => {
  if (!stripeReady) {
    toast.error(pt.connectStripeFirst)
    return
  }
  const checked = e.target.checked
  setPaymentCard(checked)
  const success = await saveTenantSettings({ payment_card: checked })
  if (success) toast.success(pt.successSave)
  else { setPaymentCard(!checked); toast.error(pt.failSaveSettings) }
}

// Tương tự handleToggleFpx
```

### 2. Stripe Card section UI

Replace MOCK card (line 277-303) với functional Switch. Pattern reuse từ COD card (line 305-351):
- Icon `CreditCard` (preserved)
- Title: i18n `pt.cardTitle` = "Credit / Debit Card"
- Subtitle: `pt.cardSubtitle` = "Visa, Mastercard, AmEx via Stripe (3% platform fee)"
- Switch checkbox: `paymentCard` state
- Status pill: Active/Inactive (giống COD)

### 3. FPX card UI (NEW)

Append card mới sau Stripe Card section, trước COD card:
- Icon `Landmark` từ `lucide-react`
- Title: "FPX (Online Banking)"
- Subtitle: "Maybank, CIMB, Public Bank, + 15 banks. MYR only."
- Switch: `paymentFpx` state
- Status pill: Active/Inactive

### 4. Not-onboarded state — Disabled + Lock + Tooltip (D-03)

**Quan trọng:** Toggles VẪN HIỂN THỊ rõ ràng (không hidden) → người dùng thấy được payment options tồn tại → motivation onboard Stripe. Nhất quán với Screenshot 2026-05-13 16:19:20.

```jsx
{/* Connect CTA banner ở top */}
{!onboarded && (
  <Alert variant="destructive">
    <Lock className="h-4 w-4" />
    <AlertTitle>{pt.connectStripeTitle}</AlertTitle>
    <AlertDescription>{pt.connectStripeDesc}</AlertDescription>
    <Button onClick={handleConnectStripe}>
      {pt.connectStripeCta} →
    </Button>
  </Alert>
)}

{/* Toggles vẫn render — disabled state với tooltip */}
<Tooltip content={!onboarded ? pt.connectToEnableTooltip : undefined}>
  <ToggleCard
    icon={<CreditCard />}
    title={pt.cardTitle}
    subtitle={pt.cardSubtitle}
    checked={card}
    disabled={!onboarded}
    showLock={!onboarded}
    onChange={(v) => handleToggle('payment_card', v)}
  />
</Tooltip>

<Tooltip content={!onboarded ? pt.connectToEnableTooltip : undefined}>
  <ToggleCard
    icon={<Landmark />}
    title={pt.fpxTitle}
    subtitle={pt.fpxSubtitle}
    checked={fpx}
    disabled={!onboarded}
    showLock={!onboarded}
    onChange={(v) => handleToggle('payment_fpx', v)}
  />
</Tooltip>
```

Use shadcn `Tooltip` + add `Lock` icon overlay khi `showLock={true}` (visual cue ngoài tooltip).

### 4b. Connect Stripe button — Phase 02b verification (D-04)

`handleConnectStripe` function — call existing onboard endpoint:

```typescript
const handleConnectStripe = async () => {
  setConnecting(true)
  try {
    const res = await fetch('/api/stripe/connect/onboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId }),
    })
    const data = await res.json()
    if (data.success && data.data?.onboardingUrl) {
      window.location.href = data.data.onboardingUrl  // Stripe-hosted KYC
    } else {
      toast.error(pt.connectFailed)
      setConnecting(false)
    }
  } catch (err) {
    toast.error(pt.connectFailed)
    setConnecting(false)
  }
}
```

**Verify trước commit Phase 02:**
- Endpoint `POST /api/stripe/connect/onboard` đã có sẵn (`src/app/api/stripe/connect/onboard/route.ts` — 110 lines, withAuth + tenant ownership check)
- Backend response shape: `{ success: true, data: { accountId, onboardingUrl } }` — confirm shape khi wire UI
- Return URLs Backend hardcode: `${baseUrl}/settings?stripe=refresh` và `${baseUrl}/settings?stripe=complete` (line 60-61, 92-93 onboard route) — **NOT** `/dashboard/settings/payments` → cần handler ở `/settings` page hoặc đổi return URL ở backend (xem §4c)
- Approach: Dùng client-side `fetch()` (đã spec ở trên) — KHÔNG cần server action `connectStripe` riêng (KISS — endpoint đã withAuth)
- Estimate: 1-2h verify + test full Stripe sandbox onboard cycle (Phase 02b sub-task)

### 4c. Return-from-Stripe redirect handler (NEW gap)

**Backend `/api/stripe/connect/onboard` set return URLs:**
- `success_url`: `/settings?stripe=complete` (KYC done)
- `refresh_url`: `/settings?stripe=refresh` (KYC interrupted, need retry)

**Hiện trạng:** Frontend chưa parse 2 query params → tenant onboard xong land back nhưng không thấy feedback.

**Action:** Add useEffect ở `PaymentsFormClient.tsx` (hoặc parent page server-side):

```typescript
import { useSearchParams, useRouter } from 'next/navigation'

const searchParams = useSearchParams()
const router = useRouter()

useEffect(() => {
  const stripe = searchParams.get('stripe')
  if (stripe === 'complete') {
    toast.success(pt.stripeConnectSuccess)
    // Refetch tenant status để verify chargesEnabled
    fetch(`/api/stripe/connect/status?tenantId=${tenantId}`)
      .then(r => r.json())
      .then(data => {
        if (data.data?.onboardingComplete) {
          setStripeReady(true)
          // Optionally auto-enable Card on first successful onboard (per D-02 backfill spirit)
        } else {
          toast.warning(pt.stripeKycPending)
        }
      })
    // Strip query param
    router.replace('/dashboard/settings/payments')
  } else if (stripe === 'refresh') {
    toast.warning(pt.stripeOnboardingIncomplete)
    router.replace('/dashboard/settings/payments')
  }
}, [searchParams])
```

**Backend return URL coordination:** Hiện return URLs trỏ về `/settings` (root settings page). Phase 02 cần quyết định:
- Option A: Update backend `onboard/route.ts:60-61, 92-93` để return URL về `/dashboard/settings/payments` (chuyển scope đúng) — recommended
- Option B: Add handler ở `/settings` page router parent → redirect → tới `/dashboard/settings/payments` với query params preserved

**Đề xuất Option A** — KISS, scope đúng, không cần router middleware. Update 2 dòng ở `onboard/route.ts`:

```diff
- `${baseUrl}/settings?stripe=refresh`,
- `${baseUrl}/settings?stripe=complete`,
+ `${baseUrl}/dashboard/settings/payments?stripe=refresh`,
+ `${baseUrl}/dashboard/settings/payments?stripe=complete`,
```

**i18n strings thêm:**
```json
{
  "stripeConnectSuccess": "Stripe connected successfully! You can now enable Card and FPX payments.",
  "stripeKycPending": "Stripe account created but KYC verification is pending. Try refreshing in a few minutes.",
  "stripeOnboardingIncomplete": "Stripe onboarding incomplete. Click Connect again to continue.",
  "connecting": "Connecting to Stripe..."
}
```

### 5. Both-OFF warning

Sau Card + FPX section, thêm conditional warning:

```jsx
{stripeReady && !paymentCard && !paymentFpx && (
  <Alert variant="warning">
    ⚠️ {pt.atLeastOneRequired}
  </Alert>
)}
```

### 6. i18n strings

Add tới `en.json` + `ms.json` dưới `dashboard.settings.payments`:

```json
{
  "cardTitle": "Credit / Debit Card",
  "cardSubtitle": "Visa, Mastercard, AmEx via Stripe (3% platform fee)",
  "fpxTitle": "FPX (Online Banking)",
  "fpxSubtitle": "Maybank, CIMB, Public Bank, + 15 banks. MYR only.",
  "connectStripeTitle": "Connect Stripe to accept Card & FPX",
  "connectStripeDesc": "Funds go directly to your bank account.",
  "connectStripeCta": "Connect Stripe",
  "connectStripeFirst": "Connect Stripe first",
  "connectToEnableTooltip": "Connect Stripe to enable",
  "connectFailed": "Failed to start Stripe onboarding. Please try again.",
  "atLeastOneRequired": "At least one method required when storefront is live"
}
```

BM (`ms.json`) cần dịch.

### 7. Tests

`payment-settings-ui.test.tsx`:
- Render với `stripeReady = false` → assert Connect CTA visible, toggles locked
- Render với `stripeReady = true, payment_card = false` → toggle Card → assert `updatePaymentSettings` called với `{ payment_card: true }`
- Render với both OFF → assert warning Alert visible
- Toggle FPX → assert state + persist

## Todo

- [ ] Create `stripe-payment-toggles.tsx` wrapper component (D-06)
- [ ] Replace mocked Stripe section trong `PaymentsFormClient.tsx` với `<StripePaymentToggles />` import
- [ ] Implement Card + FPX Switch + handler trong wrapper
- [ ] Implement Disabled+Lock+Tooltip state khi not onboarded (D-03)
- [ ] Add both-OFF warning Alert (chỉ render khi onboarded)
- [ ] **Phase 02b:** Wire `handleConnectStripe` → POST `/api/stripe/connect/onboard` + redirect (D-04)
- [ ] **NEW gap:** Update backend `onboard/route.ts:60-61, 92-93` — return URLs trỏ về `/dashboard/settings/payments` thay vì `/settings`
- [ ] **NEW gap:** Add return handler — parse `?stripe=complete` / `?stripe=refresh` → toast + refetch status + strip query
- [ ] Update i18n `en.json` + `ms.json` (15 new strings)
- [ ] Create `stripe-payment-toggles.test.tsx` — 7 test cases (onboarded toggle, not-onboarded disabled, tooltip render, connect CTA, both-OFF warning, return-complete handler, return-refresh handler)
- [ ] Manual QA: toggle Card on/off, FPX on/off, not-onboarded state, warning Alert
- [ ] Manual QA: full sandbox cycle — Connect → Stripe KYC → return `?stripe=complete` → toast + auto-enable visibility
- [ ] Manual QA: Stripe KYC abandoned → return `?stripe=refresh` → toast warning
- [ ] Verify `tabIndex` order accessible (keyboard nav) + tooltip screen-reader
- [ ] Verify mobile 54px hitbox preserved (test 375px viewport)

## Success criteria

- Toggle Card → persists `payment_card = true` trong DB
- Toggle FPX → persists `payment_fpx = true`
- `stripeOnboardingComplete = false` → toggles disabled + Connect CTA visible + tooltip "Connect Stripe to enable"
- Click Connect Stripe → redirect ra Stripe-hosted KYC → return `/dashboard/settings/payments?stripe=complete` → toast success + auto-show enabled toggles
- Stripe KYC abandoned → return `/dashboard/settings/payments?stripe=refresh` → toast warning + Connect CTA still visible
- Both OFF → warning Alert visible (không block Save)
- Mobile 375px: toggle hit area ≥ 54×54px
- 0 regression trên COD/QR toggles (existing tests pass)
- All new i18n strings localized (en + ms — 15 strings)

## Risk

| Risk | Mitigation |
|------|-----------|
| Merge conflict với COD/QR team trên `PaymentsFormClient.tsx` | Edits additive (insert before/after, không modify COD/QR blocks); rebase trước commit |
| Connect Stripe link target chưa có UI | Verify `/dashboard/settings/payments/connect` route; nếu chưa có → tạm link tới API endpoint hoặc add Phase 02b |
| i18n keys conflict với existing | Prefix tất cả new keys (e.g. `cardTitle` → đảm bảo không trùng) |

## Open questions (resolved)

1. ~~Lucide icon `Landmark` cho FPX OK?~~ → Use `Landmark` (consistent với existing `CreditCard`, `Banknote` imports trong `PaymentsFormClient.tsx`)
2. ~~Connect Stripe button target?~~ → D-04: Phase 02b verify route. Default: POST `/api/stripe/connect/onboard` → Stripe-hosted URL → `window.location.href`

## Next phase

Phase 04 (storefront integration) sau khi Phase 02 + 03 done + COD/QR storefront merge.
