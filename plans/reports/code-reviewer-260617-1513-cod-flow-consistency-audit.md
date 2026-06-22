# COD Flow Consistency Audit — F36 EasyParcel

**Date:** 2026-06-17 15:13 | **Reviewer:** read-only audit | **Branch:** docs/F36-easyparcel-delivery

## VERDICT: NOT 100% match — 1 HIGH (codAmount migration not flagged), 2 MED, rest MATCH.

The COD flow is internally consistent (doc-vs-doc) and aligns with the codebase model. The one real defect: **`codAmount` is a NEW stored column but NO F36 doc flags it for `scripts/db-setup.js` MIGRATIONS** — only `codStatus` is flagged. This violates NFR-9 / project schema gate. Plus a wrong-claim in the prior docs-engineer note ("codAmount đã có sẵn từ computeOrderTotal") — `computeOrderTotal` returns a derived total, it is NOT a stored `codAmount` column.

---

## PART 1 — COD doc claims vs ACTUAL codebase

| # | Claim | Verdict | Sev | Evidence (path:line) | Fix |
|---|---|---|---|---|---|
| 1 | `paymentMethod` field exists, options include `'cod'` | **MATCH** | — | `Orders.ts:227-230` — `{ label: 'Cash on Delivery', value: 'cod' }` | none |
| 2 | `codAmount` already exists vs NEW | **MISMATCH** | **HIGH** | NO `codAmount`/`cod_amount` column in `Orders.ts` (fields end line 414); NOT in `db-setup.js` (grep empty). `total` (`Orders.ts:173`) is a **derived RM-float**, not a stored COD column. docs-engineer claim "codAmount đã có sẵn từ computeOrderTotal()" is **FALSE** — `computeOrderTotal` (`order-total.ts:42`) returns `{totalSen, total}`, computes nothing persisted as codAmount. | **codAmount IS NEW.** Add `cod_amount` (sen, integer) entry to `scripts/db-setup.js` MIGRATIONS + `Orders.ts` field, atomically (per database-schema.md). Add a "needs migration" flag for `codAmount` to PRD C-6b and US-F36-08 DoD (currently only `codStatus` is flagged). CI `check-migrations.js` will hard-gate otherwise. |
| 3 | `codStatus` does NOT exist today; docs flag it for MIGRATIONS | **MATCH** | — | No `cod_status` in `Orders.ts`/`db-setup.js`. PRD C-6c + US-F36-08b both flag `cod_status varchar` → MIGRATIONS (NFR-9). Correct. | none |
| 4 | US-F36-08 AC-3 "paymentStatus unpaid" — real field/value | **MATCH** | — | `Orders.ts:211-216` — `paymentStatus` select, `{ label: 'Unpaid', value: 'unpaid' }` (default `unpaid`). "unpaid" is a real value. | none |
| 5 | Order `status` enum = `pending→new→confirmed→ready_to_ship→shipped→completed` + cancelled/refunded; COD "confirmed but unpaid" fits | **MATCH** | — | `Orders.ts:194-207` exact lifecycle; `ORDER_STATUS_TRANSITIONS` (`Orders.ts:15-29`) matches PRD §4. `paymentStatus` is a separate field → COD "confirmed but unpaid" model is structurally supported (status independent of paymentStatus). | none |
| 6 | `computeOrderTotal()` returns grand total in sen; COD total = items + shipping − discount | **MATCH** | — | `order-total.ts:42-45` — `totalSen = subtotalSen - discountSen + shippingFeeSen`; returns both `totalSen` (sen) + `total` (RM). COD `codAmount` = snapshot of this grand total in sen → consistent (note: order row stores `total` as RM, codAmount must store the sen value separately). | none |
| 7 | Checkout routes accept `paymentMethod`; COD skips payment capture | **MATCH** | — | `checkout/route.ts:40,308-309` — COD path sets `paymentStatus: 'unpaid'` (no capture). `stripe-checkout/route.ts` exists. COD gated by `tenantPayments.payment_cod && pc.enableCod` (`checkout/route.ts:85`). | none — but see Part1 #7-note below |
| 7b | **xendit-checkout route** (B-4, US-F36-04 AC-3 claim 3 checkout branches incl. xendit) | **DATA-GAP** | **MED** | `grep -rln xendit src/app/api/` = **0 hits**. No xendit-checkout route exists. PRD B-4 + US-F36-04 AC-3 list "xendit-checkout F34" as a branch that must persist shippingCourier/codAmount. | Acceptable as forward-ref (F34 "song hành"/in-progress, marked as dependency). But the AC "cả 3 nhánh checkout đều persist" is untestable today (only 2 routes exist). Add a note that xendit branch is gated on F34 landing, or scope COD persist to the 2 existing routes for MVP. |
| 8 | Geo `zone` (west/east) returned + used to gate COD | **MATCH** | — | `geo/states/route.ts:17` SELECT `zone`; `geo/lookup/[postcode]/route.ts:26` `s.zone AS zone`. Values west/east confirmed (`classify-region.ts:3`). COD gating C-6a uses `/api/geo/lookup/[postcode]` → `zone='west'`. Real + wired. | none |
| 9 | `shippingFee` exists on Orders but never populated (orphan) | **MATCH** | — | `Orders.ts:161-165` field exists (default 0). `checkout/route.ts:274` populates it via `getShippingRate` (flat-rate). So it IS populated today by flat-rate — the "orphan" claim is partly stale: it's populated for flat-rate, but never with a real courier rate. Minor wording nuance, not a blocker. | Low: PRD §1 says shippingFee "không bao giờ được populate" re: provider — accurate for courier rate, slightly loose literally. No fix needed. |
| 10 | Per-courier COD capability encoded anywhere; Pos-Laju-default-but-no-COD contradiction handled | **DATA-GAP (expected)** | **MED** | No per-courier COD capability map in `src/` (no easyparcel code exists yet — confirmed by codebase-map). Capability comes at runtime from `cod_service_available` in EPRateCheckingBulk response (per research). The Pos-Laju contradiction (A-3 defaults top-3 incl. Pos Laju "Phổ biến SME"; Pos Laju does NOT support COD) **IS handled at gating layer:** C-6a/E3 + design §2.2 + HTML Screen F gate COD on `cod_service_available`, and AC-2 gives helper "Courier đang chọn không hỗ trợ COD". | Acceptable. Contradiction is resolved by runtime gating, not by removing Pos Laju from courier defaults (courier choice ≠ COD availability — a shop can use Pos Laju for prepaid). No code today is correct (feature unbuilt). |

---

## PART 2 — COD flow internal consistency (doc-vs-doc)

| # | Check | Verdict | Sev | Notes |
|---|---|---|---|---|
| 1 | `codStatus` values pending/collected/settled identical across PRD/design/stories/HTML | **MATCH** | — | PRD C-6c, design §2.4 badge variants, US-F36-08b AC-1, HTML Screen F timeline (L503-505) all use **pending/collected/settled**. No drift. (Old codebase-map report L83 used `unpaid/collected/remitted` — that was an early draft, correctly superseded; not a current-doc defect.) |
| 2 | COD courier list consistency; Pos-Laju contradiction | **MATCH** | — | COD set = J&T/DHL/Flash/Aramex consistent across §3, C-6a, US-F36-08, HTML. No doc claims "all couriers support COD". A-3 top-3 (J&T/Pos Laju/Flash) is the **courier-selection** default list, explicitly noted "Pos Laju top SME nhưng KHÔNG hỗ trợ COD" (US-F36-08 Market Notes L651). Two distinct concepts, both correct. |
| 3 | camelCase→snake_case naming (codStatus→cod_status, codAmount→cod_amount) matches siblings (shippingCourier→shipping_courier, awbNo→awb_no) | **MATCH** | — | PRD C-6c specifies `cod_status varchar`; US-F36-08b L720 `cod_status`. Convention consistent with sibling F36 fields. (codAmount→cod_amount column name implied but see HIGH #2 — the migration entry itself is missing.) |
| 4 | Helper texts match between design §2.2 and HTML Screen B/F | **MATCH** | — | 4 disabled reasons identical: East MY "COD chỉ khả dụng cho địa chỉ West Malaysia"; ">RM7,000" "Đơn vượt hạn mức COD (RM7,000)"; courier "Courier đang chọn không hỗ trợ COD"; "<RM5.01" "Giá trị đơn tối thiểu...RM5.01". design §2.2 table = US-F36-08 AC-2 = HTML L475-476. |
| 5 | HTML Screen B vs Screen F — leftover duplication/contradiction | **MATCH** | — | Screen B (L338) = checkout entry point with short COD hint, explicitly defers detail: "chi tiết gating ở Screen F". Screen F (L470) = detail scene. Clean handoff, no contradiction. |
| 6 | FR↔US↔AC traceability (C-6a..e → US-F36-08/08b + Phase C ACs) | **MATCH** | — | C-6a→AC-1, C-6b→AC-3, C-6c→AC-3+US-08b, C-6d→AC-4, C-6e→AC-5. PRD §8 Phase C AC#4-11 map cleanly. Old `C-6` marked "(Deprecated — xem C-6a..C-6e)" (PRD L326) — clean supersede, no dangling ref. Story footer L923 confirms full FR coverage. |
| 7 | Sandbox caveat ("COD param name cod_enabled/cod_amount unconfirmed") preserved consistently | **MATCH** | — | PRD §11 item#1, C-6e, Use Case Normal step 3, US-F36-08 AC-5 NOTE, design §2.3, HTML L488 all say param name UNCONFIRMED / verify sandbox. No doc claims it's confirmed. |

---

## HIGHEST-SEVERITY FIXES (in order)

1. **[HIGH] codAmount missing migration flag.** `codAmount` is a NEW stored sen column (NOT derivable/already-present). Every F36 doc flags `codStatus` for `db-setup.js` MIGRATIONS but NONE flags `codAmount`. Fix: add `cod_amount` to the MIGRATIONS-required list in PRD C-6b + US-F36-08 DoD + design §2.4 note, alongside `cod_status`. The docs-engineer note "codAmount đã có sẵn từ computeOrderTotal()" is wrong and should be removed/corrected. (Without this, the field either won't persist or CI schema gate blocks the PR.)

2. **[MED] xendit-checkout branch.** B-4 / US-F36-04 AC-3 require persisting COD/shipping fields across 3 checkout routes incl. xendit — but no xendit route exists in `src/` (F34 in progress). AC is untestable today. Fix: scope-note that xendit persistence lands with F34, or reduce the AC to the 2 existing routes for F36 MVP.

3. **[MED] Per-courier COD capability is runtime-only (no static map).** Expected (feature unbuilt) — capability read from `cod_service_available` at rate-check. No fix needed for docs; flag for implementation: gating MUST come from the live rate response, not a hardcoded courier list, or Pos-Laju-style mismatches slip through.

---

## Unresolved questions
- Is `codAmount` intended as a distinct stored column, or should it reuse `total` (RM-float) at COD-label time? Docs say "snapshot grand total (sen)" → implies a distinct sen column (since `total` is RM). Confirm with Domin: separate `cod_amount` sen column vs compute-from-`total`-on-the-fly. If the latter, no migration needed and HIGH #2 downgrades — but current docs clearly describe a stored field needing a migration.
- F34 (Xendit) timeline vs F36 Phase B: does COD-field persistence in the xendit branch block F36 merge, or defer?

**Status:** DONE_WITH_CONCERNS
**Summary:** COD flow is internally consistent and matches the codebase model; 1 HIGH defect — `codAmount` is a new stored column but no doc flags it for the db-setup.js MIGRATIONS schema gate (and a prior note wrongly claimed it already exists). 2 MED items (xendit route absent; per-courier COD capability runtime-only).
**Concerns:** codAmount migration gap must be fixed before implementation or CI will block.
