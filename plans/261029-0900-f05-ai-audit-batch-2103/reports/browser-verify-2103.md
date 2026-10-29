# Browser verify — #2103 (fix/F05-ai-audit-batch)

- **Verifier:** audit session (read-only on the worktree; no code changes).
- **Date:** 2026-10-29.
- **Evidence:** screenshots in `reports/browser-2103/`; audit evidence in `ech-ai2/audit-output/primeweb-v2/`.

## Isolated environment (does not touch the :3600 trial)

| Part | Value |
|---|---|
| Web | `:3610`, tmux `v2103-web`: **`npx cross-env NODE_OPTIONS='--require ./node-polyfill.js' next dev -p 3610`** (webpack dev; Turbopack can't find `next` through the symlinked node_modules). Log `/tmp/v2103/web-dev.log`. **Do not** use `next build`/`start` here: `output: 'standalone'` (next.config.ts:15 when `VERCEL` is unset) plus symlinked node_modules emptied the shared packages at 10:00:46. |
| ai-platform | `:8170`, tmux `v2103-aip`: `node --enable-source-maps dist/main.js` (after `npm run build`). Log: `/tmp/v2103/aip.log`. |
| DB prime-web | `primeweb_2103` on `primeweb-db` :5433. Copy of `primeweb_trial` via `pg_dump \| psql` (`createdb -T` can't run while the trial is connected). Owner `primeweb`. |
| DB ai-platform | `ai_platform_2103` on `primeweb-platform-db` :5434. Copy of `ai_platform_trial`, keeps owner `app_user`. |
| Env | `ech-fix-2103/.env.local` and `services/ai-platform/.env.local` (gitignored), copied from the trial with: DB → `*_2103`, `NEXT_PUBLIC_SERVER_URL=http://localhost:3610`, `AI_PLATFORM_URL=:8170`, ai-platform `PORT=8170`, `PRIME_WEB_INTERNAL_URL=:3610`. |
| Schema | The trial DB is a superset of this branch (it has the #2060 columns/migrations; the fix branch has no new migrations). No `db-setup` run needed. |
| Test accounts (copy DB only) | `v2103-beauty` (13), `v2103-bakery` (14), `v2103-beauty-r2` (15), `v2103-bakery-r2` (16), `v2103-beauty-r3` (17), `v2103-bakery-r3` (18), all `@primeweb.local`, Standard plan. `audit-botanica` (11) is reused in the copy for C2/C3. Password and OTP are the same as the trial README. |
| Model | Real model calls go through the shared OmniRoute :20128. Usage is written to `ai_platform_2103`, not the trial DB. |

**Re-run:** `tmux new-session -d -s v2103-web -c <worktree> "npx cross-env NODE_OPTIONS='--require ./node-polyfill.js' next dev -p 3610"`; `tmux new-session -d -s v2103-aip -c <worktree>/services/ai-platform "npm run build && node --enable-source-maps dist/main.js"` (tsup only).

## Task 1 — diff vs audit evidence (code review)

| Item | Audit evidence | Diff covers? | Gap / risk |
|---|---|---|---|
| A1 | Named reviews (Farah Glow, Priya nail, Seri Spa, K-Beauty Lab), fake stats/team/logos (beauty); JAKIM/GrabFood/5% FAQ + Ah Huat review (bakery) | Yes: claim strings removed from testimonials/stats/team/FAQ pools; FACTS object; grounded blocks; claim scrub | **Risk:** `src/lib/ai/post-ai-swap.ts:27-41` `hydrateBiz()` still falls back to library sample businesses (`content/beauty.ts:8-16`: Farah Glow Studio, Bangsar address, `+60 12-988 7766`, `glow@farahstudio.my`) for any missing `name/description/address/phone/email/heroHeadline`. Fake contact data could reach Contact/Footer. Checked at runtime below. |
| A1 (related) | Beauty CTA "Book a Glow-Up / See Services" (service framing; "See Services" linked to /about) | Not touched (`src/lib/ai/theme-moods.ts:114`) | Out of #2103 scope. Worth checking that the CTA targets exist. |
| A2 | Menu RM 3.50/4.00 vs catalog 65/35/48/120; "half RM35)" split | Yes: paren-aware parse + menu from product price | Runtime check below |
| A3 | All products active, stock 0, 2 invented, irrelevant stock photos, no product section / shop page | Yes, per decision: N products, keyword photo or none, home `products-featured` + `/products` page, Sold out, quantities question + bulk setup card | Hero/gallery image relevance is **not** in scope (dup #1185/#1611) |
| A4 | Pages + blogs `published` at generation | Yes: `builder-draft-save.ts` (`isDraft: true` + base), generation drafts, first publish promotes | — |
| A5 | Alt = keyword dump | Yes: `buildStockAlt` | — |
| A6 | Preview "Real estate" when Beauty selected; duplicate F&B labels | Yes | — |
| B1 | Claimed 4 products with images; 1 rendered; duplicate grid | Yes: fixed `products-grid`, "shows N of M", duplicate guard, Sold out | Runtime check below |
| B2 | Mongolian card summary; Malay reply to an English prompt | Yes: per-turn language line + script guard | — |
| B3 | Raw `<span style=font-size:xxx-large>` in diff; "Reading your catalog families" | Yes: plain-text diff; label only for `product_details` (`agent-run.service.ts:1171`) | — |
| B4 | "still working on your last message" after Skip | Yes: save before suggestions + client retry on 409 | — |
| B5 | Chip suggests a declined ability | Yes: `looksDeclined` + prompt rule | — |
| C1 | Missed payments / photos / contact / domain | Yes: `setup[]` list | — |
| C2 | Agent card "RM 0.00" for a variant product | Yes: `store-product-tools.ts` display price | — |
| C3 | Mascot over **Save as draft** and over the **Bank transfer switch** (not a save bar); chip over placeholder | Yes: `data-save-bar` added to ProductForm, Payments (`PaymentsFormClient.tsx:985`), Shipping, Discounts, Customers; chip attach-then-fly | Runtime check: the Payments switch sits in the page body, not the save bar, so lifting only when a save bar exists may not cover it |

## Task 2 — browser results

Final run on the code after the lead's last fixes. Web is `next dev`, ai-platform was rebuilt at about 10:24. Auto-approve was off.

**Note:** images from `file-storage.bdskhudong.com` return 530 on the canvas. That is an **env** issue (tunnel), not a code bug.

| # | Status | Check (exact) | Evidence |
|---|---|---|---|
| A1 | **PASS** (minor leftovers) | Beauty (R2, R3) and Bakery (R2, R3) generated from scratch with only name, industry, products and description. No named reviews, star ratings, fake stats, team names, client logos, JAKIM/halal, GrabFood/Foodpanda or "% off". Reviews are a "Be the first to review …" card; Team is "The {brand} team / Founder"; FAQ uses only real data (products, COD). Contact and Footer are **empty**, with no Farah Glow/Bangsar data (`sites.contact_info_*` empty, site 13). "Halal" appeared only when the merchant wrote it (first run). | `A1R2-beauty-home-full.png`, `A1R3b-beauty-home-full.png`, `A1R3-bakery-home-full.png` |
| A1-residual | **FAIL (minor, P3)** | Two claim strings still render. (1) `/services` pricing block: **"Transparent pricing with no hidden fees."** (`src/lib/ai/block-i18n.ts:172`). (2) The logo cloud heading **"TRUSTED BY"** sits above a single "COD" logo, which reads as an endorsement (`block-i18n.ts:158`). Seen on all 4 R2/R3 sites. | `A1R3b-beauty-services-full.png`, `A1R2-beauty-services-full.png` |
| A1-regression | **PASS after fix** | At 10:28, a beauty generation failed with `pages_write`: `ValidationError: Page Blocks > Block 9 (Stats Section) > Stats` (debugId `mvszgm14-ozgu0f`). The user saw a **Vietnamese error message with broken encoding** ("ChÃºng tÃ´i…"). After the lead's `sanitizeBlocksForPayload` fix, R3 beauty (site 13) and R3 bakery (site 14) generated fine and the stats block was dropped. The error-message language/encoding was not re-checked. | `/tmp/v2103/A1R3-beauty-sse.txt` |
| A2 | **PASS** | Input `Kek lapis Sarawak (whole cake RM65, half RM35), kuih raya gift box RM48, custom birthday kek lapis from RM120` gives 3 products at 65 / 48 / 120. The menu block shows the same prices; there is no "half RM35)" split. Minor: lower-case names ("kuih raya gift box"). | `A2-menu-home.png`, `A1R3-bakery-menu-full.png` |
| A3 | **PASS** | Exactly N products, `active`, stock 0, "Sold out" on `/products` and the home section. "Finish your shop" CTA is present. Photos: Vitamin C Serum = "skincare, beauty, serum" (R3, site 13; was orange/citrus before the fix); unmatched products have **no** photo. Note: home uses the `products-featured` variant `hero-product`, which shows 1 product by design. | `A3-products-page.png`, DB `products_images` tenant 17/18 |
| A4 | **PASS** | After generation, all pages, blogs and the site are `draft`. **First publish** (site 11): 3 blogs with `ai_seeded=true` became `published` and `ai_seeded=false`; 8 pages became `published`. | `A4-01-first-publish-dialog.png`, `A4-01-first-publish-after.png` |
| A4-republish | NOT TESTED | I couldn't switch a blog back to draft through the UI quickly ("Save draft" stayed disabled after a title edit). By code, a republish can't re-promote it because `ai_seeded=false`. | — |
| A5 | **PASS** | Alt text ≤ 62 characters, de-duplicated, with brand prefix ("V2103 Botanica TEST ONLY - skincare, beauty, serum"). | DB `media.alt` |
| A6 | **PASS** | Labels are no longer duplicated ("Restaurant / dine-in" vs "Café / bakery / desserts"). With Beauty selected: hovering Real estate shows Real estate (by design), and once the pointer leaves the grid the preview goes back to Beauty. | `A6-00-builder-form.png`, `A6-01-form-filled-beauty-selected.png` |
| B1 | **PASS** | Prompt: `Add a Featured Products section to the homepage using four existing active products. Display their actual names, images, prices, and product links.` The AI first asked for a photo for Sunscreen (it has none), then after Skip staged a **fixed `products-grid` with 4 products**. The reply truthfully says all 4 are sold out and Sunscreen uses a placeholder. After Approve the grid shows 4 products with prices and Sold out. Sending the same prompt again adds no duplicate ("already has…"). Thread `thr_78e05e9f1ee9478d9172`, runs `run_4a78688c0f8442aa9776`, `run_4e7451dc155d4e4e964f`. | `B1-01…B1-05*.png` |
| B1-obs | **FAIL (minor, P3)** | After the merchant chose **"Skip, add later"** on the photo question, the AI still **generated an AI image** ("Generating a picture… Made 1 picture(s)", offered as "Generated / Use this"). It isn't used in the card, but it costs an image call and suggests an AI "product photo". Same run `run_4a78688c0f8442aa9776`. | `B1-03-result.png` |
| B2 | **FAIL** | Thread `thr_9bcecb5f425048299990`. (1) `run_035a31c79d64447eb9be`: `Tukar tajuk bahagian utama kepada 'Penjagaan Kulit Untuk Setiap Hari'. Jangan ubah harga produk atau halaman lain.` → Malay (correct). (2) `run_353df399f4fd4472bbd7`: `Make the hero subheadline shorter.` → the reply is English and says it staged *"Gentle daily skincare, delivered across Malaysia."*, but the **card summary is Malay** ("Memendekkan subheadline hero sahaja…") and **the staged value is Malay** ("Penjagaan kulit harian yang lembut, dihantar ke seluruh Malaysia.") on an English site. **The reply does not match the actual change.** Same failure in the first round (thread `thr_5bf76f1cd56848a39521`). | `B2R-01-malay.png`, `B2R-02-english.png` |
| B3 | **PASS** | Hero headline really contains `<span style="font-size: xxx-large;">`. Prompt `Change the hero headline to 'Glow Every Day'.` → the diff's "before" value is plain text. Question steps are labelled "Preparing a question", not "Reading your catalog families". | `B3-02-diff-plain-text.png`, `B2-02-english-after-malay.png` |
| Marker | **PASS** (after fix) | Round 1 leaked `[Staged draft cs_32a880fc7bb14c06a141: Edit page: Home — …]` into the reply (thread `thr_5bf76f1cd56848a39521`). In the final run (`run_353df399f4fd4472bbd7`) the reply no longer contains the marker. | `B2-03-english-prompt-malay-summary.png` (old), `B2R-02-english.png` (new) |
| B4 | **PASS** | Click "Skip, decide later" and immediately send `Make the hero subheadline shorter.` → both `POST /api/agent/runs` return 200, a card is staged, and there is no "still working" error. | `B4-01-send-right-after-skip.png` |
| B5 | Not re-checked | (Round 1 was not tested directly.) | — |
| C1 | **PASS** | `What is still missing in my store setup before I can really start selling? List only real gaps.` → products with no stock, stock/AI photos and a product without photo, COD only, missing phone/address/hours, website not published, domain (optional). | `C1-01-setup-gaps.png` |
| C2 | **PASS** | `Show me TEST Rose Toner in full.` → "Price: From RM 59.00", options 100ml RM59 / 200ml RM99, stock 35; the card shows "From RM 59.00". | `C2-01-variant-card.png` |
| C3 desktop | **PASS** | Payments: the Bank transfer switch is not covered at any scroll position (start/center/end). Product form: "Save as draft" is not covered. The "Section" chip does not cover the chat placeholder. | `C3R-payments-desktop.png`, `C3R-productform-desktop.png`, `C3-04-editor-section-chip.png` |
| C3 mobile | **FAIL** | At 375×812, `/settings/payments`: when the Bank transfer switch is near the bottom of the screen (scrollIntoView `end`, switch at 300,772), it is **covered by `.ech-ag-float-root/.ech-ag-fab`**. Mobile product form "Save as draft" (110,751) is not covered. Account `audit-botanica` (copy DB). | `C3R-payments-mobile.png`, `C3R-productform-mobile.png` |

### FAIL summary (for the lead)
1. **B2:** after a Malay turn, an English prompt gets a Malay card summary **and Malay staged content**, while the reply describes English text (thread `thr_9bcecb5f425048299990`, run `run_353df399f4fd4472bbd7`).
2. **C3 mobile:** the mascot covers the Bank transfer switch on `/settings/payments` at 375 px when the switch is near the bottom of the screen.
3. **A1 leftovers (P3):** "Transparent pricing with no hidden fees." (`block-i18n.ts:172`); "TRUSTED BY" above COD (`block-i18n.ts:158`).
4. **B1 observation (P3):** an AI image is generated even though the merchant skipped the photo question.
5. (Not re-checked) The `pages_write` error message shown to users in Vietnamese with broken encoding (round 1).

### Environment notes
- `next dev` runs `predev` → `scripts/db-migrate-dev.js` on the copy DB: 1148/1165 OK, 17 old data migrations error and are skipped (`primeweb_2103` only).
- `scripts/db-setup.js --migrate-only` was run per the lead on `primeweb_2103` (adds `blogs.ai_seeded`); the trial DB was checked and does not have the column.
- The incident (10:00:46): see the note above about `output: 'standalone'`.

## Round 3 (after lead fixes; ai-platform restarted 11:02; real model)

Site 11 (`v2103-beauty-r2`), editor chat after "Start over". Thread `thr_3e30ecbaa7f54416a33c`.

| # | Status | Detail | Run | Evidence |
|---|---|---|---|---|
| B2 | **PASS** | Malay turn (`Tukar tajuk bahagian utama kepada 'Penjagaan Kulit Untuk Setiap Hari'. …`), then `Make the hero subheadline shorter.` Card summary is English ("Review the changes below before approving."). The staged value is English: "Gentle skincare for Malaysia, delivered nationwide." The reply quotes exactly that sentence. | Malay `run_71e30d7ec6ba4412a0b1`, English `run_8b99c2cd6ce74c2ea9b4` | `R3-B2-02-english.png` |
| B1 P3 | **PASS (Skip path not reached)** | Two prompts. (1) `Add a products grid to the About page showing Sunscreen SPF50 and Daily Moisturizer with their real photos.` → declined (Daily Moisturizer photo is AI-made). (2) `Add a Featured Products section to the About page using four existing active products. Display their actual names, images, prices, and product links.` → staged a grid directly with a placeholder for Sunscreen. **No photo question was shown, so "Skip, add later" could not be clicked.** No AI image was generated in either run. | `run_d6425f5e05b3441d8fbd`, `run_a716297cbd0a4ca08641` | `R3-B1-03-after-skip.png` |
| B5 chips | **PASS** | `Make the Hero display as two columns on desktop and one column on mobile. Keep the product image above the heading on mobile.` The only chip is "Publish my website"; nothing suggests the declined ability or a workaround. | `run_1c6ac07abf564fc59fcf` | `R3-B5-02-final.png` |
| B5 new | **FAIL** | Same run. (a) The **reply is in Malay** ("Saya telah mencadangkan susun atur Hero dua lajur…") for an English prompt; the earlier Malay turn in this chat still leaks into the reply text. (b) It no longer declines: it staged a Hero `style` change ("Formatting changed") and says the image stays above the heading on mobile "jika varian tersebut menyokong turutan itu" (if the variant supports it), an unverified conditional claim. | `run_1c6ac07abf564fc59fcf` | `R3-B5-02-final.png` |
