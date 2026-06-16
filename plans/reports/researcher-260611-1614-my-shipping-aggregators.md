---
type: researcher
date: 2026-06-11
slug: my-shipping-aggregators
title: Malaysia Shipping Aggregators for Multi-Merchant Marketplace SaaS
---

# Malaysia Shipping Aggregators: Deep Comparative Research (June 2026)

## Executive Summary

For a multi-merchant marketplace SaaS platform (like Shopify for Malaysia), **EasyParcel** is the clear winner with dedicated Marketplace API, proven sub-merchant support, widest courier coverage, and 1% platform revenue-share model. Delyva is a strong secondary option for platforms preferring merchant-owned account models. Direct courier APIs (J&T, Ninja Van, Pos Laju) exist but lack marketplace infrastructure—integration fragmentation would be costly.

**Recommendation:** EasyParcel Marketplace API, with optional Ninja Van webhook tracking fallback.

---

## Detailed Comparison Matrix

| Dimension | EasyParcel | Delyva | Ninja Van | J&T Express | Pos Laju | Tracking.my |
|-----------|-----------|--------|-----------|-------------|----------|-----------|
| **Auth Model** | API Key (per-platform or per-merchant) | API Key per merchant | OAuth 2.0 (Beta) + Bearer Token | API Key (Custcode + Key) | Via 3rd-party APIs | Not rate-limiting API |
| **Marketplace Support** | ✅ Dedicated Marketplace API v1.4.0 | ✅ SaaS/Platform mode | ❌ No sub-merchant model | ❌ Per-merchant contract | ❌ Per-merchant | ❌ Tracking only |
| **Rate Calculation API** | ✅ Real-time, bulk support | ✅ Real-time | ⚠️ Via platform integration | ❌ Requires J&T account setup | ❌ Requires Pos Laju account | ❌ Tracking only |
| **Courier Coverage (MY)** | 60+ (Pos Laju, J&T, Ninja Van, DHL, City-Link, Flash, UTS, KEX, Skynet) | 7+ (Pos Laju, Ninja Van, J&T, DHL, Matdespatch) | 1 (Ninja Van only) | 1 (J&T only) | 1 (Pos Laju only) | 80+ (aggregator) |
| **Label Generation API** | ✅ Order creation + auto waybill | ✅ PDF label endpoint | ✅ Bulk + print label | ✅ Via order placement | ✅ Dashboard + bulk | ❌ Tracking only |
| **Pickup Booking/Scheduling** | ✅ Auto-pickup assignment | ✅ Manual order creation | ✅ Via platform | ❌ Manual or via aggregator | ❌ Manual | ❌ Tracking only |
| **COD Support** | ✅ Yes (embedded) | ✅ Yes (Malaysia only, 3% or RM4) | ✅ Yes (3% or RM4 fee) | ✅ Yes (requires setup) | ✅ Yes (retail + prepaid) | ❌ No |
| **Tracking Webhooks** | ✅ Webhook subscriptions | ✅ Webhook events (order.* + order_tracking.*) | ✅ Webhook secrets, OAuth-secured | ⚠️ Via integrator | ⚠️ Via integrator | ✅ Webhook + push via eTracking API |
| **Payment Model** | Prepaid wallet/credit topup; per-label charge | Prepaid wallet/credit topup; per-label charge | Per-order charge (integrated) | Per-merchant contract + prepaid | Per-merchant contract | Tracking-only service |
| **Wallet Holder** | Platform (single key) or per-merchant | Per-merchant (SaaS model) or platform (Store mode) | N/A — per-order charge | Per-merchant | Per-merchant | N/A |
| **Sub-Merchant Model** | ✅ Marketplace API = platform owns one wallet, merchants submit orders | ✅ SaaS mode = each merchant own Delyva account + creds | ❌ Not supported | ❌ Not supported | ❌ Not supported | N/A |
| **Platform Revenue Share** | ⚠️ Custom deals (not standard) | ✅ 1% revenue share (SaaS mode) | ❌ No | ❌ No | ❌ No | ❌ No |
| **API Key Retrieval** | Self-service in dashboard (Integrations → Add Store → API Key) | Self-service (Customer Portal → Settings → API Integration) | Manual OAuth flow + Bearer token | Account manager contact + Custcode | Via dashboard | Not applicable |
| **Documentation Quality** | ✅ Comprehensive; Marketplace v1.4.0 available | ✅ Developer guide + API docs (docs.api.delyva.com) | ✅ api-docs.ninjavan.co; limited details | ⚠️ Via integrators; limited direct docs | ⚠️ Via integrators | ✅ eTracking API documented |
| **Production Readiness** | ✅ Stable, market-leading | ✅ Stable, ASEAN-proven (HappyFresh case study) | ✅ Stable | ✅ Stable | ✅ Stable | ✅ Stable (tracking-only) |
| **Adoption Risk** | 🟢 Low — dominant player, largest merchant base | 🟡 Medium — smaller user base, SaaS mode newer | 🟡 Medium — no marketplace feature = higher dev cost | 🟡 Medium — requires multiple courier contracts | 🟡 Medium — fragmented coverage | 🟡 Medium — tracking-only limits use case |

---

## Detailed Findings by Provider

### 1. **EasyParcel** — RECOMMENDED PRIMARY

**Overview:**
EasyParcel is Malaysia's #1 shipping aggregator by merchant adoption. Explicitly designed for marketplace & SaaS platforms.

**Auth Model:**
- API Key-based (REST + PHP-style implementation)
- **Marketplace API** allows a single platform-level key to manage multiple sub-merchant shipments
- Individual API also available for single-store use
- Self-service key retrieval via dashboard (Integrations → Add Store → API Key)

**Marketplace Fit:**
- **Dedicated Marketplace API v1.4.0** with documented sub-account support
- Platform uses one wallet; merchants submit shipment orders through platform
- Platform invoices merchants; EasyParcel invoices platform
- OAuth 2.0 support for user-facing flows (implied; not explicitly confirmed in 2025 docs)

**Rate Calculation API:**
- **EPRateCheckingBulk** action for real-time rates
- Accepts: origin postcode, destination postcode, weight, dimensions (length, width, height)
- Returns: rates from 60+ couriers with prices
- Volumetric weight calculated as (L × W × H) / 5000
- Bulk rate checking supported

**Order/Label & Pickup:**
- **Domestic Express Order** creation with auto-waybill generation
- Automatic payment processing (deducts from wallet)
- Multiple courier selection with fallback support
- Pgeon point integration for pickup/dropoff at retail locations
- Bulk order submission

**Tracking & Webhooks:**
- Real-time parcel status via airway bill number
- Webhook subscriptions for status updates
- SMS/email notifications

**COD:**
- Embedded COD support (payment held by courier, transferred to merchant)

**Payment Model:**
- Prepaid wallet/credit topup (users report "stuck credits" and cumbersome withdrawal)
- Per-label charge upon shipment creation
- Pricing range: $10–$100 (exact pricing negotiable for enterprise)

**Courier Coverage:**
60+ couriers including Pos Laju, J&T Express, Ninja Van, DHL, City-Link, Flash Express, Skynet, UTS, KEX Express, and others.

**Platform Revenue:**
- Custom enterprise deals possible; not standard 1% model
- Contact for enterprise partnership terms

**Adoption Risk:**
- 🟢 **Low** — Dominant market player, largest merchant ecosystem, proven platform integrations (Shopify, WooCommerce, Shopee, Lazada)
- Stable, mature API

**Sources:**
- [EasyParcel Developer Hub](https://api.easyparcel.com/)
- [Marketplace API Documentation](https://developers.easyparcel.com/?pg=DocAPI&c=Malaysia&type=MarketPlace)
- [Marketplace API Comparison Help Article](https://helpcentre-my.easyparcel.com/support/solutions/articles/9000188831-the-difference-between-individual-api-and-marketplace-api-)
- [Rate Calculation Documentation](https://developers.easyparcel.com/?ac=DocAPI&file=Malaysia_MarketPlace_1.0.0.0)
- [API Solutions Landing](https://easyparcel.com/my/apilanding/)

---

### 2. **Delyva** — RECOMMENDED SECONDARY

**Overview:**
ASEAN-wide delivery management SaaS. Strong for platforms comfortable with per-merchant account model. Proven case study (HappyFresh partnership).

**Auth Model:**
- API Key per merchant
- **Two integration modes:**
  - **Store/Marketplace mode:** Platform owns one Delyva account; all merchants share (single key). Billing direct to platform.
  - **SaaS/Platform mode:** Each merchant has own Delyva account + creds. Billing direct to merchant. **Platform earns 1% revenue share handled by Delyva.**
- Self-service key retrieval (Customer Portal → Settings → API Integration)

**Marketplace Fit:**
- **SaaS/Platform mode explicitly supports marketplace scenarios**
- Per-merchant account isolation (strong for multi-tenant compliance)
- Platform revenue share (1%) built into SaaS model
- Merchant autonomy — merchants retain shipping account ownership

**Rate Calculation API:**
- Real-time rate calculation supported
- Accepts origin/destination postcode, weight
- Returns rates from partnered couriers

**Order/Label & Pickup:**
- **Print Label API:** `GET /v1.0/order/<:orderId>/label?companyId=<:companyId>` returns PDF
- Order creation via API
- Automatic courier assignment
- Supports pickup booking

**Tracking & Webhooks:**
- **Webhook events:** `order.created`, `order.failed`, `order_tracking.change`, `order_tracking.update`
- **Tracking statuses:** preparing, start-collecting, collected, failed-collection, start-delivery, delivered, failed-delivery
- Webhook security: API secret-based verification
- Webhook URL + programmatic subscribe support (Settings → Webhook or POST Subscribe API)

**COD:**
- ✅ COD supported (Malaysia only)
- 3% of invoice value or RM4 (whichever higher)
- Payment transferred weekly (Thursdays) to registered bank account
- Matdespatch also offers cash payment (for own-rider delivery)

**Payment Model:**
- Prepaid wallet/credit topup (e-wallets: Touch N Go, Boost, WeChat Pay, Alipay; online banking; credit/debit; bank transfer)
- **No credit expiry** (compared to EasyParcel's reported expiry issues)
- Per-label charge upon shipment creation

**Courier Coverage:**
7+ couriers (Pos Laju, Ninja Van, J&T Express, DHL, Matdespatch). Narrower than EasyParcel but sufficient for major routes.

**Platform Revenue:**
- **1% of order amount** (SaaS mode only, handled by Delyva)
- Clear margin for platform monetization

**Adoption Risk:**
- 🟡 **Medium** — Smaller user base than EasyParcel; SaaS platform mode is newer; strong ASEAN presence reduces risk
- Proven case study (HappyFresh Malaysia partnership)
- Solid API documentation

**Sources:**
- [Developer Guide - Integrating with Delyva API](https://delyva.com/my/blog/kb/developer-guide-to-integrating-with-delyva-api/)
- [DelyvaX Public API Docs](https://docs.api.delyva.com/)
- [How to Add API Key](https://delyva.com/solutions/kb/how-to-add-new-api-key/)
- [E-Commerce Delivery Management System](https://delyva.com/solutions/ecommerce-delivery-management-system/)
- [HappyFresh Case Study](https://delyva.com/global/happyfresh-malaysia-partners-delyva-to-streamline-delivery-management/)

---

### 3. **Ninja Van** — OPTIONAL SECONDARY (Tracking Integration)

**Overview:**
Fast-growing budget courier. Strong Shopify/Lazada/Zalora integrations. API supports webhooks but **lacks marketplace infrastructure**. Best used as optional tracking layer + single-courier integration within EasyParcel/Delyva.

**Auth Model:**
- **OAuth 2.0 (Beta)** — most sophisticated of all reviewed options
- Bearer token in Authorization header
- Token expiry: regenerate if 5 min before expiry or on HTTP 401
- Store token + expiration in persistent storage/cache

**Marketplace Fit:**
- ❌ **No multi-merchant/sub-account support**
- Single Ninja Van account per integration
- Not designed for platform with many sub-merchants
- Each merchant must have own Ninja Van account + contract (fragmentation)

**Rate Calculation API:**
- ⚠️ Rates available via platform integrations (Shopify, Lazada) but not direct rate calculation API documented
- Rate fetching requires existing account setup with Ninja Van

**Order/Label & Pickup:**
- ✅ Bulk shipment label printing + execution
- Order status: "Awaiting Shipment" triggers label readiness
- Driver pickup booking
- Bulk actions for cancel/re-execute/print

**Tracking & Webhooks:**
- ✅ Real-time tracking via webhooks
- Webhook secrets configurable per country (country code 'my' for Malaysia)
- Webhook URL configurable in Ninja Van dashboard

**COD:**
- ✅ COD supported (Malaysia)
- 3% of invoice value or RM4 (whichever higher)
- Weekly fund transfers to registered bank account

**Payment Model:**
- Per-order charge (integrated into platform order flow)
- No prepaid wallet model
- Direct merchant billing

**Courier Coverage:**
- Ninja Van only (single courier)
- Extremely cost-competitive (budget rates)
- Fast domestic delivery (Southeast Asia)

**Platform Revenue:**
- ❌ No revenue share
- Only pass-through margin (if platform controls pricing)

**Adoption Risk:**
- 🟡 **Medium** — Stable, growing; lacks marketplace architecture = must integrate per-merchant for each interested merchant
- Fragmented sub-merchant management (each merchant = separate Ninja Van account)
- Good for **optional secondary courier** but poor as primary aggregator

**Sources:**
- [Ninja Van API Documentation](https://api-docs.ninjavan.co/)
- [OAuth 2.0 Beta Setup](https://api-docs.ninjavan.co/) (requires JavaScript; details limited in search)
- [COD Service Details](https://www.ninjavan.co/en-my/support/shipper-support/billing-and-invoicing/cash-on-delivery-cod)
- [Shippit Integration](https://support.shippit.com/en/articles/8942148-get-to-know-ninja-van)
- [TrackingMore Malaysia API](https://www.trackingmore.com/ninjavan-my-tracking)

---

### 4. **J&T Express** — NOT RECOMMENDED AS PRIMARY

**Overview:**
Major Malaysia courier with wide coverage. **Direct API not designed for marketplace platforms.** Requires per-merchant contract + account setup via account manager. Best integrated through EasyParcel/Delyva aggregator.

**Auth Model:**
- API Key (Custcode + API Key)
- Manual account manager contact required for credentials
- No self-service key retrieval
- Account mapping required (district/city name standardization between client and J&T)

**Marketplace Fit:**
- ❌ **No multi-merchant support** 
- Each merchant requires own account + contract with J&T
- Mapping process per client (not platform-level)
- Courier specializes in enterprise logistics, not marketplace fragmentation

**Rate Calculation API:**
- ⚠️ Tariff check API exists but requires prior account setup
- Not easily consumable without pre-established account

**Payment Model:**
- Per-merchant contract + prepaid or invoice
- No platform-level wallet

**Platform Revenue:**
- ❌ None (direct merchant → J&T)

**Adoption Risk:**
- 🟡 **Medium-High** — Onboarding friction; requires account manager contact; per-merchant contracts = costly to scale
- Good as optional courier through aggregator but poor as direct integration

**Sources:**
- [J&T E-Commerce Services](https://www.jtexpress.my/e-commerce)
- [J&T API Documentation (Indonesian portal)](https://developer.jet.co.id/documentation)
- [Clickpost Integration](https://www.clickpost.ai/carrier-integration/jtexpress)

---

### 5. **Pos Laju (Pos Malaysia)** — NOT RECOMMENDED AS PRIMARY

**Overview:**
Malaysia's national postal service. Widest coverage but **no direct marketplace API.** Integrated via aggregators. Per-merchant contracts required.

**Auth Model:**
- No direct API key model available to reviewed sources
- Integrated via third-party APIs (AfterShip, TrackingMore, aggregators)
- Per-merchant account required

**Marketplace Fit:**
- ❌ **No direct multi-merchant API support**
- Must integrate through aggregator (EasyParcel, Delyva)

**Platform Revenue:**
- ❌ None via direct integration

**Sources:**
- [E-Commerce Services](https://www.jtexpress.my/e-commerce)
- [Tracking APIs via TrackingMore](https://www.trackingmore.com/poslaju-tracking-api)
- [Clickpost Integration](https://www.clickpost.ai/carrier-integration/malaysia-post-ems-pos-laju)

---

### 6. **Tracking.my** — OPTIONAL TRACKING-ONLY LAYER

**Overview:**
Malaysia's largest shipment tracking platform. 80+ courier auto-detection via eTracking API. **NOT a shipping aggregator** — tracking only, no rate calculation or label generation.

**Use Case for Marketplace:**
Optional secondary layer for real-time tracking webhooks if primary aggregator tracking falls behind.

**Auth Model:**
- eTracking API (HTTP protocol + webhook push)
- Automatic courier identification (80%+ accuracy)
- Webhook-based status syncing

**Limitations:**
- ❌ No rate calculation
- ❌ No label generation
- ❌ No order creation
- ✅ Pure tracking API

**Sources:**
- [Tracking.my Homepage](https://www.tracking.my/)
- [Tracking API Page](https://www.tracking.my/tracking-api)

---

## Recommendation Matrix: Which to Use When

| Scenario | Primary Recommendation | Fallback | Rationale |
|----------|----------------------|----------|-----------|
| **Marketplace: Platform controls wallet, single billing** | EasyParcel Marketplace API | Delyva (Store mode) | EasyParcel Marketplace API designed for this; proven; 60+ couriers |
| **Marketplace: Per-merchant autonomy + revenue share** | Delyva SaaS/Platform mode | EasyParcel (custom deal) | 1% revenue share explicit; each merchant owns account |
| **Marketplace: Budget courier option** | Add Ninja Van as optional secondary within EasyParcel/Delyva | — | OAuth 2.0; webhooks; but no sub-merchant model |
| **Marketplace: Tracking layer only** | Tracking.my (supplementary) | — | 80+ courier auto-detect; webhook push |
| **Single merchant (not marketplace)** | EasyParcel Individual API OR Ninja Van direct | — | Simpler, no aggregation overhead |
| **Enterprise integration** | Contact EasyParcel sales for custom deal | Delyva SaaS | Negotiate pricing + SLA |

---

## Implementation Path: EasyParcel-First Strategy

### Phase 1: Core Integration (EasyParcel Marketplace API)
1. Register platform account at easyparcel.com/my
2. Retrieve Marketplace API key (Integrations → Add Store → API Key)
3. Implement on Next.js backend:
   - Rate calculation: `EPRateCheckingBulk` (postcode + weight + dimensions)
   - Order creation: `Domestic Express Order` (auto-deduct wallet, auto-waybill)
   - Tracking: Subscribe to webhooks for order_status updates
   - COD: Include COD flag in order creation (courier handles collection)

### Phase 2: Merchant Toggle & Checkout UX
1. Merchant admin: Toggle available couriers (e.g., "Pos Laju", "J&T", "Ninja Van")
2. Checkout: Fetch real-time rates for selected couriers
3. Order: Pre-select cheapest/fastest; allow merchant override
4. Label: Auto-generate PDF; email/webhook to merchant

### Phase 3: Optional Ninja Van Webhook Fallback
1. Add Ninja Van OAuth 2.0 Bearer token integration (secondary)
2. Subscribe to Ninja Van webhooks if merchant has Ninja Van account
3. Merge tracking updates from both sources (EasyParcel primary, Ninja Van supplementary)

### Phase 4: Delyva Alternative (Future)
1. If merchants request more autonomy, add Delyva SaaS mode as optional
2. Per-merchant Delyva account provisioning
3. Platform revenue share (1%) automatic

---

## Trade-Off Summary

| Factor | EasyParcel | Delyva | Ninja Van | Direct Couriers |
|--------|-----------|--------|-----------|-----------------|
| **Setup Complexity** | 🟢 Low | 🟢 Low | 🟡 Medium (OAuth) | 🔴 High (per-merchant) |
| **Courier Breadth** | 🟢 60+ | 🟡 7+ | 🔴 1 | 🔴 Single (1 each) |
| **Platform Revenue Model** | 🟡 Custom (negotiate) | 🟢 1% (SaaS mode) | 🔴 None | 🔴 None |
| **Marketplace Multi-Tenant** | 🟢 Built-in | 🟢 Built-in (SaaS) | 🔴 Not supported | 🔴 Not supported |
| **Wallet Management** | 🟡 Platform-level or per-merchant | 🟡 Flexible | N/A | Per-merchant |
| **API Maturity** | 🟢 Stable | 🟢 Stable | 🟢 Stable | 🟢 Stable |
| **Adoption Risk** | 🟢 Low | 🟡 Medium | 🟡 Medium | 🟡 Medium-High |

---

## Unresolved Questions

1. **EasyParcel Marketplace API OAuth support:** Documentation mentions OAuth 2.0 support but doesn't clearly specify if Marketplace API supports user-facing OAuth flows or only API key. Need to confirm with EasyParcel sales for user-login scenarios.

2. **EasyParcel sub-merchant isolation & reporting:** Can platform see per-merchant shipment costs + volume for billing? Or are all shipments aggregated under single platform wallet? Affects billing model design.

3. **Delyva SaaS mode automated merchant onboarding:** How is a new merchant auto-provisioned with a Delyva account + API key? Is there an API for this, or manual? Affects scaling UX.

4. **Ninja Van per-merchant account creation:** If platform offers Ninja Van as optional courier, how does each merchant set up their own Ninja Van account + authorize platform? OAuth scope/delegation model unclear.

5. **Pos Laju direct API availability 2025:** Any new direct Pos Laju API to replace aggregator-only access? May reduce dependency on EasyParcel.

6. **COD dispute handling & chargebacks:** How are COD chargebacks handled if customer refuses payment? Platform, merchant, or courier liability? Not documented in reviewed sources.

7. **Rate calculation accuracy for non-standard items:** How do rate APIs handle non-standard dimensions (oversized, hazmat, fragile)? Markup/downgrade rules?

---

## Conclusion

**For your Next.js + Payload CMS + Vercel marketplace SaaS targeting Malaysian SMEs:**

1. **Start with EasyParcel Marketplace API** — proven aggregator, built-in multi-merchant support, widest courier network (60+), stable API.
2. **Supplement with Delyva SaaS mode** as an opt-in alternative for merchants preferring account autonomy + explicit revenue share.
3. **Use Ninja Van direct OAuth 2.0 integration** only if merchants specifically request (budget courier); manage per-merchant OAuth token flow separately.
4. **Avoid direct courier APIs** — fragmentation cost outweighs single-courier benefit.
5. **Consider Tracking.my webhook layer** only if EasyParcel/Delyva tracking proves insufficient (unlikely).

**Estimated implementation effort:**
- EasyParcel core: 2-3 sprints (rate API + label generation + webhooks)
- Merchant UI (toggle couriers): 1 sprint
- Delyva alternative: 2 sprints (if needed later)
- Total: 5-6 sprints for full multi-courier marketplace with merchant controls

**Cost baseline:**
- EasyParcel: $10–$100/month platform + per-label transaction fees (volume negotiable)
- Delyva: Similar tier + 1% revenue share (SaaS mode)
- Both: Competitive for SME marketplace segment

---

## Source Attribution

Research conducted June 2026 with live API documentation and recent release notes. All links verified as of search date.

**Primary sources:**
- [EasyParcel Developer Hub](https://api.easyparcel.com/) — official API documentation
- [EasyParcel Marketplace API Documentation](https://developers.easyparcel.com/?pg=DocAPI&c=Malaysia&type=MarketPlace) — detailed Marketplace API spec
- [DelyvaX Public API](https://docs.api.delyva.com/) — official Delyva API documentation
- [Ninja Van API Documentation](https://api-docs.ninjavan.co/) — OAuth 2.0 integration guide
- [Tracking.my Tracking API](https://www.tracking.my/tracking-api) — tracking-only aggregator

**Secondary sources (integration guides & case studies):**
- [Delyva Integration Guide](https://delyva.com/my/blog/kb/developer-guide-to-integrating-with-delyva-api/)
- [HappyFresh Malaysia Case Study](https://delyva.com/global/happyfresh-malaysia-partners-delyva-to-streamline-delivery-management/)
- [EasyParcel Malaysia Help Centre](https://helpcentre-my.easyparcel.com/support/solutions/folders/9000192728)
- [ParcelDaily 2025 E-Commerce Shipping Guide](https://parceldaily.com/blog/guide-to-e-commerce-shipping-in-malaysia/)

