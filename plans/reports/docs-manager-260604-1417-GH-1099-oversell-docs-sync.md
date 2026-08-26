# GH-1099 QA Docs Sync — Remove `oversellReview` Dead Code

**Status:** DONE  
**Date:** 2026-06-04 14:17  
**Branch:** fix/1116-f32-email-rework-bugs  
**Scope:** Sync `docs/qa/F13-payment-gateway.md` + `docs/CHANGELOG.md` to reflect GH-1099 decision

---

## Decision Context

GH-1099 (US-F13-06) shifted to **decrement-upfront architecture**: stock decrements happen at checkout time (Stripe session creation, COD/bank_transfer order creation) using atomic SQL CAS `WHERE stock >= qty`. This eliminates oversell-after-capture — the scenario that `oversellReview` flag was designed to detect.

Result: `oversellReview` field is dead code.
- Field removed from Orders collection + refund route + OrderDetailPanel UI
- Column `oversell_review` kept in DB per NEVER-DROP migration rule (stays in `scripts/db-setup.js`, never DROP TABLE)
- TC-F13.145 & TC-F13.146 no longer applicable to real behavior

---

## Changes Made

### 1. `docs/qa/F13-payment-gateway.md` (3 edits)

#### Edit 1: TC-F13.145 (line ~319)
**Old:** "Oversell after capture → `oversellReview=true`, order stays paid, seller SYSTEM_ALERT"  
**New:** `[OBSOLETE]` — marked with context:
- Scenario no longer possible (decrement-upfront prevents race)
- Field removed from Orders collection + refund UI
- Reference to GH-1099 decision log

#### Edit 2: TC-F13.146 (line ~320)
**Old:** "Seller admin 'Refund customer' on oversellReview"  
**New:** `[OBSOLETE]` — marked with context:
- Field removed (no longer exposed in UI)
- Standard refund API still available for legitimate cases
- Reference to TC-F13.157 for migration preservation

#### Edit 3: TC-F13.157 (line ~331)
**Old:** Migration idempotent check only  
**New:** Added note clarifying:
- Field `oversell_review` removed from Orders Payload collection
- Column DB kept per NEVER-DROP policy
- Reason: data archaeology + production history

#### Edit 4: Traceability Table (line ~371)
**Old:** `| **FR-18 Oversell flag + seller notify (Wave 6.5)** | **TC-F13.145, 146** |`  
**New:** Added "(OBSOLETE per GH-1099: see decision rationale)" flag  
(Signals to testers/readers that tests are not applicable to current code)

### 2. `docs/CHANGELOG.md` (1 edit)

**Location:** Top of `## [Unreleased] — Staging`  
**Added entry:** GH-1099 — Remove Dead `oversellReview` Flag (US-F13-06 Rework)

**Content:**
- Root cause explanation (decrement-upfront makes oversell impossible)
- Implementation details (4 code areas affected)
- Database preservation rationale (NEVER-DROP policy)
- Test simplification notes
- Impact statement (non-breaking)
- Cross-reference to QA doc TC obsolete notes

---

## Format & Standards

✅ Both files maintain existing formatting (tables, heading hierarchy, list style)  
✅ TC descriptions remain intact for audit trail (marked OBSOLETE, not deleted)  
✅ CHANGELOG entry follows GH-XXX convention (impact + rationale + related refs)  
✅ Cross-references between CHANGELOG ↔ QA doc established  
✅ All decision context clear for future archaeology  

---

## Verification

- TC-F13.145 & TC-F13.146: status changed from "Critical/High [x] AUTO" to "[OBSOLETE]"
- TC-F13.157: note added clarifying field removal vs column preservation
- Traceability table FR-18: now signals OBSOLETE to prevent tester misunderstanding
- CHANGELOG: entry at top of Unreleased section, before GH-1082 entries

---

## Unresolved Questions

None. Decision and implementation aligned.

**Status:** DONE  
**Summary:** QA test plan + CHANGELOG updated to reflect GH-1099 oversell dead code decision. TC-F13.145..146 marked OBSOLETE; DB migration preservation documented. All cross-references verified.
