# F13 Payment Gateway — Design & Wireframe Report

> **Epic:** Storefront Commerce & Seller Settings
> **Feature Code:** F13
> **Links:**
> - PRD: [`docs/prd/F13-payment-gateway.md`](../prd/F13-payment-gateway.md)
> - Stories: [`docs/stories/F13-payment-gateway-stories.md`](../stories/F13-payment-gateway-stories.md) — US-F13-01 (FPX), US-F13-02 (Seller Settings), US-F13-03 (Mobile UX)
> - Architecture: [`docs/architecture/F13-payment-gateway.md`](../architecture/F13-payment-gateway.md) *(TBD — chưa tồn tại)*
> - **🎨 Figma Design (hi-fi reference):** https://www.figma.com/design/oFACZVA1oplxslloJWEkLp/TM_Prime-Web-V2.0?node-id=30877-2233
>   - **Dev action:** Mở Figma node → Inspect spacing/typography/color → implement Figma làm UI source-of-truth
>   - Wireframe ASCII bên dưới chỉ là sketch low-fi
>   - Nếu Figma conflict §8 decisions → ưu tiên §8 (đã chốt với PM)
> - Related: F09 Storefront Commerce (Checkout host), F14 Shipping (sibling settings card), F18 CMS Global Layout, F19 Store Configuration (extends `Settings > Payments`)
> - Code reference: [`src/lib/payment/stripe.ts`](../../src/lib/payment/stripe.ts), [`src/app/api/orders/create/route.ts`](../../src/app/api/orders/create/route.ts), [`src/app/(dashboard)/settings/payments/PaymentsFormClient.tsx`](../../src/app/(dashboard)/settings/payments/PaymentsFormClient.tsx)

Tài liệu này cung cấp wireframe & UI spec low-fi cho tính năng **Payment Gateway Malaysia** — Wave 6 P0 (Card + FPX qua **Stripe Checkout Session hosted**). Settings UI tuân thủ **F18 CMS Global Layout**. Checkout UI thuộc Storefront F09.

---

## 1. Feature Summary

> **💳 Payment Model:** **STRIPE CHECKOUT SESSION (HOSTED)** + **STRIPE CONNECT DIRECT CHARGES**.
>
> - Storefront chỉ có **1 nút "Pay with Stripe"** → click → redirect tới Stripe-hosted Checkout page (`stripe.com`).
> - Stripe Checkout page tự render: Card form (Visa/MC/AmEx) + FPX bank picker (Maybank, CIMB, etc.) + 3D Secure + receipt — chúng ta KHÔNG build custom UI cho method picker.
> - Payment flows trực tiếp vào account merchant đã connect; PrimeWeb thu `application_fee_amount = 3%` của total.
> - Sau pay: Stripe redirect về `success_url` (confirmation) hoặc `cancel_url` (cart preserved).

Wave 6 Payment bao gồm 3 surface chính:

- **Seller Payment Settings (CMS Dashboard):** Seller bật/tắt **Card** và **FPX** cho Storefront. UI dạng card với 2 toggles. Persist vào `tenant.paymentMethods.card / .fpx`. Khi seller toggle, checkout API pass dynamic `payment_method_types` array vào Stripe Checkout Session.
- **Checkout Payment Section (Storefront):** Bước cuối F09 checkout. Section "Phương thức thanh toán" hiển thị **1 nút "Pay with Stripe"** (label thay đổi theo settings: "Pay with Stripe (Card · FPX)" nếu cả 2 ON, "Pay with Card" nếu chỉ Card, etc.) → click → server tạo Stripe Checkout Session → redirect.
- **Mobile Optimization (375px):** Button full-width sticky bottom, hitbox ≥ 54px (FR-08). Stripe Checkout page tự handle mobile UX (FR-09 satisfied bởi Stripe-hosted page).

### Design Principles
- **KISS:** Stripe-hosted Checkout — KHÔNG build inline Payment Element, KHÔNG custom bank dropdown, KHÔNG Card form MM/YY trong codebase. Stripe handle 100%.
- **Reuse F19/F14 pattern:** Settings card layout giống F14 Shipping, toggle pattern giống F19 Payments (COD, QR).
- **Stripe Connect Direct Charges:** Payment → merchant connected account, PrimeWeb thu 3% via `application_fee_amount`. Yêu cầu seller đã onboard Stripe Connect (`tenant.stripeAccountId` + `chargesEnabled = true`).
- **shadcn/ui only:** `Card`, `Switch`, `Button`, `Badge`, `Alert` — không custom component.
- **Mobile-first:** 54px hitbox (FR-08).

---

## 2. Wireframes & UI Layouts

### 2.1. Screen A — Seller Payment Settings <a id="screen-a-seller-settings"></a>

> **🎨 Hi-fi reference:** [Figma — TM_Prime-Web-V2.0 / Node 30877-2233](https://www.figma.com/design/oFACZVA1oplxslloJWEkLp/TM_Prime-Web-V2.0?node-id=30877-2233)
>
> **Dev implementation steps:**
> 1. Mở Figma link → navigate đến node `30877-2233`
> 2. Inspect spacing, color tokens, typography, component states
> 3. Implement theo Figma làm UI source-of-truth
> 4. Wireframe ASCII bên dưới chỉ là low-fi sketch
> 5. Nếu Figma conflict §8 decisions → ưu tiên §8

**Path:** `Dashboard > Settings > Payments` (`/dashboard/settings/payments`)
**Trạng thái:** Seller đã đăng nhập, Stripe Connect onboarded (`chargesEnabled = true`), Card ON, FPX OFF.
**Context:** Section này **mở rộng** existing `PaymentsFormClient.tsx`. Hiện tại file đã có "Stripe / Card Gateway" toggle nhưng đang **MOCK** (line 288-296: `cursor-not-allowed`, hardcode "Inactive"). F13 wire toggle + thêm FPX toggle.

```text
┌─────────────────────────────────────────────────────────┐
│ [≡ Logo]  Search...                           [👤 Admin]│ ◄── F18 Header
├──────────────┬──────────────────────────────────────────┤
│ 🏠 Dashboard │ Store Settings > Payments                │
│ 📦 Products  │                                          │
│ 🛒 Orders    │ ┌──────────────────────────────────────┐ │
│ ⚙️ Settings  │ │ 💳 Stripe Payment Methods (Malaysia) │ │
│  ↳ Domains   │ │ Powered by Stripe Checkout — Stripe  │ │
│  ↳ Payments ●│ │ host secure UI, you receive funds    │ │
│  ↳ Shipping  │ │ directly (3% platform fee applies)   │ │
│  ↳ Staff     │ │                                      │ │
│              │ │ ┌──────────────────────────────────┐ │ │
│              │ │ │ 💳  Credit / Debit Card          │ │ │
│              │ │ │     Visa, Mastercard, AmEx       │ │ │
│              │ │ │                          [●━]ON  │ │ │
│              │ │ └──────────────────────────────────┘ │ │
│              │ │                                      │ │
│              │ │ ┌──────────────────────────────────┐ │ │
│              │ │ │ 🏦  FPX (Online Banking)          │ │ │
│              │ │ │     Maybank, CIMB, Public Bank,  │ │ │
│              │ │ │     + 15 banks. MYR only.        │ │ │
│              │ │ │                          [○━]OFF │ │ │
│              │ │ └──────────────────────────────────┘ │ │
│              │ │                                      │ │
│              │ │ ⚠️ At least one method required      │ │ ◄── inline warn
│              │ │   when storefront is live.           │ │
│              │ └──────────────────────────────────────┘ │
│              │                                          │
│              │ ┌──────────────────────────────────────┐ │
│              │ │ 💵 Manual Payment Methods            │ │ ◄── F19 existing
│              │ │   (COD, Bank QR — unchanged)         │ │
│              │ └──────────────────────────────────────┘ │
│              │                                          │
│              │                       [ Save Changes ]   │ ◄── disabled until dirty
└──────────────┴──────────────────────────────────────────┘
```

**Empty state — Stripe chưa connect:**

```text
│ │ 💳 Stripe Payment Methods (Malaysia)             │ │
│ │                                                  │ │
│ │ ⚠️ Connect Stripe to accept Card & FPX           │ │
│ │   payments. Funds go directly to your bank.      │ │
│ │                                                  │ │
│ │             [ Connect Stripe → ]                 │ │ ◄── CTA tới onboard flow
│ │                                                  │ │
│ │ (Card & FPX toggles disabled until connected)    │ │
│ │ ┌──────────────────────────────────────────────┐ │ │
│ │ │ 💳 Credit / Debit Card             [○━]🔒    │ │ │ ◄── locked
│ │ └──────────────────────────────────────────────┘ │ │
│ │ ┌──────────────────────────────────────────────┐ │ │
│ │ │ 🏦 FPX                              [○━]🔒    │ │ │ ◄── locked
│ │ └──────────────────────────────────────────────┘ │ │
```

**Components (shadcn/ui mapping):**
- Outer card: `<Card>` + `<CardHeader>` + `<CardContent>` (background `bg-[#1E293B]/60` theo `PaymentsFormClient.tsx` design tokens)
- Method row: flex layout với icon + label/desc + `<Switch>` (custom checkbox hiện tại — preserve style)
- Inline warning: `<Alert variant="warning">` "At least one method required"
- Empty state: `<Alert variant="destructive">` + `<Button>` "Connect Stripe →" link `/dashboard/settings/payments/connect`
- Footer button: `<Button>` (Save, hoặc auto-save on toggle như current code pattern)

**States:**
| State | UI |
|-------|-----|
| Loading | Skeleton 2 method rows |
| Stripe not connected | Destructive alert + CTA "Connect Stripe", toggles disabled với 🔒 icon |
| Card ON, FPX OFF | Card toggle green active, FPX toggle gray |
| Both ON | 2 toggles green active |
| Both OFF | `<Alert variant="warning">` "At least one method required when storefront is live" (soft warn — không block Save) |
| Saving | Toast loading "Updating payment methods..." |
| Success | Toast "Payment methods updated" (Sonner, 3s) |
| Error | Toast destructive + revert toggle state (giống `handleToggleCod` pattern hiện tại) |

**Wire action (TODO trong code):**
- Replace mocked toggle (line 288-296 `PaymentsFormClient.tsx`) với functional `<Switch>` giống COD toggle pattern (line 324-336)
- Thêm `paymentMethodCard` + `paymentMethodFpx` state vào `tenant` schema → persist
- Update `createStripeCheckoutSession` ở `src/app/api/orders/create/route.ts` để pass dynamic `payment_method_types` based on tenant settings

---

### 2.2. Screen B — Checkout Payment Section <a id="screen-b-checkout-payment"></a>

**Path:** `/sites/[slug]/checkout` — bước 3 (Payment), sau khi buyer điền address + chọn shipping state.
**Trạng thái:** Buyer guest, cart 1 SP RM 50, address filled, state = Selangor, shipping RM 8, total RM 61.

#### 2.2.1. Default state — Stripe button visible

```text
┌─────────────────────────────────────────────────────────────┐
│ [≡ Logo]                              Bảo mật thanh toán 🔒 │
├─────────────────────────────────────────────────────────────┤
│ ← Continue Shopping                                          │
│                                                              │
│ ┌──────────────────────────────┬───────────────────────────┐│
│ │ 1. Contact ✓                 │ 🛒 Order Summary          ││
│ │ 2. Shipping ✓                │                           ││
│ │ 3. Payment Method            │ • Áo Khoác Bò      RM 50  ││
│ │                              │   x1                      ││
│ │ Choose how to pay:           │ ───────────────────────── ││
│ │                              │ Subtotal:          RM 50  ││
│ │ ┌──────────────────────────┐ │ Shipping (West):  RM 8.00 ││
│ │ │  ●  💳 Pay with Stripe   │ │ SST (6%):       RM 3.00   ││
│ │ │     (Card · FPX)         │ │ ───────────────────────── ││
│ │ └──────────────────────────┘ │ Total:         RM 61.00   ││
│ │ ┌──────────────────────────┐ │                           ││
│ │ │  ○  💵 Cash on Delivery  │ │ [ Place Order — RM 61 ]   ││
│ │ └──────────────────────────┘ │   (enabled when method    ││
│ │ ┌──────────────────────────┐ │    selected)              ││
│ │ │  ○  📷 Bank Transfer / QR│ │                           ││
│ │ └──────────────────────────┘ │ 🔒 Secured by Stripe      ││
│ │                              │                           ││
│ │ ℹ️ You'll be redirected to   │                           ││
│ │  Stripe to complete payment  │                           ││
│ │  securely (Card or FPX).     │                           ││
│ └──────────────────────────────┴───────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

**Note:**
- Stripe row label thay đổi theo seller settings:
  - Card ON + FPX ON → "Pay with Stripe (Card · FPX)"
  - Card ON, FPX OFF → "Pay with Card"
  - Card OFF, FPX ON → "Pay with FPX (Online Banking)"
  - Cả 2 OFF → row ẨN hoàn toàn (chỉ hiện COD + QR)
- Method picker chứa **cả Stripe + Manual methods** (COD, QR từ F19) trong cùng 1 RadioGroup
- Stripe = 1 row duy nhất; KHÔNG split Card vs FPX inline (Stripe Checkout page handle)

#### 2.2.2. After "Place Order" — Processing redirect

```text
│  ⏳ Redirecting to Stripe...  │ [ Processing... ⏳ ]      │ ◄── disabled
│                              │                           │
│  Please don't close this     │                           │
│  window.                     │                           │
│                              │                           │
│  ┌──────────────────────┐    │                           │
│  │  (full-page overlay  │    │                           │
│  │   dim background     │    │                           │
│  │   + Stripe logo +    │    │                           │
│  │   spinner)           │    │                           │
│  └──────────────────────┘    │                           │
```

**Flow:**
1. User chọn "Pay with Stripe" + click "Place Order"
2. Client POST `/api/orders/create` → backend tạo Stripe Checkout Session (Direct Charge on connected account)
3. Backend trả `{ url: 'https://checkout.stripe.com/...' }`
4. Client redirect bằng `window.location.href = url` → Stripe Checkout page mở
5. Stripe page render: Card form HOẶC FPX bank picker (theo `payment_method_types` server pass)
6. Buyer complete → Stripe redirect `success_url` (`/sites/[slug]/orders/[id]/confirmation`) hoặc `cancel_url` (`/sites/[slug]/checkout`)
7. Webhook `checkout.session.completed` → backend update order status `pending` → `new`

#### 2.2.3. On return — Success

→ Buyer landed `/sites/[slug]/orders/[id]/confirmation` page (F10 scope). KHÔNG có UI ở checkout.

#### 2.2.4. On return — Cancelled / Failed (FR-04, FR-05)

```text
│ 3. Payment Method            │ 🛒 Order Summary          │
│                              │                           │
│ ⚠️ Pembayaran gagal.         │ • Áo Khoác Bò      RM 50  │ ◄── cart preserved
│   Sila cuba lagi.            │   x1                      │
│                              │ Subtotal:          RM 50  │
│ ┌──────────────────────────┐ │ Shipping (West):  RM 8.00 │
│ │  ●  💳 Pay with Stripe   │ │ SST (6%):       RM 3.00   │
│ │     (Card · FPX)         │ │ ───────────────────────── │
│ └──────────────────────────┘ │ Total:         RM 61.00   │
│ ┌──────────────────────────┐ │                           │
│ │  ○  💵 Cash on Delivery  │ │ [ Try Again ]             │
│ └──────────────────────────┘ │                           │
```

**Components:**
- Method radio: `<RadioGroup>` + `<RadioGroupItem>` wrapped trong Card-like row (border + padding ≥ 54px height — FR-08)
- Stripe row label: dynamic text based on seller settings (computed server-side hoặc client-side via tenant context)
- Trust signal: `<p className="text-xs text-muted-foreground">` "🔒 Secured by Stripe"
- Redirect hint: `<Alert variant="default">` "You'll be redirected to Stripe..."
- Processing overlay: `<Dialog>` modal full-page với spinner + Stripe logo + "Don't close this window"
- BM error: Toast destructive "Pembayaran gagal. Sila cuba lagi." (5s persist) + cart preserved

**States:**
| State | UI |
|-------|-----|
| No method selected | All radios unchecked, Place Order disabled, hint "Choose how to pay" |
| Stripe selected | Stripe row active, hint "You'll be redirected to Stripe", Place Order enabled |
| COD selected | (F19 flow, không thuộc F13) |
| Redirecting (after click) | Place Order → spinner "Processing...", radios disabled, full-page overlay "Redirecting to Stripe..." |
| Returned (cancel_url) | Toast BM "Pembayaran gagal. Sila cuba lagi." (FR-04) + cart preserved (FR-05) + radios re-enabled + "Try Again" CTA |
| Network error | Toast destructive "Failed to start payment. Please try again." + Place Order re-enabled |
| Stripe Connect failed (seller-side) | Toast "Payment temporarily unavailable" + Stripe row disabled + fallback gợi ý COD/QR |

---

### 2.3. Screen C — Mobile 375px <a id="screen-c-mobile-375px"></a>

**Settings (Mobile):**

```text
┌──────────────────────┐
│ ☰  Payments     [×]  │ ◄── Mobile drawer nav
├──────────────────────┤
│                      │
│ 💳 Stripe Methods    │
│ Powered by Stripe    │
│ Checkout (3% fee)    │
│                      │
│ ┌──────────────────┐ │
│ │ 💳 Credit/Debit  │ │ ◄── 54px height (FR-08)
│ │    Card          │ │
│ │ Visa · MC · AmEx │ │
│ │           [●━]ON │ │ ◄── Switch ≥ 54x54px
│ └──────────────────┘ │
│                      │
│ ┌──────────────────┐ │
│ │ 🏦 FPX Banking   │ │
│ │    18 MY banks   │ │
│ │ MYR only         │ │
│ │          [○━]OFF │ │
│ └──────────────────┘ │
│                      │
│ ⚠️ At least one      │
│   method required    │
│                      │
│ 💵 Manual Methods    │
│ (COD, QR — F19)      │
└──────────────────────┘
```

**Checkout Payment (Mobile):**

```text
┌──────────────────────┐
│ ← Payment       🔒   │
├──────────────────────┤
│ 1. Contact ✓         │
│ 2. Shipping ✓        │
│ 3. Payment Method    │
│                      │
│ Choose how to pay:   │
│                      │
│ ┌──────────────────┐ │
│ │ ● 💳 Pay with     │ │ ◄── 54px hitbox (FR-08)
│ │   Stripe          │ │
│ │   Card · FPX      │ │
│ └──────────────────┘ │
│ ┌──────────────────┐ │
│ │ ○ 💵 COD          │ │
│ └──────────────────┘ │
│ ┌──────────────────┐ │
│ │ ○ 📷 Bank QR      │ │
│ └──────────────────┘ │
│                      │
│ ℹ️ Redirect to       │
│  Stripe for secure   │
│  payment             │
│                      │
│ ────────────────────│
│ 🛒 Order Summary     │
│ Subtotal:    RM 50   │
│ Shipping:  RM 8.00   │
│ SST:       RM 3.00   │
│ Total:    RM 61.00   │
│                      │
│ ┌──────────────────┐ │
│ │  Place Order     │ │ ◄── full-width sticky bottom
│ │  RM 61           │ │
│ └──────────────────┘ │
│ 🔒 Secured by Stripe │
└──────────────────────┘
```

**Stripe Checkout page (Stripe-hosted, NOT our UI):**

> Sau khi click "Place Order" → redirect ra `checkout.stripe.com`. Stripe tự render mobile-optimized:
> - Card form: card number / MM/YY / CVC / postcode
> - FPX: bank dropdown native iOS/Android picker (FR-09 satisfied automatically)
> - 3D Secure: Stripe handle
> - Receipt: Stripe handle
>
> **Chúng ta KHÔNG design UI này** — KISS, ưu tiên security + maintenance.

**Mobile-specific rules (FR-08, FR-09):**
- Method row: min height **54px** (FR-08 anti-mis-tap)
- Switch tap target: **54×54px** minimum (FR-08)
- Place Order: full-width primary, **sticky bottom** với safe-area padding
- FR-09 (native bank picker / bottom sheet): **satisfied automatically** bởi Stripe Checkout hosted page — không cần build inline

---

## 3. UI States Matrix

| Screen | Loading | Empty | Error | Success | Validation |
|--------|---------|-------|-------|---------|-----------|
| Settings | Skeleton 2 method rows | Destructive alert "Connect Stripe" + CTA | Toast destructive + revert toggle state | Toast "Payment methods updated" (Sonner 3s) | Soft warn `Alert` "At least one required" (không block Save) |
| Checkout — method select | RadioGroup skeleton 3 rows | Stripe row ẩn nếu cả Card+FPX OFF tenant-side | Toast "Failed to load checkout. Please refresh." | Place Order enabled | N/A (radio, no input) |
| Checkout — Place Order click | Button spinner "Processing..." + full-page overlay "Redirecting to Stripe..." | N/A | Toast destructive "Failed to start payment" + button re-enabled | Browser navigate `checkout.stripe.com/...` | N/A |
| Checkout — returned (cancel) | N/A | N/A | Toast BM "Pembayaran gagal. Sila cuba lagi." (FR-04) + cart preserved (FR-05) | (success → confirmation page, không trong checkout) | N/A |
| Mobile both | Same as desktop | Same | Same + larger error text (≥14px) | Same | Same + 54px hitbox |

---

## 4. Component Inventory

| Component | shadcn/ui | Usage |
|-----------|-----------|-------|
| Card group | `Card`, `CardHeader`, `CardContent` | Settings sections |
| Method row | `RadioGroup` + `RadioGroupItem` + custom label wrapper | Checkout method picker (1 row Stripe + COD + QR) |
| Toggle | `Switch` (hoặc custom checkbox như `PaymentsFormClient.tsx` hiện tại) | Settings enable/disable per method |
| Action button | `Button` (variants: default, ghost) | Save, Place Order, Connect Stripe, Try Again |
| Toast | `Sonner` | Save feedback, BM error "Pembayaran gagal" |
| Alert (warn) | `Alert variant="warning"` | "At least one method required" |
| Alert (info) | `Alert variant="default"` | "You'll be redirected to Stripe" |
| Alert (destructive) | `Alert variant="destructive"` | "Connect Stripe to enable methods" empty state |
| Badge | `Badge variant="secondary"` | "🔒 Secured by Stripe" trust signal |
| Dialog | `Dialog` | Full-page "Redirecting to Stripe..." overlay |
| Skeleton | `Skeleton` | Loading state (settings rows, checkout radio) |
| Spinner | `Loader2` từ lucide-react | Button processing state |

**Removed (vs previous Payment Element approach):**
- ❌ Stripe Card Element mount slot — không cần (Stripe Checkout hosted)
- ❌ FPX bank picker dropdown — không cần (Stripe Checkout hosted)
- ❌ Inline Stripe.js Elements provider — không cần

---

## 5. Design Tokens

Reference: [`docs/design/decorative-vocabulary.md`](./decorative-vocabulary.md), [`src/app/(dashboard)/settings/payments/PaymentsFormClient.tsx`](../../src/app/(dashboard)/settings/payments/PaymentsFormClient.tsx)

| Token | Value | Used in |
|-------|-------|---------|
| Card padding (desktop) | 25px | Settings cards (match existing `PaymentsFormClient.tsx`) |
| Card padding (mobile) | 16px | Mobile settings |
| Card border-radius | 16px | All cards |
| Card background | `bg-[#1E293B]/60` | Settings (dark theme) |
| Method row height (desktop) | 56px | Checkout radio row |
| Method row height (mobile) | **54px (min)** | FR-08 anti-mis-tap |
| Switch hit area (mobile) | **54×54px** | FR-08 |
| Switch dimensions | 56×32px (track), 24×24px (thumb) | Match existing `PaymentsFormClient.tsx` |
| Active toggle gradient | `from-blue-500 to-teal-400` | Match existing |
| Trust signal text | `text-xs text-muted-foreground` | "Secured by Stripe" |
| Error toast (BM) | `red-500` bg, white text, 5s persist | FR-04 |
| Redirect overlay | `bg-black/60` backdrop + `<Dialog>` center | Processing state |

---

## 6. Responsive Breakpoints

| Breakpoint | Width | Behavior |
|-----------|-------|----------|
| Mobile | 375-639px | Vertical stack, 54px method rows, sticky Place Order bottom, full-width buttons |
| Tablet | 640-1023px | Settings 1-col, checkout 1-col stacked (method + summary) |
| Desktop | ≥1024px | Settings 1-col centered, checkout 2-col side-by-side |

---

## 7. Out of Scope (Wave 7+)

- ❌ **Inline Stripe Payment Element** — Wave 6 dùng Stripe Checkout Session hosted; Payment Element inline defer (yêu cầu Stripe Connect setup phức tạp hơn cho Direct Charges)
- ❌ Custom Card form (MM/YY/CVC inline) — Stripe Checkout handle
- ❌ Custom FPX bank picker — Stripe Checkout handle
- ❌ Touch 'n Go eWallet (Stripe MY chưa GA)
- ❌ GrabPay, Boost (cần Ipay88 integration)
- ❌ Stripe Connect Express/Custom accounts — Wave 6 dùng Standard (Stripe-hosted onboarding)
- ❌ Saved cards / tokenized re-purchase (Wave 7+ — buyer accounts)
- ❌ Refund UI trong order detail (F10 scope riêng)
- ❌ Custom application_fee tier theo plan (Wave 6 hardcode 3%)

---

## 8. Decisions Log

> Chốt theo PM direction.

### 8.1. Both-OFF behavior — soft warn vs hard block

**Quyết định:** **Soft warn**. `<Alert variant="warning">` hiển thị, Save vẫn cho phép.

**Lý do:** Seller có thể đang test, chưa publish storefront. Hard block làm khó workflow. Storefront `live` check sẽ block public checkout (handled bởi Stripe row tự ẩn ở Screen B nếu cả 2 OFF).

**Hành vi cụ thể:**
- Cả Card + FPX OFF → Stripe row ẨN khỏi Screen B method picker (chỉ hiện COD + QR nếu enabled)
- Settings vẫn cho Save (không block)
- Toast warn "Storefront only shows COD / QR until you enable Card or FPX"

---

### 8.2. Card-fail vs FPX-fail copy

**Quyết định:** **Cả 2 dùng BM toast** "Pembayaran gagal. Sila cuba lagi." (FR-04).

**Lý do:**
- Buyer return từ Stripe Checkout (cancel_url) → không phân biệt được Card decline vs FPX timeout từ URL alone
- BM nhất quán cho MY market
- Stripe Checkout đã hiện chi tiết error EN trong session (trước khi redirect cancel) → buyer đã thấy reason

**Hành vi cụ thể:**
- Bất kỳ return-to-cancel_url → toast BM "Pembayaran gagal. Sila cuba lagi."
- Cart preserved (FR-05) — Order status stays `pending` (BR-03)
- "Try Again" button → click → re-submit `/api/orders/create` → new Stripe Checkout Session

---

### 8.3. Hitbox 54px vs Apple HIG 44px

**Quyết định:** **54px cho F13 mobile** (FR-08).

**Lý do:** Payment là moment-of-truth. Mis-tap → wrong method → frustration. 54px buffer worth extra space. F14 dùng 44px chỉ vì non-critical form input.

**Open question:** UX team có muốn align project-wide standard 54px cho mọi payment/checkout flow không?

---

### 8.4. Processing overlay — modal vs inline

**Quyết định:** **Full-page `<Dialog>` overlay** "Redirecting to Stripe, please don't close window".

**Lý do:** Stripe redirect mất 1-3s. Inline spinner dễ bị user hiểu nhầm là frozen → close tab → mất Stripe Checkout Session → friction. Modal forces attention + giải thích lý do.

**Hành vi cụ thể:**
- Click "Place Order" → button spinner + full-page Dialog với:
  - Stripe logo
  - Spinner
  - Copy: "Redirecting to Stripe Checkout. Please don't close this window."
- Dialog không có close button (force forward)
- Sau 5s nếu redirect chưa diễn ra → fallback button "Open Stripe Checkout manually" (link to URL)

---

### 8.5. Stripe-not-connected empty state placement

**Quyết định:** Replace 2 toggles bằng `<Alert variant="destructive">` "Connect Stripe to accept Card & FPX" + CTA `[Connect Stripe →]`.

**Toggle visual khi locked:**
- Toggle disabled + 🔒 icon overlay
- Click toggle → toast "Connect Stripe first" + scroll lên Connect CTA

**Link target:** `/dashboard/settings/payments/connect` (existing endpoint `/api/stripe/connect/onboard` đã có sẵn ở `src/app/api/stripe/connect/onboard/route.ts`)

---

### 8.6. Stripe Checkout Session vs Payment Element (**KEY DECISION**)

**Quyết định:** **Stripe Checkout Session HOSTED** cho Wave 6. Payment Element inline defer Wave 7+.

**Lý do:**
- Code hiện tại (`src/lib/payment/stripe.ts`) đã implement Stripe Checkout Session + Stripe Connect Direct Charges → không refactor
- Stripe Checkout page tự handle Card + FPX + 3D Secure + receipt → security + maintenance lower
- KISS — không cần build Stripe.js Elements provider, không cần CardElement/PaymentElement mount slot
- FR-09 (native bank picker / bottom sheet) satisfied automatically bởi Stripe-hosted mobile page
- 3% application_fee_amount đã wired (`stripe.ts:117`)

**Trade-off:**
- Mất control UX khi user vào Stripe page (branding break)
- Mitigation: Trust signal "Secured by Stripe" + clear copy "You'll be redirected to Stripe"

**PRD §13 conflict:** PRD viết code sample `paymentIntents.create` + Payment Element. PRD §13 cần update để match code reality (Checkout Session). Đề xuất BA update PRD §13 + §17.

---

### 8.7. Card label dynamic based on settings

**Quyết định:** Stripe row label thay đổi theo settings:
| Card | FPX | Label |
|------|-----|-------|
| ON | ON | "Pay with Stripe (Card · FPX)" |
| ON | OFF | "Pay with Card" |
| OFF | ON | "Pay with FPX (Online Banking)" |
| OFF | OFF | (Stripe row hidden entirely) |

**Lý do:** Reduces buyer confusion — chỉ show options thực sự available. Backend pass dynamic `payment_method_types` vào Stripe Checkout → Stripe page chỉ render method tương ứng.

---

## 9. Cross-feature References

| Feature | Touchpoint | Notes |
|---------|-----------|-------|
| F09 Storefront | Hosts checkout payment section | F13 thêm "Pay with Stripe" row vào method RadioGroup (cùng COD + QR) |
| F10 Orders | Order status update via webhook `checkout.session.completed` | Webhook đã wired ở `src/app/api/webhooks/stripe/route.ts` |
| F14 Shipping | Sibling card trong `Settings` group | Same dark theme tokens, similar Card pattern |
| F18 CMS Layout | Sidebar + Topbar cho Dashboard | Settings page tuân thủ F18 breadcrumb |
| F19 Store Config | Existing `Settings > Payments` page với COD + QR | F13 thêm card "Stripe Payment Methods" — KHÔNG thay thế Manual Methods |
| F21 Localization | Future — translate BM error strings | Wave 6: hardcode BM "Pembayaran gagal" |
| Stripe Connect | Onboarding flow ở `src/app/api/stripe/connect/onboard/route.ts` | Yêu cầu seller complete onboard trước khi enable Card/FPX |

---

## 10. Unresolved Questions

1. **PRD §0 outdated:** PRD vẫn note "F13 chưa có Story file riêng" — stories file đã tồn tại (3 stories). BA cần update PRD §0.
2. **PRD §13 code sample misleading:** PRD viết Payment Element pattern, code dùng Checkout Session. BA/PM cần update PRD §13 + §17 9-Point Done Checklist (bỏ "Card Element validation", thay bằng "Stripe redirect happy path").
3. **Architecture file:** `docs/architecture/F13-payment-gateway.md` chưa tồn tại. Dev cần draft: Direct Charges flow, application_fee_amount calc, webhook signature verify, idempotency (orderId làm `client_reference_id`), connected account state machine.
4. **Figma scope:** Node `30877-2233` cover screens nào? Cần Design team confirm Figma đã align với hướng A (Checkout Session) chứ không phải Payment Element inline.
5. **Card toggle wiring:** `PaymentsFormClient.tsx` line 288-296 hiện đang mock toggle. F13 cần ticket: wire `handleToggleStripe` + persist `tenant.paymentMethods.card` + add FPX toggle (currently missing).
6. **Dynamic `payment_method_types`:** Hiện code hardcode `['card', 'fpx']` ở `stripe.ts:123`. F13 cần refactor: pass dynamic array từ `orders/create` route based on tenant settings.
7. **MYR-only enforcement:** BR-01 yêu cầu MYR. UI có cần warning nếu seller dùng non-MYR không, hay assume MYR-by-default cho MY stores?
8. **3% application fee disclosure:** Hiện copy "3% platform fee applies" hiển thị nhỏ ở Settings header. PM có muốn highlight rõ hơn không (modal info icon, link tới pricing page)?
9. **Story status review:** US-F13-01 và US-F13-02 đang `Status: Draft`, chỉ US-F13-03 `Ready`. BA/PM cần review move sang Ready trước Phase 03.
