# PRD ↔ Design File Gap Audit

**Audit Date:** 2026-05-12  
**Scope:** 33 PRD files vs 15 design files in `/docs/prd/` & `/docs/design/`

## 1. Missing Design Files (UI-bearing PRDs)

| PRD | Type | Coverage Gap | Priority |
|-----|------|--------------|----------|
| F13 Payment Gateway | UI—Commerce | Checkout payment form UI; FPX/e-wallet selector; seller payment settings — NO mockup | P1 |
| F14 Shipping | UI—Commerce | Shipping settings form (region rates, free threshold); checkout shipping step UI — NO mockup | P1 |
| F15 Admin Management | UI—Admin | Activity logs table, user/workspace list, broadcast UI, admin dashboard layout — NO mockup | P1 |
| F21 Localization | UI—Settings | Language switcher placement (header vs profile, mobile vs desktop) — NO mockup | P0 |
| F22 Tracking Analytics | UI—Settings | Tracking ID input form (GA4, Facebook, TikTok); validation feedback; setup help links — NO mockup | P0 |

## 2. Integrated into Existing Design (No separate file needed)

- **F11 Undo-Redo:** Buttons ↩ ↪ visible in F05 toolbar (line "↩ Undo  ↪ Redo"). PRD requires counts: "Undo (3)" → **F05 design incomplete** (shows buttons but not count badge).
- **F12 Auto-Save:** Status indicator "Draft / Saving... / Saved" + "Saved Xs ago" mentioned in F05 design (line "│ 👁️ │ Saved │ 🚀 Publish│"). PRD requires Ctrl+S manual save → **F05 design incomplete** (only shows status, not keyboard shortcut handling).

## 3. Backend/Infrastructure PRDs (Design not required)

- **F04 Block Renderer:** Engine—no end-user UI
- **F30 Sprints 1-4:** Aggregation—references component PRDs instead
- **F31 Block Variant Audit:** Quality—technical infrastructure
- **F31 Template Blueprints:** Data/blueprint seed (renders via existing F01/F04)
- **F01 Design Quality:** Quality gate—not a user-facing feature
- **F01 AI Builder Variety:** Algorithm/AI prompt tuning—not a UI feature

## 4. Spot-Check: Design Coverage vs PRD Sub-features

### F01 AI Builder
- **PRD has:** Form-based input (4 fields), AI generation stream, live preview, block reorder, image generation, publish flow, mobile UX
- **F01 design covers:** ✓ Form input states, ✓ Live preview, ✓ Block reorder, ✓ Mobile (separate frame)
- **Note:** Sub-features align well

### F05 AI Editor
- **PRD has:** AI chat sidebar, block selection, inline editing, global settings panel, undo/redo, auto-save, mobile UX
- **F05 design covers:** ✓ Chat panel, ✓ Live preview, ✓ Global settings, ✓ Block click-to-edit, **⚠ undo/redo buttons shown but no count badge**, **⚠ auto-save shown but no Ctrl+S flow**
- **Note:** F11 & F12 features partially visible but implementation details missing

### F09 Storefront
- **PRD has:** Product list (PLP), product detail (PDP), checkout flow, cart, search/filters, reviews
- **F09 design covers:** ✓ PLP with filters, ✓ PDP structure
- **Gap:** Checkout flow (shipping + payment) not in F09 design — found in F10 context only

### F10 Orders Management
- **PRD has:** Order dashboard, order detail, status tracking, bulk actions, seller settings
- **F10 design covers:** ✓ Orders table, ✓ Status bar, ✓ Filters
- **Note:** Sub-features align well

## 5. Critical Gaps Summary

| Gap | Severity | Action |
|-----|----------|--------|
| F13, F14 commerce flows no design mockup before Wave 6 | HIGH | Create designs for payment/shipping checkout steps + seller settings forms |
| F15 admin panel no design (being built blind) | HIGH | Create admin panel layout + activity logs table design |
| F21, F22 settings UI missing (Wave 1/earliest sprints) | MEDIUM | Quick mockups for language switcher + tracking settings form |
| F11, F12 features in F05 design but incomplete (no count badge, no Ctrl+S) | MEDIUM | Update F05 design specs or create separate detail specs for keyboard shortcuts & status indicators |
| Checkout payment/shipping not in F09 design (only in F10 context) | MEDIUM | Clarify: Should F09 design include checkout, or is it F10 scope? Current split confusing. |

## 6. Unresolved Questions

1. **F11/F12 incomplete specs:** Should F05 design include detailed state machine for undo counts + auto-save status ticker?
2. **Checkout ownership:** Is checkout (payment + shipping) part of F09 Storefront design or F10 Orders?
3. **Admin panel phase:** F15 v2 defers impersonation/subscriptions to later. Should design match Phase 1 scope only?
4. **Wave 6 readiness:** F13 & F14 both P1 for Wave 6 but have no design. Start now or defer wave?

---

**Key Finding:** Project has **5 critical UI-bearing PRDs with zero design files**, plus **2 editor features (undo/auto-save) with incomplete design specs** embedded in F05. Recommend prioritizing F13, F14, F15 designs before development sprint starts.
