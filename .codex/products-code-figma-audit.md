# Products — Code ↔ Figma Audit

Audit date: 2026-07-24

Source of truth:

- `src/app/(dashboard)/products/page.tsx`
- `src/components/dashboard/product-form/ProductForm.tsx`
- `src/components/dashboard/product-form/*.tsx`
- `src/components/dashboard/CategorySelect.tsx`
- `src/components/dashboard/ImageUploader.tsx`
- `src/app/(dashboard)/products/categories/components/CategoryManager.tsx`
- `docs/design/F08-category-management-ui.html`

Target Figma section: `33936:61890`

## P0 — Always-visible UI missing or materially inaccurate

| Area | Production code | Current Figma | Required correction |
| --- | --- | --- | --- |
| Product form / Description | Label `Product Description`, `Write with AI` action, 144px minimum textarea | Corrected in `33961:80066` | Done |
| Product form / SEO | `Search Optimization (SEO)` banner, explanatory text, `AI Optimization` action | Corrected in `33961:80066` | Done |
| Product form / Meta description | Textarea with `(max 160 chars)` counter label | Corrected in `33961:80066` | Done |
| Product form / SEO order | Meta Title → Meta Description → URL Slug | Corrected in `33961:80066` | Done |
| Product form / Attributes | Title `Extended Information (Attributes)`; count in header; populated key/value rows; text-link action `Add Attribute` below rows | Empty/Populated canonical set `34051:97614`; filled variant `34051:97581` | Done |
| Product form / Filled add state | Every form section contains representative valid data; populated image, selected category breadcrumb, SEO, shipping and attributes | Light `34051:98120`; Dark `34051:98126`; canonical form variant `34051:100545` | Done |
| Product image uploader / populated | Uploaded 147×147 tile, remove action, Alt text, and next-upload tile | Canonical set `34051:95874`; populated `34051:95859` | Done |
| Category selector | Custom 1–3 level cascading selector with breadcrumb result | Generic Select instance | Create dedicated CategorySelect component/state |
| Categories tree rows | Exact F08 data, expanded hierarchy, FolderOpen/File, `L1`/`L2`/`L3`, `{count} products`, exact indent, add/edit/delete actions; L3 cannot add a child | Corrected in `33977:81654`; atomics reused from `33965:15798`, `33965:15765`, `33965:15769` | Done |
| Categories table header and pagination | Uppercase labels on muted surface; `Showing 1–10 of 18 categories`; rows-per-page selector; page controls | Corrected in `33977:81654` | Done |
| Products responsive list | Product cards below 820px with thumbnail, category/variant/SKU, price, stock chip, status, Edit/Delete | Canonical mobile Product Card `34072:99687`; representative Light/Dark populated screens `34107:8` / `34107:168` | Done |

## P1 — Required component/data states

| Area | Missing states |
| --- | --- |
| Product form | Filled state completed in Light/Dark. Validation errors and saving state remain. Dirty save bar is composed from canonical `33863:14602`; the legacy component's transparent root surface cannot currently be mutated by Figma MCP and remains a visual audit exception. |
| Product variants | Switch-on option editor; Generate variants; SKU matrix desktop/mobile; remove-option confirmation |
| Image uploader | Populated image tile, remove and saved Alt text completed. Uploading/progress; open Alt-text popover; missing-alt advisory remain. |
| Category selector | Open desktop cascading columns; open mobile nested tree; selected breadcrumb; error |
| Categories | F08-supported states completed: populated/pagination, Add root, Add subcategory with locked parent, Edit, delete blocked by assigned products, delete with child reparent warning. Canonical modal set `33977:83050`; every state composed in Light/Dark. Loading, empty and search-no-results are not defined by the supplied F08 HTML and remain separate production-code audit items. |
| Products list | Mobile breakpoint and mobile detail panel completed. Filter no-results, filter-open, bulk create and destructive confirmations remain component-level state coverage; they are not separate route-level mobile screens. |

## Confirmed accurate

- Dashboard Topbar/Sidebar shell and Products navigation state
- Base Product form header
- General Information labels and empty upload dropzone dimensions
- Base master price/SKU/inventory fields
- Variants switch-off summary
- Shipping field labels and desktop four-column structure
- Products list populated/empty/loading/error desktop states
- Light/Dark variable mode inheritance after shell repair

## Mobile Products delivery — 390px

Added 14 production-backed mobile compositions in both Light and Dark (28 frames total):

- Products list: populated, total-empty, loading and fatal error
- Product detail full-width mobile sheet
- Add Product: blank and fully filled
- Edit Product: loaded
- Product Categories list
- Category modal compositions: edit, add root, add subcategory, delete blocked and delete/reparent warning

Canonical mobile sources live in Components section `34072:99686`:

- Product Card `34072:99687`
- Products List set `34072:101225`
- Product Form set `34072:100084`
- Product Detail `34072:100528`
- Category Row `34072:100546`
- Categories `34072:100553`
- Category Modal set `34072:100675`

Verification:

- 28 screen frames: 14 Light + 14 Dark
- 66 directly auditable canonical instances across the matrix
- 0 component/component-set originals inside screens
- Components mobile section overlap count: 0
- 588 bound reusable paints and 0 raw reusable paints in the audited component section
- The only raw screen paint is the intentional black modal backdrop at 60% opacity
- 262 of 263 mobile-source text layers use existing role-based text styles; the remaining Product Detail display-name layer is a documented content-specific one-off
- Product card/form/modal visual captures were checked at native 390px width after correcting default white Auto Layout fills, field width, textarea wrapping and product-title wrapping
- Screen structure: 54 directly auditable frames, 44 Auto Layout frames, plus 10 justified absolute `Modal Composition` canvases
- Component structure: 254 directly auditable component frames, 246 Auto Layout frames; the eight non-Auto Layout nodes are two component-set canvases, four media/icon placeholders, and two variant-set canvases

Canonical Reuse Gate:

| Proposed UI | Production primitive | Existing candidate | Decision |
| --- | --- | --- | --- |
| Mobile dashboard header | `TopHeader` below `lg` | `34051:98616` | Reuse |
| Product card below 820px | Product card branch in `products/page.tsx` | Desktop row `33108:815` is table-specific | Create mobile organism `34072:99687` |
| Products loading/empty/error | Existing desktop state organisms | `33945:69225`, `33945:69464`, `33947:72477` are fixed 1100px | Extend through mobile state organisms in `34072:101225` |
| Product form | Shared `ProductForm` responsive layout | Desktop form set `33950:74296` fixed at 1100px | Extend with mobile form set `34072:100084` |
| Product detail | `ProductDetailsMobile` | Desktop Quick View is a different `xl` interaction | Create mobile detail organism `34072:100528` |
| Category tree rows | Responsive branch in `CategoryManager` | Desktop categories organism `33977:81654` | Extend with mobile row/list `34072:100546` / `34072:100553` |
| Category modal | Same form contract with mobile viewport inset | Desktop set `33977:83050` | Extend with mobile modal set `34072:100675` |

Representative Figma evidence:

- Products populated Light `34107:8`
- Add Product filled Dark `34107:1039`
- Add Category Dark `34107:1819`

Scope note:

- The 28-frame delivery is the approved screen-level matrix.
- Validation, saving, upload progress, CategorySelect-open, filter-open/no-results, SKU accordion and confirmation/loading variations remain data/component-level states. They are tracked under `component-state-coverage` and are not claimed as additional completed screens.

Responsive behavior follows production breakpoints:

- mobile dashboard topbar at 56px; no fixed sidebar below `lg`
- content gutter 16px
- product cards below 820px
- one-column product form and mobile SKU accordion below `lg`
- category rows stack below `sm`
- category modal uses 16px viewport inset and scrolling body
- dirty save actions remain full-width and mobile-safe
