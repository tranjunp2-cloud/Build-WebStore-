# Phase 03 — Author BM (+ normalize EN) default content

**Priority:** P0 · **Status:** pending · **Risk:** Med · **Effort:** M · **Depends on:** phase-02

## Goal
Populate `en.ts` / `ms.ts` with hand-authored default content for the **addable, high-traffic content blocks**, so a `ms` site gets proper Bahasa Melayu starter text (not machine-translated, not English). Everything else falls back to EN + flag (already handled by phase-02).

## Block set (Phase 1 coverage target)
Author EN+BM for these ~15 (highest content + most-added):
`hero, features, faq, testimonials, team, pricing, newsletter, cta, contact, stats, accordion, service-cards, about, gallery-related text, products text labels`.

Out of this phase (fall back to EN + flag, picked up by US-F26-06 / US-F26-04):
structural/data-driven blocks where text is minimal or user-supplied (`divider, breadcrumb, custom-html, google-maps, whatsapp-button, cart-widget, products-grid items, menu-food dish names`, etc.).

## EN extraction (DRY, regression-safe)
Move the existing English literals from the `createAddSectionBlock` switch into `en.ts` **verbatim** (same strings) for each migrated block. This guarantees the `en` path is unchanged (phase-04 snapshot proves it). Use the `{brand}` token where the old code interpolated `brandName`.

Example `en.ts`:
```ts
export const BLOCK_CONTENT_EN = {
  hero: {
    headline: 'Welcome to {brand}',
    subheadline: 'We deliver exceptional products and services that help you achieve your goals. Discover what makes us different.',
    ctaButtons: [
      { label: 'Get Started', url: '#contact', style: 'primary' },
      { label: 'Learn More', url: '#about', style: 'outline' },
    ],
  },
  // features, faq, ...
}
```

## BM authoring (quality bar)
Hand-authored, natural Bahasa Melayu (NOT literal machine translation). Mirror structure/keys of `en.ts` exactly.
```ts
export const BLOCK_CONTENT_MS = {
  hero: {
    headline: 'Selamat datang ke {brand}',
    subheadline: 'Kami menyediakan produk dan perkhidmatan terbaik untuk membantu anda mencapai matlamat. Temui apa yang membezakan kami.',
    ctaButtons: [
      { label: 'Mula Sekarang', url: '#contact', style: 'primary' },
      { label: 'Ketahui Lagi', url: '#about', style: 'outline' },
    ],
  },
  // ...
}
```

### BM copy guidelines
- Keep CTA labels short (button overflow risk — F21 success metric: 0 layout breaks).
- Currency/format rules from F21 BR-03 (`RM`, `DD/MM/YYYY`) apply to any pricing/date sample text.
- Reuse terminology already used in `src/lib/ai/content/*.ts` BM content (from `fix/ai-gen-locale-ms`) for consistency — **align, don't diverge**.

## Coordination (do first)
⚠️ Rebase/merge `fix/ai-gen-locale-ms` before authoring so BM wording is consistent and `src/lib/ai/content/*` / `add-section.ts` edits don't conflict.

## Related code files
- Modify: `src/lib/ai/add-section-content/en.ts`, `.../ms.ts`
- Modify: `src/lib/ai/add-section.ts` (finish migrating the covered cases to the resolver)
- Reference: `src/lib/ai/content/*.ts` (BM terminology source of truth)

## Todo
- [ ] Rebase onto / merge `fix/ai-gen-locale-ms`
- [ ] Extract EN literals → `en.ts` verbatim for the covered set
- [ ] Author BM equivalents in `ms.ts` (natural, short CTAs)
- [ ] Migrate remaining covered switch cases to resolver
- [ ] Record final coverage via `getLocaleCoverage()` (handoff to US-F26-06)

## Success criteria
- All ~15 covered blocks return BM on `ms`, identical EN on `en`.
- BM CTA labels fit without layout break (spot-check in preview).
- Coverage map exported and accurate.

## Risks
- BM quality/consistency — mitigate: align with existing `content/*` BM, peer review by a BM speaker if available.
- Merge conflict with `fix/ai-gen-locale-ms` — mitigate: do the rebase first.
