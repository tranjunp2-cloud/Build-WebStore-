# EasyParcel Status Taxonomy & Order Lifecycle Mapping

**Date:** 2026-06-17  
**Objective:** Determine if EasyParcel delivery statuses can map to internal order lifecycle, or require separate tracking field  
**Scope:** EasyParcel Individual API (`EPParcelStatusBulk`), top 10 MY couriers, mapping to order states

---

## 1. EasyParcel Canonical Status List

EasyParcel **normalizes all courier statuses** into a single, unified taxonomy. The API returns `ship_status` with these 13 canonical values:

| Status | EasyParcel Definition | Internal Lifecycle Fit |
|--------|---|---|
| **Scheduled (In Arrangement)** | Booking confirmed, scheduled for next step | → `new` / `confirmed` |
| **Pending For Collection** | Ready for courier pickup at merchant | → `ready_to_ship` |
| **Collected** | Courier has physically picked up parcel | → `shipped` (tentative) |
| **In Transit** | Parcel moving between hubs/sorting centers | NO CLEAN FIT |
| **Out for Delivery** | With delivery driver, en route to recipient | NO CLEAN FIT |
| **Delivery On Hold** | Temporary hold (payment, missing docs, customs) | NO CLEAN FIT |
| **Delivered** | Successfully arrived at recipient | → `completed` (if we trust EasyParcel) |
| **Drop Off** | Recipient opted for drop-off pickup point | NO CLEAN FIT |
| **Returned** | Parcel returned to merchant (failed delivery, refusal) | → `refunded` / manual review |
| **Cancelled** | Merchant cancelled before shipment | → `cancelled` |
| **Admin Cancel** | EasyParcel/courier cancelled | → `cancelled` |
| **Exception** | Unexpected delay (weather, bad address, customs hold) | NO CLEAN FIT (needs visibility) |
| **Expired (Unpaid)** | Booking unpaid past deadline | → `cancelled` |

**Key finding:** Only 4/13 statuses have clean 1:1 mapping to internal states. The remaining 9 represent **delivery nuance** not captured by our simple lifecycle.

---

## 2. Per-Courier Raw Status Variance

### Courier Status Divergence Summary

Each courier exposes its own raw status vocabulary:

- **J&T Express**: In Transit, Out for Delivery, Delivered, Exception/Delayed
- **Pos Laju**: Picked Up, In Transit, Out for Delivery, Delivered
- **Flash Express**: (implicit from tracking) In Transit, Delivered
- **Ninja Van**: (tracking provided via EasyParcel integration)
- **City-Link, DHL, GDex, Aramex, Skynet, Best Express**: Various proprietary statuses

### Critical Insight

**EasyParcel's aggregation layer hides this variance.** The API (`EPParcelStatusBulk`) returns **only EasyParcel's 13 normalized statuses, never raw courier status strings.** 

Proof: Official EasyParcel documentation lists the same `ship_status` values regardless of connected courier. The integration abstracts away per-courier vocabulary; we see a unified view.

**Confidence:** HIGH — confirmed via EasyParcel developer docs + help centre + blog.

---

## 3. Mapping Recommendation

### Current Internal Lifecycle

```
pending → new → confirmed → ready_to_ship → shipped → completed
                                              ↓
                                          cancelled / refunded
```

### Proposed Mapping Strategy

**RECOMMENDATION: Dual-field approach (NOT full mapping)**

Do NOT attempt to force all EasyParcel statuses onto the internal lifecycle. Instead:

#### Field 1: Order State (existing `status` column)
Keep the current state machine. Update only on clear lifecycle transitions:
- `ready_to_ship` → `shipped` when EasyParcel status reaches **`Collected`** or later
- `shipped` → `completed` **only on explicit merchant confirmation** (do not auto-promote on EasyParcel `Delivered`, as risk of false delivery claims or customs holds)
- → `cancelled` on `Cancelled`, `Admin Cancel`, `Expired (Unpaid)`
- → `refunded` on `Returned` (after merchant inspects returned parcel)

#### Field 2: Shipping Tracking Status (new `shippingTrackingStatus` enum column)
Expose EasyParcel's 13 statuses directly to the frontend **for customer visibility**:
```
SCHEDULED | PENDING_FOR_COLLECTION | COLLECTED | IN_TRANSIT | 
OUT_FOR_DELIVERY | DELIVERY_ON_HOLD | DELIVERED | DROP_OFF | 
RETURNED | CANCELLED | ADMIN_CANCEL | EXCEPTION | EXPIRED_UNPAID
```

Map this in the API response; render in customer portal / tracking page.

### Why This Works

1. **Stateful business logic** remains simple (4 clean mappings) — no fragile interpretation of "In Transit" or "On Hold"
2. **Customer transparency** — users see actual delivery progress without linguistic gymnastics
3. **Audit trail** — `shippingTrackingStatus` captures every EasyParcel update; order `status` stays intentional
4. **Exception handling** — `EXCEPTION` or `DELIVERY_ON_HOLD` appear in tracking UI, triggering customer support flow separate from order state
5. **Courier-agnostic** — EasyParcel normalizes; we don't care if J&T or Pos Laju has different raw statuses underneath

### Practical Edge Cases

| Scenario | Action |
|----------|--------|
| EasyParcel → `DELIVERED`, but customs hold reported | `shippingTrackingStatus = EXCEPTION`; order stays `shipped`; manual review |
| Parcel → `RETURNED` after failed delivery | `shippingTrackingStatus = RETURNED`; trigger merchant inspection; only move to `refunded` after confirmation |
| Status never updates past `PENDING_FOR_COLLECTION` for 7 days | `EXCEPTION` flag via polling; alert merchant |
| Drop-off selected by customer | `shippingTrackingStatus = DROP_OFF`; customer picks up at point; manual `completed` |

---

## 4. Source Credibility & Confidence Levels

| Claim | Sources | Confidence |
|-------|---------|-----------|
| EasyParcel normalizes statuses (13-value enum) | [EasyParcel official API docs](https://developers.easyparcel.com/), [Help Centre](https://helpcentre-my.easyparcel.com/support/solutions/articles/9000223904-what-does-the-parcel-tracking-statuses-mean-), [Blog](https://blog.easyparcel.com/my/tracking-status-meaning/) | **VERY HIGH** — official sources, consistent across all 3 |
| API returns ONLY EasyParcel statuses, not raw courier strings | EasyParcel API docs + integrator blog (AfterShip) | **HIGH** — standard in aggregator platforms |
| Top couriers have divergent raw statuses | [J&T Malaysia](https://www.jtexpress.my/tracking), [Pos Laju](https://tracking.my), [Flash Express Malaysia](https://www.flashexpress.my/fle/tracking), tracking aggregators | **MEDIUM** — inferred from fragmented courier docs; EasyParcel doesn't explicitly document per-courier variance (by design) |
| Delivery statuses don't cleanly map to order lifecycle | Domain analysis (shipping best practices) | **HIGH** — standard industry problem; no single correct mapping |

---

## 5. Implementation Notes

### Database Changes

Add to `orders` collection or extend `shippingInfo`:
```typescript
{
  status: "shipped" | "completed" | ..., // existing
  shippingTrackingStatus: "SCHEDULED" | "PENDING_FOR_COLLECTION" | ... // new enum
  shippingTrackingLastUpdated: Date, // poll timestamp
  shippingTrackingHistory: Array<{ status, timestamp, message }>, // audit trail
}
```

### API Response

Return both fields to customer portal:
```json
{
  "order_id": "...",
  "status": "shipped",
  "shipping": {
    "tracking_number": "...",
    "status": "IN_TRANSIT",
    "status_label": "Your parcel is on its way",
    "last_update": "2026-06-17T10:30Z",
    "history": [...]
  }
}
```

### Polling Strategy

Poll `EPParcelStatusBulk` periodically:
- Successful delivery: ✓ → stop polling (unless drop-off or return possible)
- Exception: ✓ → alert merchant, continue polling
- No update > 7 days in transit: ⚠ → flag as potential issue

---

## 6. Unresolved Questions

1. **Does EasyParcel's `Delivered` status include proof (photo, signature)?** Or just "last scan says delivered"? → Affects risk of auto-promoting to `completed`.
2. **Drop-off mechanics** — Does `DROP_OFF` mean customer chose point pickup, or courier left at safe place? Need to clarify with EasyParcel support.
3. **Customs hold detection** — Is `DELIVERY_ON_HOLD` the only way to surface customs delays, or does exception message contain "customs"?
4. **Polling frequency** — What's the SLA for EasyParcel status updates after courier scan? (Recommend 4–6 hourly for active shipments.)
5. **Returned parcel inspections** — Do we have an in-house inspection workflow, or trust EasyParcel's "returned" marker?

---

## Sources

- [EasyParcel Official Developer Documentation](https://developers.easyparcel.com/)
- [EasyParcel Help Centre — Tracking Status Meanings](https://helpcentre-my.easyparcel.com/support/solutions/articles/9000223904-what-does-the-parcel-tracking-statuses-mean-)
- [EasyParcel Blog — Tracking Status Meaning](https://blog.easyparcel.com/my/tracking-status-meaning/)
- [AfterShip EasyParcel API Integration](https://www.aftership.com/carriers/easyparcel)
- [J&T Express Malaysia Tracking](https://www.jtexpress.my/tracking)
- [Pos Laju Tracking Guide](https://parceldaily.com/blog/pos-laju-tracking-guide/)
- [Flash Express Malaysia Tracking](https://www.flashexpress.my/fle/tracking)
- [PHP EasyParcel Wrapper (apih/easyparcel)](https://github.com/apih/easyparcel)
- [Tracking.my Courier Aggregator](https://www.tracking.my/)
