# PRD: Shipping — Malaysia (F14)
> **Version:** 1.1 | **Updated:** 2026-03-16 | **Agent:** `project-planner`
> **Priority:** P1 | **Sprint:** Wave 6 | **Size:** M
> **Depends on:** F09 Storefront Commerce ✅, F10 Orders Management ✅
> **MY Ref:** [malaysia-market-context.md](../malaysia-market-context.md) — §5 Shipping Landscape

---

> [!IMPORTANT]
> **Stories-First Rule:** PRD này được xây dựng từ các User Stories đã approve.
> Mọi FR phải có Story Ref. AC được copy từ story file.

> [!NOTE]
> F14 chưa có Story file riêng. Checkout shipping (WestMY/EastMY) được derived từ US-F14-03.
> **Action required:** Tạo `F12-shipping-stories.md` trước Wave 6 development.

---

## 0. Story Traceability

| Story ID | Title | File | Status |
|----------|-------|------|--------|
| US-F14-03 | Checkout — Shipping by State AC | [F09-storefront-stories.md](../stories/F09-storefront-stories.md) | Draft |
| *(Pending)* | Seller Sets Shipping Rates | *(F12-shipping-stories.md chưa có)* | Needs Story |
| *(Pending)* | Track Order Delivery | *(F12-shipping-stories.md chưa có)* | Needs Story |

> ⚠️ Seller shipping settings và tracking stories chưa tạo. Tạo trước Wave 6.

---

## 1. Problem Statement

PrimeWeb không có shipping logic. Checkout hiện create orders mà không tính shipping fees. Sellers Malaysia cần shipping cost auto-calculation theo state, và buyers cần thấy delivery cost trước khi thanh toán. Không có → seller phải tính tay qua WhatsApp.

---

## 2. Target User

- **SME Owner:** Set shipping rates, cập nhật tracking number
- **Buyer:** Thấy shipping cost tại checkout, track delivery

---

## 3. Solution Overview

**Wave 6 (P0):** Flat rate shipping theo region: West Malaysia RM 8, East Malaysia RM 15. Seller có thể customize trong Settings. Free shipping threshold configurable.

**Wave 7+ (P1):** Carrier API integration (J&T, Pos Laju, Ninja Van) via EasyParcel aggregator.

---

## 4. Scope

### In Scope (Wave 6)
- Flat rate by state: West MY = RM 8, East MY = RM 15 (US-F14-03)
- Seller customizable rates trong Settings (Pending story)
- Free shipping threshold (Pending story)
- Malaysian states dropdown (16 states + territories)

### Out of Scope (Wave 7+)
- Carrier API (J&T, Pos Laju) — EasyParcel integration
- Tracking number + tracking link
- Label printing

---

## 5. Success Metrics

| Metric | Target | Measured By |
|--------|--------|-------------|
| Orders with shipping cost shown | 100% | DB check |
| Seller shipping setup time | < 2 min | UX test |

---

## 6. User Story Summary

```
AS A   buyer tại checkout
I WANT thấy shipping cost trước khi thanh toán
SO THAT tôi biết tổng tiền thực sự phải trả
```

> Source: [US-F14-03](../stories/F09-storefront-stories.md#us-f10-03)

---

## 7. Functional Requirements

| FR-ID | Requirement | Story Ref | Priority | Notes |
|-------|-------------|-----------|----------|-------|
| FR-01 | State dropdown: 16 Malaysian states + territories | US-F14-03 | P0 | |
| FR-02 | Shipping auto-calculate: West MY = RM 8, East MY = RM 15 | US-F14-03 | P0 | |
| FR-03 | Order summary: Subtotal + Shipping + SST = Total | US-F14-03 | P0 | |
| FR-04 | Free shipping khi subtotal ≥ threshold | *(Pending)* | P1 | Seller configurable |
| FR-05 | "Add RM X more for free shipping" hint | *(Pending)* | P1 | |
| FR-06 | Seller Settings: customize West/East rates, free threshold | *(Pending)* | P0 | |
| FR-07 | Seller Settings: estimated delivery days per region | *(Pending)* | P1 | |

---

## 8. Business Rules

- **BR-01:** West MY = Johor, Kedah, Kelantan, Melaka, N.Sembilan, Pahang, Perak, Perlis, Penang, Selangor, Terengganu, KL, Putrajaya, Labuan
- **BR-02:** East MY = Sabah, Sarawak
- **BR-03:** Seller rates override defaults — stored trong `site.shippingConfig`
- **BR-04:** Rate phải ≥ 0 (free shipping allowed)
- **BR-05:** SST 6% computed on subtotal ONLY (không gồm shipping)

---

## 9. User Flow

```
Checkout form → type address
  → Select state from dropdown
  ↓
  ├── State in West MY → RM 8 shown
  └── State in East MY → RM 15 shown

  ├── Subtotal ≥ free threshold → RM 0 "🎉 Free Shipping"
  └── Subtotal < free threshold → "Add RM X more for free"

  Order Summary:
  Subtotal: RM XXX
  Shipping: RM 8 / RM 15 / FREE
  SST (6%): RM X.XX
  Total:    RM XXX
```

---

## 10. Screen Layout

```
Checkout (/sites/[slug]/checkout):
┌─ Shipping ─────────────────────────────┐
│  [Address Line 1*     ]                │
│  [City*   ] [Postcode*]                │
│  [State ▼ — 16 states]                 │
│                                         │
│  📦 Standard Delivery — RM 8.00        │
│     Est. 3-5 business days             │
│     (Sabah/Sarawak: RM 15, 5-7 days)  │
└────────────────────────────────────────┘

Settings (/dashboard/settings/shipping):
┌──────────────────────────────────────┐
│  Semenanjung (West):  [RM 8  ]       │
│  Sabah & Sarawak:     [RM 15 ]       │
│  Free shipping above: [RM 150]       │
│  ☐ Enable free shipping              │
│  [Save Settings]                     │
└──────────────────────────────────────┘
```

---

## 11. Acceptance Criteria

> AC từ US-F14-03. Seller Settings AC pending story.

### AC-1: West Malaysia Shipping
> 📌 Source: [US-F14-03](../stories/F09-storefront-stories.md) — Market Notes

```gherkin
GIVEN buyer at checkout selects state = "Selangor"
WHEN  state is in Semenanjung list
THEN  shipping cost shows RM 8.00
  AND order summary: Subtotal + RM 8.00 + SST = Total
```

### AC-2: East Malaysia Shipping
> 📌 Source: [US-F14-03](../stories/F09-storefront-stories.md) — Market Notes

```gherkin
GIVEN buyer selects state = "Sabah" or "Sarawak"
WHEN  shipping calculates
THEN  shipping cost shows RM 15.00
  AND estimated delivery "5-7 business days"
```

### AC-3: Malaysian States Dropdown
> 📌 Source: [US-F14-03](../stories/F09-storefront-stories.md) — AC-3

```gherkin
GIVEN buyer at checkout address form
WHEN  clicks State dropdown
THEN  shows all 16 Malaysian states + federal territories:
      Johor, Kedah, Kelantan, Melaka, Negeri Sembilan, Pahang,
      Perak, Perlis, Pulau Pinang, Sabah, Sarawak, Selangor,
      Terengganu, W.P. Kuala Lumpur, W.P. Putrajaya, W.P. Labuan
```

---

## 12. Non-Functional Requirements

| Category | Requirement | Notes |
|----------|-------------|-------|
| **Accuracy** | Shipping rate 100% correct based on state | Auto-tested |
| **Device** | Mobile 375px — address fields stack, state full-width | |

---

## 13. Technical Architecture

### Data Model

```typescript
// Sites collection — add shippingConfig
shippingConfig: {
  westRate: number,        // default: 800 (RM 8.00 in cents)
  eastRate: number,        // default: 1500 (RM 15.00)
  freeAbove: number | null // null = no free shipping
  westDays: string,        // "3-5"
  eastDays: string,        // "5-7"
}

// Orders collection — add shipping
shipping: {
  address: { line1, line2, city, state, postcode, country: "Malaysia" },
  cost: number,
  method: 'standard',
  trackingNumber?: string, // Wave 7+
}
```

### API Endpoints

```
GET /api/sites/:id/shipping-config          → get rates
PATCH /api/sites/:id/shipping-config        → update rates (auth required)
POST /api/orders/calculate-shipping         → returns cost based on state
```

---

## 14. Dependencies

| Dependency | Status | Action Needed |
|-----------|--------|---------------|
| F09 Storefront | ✅ | — |
| F10 Orders collection | ✅ | Add shipping fields |
| EasyParcel API (Wave 7) | ⬜ | Future |

---

## 17. 9-Point Done Checklist

- [ ] Loading State — Shipping calculation spinner
- [ ] Empty State — N/A
- [ ] Error State — "Failed to calculate shipping" + retry
- [ ] Form Validation — Address, State required
- [ ] Button States — Save Settings disabled during API
- [ ] Toast Feedback — "Shipping settings saved!"
- [ ] Auth Redirect — Settings requires auth; checkout public
- [ ] Mobile 375px — Address fields stack, state full-width
- [ ] TypeScript Clean — `tsc --noEmit` pass

---

## 18. Definition of Ready

- [ ] ⚠️ Story file `F12-shipping-stories.md` created
- [ ] F09, F10 done
- [ ] All 16 MY states list confirmed

---

## 19. Definition of Done

- [ ] All FR implemented
- [ ] Shipping cost calculation verified (all 16 states)
- [ ] Free shipping threshold works
- [ ] Seller settings saved and applied correctly
