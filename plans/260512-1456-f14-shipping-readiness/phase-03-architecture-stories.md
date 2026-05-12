# Phase 03 — Architecture + supplementary stories

> **Priority:** P0 (BLOCKER for dev) | **Status:** ⬜ Pending | **Size:** M
> **Owner:** planner (architecture) + docs-engineer (stories) | **Estimated:** 60-90 min
> **Depends on:** Phase 01, Phase 02

## Context Links
- PRD (post-fix): [`docs/prd/F14-shipping.md`](../../docs/prd/F14-shipping.md)
- Design (post-Phase 02): [`docs/design/F14-shipping-design.md`](../../docs/design/F14-shipping-design.md)
- Stories: [`docs/stories/F14-shipping-stories.md`](../../docs/stories/F14-shipping-stories.md)
- QA: [`docs/qa/F14-shipping.md`](../../docs/qa/F14-shipping.md)
- Architecture template: [`docs/architecture/_TEMPLATE.md`](../../docs/architecture/_TEMPLATE.md)
- Reference architectures:
  - [`docs/architecture/F09-storefront-commerce.md`](../../docs/architecture/F09-storefront-commerce.md)
  - [`docs/architecture/F10-orders-management.md`](../../docs/architecture/F10-orders-management.md)
- Code:
  - `src/collections/Sites.ts:330` — shippingConfig group
  - `src/collections/Orders.ts:138,237` — shippingFee + shippingAddress
  - `src/lib/storefront/checkout.ts` — MY_STATES + calculateOrderTotals

## Overview
Phase này deliver 2 artifact song song:
1. **Architecture doc** — API contract, component tree, sequence diagram cho dev
2. **Stories supplement** — 3 story mới phủ QA TC còn trống

## Key Insights
- Architecture flat-rate Wave 6 đơn giản → không cần caching layer, không cần queue, không cần webhook
- API spec phải khớp PRD §13 (3 endpoint: GET/PATCH shipping-config, POST calculate-shipping)
- Stories US-F14-04/05/06 fill gap với QA TC-F14.13/15/19/20

## Requirements

### Functional — Architecture

- F3.1: **Component tree**
  - `Settings/ShippingSettingsCard` (Phase 02 Screen A)
  - `Checkout/AddressForm` (Phase 02 Screen B)
  - `Checkout/OrderSummary` (existing, modify breakdown)
  - `lib/shipping/classify-region.ts` (West/East MY classifier)
  - `lib/shipping/calculate-fee.ts` (rate * region + free threshold)
- F3.2: **API contract** — đủ schema request/response + status code
  - `GET /api/sites/:siteId/shipping-config` → 200 ShippingConfig | 404 SiteNotFound
  - `PATCH /api/sites/:siteId/shipping-config` → 200 Updated | 400 ValidationError | 403 Forbidden
  - `POST /api/orders/calculate-shipping` → 200 { fee, isFree, hint } | 400 InvalidState
- F3.3: **Sequence diagram** — Mermaid v11
  - Checkout flow: User → AddressForm → POST calc → render Summary
  - Settings flow: Seller → PATCH config → toast + invalidate cache
- F3.4: **Data model** — chi tiết hơn PRD §13
  - Validation rules: westRate/eastRate ∈ [0, 100_000] sen (0-RM 1000)
  - freeAbove: null | number ≥ 0
- F3.5: **State classification source of truth**
  - `WEST_MY_STATES` = [Johor, Kedah, Kelantan, Melaka, N.Sembilan, Pahang, Perak, Perlis, Penang, Selangor, Terengganu, KL, Putrajaya] (13)
  - `EAST_MY_STATES` = [Sabah, Sarawak, Labuan] (3) — Labuan = East per TC-F14.03
  - Total = 16 ✓
- F3.6: **Error handling**
  - Invalid state → 400 + error code `INVALID_STATE`
  - Missing siteId → 404
  - Rate out of range → 400 + field-level error

### Functional — Stories supplement

- F3.7: **US-F14-04**: Validate shipping rate boundaries
  - AC-1: Rate âm → reject (TC-F14.13)
  - AC-2: Rate = 0 → accept, hiển thị FREE (TC-F14.14)
  - AC-3: Rate > 100000 sen → reject với message "max RM 1,000" (TC-F14.15)
- F3.8: **US-F14-05**: Live recalc khi đổi address
  - AC-1: Change state West → East → fee auto update không reload (TC-F14.19)
  - AC-2: Debounce 300ms tránh spam call
- F3.9: **US-F14-06**: Order RM 0 vẫn tính phí ship
  - AC-1: Subtotal = 0, state = East → fee = RM 15, total = RM 15 (TC-F14.20)
  - AC-2: Subtotal = 0 + freeAbove threshold (e.g. RM 100) → fee KHÔNG free (0 < 100)

### Non-functional
- N3.1: Follow `_TEMPLATE.md` structure
- N3.2: API spec dùng pseudo-OpenAPI YAML hoặc TypeScript interface (consistent với F09/F10)
- N3.3: Stories follow format hiện có (Story + AC gherkin + DoD)

## Related Code Files
- **Create:**
  - `docs/architecture/F14-shipping.md`
- **Modify:**
  - `docs/stories/F14-shipping-stories.md` (append US-F14-04/05/06)
  - `docs/prd/F14-shipping.md` §15 update link tới architecture
- **Read for context:**
  - `docs/architecture/_TEMPLATE.md`
  - `docs/architecture/F09-storefront-commerce.md`
  - `src/collections/Sites.ts`, `src/collections/Orders.ts`
  - `src/lib/storefront/checkout.ts`

## Implementation Steps
1. Read `_TEMPLATE.md` + F09/F10 architecture để nắm format
2. Draft `F14-shipping.md` (architecture):
   - §1 Overview + scope
   - §2 Component tree (mermaid graph)
   - §3 Data model (TypeScript interface)
   - §4 API contract (3 endpoint chi tiết)
   - §5 Sequence diagrams (mermaid v11)
   - §6 State classification (WEST/EAST list)
   - §7 Validation rules
   - §8 Error codes
   - §9 Dependencies & assumptions
3. Append 3 story US-F14-04/05/06 vào `F14-shipping-stories.md`
4. Update PRD §15 "API Spec" → "See `docs/architecture/F14-shipping.md` §4"
5. Update PRD §7 FR table thêm row cho US-F14-04/05/06
6. Update PRD §0 Story Traceability table thêm 3 row

## Todo List
- [ ] Architecture file 9 section
- [ ] Component tree mermaid
- [ ] API contract 3 endpoint
- [ ] Sequence diagram (2 flow)
- [ ] State classification list (13 West + 3 East = 16)
- [ ] US-F14-04 story
- [ ] US-F14-05 story
- [ ] US-F14-06 story
- [ ] PRD §15 link updated
- [ ] PRD §0 traceability extended

## Success Criteria
- Dev có thể đọc architecture → implement không cần hỏi lại API shape
- Stories phủ 100% QA TC (đánh dấu mapping TC-ID trong story comment)
- Mermaid render được trong markdown-novel-viewer

## Risk Assessment
- **Risk:** Architecture quá chi tiết → over-engineer. Mitigate: keep flat-rate simple, no caching, no async.
- **Risk:** State classification disagreement (Labuan = West hay East?). Mitigate: confirm theo TC-F14.03 = East.

## Security Considerations
- API authorization: PATCH shipping-config yêu cầu tenant member (user.tenants includes siteId)
- POST calculate-shipping: public endpoint (checkout guest cũng dùng được)
- Input sanitization: rate phải là integer (sen), không float

## Next Steps
- Sau Phase 03: PR `docs(F14): readiness audit + design + architecture` → staging
- Wave 6 dev có thể dùng plan này làm input cho `/ck:plan` → `/ck:cook`
