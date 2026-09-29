# PW1 website mapping audit — 2026-09-29

Scope: website adapter, native block binder, site-setting fallbacks and editor controls. This is not an audit of the separate BE catalog/order/account importer.

## Corrected

- Contact editor reads the same site contact fallback as the storefront, including refreshed uncontrolled input keys.
- Social-widget editor resolves inherited site links before normalization, matching the storefront.
- Footer editor resolves inherited branding/social links; editing one preserves the others. Blank overrides do not resurrect inherited icons.
- Compact input contract includes footer branding and social links before AI layout selection.
- Native binder prevents compact footer variants from hiding source tagline/link columns/social links. Content-rich sources fall back to centered-stack.
- Prompt now describes simple footer as the compact bar actually implemented by PW2.
- Footer HTML-to-text conversion preserves line breaks; supported footer layouts render those line breaks.
- Product selection mapper only resolves category for random mode, matching the current PW2 source semantics. Fixed shortlist order remains preserved.

## Verified paths

- Branding logo/favicon and SEO OG image flow through preparePw1SiteSettings; image assets are imported before site settings are applied.
- Navigation already falls back to site branding in editor and renderer.
- Product selection identity mappings remain tenant/site scoped and require VERIFIED BE mappings.
- Footer data and website settings are deterministic source inputs, not AI-generated copy.

## Known source features not implemented as complete PW2 parity

These are surfaced by existing adapter reconciliation, not silently treated as mapped:

- Product category/price criteria are merged page-wide into listing filterControls. Multiple controls are unioned, never paired by proximity. All-products uses URL filters; fixed/random retain their existing local-filter behavior. Search is not invented from a standalone filter component.
- Article category controls map to all-article listings and use tenant-scoped PW2 category slugs via blogCategory. Fixed/random article selection remains unsupported and is explicitly reported.
- Brand has no equivalent PW2 product field. PW1 variant filtering uses attribute/value identities; the prepared BE handoff inspected retains variant name/SKU/price/stock but no attributes. Neither is falsely mapped to generic attributes.
- Sort components are skipped-intentionally, not pending, per the user's instruction.
- Filter reports include page/source IDs, target listing IDs, status and reason. Partial criteria mappings retain unsupported status. Orphan/malformed controls remain explicit findings.
- Header product search mapping remains pending; current navigation has no equivalent setting.
- Brand CTA mapping is deferred.
- Article listing fixed/random selection configuration is retained as source settings, not mapped to equivalent blog-list modes.
- Footer rich HTML is converted to plain text (line breaks preserved); arbitrary legacy formatting is not reproduced.

Editor fallback fixes apply immediately to existing sites. Adapter/binder changes apply to future migration runs; this audit did not rerun paid generation or overwrite previously migrated pages.

## Rerun safety

Dry-run validates adapters only and never calls AI or writes website data. Completed stores with unchanged input remain skipped by default. Code changes do not change the input hash. `--rerun` explicitly regenerates the mapped site; it is not a selective filter backfill and can replace editor changes. Do not run it across all stores merely to apply these settings. The apply path retains its transaction, source snapshot and concurrent-edit checks. New filter columns are checked before page replacement.

Local verification uses a disposable tenant/site with real published products/articles. Browser tests exercise desktop/mobile filter visibility, tenant-scoped article category selection and clearing, and retained scroll. It does not claim a full editor save-flow or all-store visual audit.
