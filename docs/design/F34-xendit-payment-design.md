# UI Design Spec: F34 — Xendit Payment Integration (Malaysia)

> **Version:** 1.0 | **Created:** 2026-06-10 | **Owner:** Domin (Product) + Dev
> **PRD:** [F34 Overview](../prd/F34-xendit-payment-overview.md) · [S1](../prd/F34-xendit-payment-sprint1.md) · [S2](../prd/F34-xendit-payment-sprint2.md) · [S3](../prd/F34-xendit-payment-sprint3.md)
> **Stack:** Next.js 15 App Router + Tailwind + shadcn/ui · **Mirror:** `StripeConnectBlock.tsx`, `StripeConnectedBar.tsx`
> **Skill:** ✅ `ui-ux-pro-max` (design-system + ux domain)

---

## 0. Design Tokens (kế thừa codebase — KHÔNG tự đặt màu mới)

| Token | Dùng | Nguồn |
|-------|------|-------|
| `--dash-surface` | Nền card dashboard | đã có (Stripe blocks) |
| Status green `emerald-500` | Approved / paid / connected | đã có |
| Status amber `amber-400/500` | KYB pending / verify | đã có (Stripe verify mode) |
| Status red | Rejected / failed / refund | semantic |
| Xendit accent | dùng **xanh dương** `#2563EB`/`#3B82F6` (design-system) phân biệt với Stripe cyan `#0EA5E9` | mới (chỉ accent) |
| Icons | **Lucide** (no emoji) — `Wallet`, `ShieldCheck`, `Loader2`, `BadgeCheck`, `Banknote`, `QrCode`, `RefreshCw` | đã có pattern |
| Fonts | hệ font dashboard hiện tại (không đổi) | codebase |
| i18n | `useI18n()` → `t.dashboard.settings.payments.*` (thêm key `xendit*`) | đã có |

> **Anti-pattern (design-system):** ❌ AI purple/pink gradient · ❌ unclear fees · ❌ emoji icons · ❌ playful. Fintech = trust + scannable + status-color rõ.

---

## 1. Screen List (7 màn)

| # | Screen | Route / Vị trí | Sprint | Device ưu tiên |
|---|--------|----------------|--------|----------------|
| S1 | Xendit Connect block (3 states) | `settings/payments` | 1 | Desktop + mobile |
| S2 | Connect confirmation (check email) | `settings/payments` sau connect | 1 | Desktop + mobile |
| S3 | Storefront checkout — method picker | storefront checkout | 2 | **Mobile-first** |
| S4 | Redirect-to-Xendit interstitial | sau checkout | 2 | **Mobile-first** |
| S5 | Confirm / payment-status (poll self-heal) | `/sites/[slug]/order/[id]/confirm` | 2 | **Mobile-first** |
| S6 | Auto-Withdrawal block (bank+schedule+balance) | `settings/payments` | 3 | Desktop + mobile |
| S7 | Order detail — refund action (Xendit) | order detail (dashboard) | 3 | Desktop + mobile |

---

## 2. Screen Flows

```
Merchant: S1(not connected) ──connect──▶ S2(check email) ──merchant verify on Xendit Dashboard──▶ S1(pending/awaiting) ──webhook account.activated──▶ S1(LIVE) ──▶ S6(setup payout)
Buyer:    S3(pick wallet) ──pay──▶ S4(redirect) ──Xendit hosted──▶ S5(confirm, poll) ──paid──▶ order success
Seller:   S7 order detail ──refund──▶ confirm dialog ──▶ Xendit refund ──webhook──▶ status refunded
```

---

## 3. Component Specs

### S1 — Xendit Connect Block (mirror `StripeConnectBlock.tsx`)

Card grid `56px 1fr auto`, rounded-[18px], gradient nền theo state. 3 trạng thái:

| State | Border / glow | Icon | Title | CTA |
|-------|---------------|------|-------|-----|
| **not_connected** | blue `rgba(37,99,235,0.32)` | `Wallet` | "Kết nối Xendit — nhận TNG, GrabPay, DuitNow, FPX" | **Connect Xendit** (primary) |
| **kyb_pending** | amber `rgba(251,191,36,0.35)` | `Loader2` (spin) | "Đang duyệt KYB" | banner "1–5 ngày" + **Refresh status** (secondary) |
| **LIVE** | emerald `0.26` | `BadgeCheck` | "Xendit đã sẵn sàng" (mirror `StripeConnectedBar`) | sub-account id (mask) + **Disconnect** |

- **Steps list** (chỉ ở not_connected): 1. Tạo sub-account · 2. Nộp KYB trên Xendit · 3. Bật nhận tiền (mirror `stripeStep1/2/3`).
- Fee transparency line (anti-pattern "unclear fees"): "Phí giao dịch do bạn chịu (ví ~1.2–1.7%, FPX ~RM1.20, thẻ ~2%). Nền tảng không thu phí giao dịch." — `[NEED: chốt số cuối]`.

### S3 — Checkout Method Picker (mobile-first, CRITICAL)

Radio-card list, **mỗi card ≥ 44px hitbox** (touch-target-size), gap ≥ 8px (touch-spacing):

```
┌─────────────────────────────────────┐
│ ( ) [TNG logo]  Touch 'n Go      ›  │  ← 56px hitbox (F13 đã set 54px chuẩn)
├─────────────────────────────────────┤
│ ( ) [Grab logo] GrabPay          ›  │
│ (•) [QR icon]   DuitNow QR        ›  │  ← selected: border accent + check
│ ( ) [bank icon] FPX Online Bank  ›  │
│ ( ) [card icon] Thẻ Visa/Master  ›  │
└─────────────────────────────────────┘
   [ Tiếp tục thanh toán → ]  (primary, full-width mobile, sticky bottom)
```

- Chỉ hiển thị method **tenant/site enabled** (FR-5 S2). Rỗng → empty state "Cửa hàng chưa bật phương thức nào".
- Logo ví: **brand asset chính thức** (rule `correct-brand-logos`), SVG, không tự recolor.
- Selected state: border accent + `Check` icon + bg nhẹ; KHÔNG chỉ dùng màu (color-not-only) → thêm icon check.
- Settlement hint nhỏ dưới (number-tabular cho tiền): "VA tức thì · ví ~T+2 · thẻ ~T+7" — `[NEED xác nhận]`.

### S4 — Redirect Interstitial (mobile-first)

Full-screen centered: spinner `Loader2` + "Đang chuyển tới trang thanh toán an toàn của Xendit…" + dòng trust "Thông tin thẻ/ví của bạn đi thẳng tới Xendit, không qua máy chủ chúng tôi." (`ShieldCheck`). Auto-redirect; nếu > 5s show fallback link "Bấm vào đây nếu không tự chuyển".

### S5 — Confirm / Payment-Status (poll self-heal, mobile-first)

3 visual states (mirror F13 confirm flow):

| State | Visual | Hành vi |
|-------|--------|---------|
| **checking** | skeleton + `Loader2` "Đang xác nhận thanh toán…" | poll `/api/orders/[id]/payment-status` mỗi ~3s, tối đa ~30s (progressive-loading) |
| **paid** | `BadgeCheck` xanh + tóm tắt đơn | dừng poll, hiện CTA "Xem đơn" |
| **failed/expired** | icon đỏ + lý do | CTA "Thử lại" (retry pay) — mirror F13 retry-payment |

- KHÔNG xoá cart cho tới khi confirmed paid (F13 decision US-F13-05).
- `aria-live="polite"` cho status announce (toast-accessibility / aria-live).

### S6 — Auto-Withdrawal Block (Sprint 3)

Card trong settings/payments (dưới S1 khi account = LIVE):

- **Balance display**: số dư sub-account (read-only, number-tabular), + "Payout kế tiếp: {date}".
- **Bank field**: chọn/thêm bank — helper "Tên tài khoản phải khớp KYB" (input-helper-text). Chưa có bank → disabled toggle + lý do (FR-9).
- **Schedule select**: Daily / Weekly / Monthly (radio/segmented). Default `manual`.
- **Toggle** bật Auto-Withdrawal: confirm dialog trước khi bật (confirmation-dialogs). Disabled khi thiếu bank (disabled-states opacity 0.4 + cursor).
- Fee note: "Phí rút DuitNow ~RM1.50/đợt do bạn chịu" — `[NEED]`.

### S7 — Order Detail Refund (Xendit)

- Nút **Refund** chỉ hiện khi `payment_provider='xendit'` && `payment_status='paid'`.
- Click → dialog: input amount (default = full, cho partial), validate ≤ paid (inline-validation, blur). **Destructive emphasis** (red) + tách khỏi primary actions (destructive-emphasis).
- Submit → loading (loading-buttons, disable while async) → success toast / error với recovery path (error-recovery).
- Hiển thị refund status badge: refunded / partially_refunded.

---

## 4. Responsive

| Breakpoint | S1/S6/S7 (dashboard) | S3/S5 (storefront) |
|------------|----------------------|--------------------|
| 375 (mobile) | card 1 cột, CTA full-width, grid `56px 1fr` (ẩn cột auto, đẩy CTA xuống) | method cards full-width, CTA sticky bottom + safe-area inset |
| 768 (tablet) | giữ 2 cột | content max-w, padding rộng hơn |
| 1024+ (desktop) | grid `56px 1fr auto` đầy đủ | centered max-w-md |

- `min-h-dvh` thay `100vh` (viewport-units) cho S4/S5.
- No horizontal scroll mobile; method picker fit viewport (horizontal-scroll rule).
- Fixed CTA bar reserve safe padding (fixed-element-offset + safe-area-awareness).

---

## 5. Interaction States

| Element | Default | Hover | Pressed | Loading | Disabled | Focus |
|---------|---------|-------|---------|---------|----------|-------|
| Connect CTA | primary blue | darken 150ms | scale 0.98 | `Loader2` + "Đang kết nối…" | opacity 0.4 + cursor | ring 2px |
| Method card | border subtle | border accent | scale 0.98 bg | — | opacity 0.4 | ring 2px |
| Refund btn | red outline | red fill | scale 0.98 | spinner | opacity 0.4 | ring 2px |
| Payout toggle | off gray | — | — | — | off+reason khi thiếu bank | ring |

- Transition 150–300ms (duration-timing), `transform`/`opacity` only (transform-performance).
- `prefers-reduced-motion`: tắt spin/scale, giữ trạng thái tĩnh rõ (reduced-motion).

---

## 6. Accessibility (CRITICAL)

- **Contrast** ≥ 4.5:1 text trên status cards (amber/green nền nhạt → text đậm). Verify cả light/dark.
- **Touch targets** ≥ 44px (method cards 54px theo F13 chuẩn).
- **Icon-only buttons** (refresh, disconnect) → `aria-label` (aria-labels).
- **Color-not-only**: selected method = border + `Check` icon (không chỉ màu); status = icon + text + màu.
- **Keyboard**: method picker là radiogroup, arrow keys di chuyển; tab order khớp visual.
- **aria-live="polite"** cho S5 status + toast (không cướp focus).
- **Focus management**: refund dialog error → focus field lỗi đầu tiên (focus-management).
- **Escape routes**: dialog/modal có nút close + ESC (escape-routes).
- **Form**: bank field có label hiện (không placeholder-only), error dưới field, required mark.

---

## 7. Empty / Error States

| Screen | Empty/Error | Message + action |
|--------|-------------|------------------|
| S3 | Không method nào enabled | "Cửa hàng chưa bật phương thức thanh toán" |
| S5 | Webhook trễ > 30s | "Vẫn đang xác nhận… Bấm làm mới" + retry (timeout-feedback) |
| S5 | Payment failed | lý do + "Thử lại" |
| S6 | Chưa có bank | disabled toggle + "Thêm bank khớp tên KYB" |
| S7 | Refund fail | error + "Thử lại"/help link |

---

## 8. [NEED]

- `[NEED]` Brand asset chính thức TNG/GrabPay/DuitNow/FPX (logo SVG + usage guideline).
- `[NEED]` Số phí cuối (giao dịch + rút) để hiển thị transparency line.
- `[NEED]` Xendit hosted checkout page có cho custom branding/logo merchant không.
- `[NEED]` Settlement timeline chính thức để hiển thị hint S3/S5.
