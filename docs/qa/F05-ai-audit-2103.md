# F05 — AI audit batch #2103 (site generation, editor copilot, ECH Agent)

> Issue: [#2103](https://github.com/primeproduction/ech-prime-web-v2/issues/2103) · Branch `fix/F05-ai-audit-batch` · TC prefix `TC-AIAUD`
> Automated tests carry the TC-ID in their name. Manual checks use a test shop with Auto-approve **off**.

## Product decisions
- A1: every block type stays; content comes only from merchant facts (form, link import, tenant/site data). Missing facts → truthful generic content or an empty block, never invented reviews, numbers, staff, logos, certifications, delivery partners or discounts. The completion screen does not list placeholders (removed in #2176).
- A3: AI-made products stay **active with stock 0** and show **Sold out**; the assistant asks for stock/prices (new `quantities` question) and photos, then stages one bulk setup card.
- C1: selling-setup gaps are a separate `setup` list for the Agent only (dashboard To-do card, mascot badge and automations unchanged).

## A. AI site generation (`/builder/new`)

| TC | Item | Check | Expected |
|---|---|---|---|
| TC-AIAUD-001..005 | A5 | `buildStockAlt` dedupe, subject prefix, long repeated tags, idempotent, pool upload | alt ≤120 chars, 2–3 distinct tags, subject first |
| TC-AIAUD-006..009 | A2 | `parseProducts` with the issue input, non-price parentheses, separators, cap 20 | "Kek lapis (whole RM65, half RM35), kuih raya box RM48, birthday from RM120" → 3 products, 65 / 48 / 120 |
| TC-AIAUD-010..012 | A2 | menu-food prices | merchant price → created product price → blank; never library prices |
| TC-AIAUD-013..016 | A1 | FACTS from form + tenant + site + link import; prompt FACTS section; placeholders list | only stated facts reach blocks and prompt |
| TC-AIAUD-017..018 | A1 | `enforceGroundedBlocks`, claim scrub | invented reviews/stats/staff/logos/FAQ/plans replaced; halal/JAKIM/GrabFood/discount text removed unless the merchant stated it |
| TC-AIAUD-019..020 | A1 | Beauty and F&B generation with only name + products | no JAKIM, halal, GrabFood, Foodpanda, "% off", named reviewers, fake stats, brand logos |
| TC-AIAUD-021..027 | A1 | testimonials invite card, real reviews verbatim, stats from facts, logos = enabled payments, team = brand, FAQ from facts, no padding | as described; library packs claim-free |
| TC-AIAUD-028..031 | A3 | product count, no top-up, cap, photo relevance | exactly the listed products; photo only when relevant, else none |
| TC-AIAUD-032 | A3 | SSE `done` | `productIds` + `placeholders`; products active, stock 0 |
| TC-AIAUD-033, 036 | A4 | generated pages, 404 page, seeded blogs | created as drafts |
| TC-AIAUD-035 | A3 | `/products` page + home products-featured + fnb/beauty recipes | store has a product section, a product page and the cart |
| TC-AIAUD-037..038 | A4 | first publish | promotes seeded AI drafts only; failure non-fatal; republish untouched |
| TC-AIAUD-039 | A1 | empty stats/team/faq/logo-cloud renderers, invite card | render nothing fake; invite card has no stars, name or avatar |
| TC-AIAUD-040..044 | A6 | industry preview on hover / leave / touch / pen / click / focus | preview shows the selected industry once the pointer leaves the grid; touch never changes it |
| TC-AIAUD-045..046 | A6 | industry labels en/ms | no duplicates; "Restaurant / dine-in" vs "Café / bakery / desserts" |
| TC-AIAUD-047..052 | A1 | no optional facts fields and no input-method tabs (#2176, prototype #2042); generate schema limits | form ends at Short description (no "How customers buy", "Areas you serve", "Facts we can say"); values from an old draft never sent; the API still accepts the three optional fields within 120/500-char limits; no "Describe business" / "Import from a link" tabs |
| TC-AIAUD-053..055 | A4 | builder autosave + manual save body | `isDraft: true` + draft `base`; 409 keeps the newer revision |
| TC-AIAUD-056..058 | A1/A3 | completion screen (#2176: approved prototype #2042) | only the ready card, Open editor, Publish website and Go to dashboard; no "Finish your shop" card/button and no "Replace before you publish" list; the builder keeps neither `productIds` nor `placeholders` from the SSE `done` event |
| TC-AIAUD-059 | A1 | link import review (`ExtractionReview`; the link import tab is hidden, #2176 — component kept for when it returns) | extracted review/FAQ counts shown, i18n labels; component test still runs |
| TC-AIAUD-140..142 | A4 | publish → unpublish → publish; owner draft with `{tenantId}-` slug | AI posts (`blogs.ai_seeded`) promoted by the site publish while the marker is set (TC-AIAUD-141 superseded by 203); owner drafts never |
| TC-AIAUD-143 | A4 | seeded posts | every seeded post carries `aiSeeded` |
| TC-AIAUD-144..146, 149 | A1 | pricing / pricing-table / features without content; generation without prices | render nothing; pricing dropped without merchant prices, kept with them |
| TC-AIAUD-147..148 | A1 | review invite next to a real review | invite dropped in every testimonials variant and in the grounded merge |
| TC-AIAUD-170..171 | A1 | stats / features with no true items (Payload `required` arrays) | block dropped before save so the page is not rejected; optional-list blocks kept empty |
| TC-AIAUD-172..173 | — | generation stream `error` event (e.g. `GENERATION_FAILED`) | builder shows the EN/MS copy for its code in the UI language, never the server text (was hard-coded Vietnamese) |

**Manual — A1/A2/A3/A4:** Onboarding → Create my store with AI → Beauty, then F&B with the A2 input → Generate. Expect: no invented reviews/stats/team/logos/FAQ claims; menu and catalog prices equal; only the listed products, Sold out badges, home product section and `/products` page; pages and blogs show Draft until first publish.

## B. Editor copilot (AI Chat)

| TC | Item | Check | Expected |
|---|---|---|---|
| TC-AIAUD-067, 075, 076, 078, 079, 081 | B1 | chosen products → products-grid fixed mode; products-featured = newest; "shows N of M" result; one product section per kind per page; Sold out badge | the reply cannot claim more products than render; no duplicate grid |
| TC-AIAUD-068 | B1 | duplicate section pending in the same chat | `section_pending`, nothing staged |
| TC-AIAUD-064, 065 | B2 | per-turn "Reply language"; script guard on card summary | English prompt after a Malay turn → English reply; no Cyrillic summary under a Latin prompt |
| TC-AIAUD-066, 070, 080 | B3 | question step label; formatting-only diff; HTML → plain text | no raw `<span …>`; no "catalog families" for custom questions |
| TC-AIAUD-060, 061, 069 | B4 | run saved before its end is streamed; client retry once on 409 | message right after "Skip, decide later" is accepted |
| TC-AIAUD-062, 063 | B5 | decline turn suggestions | no chip suggesting the declined ability or a workaround |
| TC-AIAUD-082 | — | `pendingEditHref` for `shop_product.*` | no Product Master link on shop cards |
| TC-AIAUD-150..152 | B1 | second products-grid with another category / fixed picks; identical grid (on page, same edit, pending in chat) | different grids allowed; identical grid refused |
| TC-AIAUD-157 | B4 | `answer()` failure | run saved before `failed` is streamed; chat free afterwards |
| TC-AIAUD-158 | — | unknown question kind from a newer ai-platform | parsed as a choice question (deploy prime-web before ai-platform) |

**Manual — B1:** prompt from the issue ("Add a Featured Products section … four existing active products …") → one grid with 4 products (or the reply says how many show and why).

## C. ECH Agent (dashboard)

| TC | Item | Check | Expected |
|---|---|---|---|
| TC-AIAUD-132..138 | C1 | `setup` list: COD only, business info, custom domain, stock/price 0, stock/AI photos; area gating; store_todos output | "What is still missing…" lists real setup gaps plus To-dos |
| TC-AIAUD-130 | C2 | variant product card / read_item | "From RM 59.00", not "RM 0.00" |
| TC-AIAUD-131 | A3 | product snapshot photo `source` | upload / stock / ai |
| TC-AIAUD-071..074, 077 | C3 | Tab hint position; chip attach-then-fly + safety timeout; quiet routes; mascot lifted over save bars | mascot never covers Save as draft / Bank transfer; "Section" chip never covers the placeholder |
| TC-AIAUD-100..105, 110..113, 139 | A3 | ask_user `quantities` question: schema, pause, answer, validation, skip, card UI | numbers per product, decimals only for prices |
| TC-AIAUD-106..109, 114..120, 123 | A3 | `propose_shop_products_setup` card, apply, undo | one card for up to 20 products; all-or-nothing preflight; tenant-scoped; one undo |
| TC-AIAUD-153..154 | A3 | bulk card with >5 products getting new photos; photo download failure | `too_many_new_photos`; every photo downloaded before the first product write, failure writes nothing |
| TC-AIAUD-155 | A4 | builder autosave after a 409 | autosave pauses; an explicit save goes through and resumes it |
| TC-AIAUD-156 | C3 | save-bar lift | `<html data-save-bar>` while a save bar is mounted (counted); mascot raised 88px / 132px on mobile |
| TC-AIAUD-121..122 | A3 | "Finish your shop" work item + instructions | `/products?todo=products_ai_review` starts the finish-your-store flow |

**Manual — A3/C1:** after generation click "Finish your shop" → send the prefilled prompt → answer the stock table and photo question → approve one card → products show stock and photos; ask "What is still missing in my store setup before I can really start selling?" → payments, photos, contact/hours, domain gaps listed.

## D. Fixes after live browser verification (2026-10-29)

| TC | Item | Check | Expected |
|---|---|---|---|
| TC-AIAUD-160 | A1 | `hydrateBiz` / `withoutLibraryIdentity` with an empty merchant partial, every category and seed | no library sample name, phone, email or address in swapped blocks; FACTS brand / description / contact are the only fallback |
| TC-AIAUD-161 | A1 | `composeFallbackResult`, gap-fill blocks (`contact`, `footer`, `hero`, `about`, `cta` …) with a merchant who gave only a name | no library identity or contact anywhere in the result; merchant phone / email kept verbatim |
| TC-AIAUD-162 | A1 | last-resort `generateBlocks` contact block | no invented phone / email / address |
| TC-AIAUD-163 | B2 | Malay (or Vietnamese) card summary under a clear English request, and the reverse | replaced by the platform summary in the request's language |
| TC-AIAUD-164 | B2 | same-script language guard on short / unclear / same-language text | summary left alone unless both languages are clear |
| TC-AIAUD-165 | — | staged-draft history record format + instruction | `<staged_draft id="cs_…">` tag, model told never to write it |
| TC-AIAUD-166 | — | `stripInternalMarkers` on the final reply and the question lead-in | no `[Staged draft cs_…]`, `<staged_draft>`, `[Answered: …]`, `[Asked the merchant: …]` or raw `cs_` / `run_` ids in streamed or stored text |
| TC-AIAUD-167 | C3 | `data-agent-quiet` root mark on form screens; `.dash-content-gutter`; launcher CSS variables | content scrolls clear of the launcher; on form screens the launcher is 80% size, 6px from the edge; open panel unchanged |
| TC-AIAUD-168 | A3 | pool photo vs "Vitamin C Serum" with ingredient photos / keyword | ingredient-only photos (orange, rose, honey) never match; product form wins over ingredient |
| TC-AIAUD-169 | A3 | head-noun fallback outside the lexicon; existing cake / cookie / shirt matches | head noun must be in the tags; no usable name = no image |

**Manual — C3:** Settings → Payments, scroll to the end: the "Bank transfer / DuitNow QR" switch scrolls clear of the mascot; the mascot is compact and in the corner on this page.

## E. Fixes after the second live browser verify (2026-10-29)

| TC | Item | Check | Expected |
|---|---|---|---|
| TC-AIAUD-174 | B2 | `confidentLanguage` on the live run's Malay card line / Malay subheadline and the old English text | Malay lines with common words ("sahaja", "seperti", "tanpa", "ke seluruh") are clearly Malay; English with a Malay product name stays English / unclear |
| TC-AIAUD-175 | B2 | `summaryInScriptOf` for "Make the hero subheadline shorter." and the live Malay `why` | replaced by "Review the changes below before approving."; unchanged under a Malay request |
| TC-AIAUD-176 | B2 | `languageSwitches`: Malay text over the English subheadline; English rewrite, short / unclear text, new section; editor language as fallback; a Malay site | only clear Malay-over-English (or the reverse) is a switch; the old text's language decides, else the editor's |
| TC-AIAUD-177 | B2 | the merchant typed the Malay headline, quoted a phrase, asked to translate / named a language | never a switch |
| TC-AIAUD-178 | B2 | `propose_page_patch`: Malay value over English text, then the English rewrite; the same Malay value twice; no run context | first refused (`wrong_language`, nothing staged), the English rewrite staged; unchanged resend staged with a "text_language" note; instructions say the page keeps its language and the reply quotes the staged text |
| TC-AIAUD-179 | B2 | full run: Malay turn (typed headline), then "Make the hero subheadline shorter." on the English site, model first sends Malay | one card, English text, English card line |
| TC-AIAUD-180 | B1 | `picturesSkippedRefusal`; skipped images answer text; instructions | refused only after a skipped pictures question unless the merchant's words ask for a generated picture |
| TC-AIAUD-181..183 | B1 | run: "Skip, add later" then `generate_image`; no skip; skip + "generate a picture" in the message | refused (nothing drawn or saved) / drawn / drawn |
| TC-AIAUD-184 | A1 | every block-strings language (en ms vi ja zh ko ar th) | no "trusted by", "no hidden fees", "best", "exclusive", "leading" claims; pricing line "What we offer and what it costs." |
| TC-AIAUD-185..186 | A1 | logo-cloud heading from strings, section labels, `normalizeLocaleStructuralStrings`, gap-fill for a COD shop | "Payment methods" / "Kaedah pembayaran" / "Phương thức thanh toán"; a model-written "Trusted By" is replaced |
| TC-AIAUD-187..188 | C3 | CSS geometry at 375px; badge; open panel | closed launcher on a form screen is an edge tab (x >= 353 vs controls <= 336); badge on the visible side; open panel unchanged |
| TC-AIAUD-190 | B5 | `replyLanguageName`: the live prompt, "Make hero shorter", "Update the title"; Spanish / French / short text; Malay with English loanwords | English for clear English from one strong word; others stay unpinned |
| TC-AIAUD-191 | B5 | `merchantUserMessage` for the live prompt, a Malay prompt, an unclear one, a Cyrillic one; tool routing on the closing note | Context keeps "Reply language"; the turn ends with the platform note (English / Malay / script); none when unclear; the note loads no tool group |
| TC-AIAUD-192 | B5 | `wrongReplyLanguage`: live Malay reply under the English prompt; English / Malay / Vietnamese pairs; "translate to Malay", short reply, English reply quoting "Áo dài" | wrong only when both sides are clear; never judged on a language request or a quoted name |
| TC-AIAUD-193 | B5 | `replyInLanguageOf` on the fast model: wrong reply, right reply, empty / far longer / still-wrong rewrite | one call naming the language; no call when right; bad rewrite not used |
| TC-AIAUD-194 | B5 | full run: Malay turn, then the live English mobile-reorder prompt; the model answers in Malay again | last user turn ends with the English note; stored and streamed answer is the English rewrite; one `agent.reply-language` ledger row; declined reply -> no chips |
| TC-AIAUD-195 | B5 | same sequence with a right-language reply, and with a failing rewrite call | no extra call; the model's own reply is kept (never empty) |
| TC-AIAUD-196 | B5 | `propose_page_patch` set_variant vs set_value | staged result says a style is only a name, never how it looks on mobile / desktop; no note for text edits |
| TC-AIAUD-197 | B5 | website instructions with and without the site capability | "Layout you can't read or set": no claim / hint / hedge, no workaround, decline in 1-2 sentences, stage nothing; absent without site tools |
| TC-AIAUD-198 | B5 | `site_read` and `propose_page_patch` tool descriptions | variants are names only; set_variant sets no columns or mobile order |
| TC-AIAUD-199 | B5 | `readSite` views `block` and `catalog` (root vitest) | `variantsNote`: names only, no layout per screen size, no variant as a layout workaround |

**Manual — B2:** English site, send a Malay request that gives the exact Malay words, then "Make the hero subheadline shorter." -> one card with English text and an English summary; the reply quotes the staged text. **Manual — C3 mobile:** 375px, Settings -> Payments, scroll the "Bank transfer / DuitNow QR" switch to the bottom edge: only a small mascot tab shows at the right edge.

**Manual — B5 reply language / layout claim:** editor chat after "Start over": send a Malay request, then "Make the Hero display as two columns on desktop and one column on mobile. Keep the product image above the heading on mobile." -> the reply is English, nothing is staged, it says it can't set or confirm the layout per screen size, no "if the variant supports it", and the chips offer no workaround. "Change the Hero style to split-left." still stages and says only that the style changed. **Manual — B1 skip:** Products page, "Add a product: … I want to choose my own photo …" -> pictures question -> "Skip, add later" -> the draft is staged without photos and no picture is generated.

## F. Fixes after the final code review (2026-10-29)

| TC | Item | Check | Expected |
|---|---|---|---|
| TC-AIAUD-200 | H1 | recovery job with a frozen snapshot; generator invents testimonials / stats and returns an empty features list | `generateSiteWithAI` gets FACTS rebuilt from the snapshot + tenant (`options.facts`); invented quote / stats scrubbed; no empty required list saved |
| TC-AIAUD-201 | H1 | recovery: generator returns `stats: []` and a `features` block with no list | both blocks dropped before `pages.create` |
| TC-AIAUD-202 | H1 | shared `sanitizeBlocksForPayload` (recovery, apply-template, template swap) | empty required stats / features / plans dropped, filled ones kept |
| TC-AIAUD-203 | M1 | regenerate (site reset to draft, `publishedAt` kept) then publish | the new `aiSeeded` draft posts are promoted (silently); owner drafts untouched |
| TC-AIAUD-204 | M1 | Blogs `beforeChange`: owner publishes / unpublishes / schedules a seeded post | `aiSeeded` cleared, so a later site publish never overrules the owner |
| TC-AIAUD-205 | M1 | same hook: same status, non-seeded post, promotion with `context.promoteAiSeeded` | marker untouched |
| TC-AIAUD-206 | M2 | `pendingProductSection` with a card stored `pending` but past `expiresAt` | expired card does not block adding the section; a live card still does |
| TC-AIAUD-207 | M2 | Featured Products refusal text | points to a Products Grid with fixed `selectedProductIds`; never suggests `set_fields productIds` |
| TC-AIAUD-208 | L1 | generation done event with a model `stats: []` block | block dropped from the saved page and absent from `placeholders` |
| TC-AIAUD-209 | L2 | `enforceGroundedBlocks` stats: model "5 ★ rating" vs 5 listed products | model stats replaced by the real facts (year started, products count) |
| TC-AIAUD-210 | L3 | `ensureProductsPage` / `ensureHomeCommerceBlock` with locale `vi`; `shopContentLocale` | "Sản phẩm" page title and Vietnamese headline / subheadline; `vi-VN` -> vi; other locales English |
| TC-AIAUD-211 | L4 | "Sold out" badge on Featured Products (hero, carousel) and Products Grid card for en / ms / vi / vi-VN / ja sites | Sold out / Habis dijual / Hết hàng / Hết hàng / Sold out; `site.locale` used without `generationLocale` |
| TC-AIAUD-212 | A1 | `pages-schema.ts` (bundled into the editor client) import graph | reaches no server-only module (`node:*`, `pg`, `payload`); guards the H1 fix from breaking the editor build |
| TC-AIAUD-213 | A1 | apply a template whose features block has no rows (TC-F07.039 fixture) | empty required list dropped by the shared sanitizer; the rest of the layout is applied instead of the page save failing |

**Manual — L4:** a Vietnamese shop's storefront with a stock-0 product shows "Hết hàng" on the Featured Products block and the grid card. "SALE" stays English (not localized in this pass).
