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

