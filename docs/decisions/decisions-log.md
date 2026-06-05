# Product Decisions Log — PrimeWeb

> Tất cả product decisions quan trọng, documented với options, chosen path, và rationale.
> Tham khảo từ ECH Webstore v2 PRD, adapted cho PrimeWeb tech stack.

---

## PD-001 — AI Provider

| | |
|---|---|
| **Decision** | OpenAI GPT-4o / GPT-4o-mini cho tất cả AI features |
| **Options** | GPT-4o (OpenAI), Claude Sonnet 4 (Anthropic), Gemini (Google), Mixed |
| **Chosen** | **OpenAI GPT-4o-mini** (cost-efficient) + GPT-4o (complex tasks) |
| **Rationale** | Vercel AI SDK integration sẵn. GPT-4o-mini tốt cho chat/edit tasks. GPT-4o cho complex generation. Consistent SDK across features. |
| **Status** | ✅ Decided — Đã implement trong `src/lib/ai/config.ts` |

---

## PD-002 — Store URL Strategy

| | |
|---|---|
| **Decision** | Subdomain default + Custom domain as P1 upgrade |
| **Options** | Subdomain only, Custom domain all plans, Subdomain + upgrade |
| **Chosen** | **Subdomain default**: `{slug}.primeweb.app` + custom domain P1 |
| **Rationale** | Subdomain gets users live faster — no DNS setup required. Custom domain = strong upgrade incentive. Cloudflare API makes setup trivial for Phase 2. |
| **Status** | ✅ Decided |

---

## PD-003 — Editor Architecture

| | |
|---|---|
| **Decision** | iframe preview of actual storefront URL |
| **Options** | iframe preview, Same-DOM preview, Server-rendered screenshot |
| **Chosen** | **iframe preview** — pixel-identical to live store |
| **Rationale** | Preview exactly matches live store. Mobile preview toggle by resizing iframe width. CSS isolation — no editor styles leak into preview. SSR benefits apply automatically. |
| **Status** | ✅ Decided |

---

## PD-004 — Onboarding Entry Point

| | |
|---|---|
| **Decision** | AI Web Builder as primary, Template Gallery as fallback (P1) |
| **Options** | Template gallery first (v1), AI Chat only, Choice: Template OR AI |
| **Chosen** | **AI Web Builder primary** — Template Gallery kept as P1 fallback |
| **Rationale** | Template selection creates choice paralysis (key v1 problem). AI Chat removes all decisions from user — fastest path to live. Consistent with "AI-first" positioning and 5-min benchmark. |
| **Status** | ✅ Decided |

---

## PD-005 — AI Language Support

| | |
|---|---|
| **Decision** | BM + EN + mixed input. Store output in both languages |
| **Options** | English only, BM only, Both BM + EN with mixed input |
| **Chosen** | **BM + EN + mixed input** |
| **Rationale** | MY SMEs naturally communicate in BM/EN mix (Manglish). GPT-4o handles BM natively. Bilingual store content improves discoverability. Key differentiator vs EN-only competitors. |
| **Status** | ✅ Decided |

---

## PD-006 — Store Generation Response

| | |
|---|---|
| **Decision** | SSE streaming — real-time section-by-section preview |
| **Options** | Wait for full response (spinner), SSE streaming, Polling every 2s |
| **Chosen** | **SSE streaming** via Vercel AI SDK |
| **Rationale** | Watching store appear section by section is the "wow moment". Reduces perceived wait time. Vercel AI SDK provides SSE out of the box. |
| **Status** | ✅ Decided — Implemented via `streamText()` |

---

## PD-007 — Auto-Save Mechanism

| | |
|---|---|
| **Decision** | Interval auto-save every 30 seconds + on AI action complete |
| **Options** | Manual save only, Auto-save every change, Debounced after inactivity, Interval |
| **Chosen** | **Interval every 30s + save-on-AI-action** |
| **Rationale** | Max 30s data loss on crash. AI changes never lost. Predictable behaviour. Toast notification "Saved" keeps user informed. |
| **Status** | ✅ Decided |

---

## PD-008 — Multi-Tenancy

| | |
|---|---|
| **Decision** | Shared DB with mandatory storeId row-level isolation |
| **Options** | DB per tenant, Schema per tenant, Shared DB + row-level isolation |
| **Chosen** | **Shared DB + storeId filter** via Payload CMS access control |
| **Rationale** | Simpler — 1 PostgreSQL instance. Cost-effective at current scale. Mandatory storeId filter on every query via Payload access control hooks. Soft delete (`deletedAt`) mandatory. |
| **Status** | ✅ Decided — Enforced via Payload collection access control |

---

## PD-009 — AI Rate Limiting

| | |
|---|---|
| **Decision** | Soft limits per plan + AI credit add-on (Phase 3) |
| **Options** | No limits, Hard daily limits, Soft limits + upgrade prompt, Credit system |
| **Chosen** | **Soft limits** — Standard: 3 generations/hour, 10 images/day |
| **Rationale** | Unlimited = unbounded cost risk. Soft limits + upgrade prompt = monetisation touchpoint. Implemented via config in `src/lib/ai/config.ts`. |
| **Status** | ✅ Decided — Config exists, enforcement TBD |

---

## PD-010 — Payment Provider

| | |
|---|---|
| **Decision** | Stripe for MVP, FPX/GrabPay integration for MY market (P1) |
| **Options** | Stripe (global), ipay88 (MY leader), Billplz (FPX-focused), Direct GrabPay |
| **Chosen** | **Stripe for MVP** — FPX + GrabPay via Stripe Malaysia (P1) |
| **Rationale** | Stripe SDK already integrated. Stripe Malaysia supports FPX as payment method. Avoids setup time for ipay88 merchant account. Cards + FPX available through single provider. |
| **Status** | ✅ Decided |

---

## PD-011 — CMS & Backend

| | |
|---|---|
| **Decision** | Payload CMS 3 integrated with Next.js 15 |
| **Options** | NestJS + Prisma (separate), Payload CMS (integrated), Strapi, Directus |
| **Chosen** | **Payload CMS 3** — runs inside Next.js App Router |
| **Rationale** | Single deployment (no separate backend). Collections = schema + API + admin UI automatically. TypeScript-native. Next.js 15 App Router integration. Admin panel built-in. |
| **Status** | ✅ Decided — Implemented |

---

## PD-012 — Deployment

| | |
|---|---|
| **Decision** | DigitalOcean + Docker + GitHub Actions CI/CD |
| **Options** | Vercel, Railway, DigitalOcean, AWS ECS |
| **Chosen** | **DigitalOcean App Platform** with Docker container |
| **Rationale** | Cost-effective. Docker ensures environment parity. GitHub Actions CI/CD already configured. Lark webhook notifications. |
| **Status** | ✅ Decided — Implemented in `.github/workflows/ci.yml` |

---

## PD-013 — Halal Trust Signal

| | |
|---|---|
| **Decision** | Products collection supports Halal certification upload + badge |
| **Options** | No Halal feature, Text-only Halal claim, Cert upload + verified badge |
| **Chosen** | **Cert upload + badge** — toggle per product, JAKIM cert image |
| **Rationale** | F&B and Beauty are top categories for MY SMEs. Halal cert is critical trust signal — consumers check before buying. Badge on storefront + cert viewable = highest trust. |
| **Status** | ✅ Decided — Added to F08 v2.0 |

---

## PD-014 — WhatsApp Integration

| | |
|---|---|
| **Decision** | WhatsApp as primary customer communication channel |
| **Options** | Email only, Live chat widget, WhatsApp button, All channels |
| **Chosen** | **WhatsApp floating button** (storefront) + **wa.me notification** (orders) |
| **Rationale** | 90%+ Malaysian users use WhatsApp daily. Lower friction than email for SMEs. P0: wa.me links (no API). P1: WhatsApp Business API for automated messages. |
| **Status** | ✅ Decided — Added to F09 AC-11, F10 AC-3b |

---

## PD-015 — Shipping Model

| | |
|---|---|
| **Decision** | Flat rate by region (West vs East Malaysia), carrier API later |
| **Options** | Free shipping all, Variable by weight, Flat rate by region, Carrier API |
| **Chosen** | **Flat rate by region** — Semenanjung RM 8, Sabah/Sarawak RM 15 |
| **Rationale** | Simple for MVP. 85% orders are Semenanjung. Seller can customize rates. Free shipping threshold (configurable). Carrier API (J&T, Pos Laju) in Wave 7 via EasyParcel. |
| **Status** | ✅ Decided — F14 PRD created |

---

## PD-016 — Store Language Selection

| | |
|---|---|
| **Decision** | Language selected at onboarding, used by AI and storefront UI |
| **Options** | EN only, BM only, Auto-detect, User selects at onboarding |
| **Chosen** | **User selects BM or EN at onboarding** — saved to `site.locale` |
| **Rationale** | Drives AI content language (product descriptions, SEO keywords). Storefront UI labels switch via locale. Product names are user-entered (stay as-is). Bilingual = competitive advantage. |
| **Status** | ✅ Decided — Added to F06 v2.0 |

---

## PD-017 — Post-deploy Template Seed Strategy

| | |
|---|---|
| **Date** | 2026-04-19 |
| **Decision** | Post-deploy template seed uses **force replace-all** (delete existing rows → reseed from `TEMPLATE_PRESETS`). |
| **Options** | Force replace-all, Upsert-by-slug (merge content), Skip if no drift |
| **Chosen** | **Force replace-all** on every staging + production deploy, via `POST /api/templates/seed?v3=true&force=true` with Bearer `SEED_TOKEN`. |
| **Rationale** | Admin does not edit templates directly today (researcher-02 confirmed); templates are code-derived snapshots, not user data. Force replace is idempotent, zero-risk, and strictly simpler than upsert-by-slug (no merge logic, no schema diff to reason about). YAGNI. |
| **Alternatives rejected** | **Upsert-by-slug** — more complex, would need per-template diff logic, no benefit while admin editing UI doesn't ship. |
| **Revisit when** | Admin template-editing UI ships (plan 260419-2022 Phase 04 / Phase 05), at which point user customizations would be overwritten by force strategy. |
| **Status** | ✅ Decided — Implemented in plan 260419-2022 Phase 03 (CI auto-seed after each deploy) |

---

## PD-018 — Oversell Handling: Prevent-Upfront vs Detect-After (GH-1099, F13 AC-3 Supersede)

| | |
|---|---|
| **Decision** | AC-3 (Oversell-detect-after + manual seller refund) **SUPERSEDED** by prevent-upfront architecture |
| **Options** | 1. Detect after capture (original AC-3): flag oversellReview, manual seller refund; 2. Prevent upfront: atomic CAS at checkout |
| **Chosen** | **Prevent-upfront (Option 2)** — stock decrement at order creation via atomic `WHERE inventory >= qty` |
| **Rationale** | **Upfront prevention is operationally simpler + safer.** Detect-after requires manual seller intervention (refund button), creates order processing ambiguity, and risks customer dissatisfaction. Prevent-upfront: fail fast at checkout (422 OUT_OF_STOCK), no order created, buyer sees error immediately, cart preserved for retry. Zero post-capture oversell scenarios. **Objective: never oversell** is achieved via architecture, not manual process. |
| **Impact** | **Code:** Stock decrement moved from webhook `reconcileOrderPaid()` to checkout/session-creation for all payment methods (commit `938406a9`); the now-dead `oversellReview` field + refund branch removed in PR #1160. **Docs:** FR-18, US-F13-06 AC-3 marked SUPERSEDED; schema field `oversell_review` deprecated (column kept for backward-compat, NEVER-DROP rule). **QA:** TC-F13.145, TC-F13.146 marked OBSOLETE (no post-capture oversell scenario to test). |
| **Status** | ✅ Decided 2026-06-04 (GH-1099, PR #1160 merged) — Docs sync: 2026-06-05 |

---

## PD-019 — Manual Payment (Bank Transfer) Verification Flow

| | |
|---|---|
| **Date** | 2026-05-14 (init) · 2026-05-15 (D-06 dropped, D-13 decided) |
| **Decision** | Bank Transfer dùng **3-step async flow** với verification gate. Buyer Place Order → Awaiting Payment → upload proof qua magic link → Pending Verification → seller Approve/Reject → Paid/Cancelled. **Wave 8+ sẽ thêm Auto-verify Open Banking** (D-13) — schema Wave 6 dự phòng fields cho backward-compat. |
| **Issue** | [#1004](https://github.com/primeproduction/ech-prime-web-v2/issues/1004) — `docs(F10/F19): rewrite manual payment verification rules` |
| **Driver** | Lỗ hổng fake orders (ảnh đen/meme/hóa đơn cũ) — PRD hiện hành (F10 BR-Payment-01) auto-mark `Paid` khi upload thành công → seller ngập đơn ảo + sai tồn kho. |
| **Status** | ✅ Decided 13/14 — PRD revision ready. D-14 (Bulk Approve) defer. |

### Sub-decisions chốt với PM (2026-05-14)

| # | Decision | Chosen | Rationale |
|---|----------|--------|-----------|
| **D-01** | Auth model guest upload-later | **Magic link JWT signed (gửi qua email khi Place Order)** | UX mượt nhất cho guest checkout, không ép signup. Token signed → tamper-proof. |
| **D-02** | Stock reservation TTL | **24h** | Buffer cho giao dịch ngoài giờ + sự cố ngân hàng. DuitNow nhanh nhưng safe margin. |
| **D-03** | Re-upload behavior | **Replace allowed khi đang `pending_verification`. Re-open khi seller Reject** (cho buyer "kháng cáo") | Tránh deadlock UX; cho buyer fix ảnh mờ/sai mà không phải tạo đơn mới. |
| **D-04** | Fast-path upload-at-checkout | **Bỏ hẳn — strict 3-step async only** | KISS code path. Giảm cart abandonment. Đảm bảo order persist trước khi nhận file. |
| **D-05** | Reject reason picker | **Enum cố định + Free text** — `Ảnh mờ`, `Sai số tiền`, `Trùng đơn`, `Khác (kèm freetext)` | Hỗ trợ analytics + UX seller cân bằng. |
| ~~**D-06**~~ | ~~Anti-fraud warning copy~~ | **BỎ — không hiển thị warning** (PM updated 2026-05-15) | Đơn giản hóa UX Post-Order Upload page; trust signal đến từ reference code + verification gate, không cần cảnh báo bằng chữ. FR-24 dropped khỏi F10 PRD. |
| **D-07** | Email trigger timing | **Gửi ngay sau Place Order** với status "Order Received — Awaiting Payment" | Fire-and-forget pattern (`email-smtp.md`). Buyer cần link upload ngay. |
| **D-08** | DuitNow Reference Code | **Auto-generate 6 chars** cho mọi Bank Transfer order | Seller đối soát nhanh trên app ngân hàng. Format chốt khi viết PRD. |
| **D-09** | Email template scope | **Đồng nhất Bank Transfer + COD** (cùng nhận instructions tiếp theo) | UX nhất quán; COD chỉ khác phần payment instructions. |
| **D-10** | Confirmation route | **`/sites/[slug]/orders/[id]?token=...`** | REST-style, định danh cao, gắn slug tenant rõ ràng. |
| **D-11** | Payment Status enum (final) | Thêm `awaiting_payment` + `pending_verification` vào enum hiện tại. Code phải align với PRD (hiện code có `processing` không đúng PRD). | Cover full lifecycle. |
| **D-12** | COD parity | **COD giữ nguyên logic — KHÔNG cần upload proof** (physical handover, không có fraud risk tương đương) | YAGNI — không over-engineer flow COD. |
| **D-13** | Wave 8+ Auto-verify Open Banking | **CÓ — sẽ implement Wave 8+** (PM + CTO chốt 2026-05-15) | Schema Wave 6 dự phòng 3 fields: `autoVerifiedAt` (timestamp), `bankTransactionId` (text — external bank ref), `verificationSource` (enum `manual` \| `auto`). Default `manual` cho Wave 6. Wave 8+ Open Banking API match `paymentReference` → set `auto` + transaction ID. Backward-compat: manual flow vẫn hoạt động song song. |

### Pending decisions (defer)

| # | Question | Status |
|---|----------|--------|
| **D-14** | Bulk Approve cho đơn `pending_verification` (1 click duyệt N đơn)? | ⏳ Defer — UX trade-off vs fraud risk. Revisit sau khi seller dashboard ship. |

### Implementation impact

- `docs/prd/F10-orders-management.md` — rewrite BR-Payment-01 + thêm BR mới (TTL, magic link, reject reason) + schema fields dự phòng cho D-13
- `docs/prd/F19-store-configuration.md` — thêm DuitNow Reference Code spec
- `docs/prd/F09-storefront-commerce.md` — variant Thank You page cho Bank Transfer
- `docs/stories/F10-orders-stories.md` — US mới: seller verify; buyer post-order upload
- Schema migration (separate issue sau khi PRD merge): enum `awaiting_payment` + `pending_verification`, fields `paymentExpiresAt`, `paymentRejectionReason`, `paymentReference`, `paymentVerifiedAt`, `paymentVerifiedBy`, `magicLinkSecret`, **`autoVerifiedAt`, `bankTransactionId`, `verificationSource`** (Wave 8+ pre-build)

