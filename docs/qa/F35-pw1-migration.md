# F35 — Native PW1 batch migration QA

Current automated coverage uses synthetic data. Browser/live generation checks are reported separately. Cases M01–M10 and M13–M17 belonged to the retired raw-export/source-reconstruction flows and are retired with their tests.

### TC-F35.M11 — Target isolation
- [x] AUTO — The shared generation service rejects a foreign tenant target before generation/writes (`src/__tests__/api/ai.test.ts`).

### TC-F35.M12 — Source media boundary
- [x] AUTO — Exact approved HTTPS bucket checks reject host tricks, credentials, ports and local URLs (`pw1-media.test.ts`).

### TC-F35.M18 — AI design using existing PW2 blocks
- [x] AUTO — AI is called before binding; preserve slide/card/document/video content and order; reject new block types and reordered IDs; no silent fallback when AI fails.

### TC-F35.M19 — Product listings use the destination database
- [x] AUTO — Native AI rejects presentation blocks for product_listing; the native flow emits products-grid without source products, prices, images, IDs or snapshot payloads. Empty destination data is handled by the existing product renderer.

### TC-F35.M20 — Blog listings use the destination database
- [x] AUTO — The native binder maps article_listing to Blog List without snapshot posts; AI cannot choose Portfolio/Carousel for article components. Native tenant blog querying and empty-state behavior are retained.

### TC-F35.M21 — Compact website input
- [x] AUTO — Resolve page links; preserve static content and listing limits; reject duplicate identities/paths and invalid database bindings; report pending controls and exclude disabled components; run through the native AI binder.

### TC-F35.M22 — Preserve hero role
- [x] AUTO — Source hero banners use a native Hero; multiple slides stay in one slideshow Hero; single-image heroes retain copy/image/CTA; reject Carousel for hero banners and reject single-slide variants that would lose slides. Small banners remain Carousel.

### TC-F35.M23 — Batch input, retry and isolation
- [x] AUTO — Validate the whole array and owner/store uniqueness before processing; support multiple stores per owner; stable input hashing; skip unchanged completed stores; require rerun for changed completed stores; continue after individual failures and record each result.

- [x] AUTO TC-F35.M24: Map legacy cart/order tracking routes to native features, preserve external routes, and activate cart without product blocks including pending drafts.

- [x] AUTO TC-F35.M25: Category listing maps only to Carousel cards, retains items and rejects Portfolio Grid.

### TC-F35.M26 — Native blueprint
- [x] AUTO — Keep source contract and page identity without generating legacy blocks; reject duplicate page/component IDs and invalid homepage/order.

### TC-F35.M27 — BE collection adapter
- [x] AUTO — Project website-only data; keep locale and content; exclude disabled/deleted/empty records; promote valid menu children; reject ambiguous owners and cross-store settings.

### Rich text editor HTML compatibility
- [x] AUTO TC-F35-RT-01: Tiptap retains PW1 container styles, headings, lists, image metadata and tables during an HTML edit round trip.
- [x] AUTO TC-F35-RT-02: Editing text color replaces the prior color without removing unrelated span styles.
- [x] AUTO TC-F35-RT-03: Image inline/left-wrap/right-wrap/standalone layouts and spacing survive HTML reload; legacy floats can be reset to inline.
- [x] AUTO TC-F35-RT-04: Source percent-width images, formatted captions, trusted media and HSL/RGB colors survive normalization; unsafe embedded HTML is removed.
