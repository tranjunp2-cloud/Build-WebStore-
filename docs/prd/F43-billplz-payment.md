# PRD: Billplz Payment Integration (F43)
> **Version:** 0.1-skeleton | **Created:** 2026-10-05 | **Agent:** `project-planner` (skeleton) — **BA to fill**
> **Priority:** P1 | **Sprint:** Wave 8 — TBD | **Size:** L
> **Depends on:** F09 Storefront ✅, F10 Order lifecycle ✅ | **Blocks:** —

---

> [!WARNING]
> **Status: SKELETON — pending BA ownership.** This PRD was scaffolded by Dev after dev-side research (no BA involved yet). Technical foundation already exists:
> - Research: `plans/261005-1427-billplz-payment/research.md` (Billplz API, X Signature, fees, OAuth findings)
> - Implementation plan: `plans/261005-1427-billplz-payment/plan.md` + 8 phase files
> - User stories + ACs: `docs/stories/F43-billplz-payment-stories.md` (Draft, dev-authored)
> - GitHub issues: #1911–#1918 (US-F43-01 → US-F43-08)
> - Product decisions logged: **PD-023, PD-024** in `docs/decisions/decisions-log.md`
>
> **BA tasks:** fill sections marked `[BA]`; confirm/amend PD-023 + PD-024; BA-accept story ACs; set sprint/wave + success metrics.

---

> [!IMPORTANT]
> **Stories-First Rule:**
> PRD này PHẢI được xây dựng dựa trên các User Stories đã tồn tại và được approve.
> - Mọi Acceptance Criteria (Section 11) phải được copy từ file story, KHÔNG tự viết mới.
> - Mọi Functional Requirement (Section 7) PHẢI có Story ID tham chiếu trong cột `Story Ref`.
> - **Rule:** Stories → PRD. Không bao giờ ngược lại.

---

## 0. Story Traceability

| Story ID | Title | File | Status |
|----------|-------|------|--------|
| US-F43-01 | Schema + Billplz client library | [F43-billplz-payment-stories.md](../stories/F43-billplz-payment-stories.md) | Draft |
| US-F43-02 | Seller connect — manual keys | same | Draft |
| US-F43-03 | Checkout flow — create Bill + hosted redirect | same | Draft |
| US-F43-04 | Webhook — X Signature verify + reconcile | same | Draft |
| US-F43-05 | Lifecycle — expiry, reconcile cron, status UX | same | Draft |
| US-F43-06 | Refund via Payment Order API v5 *(stretch)* | same | Draft |
| US-F43-07 | OAuth Connect *(stretch — blocked)* | same | Draft |
| US-F43-08 | Docs + cross-phase hardening | same | Draft |

---

## 1. Problem Statement

[BA] Merchant Malaysia cần nhận thanh toán qua kênh local (FPX online banking, DuitNow QR/e-wallet, BNPL) — Stripe không phủ FPX, Xendit không còn là production flow. *(Dev draft — BA refine với business context + demand evidence.)*

---

## 2. Target User

- [BA] Primary: SME Owner Malaysia (non-technical, Malay/English)
- [BA] Secondary: Buyer Malaysia thanh toán bằng bank app (FPX/DuitNow)

---

## 3. Solution Overview

Hosted checkout Billplz: seller connect bằng 3 keys (API Secret + Collection ID + X Signature Key) trong Settings → Payments; buyer chọn "Billplz" ở checkout → redirect sang hosted page của Billplz → trả qua FPX/e-wallet/card/BNPL → webhook ECH mark paid. Refund v1 manual (FPX non-reversible — PD-023); OAuth Connect + Payment Order refund là stretch (PD-024).

---

## 4. Scope

### In Scope (P0–P1, dev-validated)

- Tenant credential fields + manual-key connect UX (US-F43-01, 02)
- Billplz checkout option + hosted redirect (US-F43-03)
- Webhook X Signature + reconcile + paid-after-cancel alerting (US-F43-04)
- Lifecycle: void bill on cancel, reconcile cron, status/retry (US-F43-05)
- Docs + hardening (US-F43-08)

### Out of Scope / Stretch

- Payment Order refund API (US-F43-06, P2) — needs seller pre-funded PO collection + buyer bank form
- OAuth Connect (US-F43-07, P2) — **blocked** on Billplz partner credentials (PD-024)
- Bank-code bypass (`reference_1`), platform-fee markup — not requested
- [BA] Confirm/add business out-of-scope items

---

## 5. Success Metrics

| Metric | Target | Measured By |
|--------|--------|-------------|
| [BA] e.g. Billplz-enabled stores | [BA] | [BA] |
| [BA] e.g. payment completion rate | [BA] | webhook paid/callback ratio |
| PAID_AFTER_CANCEL incidents | 0 un-alerted | error-log marker coverage |

---

## 6. User Story Summary

[BA] — copy tóm tắt từ stories file khi accept.

---

## 7–10. Functional Requirements / Flows / Data / Edge Cases

[BA] — derive FRs from accepted ACs (stories-first rule). Dev-authored ACs live in stories file sections AC-1..AC-5 per US.

---

## 11. Acceptance Criteria

Canonical ACs: `docs/stories/F43-billplz-payment-stories.md` — [BA] copy vào đây khi accept (stories-first rule).

---

## 12. Open Questions

- Billplz OAuth partner contract (client_id/secret, scopes, token→credential endpoint) — outreach `team@billplz.com` (PD-024)
- Payment Order v5 exact contract — verify before US-F43-06 implementation
- Sandbox merchant account creation for E2E testing
- [BA] business open questions

---

## 13. Dependencies & Risks

- Stripe remains primary card gateway — Billplz is additive, not replacement
- FPX non-reversible → refund always needs disbursement (PD-023)
- Billplz bill lifetime 30d vs order expiry 24h → late-payment window mitigated by void+alert (PD-023)
