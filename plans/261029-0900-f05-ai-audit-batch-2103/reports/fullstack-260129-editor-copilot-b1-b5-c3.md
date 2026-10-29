# #2103 editor copilot B1-B5 + C3 — implementation report

Status: done (code + tests green). Not committed.

## Decisions applied
- B1: chosen products = products-grid fixed mode (selectionMode fixed + selectedProductIds, limit raised to N, max 20). products-featured = store's newest (productIds removed from config.ts / PRODUCT_ID_FIELDS; model gets `use_products_grid` error). No Pages.ts / db-setup change.
- "will show N of M" evaluated on the grid (storefront rule: site, status active, not deleted; includeOutOfStock honoured). Both product section types: one per page (prepare-time, incl. swap, in-edit duplicates and cards pending in the chat).

## TC list (id | title | steps | expected)
- TC-AIAUD-060 | run saved before end streamed | run with warm cache; log saveRun / emitted end / suggestion call | saved applied -> streamed applied -> suggestion call -> streamed with suggestions; failed runs likewise
- TC-AIAUD-061 | next send accepted during suggestions | gate the suggestion call, reserve+start 2nd message in same thread | no THREAD_BUSY (fails without fix)
- TC-AIAUD-062 | no chips after a decline | reply "I can't..." with warm cache | zero fast-model calls, no suggestions; answer reply still gets chips; en/ms/vi decline phrasing
- TC-AIAUD-063 | suggestion prompts forbid declined thing/workaround | read SUGGEST_NEXT_PROMPT/SYSTEM | rule present
- TC-AIAUD-064 | reply language per turn | merchantUserMessage en/ms/vi/Cyrillic/short/Spanish | "Reply language: X (from this message)" when clear, none when short/unclear; follows each message; suggestUserTurn carries language
- TC-AIAUD-065 | script guard on card summary | summaryInScriptOf + staged card with Cyrillic why under Latin prompt | neutral line (en/ms/vi) or title; same script untouched
- TC-AIAUD-066 | question step label | ask_user purpose custom | "Preparing a question" (step.question), not "Reading your catalog families"
- TC-AIAUD-067 | tool result reports products shown | products_shown guardrail | result.productsShown separate from skipped; note says not to claim more
- TC-AIAUD-068 | duplicate pending section refused | pending card same page+type; other page/kind/decided; multi-page; real run reading thread cards | section_pending error, prime-web not called
- TC-AIAUD-069 | client retry on 409 after own run ended | agent-react ChatSession | one retry after 1.5s; no retry while running / other errors / second 409 shown
- TC-AIAUD-070 | formatting-only edit | SiteChangeRows with same before/after | "Formatting changed", no struck text; real change unchanged
- TC-AIAUD-071 | Tab hint anchored to typing box | composer markup with chips | hint inside .ech-ag-cmp-box after chips row, before footer
- TC-AIAUD-072/073 | fly attaches chip first; safety timeout | fake timers, stub animate | attach before flight, real chip hidden then revealed, lands on its rect; clone removed at FLY_MS+150 even if animation never ends; no-composer still attaches once
- TC-AIAUD-074 | mascot raises nothing on form screens | AgentAssistantPanel work.quiet | raise card on normal screen, none when quiet
- TC-AIAUD-075 | Featured Products = newest | fetch URL | sort -createdAt, limit 2/6, no selectionMode/productId even if productIds in config
- TC-AIAUD-076 | Sold out badge | hero, carousel, grid card | badge when inventory<=0; none in stock / sample slides
- TC-AIAUD-077 | quietOn routes | path table | products/new|:id, settings/**, discounts/new|:id, customers/:id quiet; lists not; dock still shown
- TC-AIAUD-078 | site_read products + N of M | where-clause + guardrail text | site/active/not-deleted/tenant; stock, inStock, hasPhoto; "shows 2 of 3", not shown / no photo / sold out; unknown id still refused
- TC-AIAUD-079 | one section per kind | prepare with existing/duplicate/swap | section_exists (both kinds), swap + set_fields OK
- TC-AIAUD-080 | previewValue plain text | html strings | tags stripped, entities decoded, br/li spaced
- TC-AIAUD-081 | chosen products -> grid fixed | featured productIds error; grid limit; >20; includeOutOfStock off | use_products_grid; selectionMode fixed + limit N; too_many_products; sold-out hidden reported
- TC-AIAUD-082 | pendingEditHref | shop_product.* vs product_master | undefined vs /catalog/products/:id

## Files changed
services/ai-platform/src/agent: agent-run.service.ts, merchant-tools.ts, merchant-instructions.ts, message-language.ts, suggest-next.ts, + specs (editor-audit-2103.spec.ts new; agent-run.service.spec.ts, agent-thread.service.spec.ts context-line expectations)
packages/agent-react: chat-session.ts, chat-session-busy-retry.spec.ts
packages/agent-ui: fly.ts, composer.tsx, styles.css, work-panel.tsx, site-change-rows.tsx, draft-card.tsx, chat.tsx, locales/chat-phrases.ts, assistant-panel.tsx, editor-audit-2103.spec.tsx
src/lib/ai-platform/site: site-blocks.ts, site-read.ts, site-prepare.ts, site-structure.ts, site-products.ts (new)
src/blocks/products-featured/{index.tsx,config.ts}, src/blocks/products-grid/ProductCard.tsx
src/components/agent: agent-dock-routes.ts, DashboardAgentDock.tsx, AgentDockPlaceholder.tsx, agent-panel-labels.ts
src/components/editor/agent/EditorAgentChat.tsx, src/app/globals.css
data-save-bar attr: ProductForm.tsx, PaymentsFormClient.tsx, settings-footer.tsx, discount-save-bar.tsx, customers-detail.tsx
tests: src/__tests__/unit/{agent/agent-dock-quiet-routes.test.ts, ai-platform/editor-audit-2103.test.ts, ai-platform/web-builder-read.test.ts, ai-platform/web-builder-prepare.test.ts, blocks/products-featured-fixed.test.tsx}
