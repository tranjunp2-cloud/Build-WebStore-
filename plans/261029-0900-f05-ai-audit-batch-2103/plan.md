# #2103 — AI audit batch (site gen, editor copilot, ECH Agent)

Branch `fix/F05-ai-audit-batch` (base `fix/ai-copilot-review-2059` @ 548fdcb6a, staging merged in).
Status: analysis done, no code yet. Paths relative to repo root.

## A. AI site generation (`/builder/new`)

| # | Root cause | Fix |
|---|---|---|
| A1 | Fake text is hard-coded, not model output: `src/lib/ai/content/fnb.ts:74,108,118`, `content/beauty.ts:108,118`, `content/restaurant.ts:108,113`; stats `template-composer.ts:671-676`; team `:918+`; features `:410-411`; real brand logos `content/client-logos-library.ts:70-85`. Injected by `content-injection.ts:360-374,483,510,652-661` + `structure-enforcer.ts:254-318`; `template-rules.ts` makes testimonials (all) + team (beauty) mandatory; `category-requirements.ts:42-44` pads items; prompt asks for them `system-prompt.ts:231,249`; empty stats render `FALLBACK_STATS` `src/blocks/stats/index.tsx:15-19`. `sample_content` gate only flags empty lists and `publish-site.ts` never checks it. | Stop library fill for testimonials/stats/team/logo-cloud; drop them from mandatory + min counts; strip claim FAQ/features (halal, delivery partners, discounts); prompt rule "no invented reviews/numbers/staff/logos". Decision: drop vs placeholder + publish block. |
| A2 | `business-info-mapper.ts:26-32` splits on commas inside `()`; `template-composer.ts:1069-1073` copies library prices (`content/fnb.ts:130-137`) by index. | Paren-aware split → `{name, price?}`; menu uses merchant/created product price, never library. |
| A3 | Always 6 products + library top-up `generate-sample-products.ts:331,349-354`; `inventory:0` + `active` hard-coded `:160-189,435,453`; photos round-robin from site pool `generate-site-service.ts:959-967` (per-product keyword dropped `:448`); fnb/beauty recipes have no product block `category-recipes.ts:188-216,428-455`; no /shop page `generate-site-service.ts:2828`. | Exactly the merchant's N products; keyword-matched photo or none; stock-0 → draft (decision); homepage `products-featured` + `/shop` grid + nav link. |
| A4 | Builder save sends only `{blocks, theme}` `AIBuilderPageClient.tsx:336-339,372-375` → `save/route.ts:359` `draft: isDraft ?? false`; generation creates pages `_status:'published'` `generate-site-service.ts:1724,1780,1945`; blogs `seed-blog-posts.ts:335`. | Builder sends `isDraft: true` + base; generation writes drafts; first publish promotes blogs. |
| A5 | Raw Pixabay `hit.tags` as alt `pixabay-client.ts:773` → `image-pool.ts:272` → `pool-preupload.ts:93`, `media-pipeline.ts:250`. | One `buildStockAlt` helper: dedupe, 2-3 tags, subject prefix, ≤120 chars. |
| A6 | Preview shows hovered option `builder/new/**/BusinessInfoForm.tsx:582-583,660,673-674` (Real estate sits under Beauty in 4-col grid; touch never fires leave). Duplicate labels `en.json:672,682` (restaurant vs fnb, `collections/Templates.ts:5,15`). | Preview = selected unless pointer over grid; rename labels (hand-insert locale keys). |

## B. Editor copilot

| # | Root cause | Fix |
|---|---|---|
| B1 | `products-featured` renderer ignores `productIds`, fetches newest `limit=2` `src/blocks/products-featured/index.tsx:149-150,226`; `site_read` products filter tenant only, no status/deleted/stock/photo `src/lib/ai-platform/site/site-read.ts:234-249`, `site-prepare.ts:94-106`; tool result has no "will show N" `merchant-tools.ts:978-990`; no duplicate-section guard (`site-patch.ts:204-209`). | Honour `productIds` (fixed mode); site-scoped, storefront-rule product read with `hasPhoto`; return "will show N of M" + reasons; refuse 2nd same product section on page. |
| B2 | Card summary = model `why` `change-set-builders.ts:908,986,1018` with no language rule (`merchant-instructions.ts:179`, `merchant-tools.ts:283`); language never pinned per turn (`merchant-tools.ts:1045`); suggestions re-infer (`suggest-next.ts:167`). | Deterministic reply-language line from `messageLanguage(prompt)` (≥3 words); rule covers card text; script-mismatch guard on `why`; pass language to suggestions. |
| B3 | `previewValue` passes HTML through `site-blocks.ts:112-114` → `packages/agent-ui/src/site-change-rows.tsx:122-126`; "Reading your catalog families" for every question `agent-run.service.ts:1139,1154`. | Plain-text diff (`rich-text-render.tsx:92 plainText`), "formatting changed" if equal; families label only for product_details. |
| B4 | Terminal status streamed `agent-run.service.ts:1173` before suggestions `:1210-1224` and `saveRun` `:1258` → next send hits `THREAD_BUSY` 409 (`stale-run.ts:7`, `run-queue.ts:120`); queued message auto-sends `chat.tsx:821-831`. | Save terminal run before suggestions; client retries once on 409 after its own run finished. |
| B5 | Suggestion prompt only "things the assistant can do" `suggest-next.ts:165-183`; runs on decline turns. | Rule: never suggest declined ability/workaround; skip model chips on decline. |

## C. ECH Agent (dashboard)

| # | Root cause | Fix |
|---|---|---|
| C1 | `store_todos` → `shop-todo.ts:181-207` has no selling-setup signals; data exists: `Tenants.payments.*` (`Tenants.ts:356-560`), media provenance (`Media.ts:243-264`), `Sites.contactInfo/localBusiness` (`Sites.ts:362-460`), `Tenants.customDomains` (`:121-140`). | Separate `setup: []` list in `readStoreTodos` (payments COD-only, stock/AI photos only, business info, domain) so To-do card/automations unchanged; tool description + instruction update. |
| C2 | `store-product-tools.ts:123-128,142,182` formats base `price` (0); `variants` not selected. | `getDisplayPrice` + "From"; select `variants.price`; align stock with variant sum. |
| C3 | `.ech-ag-float-root` fixed bottom-right z-90 `packages/agent-ui/src/styles.css:913-926` over fixed save bars (`ProductForm.tsx:316-319`, Payments, Shipping, Discounts, Customers); no route quiet mode (`agent-dock-routes.ts`). Chip = flying copy `packages/agent-ui/src/fly.ts:40-73` landing on textarea before real chip attaches (`EditorAgentChat.tsx:326-354`). | Lift mascot when `[data-save-bar]` present; no raise/peek on edit routes; attach chip first then fly to it; fly safety timeout. |

## User decisions (2026-10-29)
- A1: keep the blocks (no drop, no publish block). Ground content in real tenant/site data, ask the merchant better questions, improve the generation tooling. No invented facts.
- A3: add/extend tool calls so the AI asks the merchant for missing stock/photos/prices and applies the answers.
- C1: separate `setup: []` list for the Agent only.

## Design A1 — grounded content (proposal, awaiting approval)
Facts: form asks only 4 fields (`BusinessInfoForm.tsx:545-617`); URL import works but tab is commented out (`:387-406,643`; `api/ai/extract-from-url`, `url-scraper.ts`) and already returns real testimonials/faq/contact/stats; template-first path never reads `contentBrief`; `enforceMinItems` pads real items with fake pool (`content-injection.ts:759-800`, mins `category-requirements.ts:37`); renderers fake when empty (`blocks/stats/index.tsx:15-19`, `team/index.tsx:23`, `faq/index.tsx:15`); tenant/site data (`Tenants.whatsappNumber/businessAddress/payments`, `Sites.localBusiness/socialLinks`) unused by `src/lib/ai/**`.
1. One FACTS object built per generation: form answers + URL extraction + tenant/site/account data + enabled payment/shipping methods. Composer, injector and prompts read only FACTS for claims.
2. Form: re-enable "your website / Instagram / Facebook" import; add 2 optional fields — "How customers buy" chips (delivery/pickup/walk-in/booking/COD/online pay + areas) and "Facts we can say" (year started, real certifications, awards).
3. Per block: testimonials = real quotes, else one "Be the first to review {brand}" card (no name, no rating); stats = real facts/counts only (≥2 or no numbers); team = owner as Founder / "The {brand} team"; logo cloud = enabled payment/shipping/marketplace logos; FAQ = answered from FACTS only; features = product/description based.
4. Remove claim strings from `content/*.ts` (30 pools), `template-composer.ts` stats/team/features/halal tags/client logos, `client-logos-library.ts`, `content-injection.ts` fallbacks; renderer fallbacks render nothing fake; no padding of real items.
5. Prompts: `system-prompt.ts:231,236,249,399-422,514`, `sitegen-tasks.ts:58` — never invent people/quotes/ratings/numbers/staff/brands/certifications; use FACTS.
6. Mark each generated item `source: real|placeholder`; `site-samples.ts` reads it; completion screen + copilot check list "replace before publishing" (informational, not a publish block).

## Design A3 — ask-and-apply products (proposal, awaiting approval)
1. Generation: exactly the merchant's N products (≤20, A2 paren-aware parse with price), no library top-up; per-product keyword photo or none; keep product ids in the SSE done event; add `products-featured` to fnb/beauty home recipes + `/products` CMS page with `products-grid` + nav link (storefront `/products` route is disabled).
2. Status: open question — draft + `aiReviewPending` (feeds existing `products_ai_review` To-do) vs active.
3. Tool `propose_shop_products_setup` (ai-platform, `shop_products`): 1–20 rows `{id, price, inventory, images, status}` → ONE card (variants.rows table), applier loops `store-product.ts` update/status with `tenantFilter`, version guard, one undo; skips products with options.
4. ask_user `quantities` kind (rows + number input) in agent-core schema / question-flow / question-card; photos via existing `pictures` question with upload.
5. Snapshot `images[].source` (upload/stock/ai) so the agent knows which photos to replace.
6. Entry: completion CTA "Finish your shop" → `/products?todo=products_ai_review` (rewritten prompt) + dashboard work item; `products_setup` row in C1 `setup` list.

A3 decisions (2026-10-29): AI products stay **active + stock 0 shown as Sold out**; new ask_user **`quantities`** kind (number per row).

## Execution (2026-10-29) — 4 parallel agents, disjoint files, no commits by agents
| Agent | Items | Owns | TC range |
|---|---|---|---|
| gen-content | A1 A2 A3-gen A4-gen A5 | `src/lib/ai/**` (not seo-queue), `lib/sites/publish-site.ts`, `blocks/{stats,team,faq,testimonials,logo-cloud}` | TC-AIAUD-001..039 |
| builder-ui | A4-client A6 A1-form A3-CTA | `app/(builder)/**`, `components/builder/**`, `store/builderStore.ts`, `lib/validations/ai.ts`, en/ms.json | 040..059 |
| copilot-ux | B1–B5 C3 | ai-platform agent (not ask/shop-product), agent-ui/react, `lib/ai-platform/site/**`, products-featured/grid, editor/agent, components/agent | 060..099 |
| store-setup | A3 tools+quantities C1 C2 | agent-core schemas, ask/**, question-card, shop-product tools/appliers, store-todos, shop-todo | 100..139 |
Lead: docs/qa rows, review, commits, PR.

## Overlap with #2077–#2102
#2082 (storefront variant price — we only touch agent tools), #2089 (font-size root cause — we only fix diff display), #2099 (dashboard checklist — don't touch `dashboard/page.tsx`), #2092 (`site-access.ts` — don't touch), en/ms.json (hand insert only).

## Suggested order
A1 → A4 → A2 → A3 → A5/A6 · B4 → B1 → B3 → B2/B5 · C2 → C1 → C3. Tests: TC-IDs in `docs/qa/F01-ai-builder-variety.md` (A1-A3, A5, A6) and `docs/qa/F05-ai-editor-testcases.md` (A4, B*); agent ones in existing ai-platform specs.
