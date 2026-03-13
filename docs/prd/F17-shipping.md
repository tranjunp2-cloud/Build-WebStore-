# PRD: Shipping — Malaysia (F17)
> **Version:** 1.0 | **Created:** 2026-03-13 | **Agent:** `project-planner`  
> **Priority:** P1 | **Wave:** 6 | **Size:** M  
> **Depends on:** F10 Storefront Commerce ✅, F11 Orders Management ✅  
> **MY Ref:** [malaysia-market-context.md](../malaysia-market-context.md) — §5 Shipping Landscape

---

## 1. Problem Statement

PrimeWeb has no shipping logic. Checkout currently creates orders without shipping fees. Malaysian sellers need shipping cost auto-calculation based on destination state, and buyers need to know delivery costs before paying. Without this, sellers manually calculate shipping via WhatsApp — defeating the purpose of an automated store.

## 2. Target User

- **SME Owner:** Sets shipping rates, prints shipping labels
- **Buyer:** Sees shipping cost at checkout, tracks delivery

## 3. Success Metrics

| Metric | Target | How |
|--------|--------|-----|
| Orders with shipping | > 80% | Orders with address |
| Shipping cost visibility | 100% | Always shown before payment |
| Seller shipping setup time | < 2 min | Onboarding flow |

## 4. User Stories

### US-17A: Shipping Cost at Checkout
```
AS A buyer
I WANT TO see shipping cost before I pay
SO THAT I know the total amount including delivery
```

### US-17B: Seller Sets Shipping Rates
```
AS A site owner
I WANT TO set shipping rates for my store
SO THAT buyers are charged correctly for delivery
```

### US-17C: Track Order Delivery
```
AS A buyer
I WANT TO track my delivery status
SO THAT I know when my order will arrive
```

## 5. Shipping Model — Phased

### Wave 6 — Flat Rate by Region (P0)

Simple, no API integration needed:

| Region | States | Rate |
|--------|--------|:----:|
| **Semenanjung** (West MY) | Johor, Kedah, Kelantan, Melaka, N. Sembilan, Pahang, Perak, Perlis, Penang, Selangor, Terengganu, KL, Putrajaya, Labuan | **RM 8** |
| **Sabah & Sarawak** (East MY) | Sabah, Sarawak | **RM 15** |
| **Free shipping** | Seller configurable | Above RM X |

Seller can customize rates in Settings.

### Wave 7+ — Carrier API (P1)

| Carrier | API | Features |
|---------|-----|----------|
| **J&T Express** | REST API | Auto rate calc, tracking, label printing |
| **Pos Laju** | EasyParcel API | Auto rate calc, pickup scheduling |
| **Ninja Van** | REST API | Cross-border (SG, ID) |

Integration via **EasyParcel** (aggregator) — 1 API for all 3 carriers.

## 6. Screen Layouts

### Checkout — Shipping Step
```
┌─ Shipping ────────────────────────────┐
│                                        │
│  Delivery Address:                    │
│  [Address Line 1*     ]               │
│  [Address Line 2      ]               │
│  [City*     ] [Postcode*]             │
│  [State* ▼ Malaysian states dropdown] │
│                                        │
│  ┌─ Shipping Option ───────────────┐  │
│  │ 📦 Standard Delivery            │  │
│  │    J&T / Pos Laju               │  │ ← Wave 7: actual carrier
│  │    3-5 business days            │  │
│  │    RM 8.00 (Semenanjung)        │  │
│  └──────────────────────────────────┘ │
│                                        │
│  ☐ Free shipping if above RM 150     │ ← seller configurable
└────────────────────────────────────────┘
```

### Dashboard — Shipping Settings
```
┌─ Settings > Shipping ──────────────────┐
│                                         │
│  Shipping Rates                         │
│  ┌────────────────────────────────────┐│
│  │ Semenanjung (West):  [RM 8  ]     ││
│  │ Sabah & Sarawak:     [RM 15 ]     ││
│  │ Free shipping above: [RM 150]     ││
│  │ ☐ Enable free shipping            ││
│  └────────────────────────────────────┘│
│                                         │
│  Estimated Delivery                     │
│  ┌────────────────────────────────────┐│
│  │ Semenanjung: [3-5 ] business days ││
│  │ Sabah/Sarawak: [5-7] business days││
│  └────────────────────────────────────┘│
│                                         │
│  [Save Settings]                        │
└─────────────────────────────────────────┘
```

## 7. Acceptance Criteria

### AC-1: Shipping Cost at Checkout
```gherkin
GIVEN buyer at checkout enters address with state = "Selangor"
WHEN  state is in Semenanjung list
THEN  shipping cost shows RM 8.00 (or seller's custom rate)
AND   order summary updates: Subtotal + Shipping + SST = Total
```

### AC-2: East Malaysia Shipping
```gherkin
GIVEN buyer selects state = "Sabah" or "Sarawak"
WHEN  shipping calculates
THEN  shipping cost shows RM 15.00 (or seller's custom rate)
AND   estimated delivery shows "5-7 business days" (vs 3-5 for West)
```

### AC-3: Free Shipping Threshold
```gherkin
GIVEN seller set free shipping above RM 150
WHEN  buyer's subtotal ≥ RM 150
THEN  shipping = RM 0, show "🎉 Free Shipping!"
AND   if subtotal < RM 150, show "Add RM X more for free shipping"
```

### AC-4: Seller Shipping Settings
```gherkin
GIVEN seller navigates to Settings > Shipping
WHEN  changes rates and clicks Save
THEN  new rates apply to all future checkout sessions
AND   validation: rates must be ≥ 0
AND   toast "Shipping settings saved!"
```

### AC-5: Malaysian States Dropdown
```gherkin
GIVEN buyer at checkout address form
WHEN  clicks State dropdown
THEN  shows all 16 Malaysian states + federal territories:
      Johor, Kedah, Kelantan, Melaka, Negeri Sembilan, Pahang,
      Perak, Perlis, Pulau Pinang, Sabah, Sarawak, Selangor,
      Terengganu, W.P. Kuala Lumpur, W.P. Putrajaya, W.P. Labuan
```

### AC-6: Tracking Number (Wave 7)
```gherkin
GIVEN seller updates order status to "Shipped"
WHEN  tracking number field appears
THEN  seller enters tracking number (e.g., J&T: 600123456789)
AND   buyer receives WhatsApp/email with tracking link
AND   tracking link: https://www.tracking.my/[carrier]/[number]
```

## 8. Data Model

### Sites collection — add shipping config
```typescript
shippingConfig: {
  westRate: number,       // default: 800 (RM 8.00 in cents)
  eastRate: number,       // default: 1500 (RM 15.00)
  freeAbove: number | null, // null = no free shipping
  westDays: string,       // "3-5"
  eastDays: string,       // "5-7"
}
```

### Orders collection — add shipping
```typescript
shipping: {
  address: { line1, line2, city, state, postcode, country },
  method: 'standard',
  cost: number,
  trackingNumber: string | null,
  carrier: string | null,    // 'jt', 'poslaju', 'ninjavan'
}
```

## 9. 9-Point Done Checklist

- [ ] Loading State — Shipping calculation shows spinner
- [ ] Empty State — N/A
- [ ] Error State — "Failed to calculate shipping" + retry
- [ ] Form Validation — Address, State required
- [ ] Button States — "Save Settings" disabled during API call
- [ ] Toast Feedback — "Shipping saved!", "Free shipping!"
- [ ] Auth Redirect — Settings requires auth; checkout is public
- [ ] Mobile 375px — Address fields stack, state dropdown full-width
- [ ] TypeScript Clean
