# Code Review — Storefront Soft-Nav + Cache + SEO

Branch: `feat/storefront-soft-navigation` (vs `staging`)
Scope: 28 modified files + 9 new files. Focus: multi-tenant cache isolation, SmartLink, editor preview, SEO.
Reviewer verdict: **No CRITICAL issues. 2 HIGH, 2 MEDIUM, several LOW.** Content-isolation in the cache is sound and safe to ship; the two HIGH items (editor regression + JSON-LD XSS) should be addressed before merge.

---

## Critical
None. The multi-tenant cache isolation — the highest-risk area — is correctly implemented (see Positive Observations).

---

## High

### H1 — Editor preview: SmartLink `<Link>` likely defeats the canvas click-interceptor
**Files:** `src/blocks/_shared/smart-link.tsx:46-51`, interaction with `src/components/editor/PreviewScripts.tsx:567-589` (handler registered bubble-phase at `:1137`).

In the editor/preview iframe, storefront blocks render through the same components. For an internal href, `SmartLink` now renders Next.js `<Link>`, which attaches its own click handler that calls `e.preventDefault()` + `router.push()`.

The editor's navigation-blocking relies on a **native, bubble-phase** `document.addEventListener('click', onClick)` (PreviewScripts `:1137`) that does `preventDefault()/stopPropagation()` and routes the click to the parent. In Next App Router, React's event delegation is attached to `document` at hydration — i.e. **before** the PreviewScripts `useEffect` runs — so React's delegated handler (and thus `Link`'s `router.push`) fires **first**, and PreviewScripts' `preventDefault` runs too late. Result: clicking an internal nav/CTA/footer link inside the builder canvas would **soft-navigate the iframe away** instead of being absorbed/forwarded to the parent — a builder regression.

Note `products-grid` is NOT affected: it puts `handleCartClick(e)` (which `preventDefault`s) in the *element's own* `onClick`, and Next's `Link` checks `e.defaultPrevented` before navigating — so that interception is preserved. The exposure is specifically the SmartLink-rendered links that rely solely on the global interceptor.

**Fix (KISS, byte-identical editor behavior):** make `SmartLink` fall back to a plain `<a>` when in the editor preview:
```tsx
import { isInEditorPreview } from '@/lib/storefront/editor-intercept'
// inside SmartLink:
if (!href || forceAnchor || !isInternalHref(href) || isInEditorPreview()) {
    return <a ref={ref} href={href} target={target} {...rest} />
}
```
Alternative: register the PreviewScripts click handler in the **capture** phase (`addEventListener('click', onClick, true)`) so it preempts Link. The SmartLink fallback is cleaner and lower-blast-radius.
**Action:** Verify in the builder canvas (click a nav link / CTA whose URL is an internal page) before merge.

### H2 — JSON-LD injection / stored XSS via unescaped `</script>` in tenant content
**Files:** `src/app/sites/[slug]/[[...path]]/page.tsx:367` (org/website), `products/[productSlug]/page.tsx:219` (breadcrumb), `blog/[blogSlug]/page.tsx:180-181` (article + breadcrumb). Same pre-existing pattern at PDP `:218` and `SiteRenderer.tsx:571`.

All emit `dangerouslySetInnerHTML={{ __html: JSON.stringify(obj) }}`. `JSON.stringify` does **not** escape `<`, so a tenant-controlled value containing `</script><script>…</script>` (product name, blog title, `site.name`, `category.name`, author) breaks out of the `<script type="application/ld+json">` tag and executes arbitrary JS on every storefront visitor. On a multi-tenant e-commerce checkout flow this is a realistic card-skimming / drainer vector; store-owner (or lower-priv staff who can edit product names) is only semi-trusted.

This PR **expands** the surface by adding org/website/article/breadcrumb nodes fed by more user fields. Worth fixing platform-wide here.

**Fix:** shared helper and use everywhere:
```ts
export const jsonLdHtml = (o: unknown) =>
  JSON.stringify(o)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/ /g, '\\u2028').replace(/ /g, '\\u2029')
// <script ... dangerouslySetInnerHTML={{ __html: jsonLdHtml(obj) }} />
```

---

## Medium

### M1 — robots.txt `Disallow` + page `noindex` are mutually defeating
**Files:** `robots.txt/route.ts:43-47` (Disallow /checkout,/cart,/orders,/order/) + `export const metadata={robots:{index:false}}` on checkout/orders/confirm pages.

A `Disallow`'d URL is never crawled, so Googlebot never sees the `noindex`. If such a URL is linked externally it can still appear as a URL-only index entry. For *guaranteed* de-indexing you want `noindex` **without** `Disallow` (let it be crawled so the directive is seen). For purely functional pages this is low-impact, but the two signals are redundant/contradictory — pick one (prefer `noindex`-only for orders/confirm; `Disallow` is fine for `/cart`/`/checkout`). Verify these paths resolve at storefront root on subdomain/custom-domain (they do).

### M2 — Sitemap scopes blogs by `tenant`, but pages/products by `site`
**File:** `sitemap.xml/route.ts` (blogs `where tenant == tenant.id`, products/pages `where site == site.id`).

For a tenant with multiple sites, every site's sitemap lists the **whole tenant's** blog URLs under that site's origin. If blogs are intended to be tenant-global this is acceptable; if blog↔site is 1:N you'll emit cross-site blog URLs. Confirm the data model. (Downgrade to Low if blogs are genuinely tenant-scoped.)

---

## Low / Nit

- **L1 `<html lang>` is client-only.** `html-lang.tsx` sets `document.documentElement.lang` in `useEffect`; SSR HTML still ships `lang="en"`. JS-less crawlers see `en`. Acceptable, but since `layout.tsx` already resolves locale server-side, consider emitting it server-side if feasible.
- **L2 products-grid prefetch in editor.** `<Link>` prefetches the force-dynamic PDP as cards enter the viewport — fires in the editor preview too (wasteful server renders). Consider `prefetch={false}` or plain `<a>` in editor.
- **L3 unstable_cache serialization.** Depth-3 cached page round-trips through JSON (Dates → ISO strings; Next silently skips data-cache entries >2MB). Verify SiteRenderer tolerates string dates and that large pages still cache (else the perf win is silently lost).
- **L4 nav data exposure (pre-existing).** `getCachedNavigationPages` ships ALL pages incl. hidden/deleted (slugs/titles) to the client for client-side filtering — unchanged from before, not introduced here, but flagged for awareness.
- **L5 owner locale staleness.** `layout.tsx` reads the *cached* site for `<html lang>` even for owners (page itself is uncached). A just-changed locale lags ≤5 min in the lang attribute only. Trivial.

---

## Positive Observations (verified, not just skimmed)

- **Cache content-isolation is correct.** Visitor helpers (`getCachedVisitorPage/Homepage/NavigationPages`) replicate the exact original visitor filters: published (no `draft:true`), `isVisible != false`, `deletedAt` absent, depth 3. Owner path stays **uncached + draft-aware**. Drafts/hidden/soft-deleted pages cannot leak to visitors.
- **No cross-tenant key collision.** Every visitor key embeds `siteId` (numeric) and slash-prefixed `pageSlug` in `keyParts`; tenant lookups key on the arg. Distinct prefixes per helper. Safe.
- **Invalidation is layered and complete.** Publish/unpublish API (`publish/route.ts:395,514`) + page API (`pages/[pageId]/route.ts:260`) cover the editor flow; new `afterChange`/`afterDelete` hooks on Pages & Sites close the Payload-admin-edit gap; `tenants` tag busts `getCachedSiteByTenant`/tenant lookups on site writes. All `revalidateTag` calls are try/caught for out-of-request scope (seeds/migrations).
- **No stale-price risk from the page cache.** `products-grid` fetches prices client-side via `/api/storefront/products`, so prices are never baked into the cached page.
- **SmartLink classification is correct.** Keeps plain `<a>` for external/`//`/`mailto:`/`tel:`/`#`/`_broken_url_:` and any `target` ≠ `_self`; uses `<Link>` only for single-leading-slash internal paths. All blocks pass hrefs through `resolveHref` first.
- **Env-correct hrefs.** `getSiteBasePath` → `''` on subdomain/custom-domain, `/sites/{slug}` on local; `useLocalHref` matches. Soft-nav RSC fetches pass through middleware (matcher includes non-static, non-api paths) so production rewrite still applies.
- **Sitemap hardening.** XML-escapes `&<>` in `<loc>`; JSON-LD uses spread guards to omit `undefined` keys (no broken JSON).

---

## Unresolved Questions
1. H1: needs a real click-through in the builder canvas to confirm the iframe navigates away (event-ordering inference). Please QA before merge.
2. M2: is `blogs` tenant-global or per-site? Determines whether the sitemap scoping is a bug or intended.
3. L3: have large (many-block) pages been confirmed to still hit unstable_cache (under the data-cache size limit)?
