# Phase 02 — Create design/wireframe doc

> **Priority:** P0 (BLOCKER for dev) | **Status:** ⬜ Pending | **Size:** M
> **Owner:** ui-ux-designer | **Estimated:** 60-90 min
> **Depends on:** Phase 01

## Context Links
- PRD (post-fix): [`docs/prd/F14-shipping.md`](../../docs/prd/F14-shipping.md) §10 Screen Layout
- Stories: [`docs/stories/F14-shipping-stories.md`](../../docs/stories/F14-shipping-stories.md) US-F14-03 (mobile UX)
- Reference designs:
  - [`docs/design/F19-store-configuration-design.md`](../../docs/design/F19-store-configuration-design.md) — settings pattern
  - [`docs/design/F09-storefront-design.md`](../../docs/design/F09-storefront-design.md) — checkout pattern
  - [`docs/design/Design system`](../../docs/design/Design%20system) — token/components
- Current code:
  - `src/app/sites/[slug]/checkout/page.tsx` (line 32-36 state list, line 358-595 form)
  - `src/app/(dashboard)/dashboard/settings/page.tsx` (settings index — TBD shipping subroute)

## Overview
Tạo `docs/design/F14-shipping-design.md` với low-fi wireframe cho 2 surface + mobile breakpoint, theo pattern các file F09/F10/F19 đã có.

## Key Insights
- Wave 6 = flat-rate UI đơn giản — không cần animation/interactive prototype
- Settings UI có thể reuse pattern từ F19 (store-configuration card layout)
- Checkout UI sửa từ current `checkout/page.tsx` — only thêm dynamic shipping breakdown
- Mobile 375px là baseline (US-F14-03 AC-2: input height ≥ 44px, vertical stack)

## Requirements

### Functional (3 màn + 3 state)
- F2.1: **Screen A — Shipping Settings (CMS Dashboard)**
  - Card 1: "Shipping Rates by Region" — 2 input (West MY, East MY) + helper text
  - Card 2: "Free Shipping" — toggle + threshold input (disabled khi toggle off)
  - Footer: Save button + Reset to defaults link
- F2.2: **Screen B — Checkout Shipping (Storefront)**
  - Address form: line1/line2/city/state(dropdown)/postcode
  - Order summary card: Subtotal → Shipping (RM 8/15 or FREE) → SST → Total
  - Free shipping hint: "Add RM X more for free shipping" khi gần threshold
- F2.3: **Screen C — Mobile 375px** (both above)
  - Stack vertical, full-width inputs
  - Numpad keyboard cho postcode (`inputmode="numeric"`)
  - Tap target ≥ 44px height

### UI States
- F2.4: Loading — Spinner inline khi đổi state dropdown (debounced 300ms)
- F2.5: Error — Postcode invalid → red border + helper text
- F2.6: Success — Free Shipping badge green khi đạt threshold

### Non-functional
- N2.1: Low-fi ASCII wireframe OK (không cần Figma link) — theo style F19
- N2.2: Mỗi component note rõ shadcn/ui component reuse: `Card`, `Input`, `Switch`, `Button`, `Select`
- N2.3: Dimension hint: card padding 16px desktop / 12px mobile, input height 40px desktop / 44px mobile

## Related Code Files
- **Create:** `docs/design/F14-shipping-design.md`
- **Read for context:**
  - `docs/design/F19-store-configuration-design.md` (settings pattern reference)
  - `docs/design/F09-storefront-design.md` (checkout pattern reference)
  - `docs/design/decorative-vocabulary.md` (design system tokens)
  - `src/app/sites/[slug]/checkout/page.tsx` (existing checkout markup)
- **Update after design done:** `docs/prd/F14-shipping.md` §10.1-10.3 → fill `[Link tới...]` placeholder với anchor `#screen-a-settings` etc.

## Implementation Steps
1. Read F19/F09 design files để nắm format chuẩn
2. Read `decorative-vocabulary.md` để dùng đúng token name
3. Draft `F14-shipping-design.md` với 6 section:
   - Section 1: Overview + design principles (KISS — flat rate)
   - Section 2: Screen A — Shipping Settings (ASCII wireframe + component note + states)
   - Section 3: Screen B — Checkout Shipping (ASCII + breakdown UI + states)
   - Section 4: Screen C — Mobile 375px (responsive notes)
   - Section 5: UI States matrix (Loading/Error/Success/Empty)
   - Section 6: Component inventory (shadcn/ui mapping)
4. Add anchor IDs để PRD §10 link sang được (`#screen-a-shipping-settings`, etc.)
5. Update PRD §10.1/10.2/10.3 fill links
6. Cross-check với US-F14-03 AC-2 (44px tap target) — explicit trong design doc

## Todo List
- [ ] File created với 6 section
- [ ] 3 wireframe (Settings, Checkout, Mobile) — ASCII low-fi
- [ ] UI states matrix
- [ ] Component inventory mapping
- [ ] PRD §10 links updated
- [ ] Anchor IDs valid

## Success Criteria
- Dev đọc design có thể bắt tay code màn Settings + Checkout không cần hỏi lại UI
- Mobile breakpoint requirement explicit (≥ 44px, vertical stack, numpad)
- Reuse pattern từ F19/F09 — không invent component mới

## Risk Assessment
- **Risk:** Over-design (high-fi) → tốn time. Mitigate: low-fi ASCII, link tới F19/F09 cho chi tiết.
- **Risk:** Lệch design system. Mitigate: tham chiếu `decorative-vocabulary.md` cho token.

## Security Considerations
N/A — docs only.

## Next Steps
- Phase 03 đọc design để align component tree trong architecture
- Phase 03 stories supplement (US-F14-04 validate rate boundary) cần screen Settings để mô tả error state
