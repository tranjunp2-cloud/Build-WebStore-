# Phase 07 — Footer + Form Polish

## Context
- Parent: [plan.md](plan.md)
- Dependencies: Phases 01-06
- Related: [researcher-01 §3, §5](research/researcher-01-component-status.md), [researcher-02 F7.7](research/researcher-02-gen-flow-output.md)

## Overview
- Date: 2026-04-15
- Description: Final polish — wire newsletter/contact forms to real API, add footer scroll animations, rotate font pairing per category, resolve hero CTAs to real page slugs.
- Priority: P2
- Implementation status: pending
- Review status: pending

## Key Insights
- Footer has ZERO animations — static. Newsletter inputs in mega-footer + expanded variants are inert. Tiktok icon falls back to `<span>`.
- Contact form is `onSubmit preventDefault` — no real submission. All inputs use same glass style → 6 variants look similar.
- Hero CTAs hardcoded `/contact` + `/about` (template-composer.ts:181-231) — break if pages don't exist.
- Font pairing defaults to `Outfit + Inter` for every site — no rotation.

## Requirements
- Footer: reveal-on-scroll stagger animation. Wire newsletter to `/api/subscribe`. Ship real tiktok SVG icon.
- Contact: wire to `/api/contact-submit` w/ validation + toast on success/error. Reuse `useNewsletterForm` hook pattern.
- Hero: resolve CTAs via `findPage(slug)` before emission — fallback to `/#<section>` anchors if page missing.
- Font pairing: `FONT_PAIRING_POOL: Record<Category, FontPairingId[]>` — rotate via seed like variant selector.

## Architecture
Reuse existing `useNewsletterForm` hook for contact. Footer animations: wrap columns in `AnimatedSection` w/ stagger index. Font pairing selector: new `selectFontPairingBySeed` parallel to variant selector.

## Related code files
- `src/blocks/footer/index.tsx` (478 LOC)
- `src/blocks/contact/index.tsx` (413 LOC)
- `src/blocks/newsletter/useNewsletterForm.ts` (reuse pattern)
- `src/lib/ai/template-composer.ts:181-231` (hero CTAs)
- `src/lib/theme/font-pairings.ts` (font pool)
- `src/app/api/subscribe/route.ts`
- `src/app/api/contact-submit/route.ts` (create if missing)

## Implementation Steps
1. Footer reveal animations via AnimatedSection stagger.
2. Wire mega-footer + expanded newsletter forms to `useNewsletterForm`.
3. Ship real tiktok SVG.
4. Create `useContactForm` mirroring `useNewsletterForm`; POST to `/api/contact-submit`.
5. Create `/api/contact-submit/route.ts` if missing (validate + persist + email notify).
6. Wire contact block variants to `useContactForm`.
7. Vary contact input styles per variant (underline, floating-label, outlined, filled, glass, borderless).
8. Hero: add `resolveCTA` helper that checks `pages[]` before emitting href.
9. Build `FONT_PAIRING_POOL` per category; call `selectFontPairingBySeed` in composer theme write.

## Todo list
- [ ] Footer reveal animations
- [ ] Footer newsletter wiring
- [ ] Tiktok SVG icon
- [ ] useContactForm hook
- [ ] /api/contact-submit route
- [ ] Contact form wiring
- [ ] Contact input style variation
- [ ] Hero CTA resolver
- [ ] Font pairing pool + rotation

## Success Criteria
- Footer columns animate on scroll.
- Newsletter POST hits /api/subscribe from footer.
- Contact form submits to /api/contact-submit w/ validation + toast.
- Hero CTAs resolve to real page slugs (0 broken links in regen QA).
- 3 font pairings rotate across 10 sites of same category.

## Risk Assessment
- **Risk**: /api/contact-submit needs anti-spam (honeypot, captcha, rate-limit). **Mitigation**: honeypot field + per-IP rate limit via existing middleware pattern.
- **Risk**: font rotation invalidates Google Fonts cache. **Mitigation**: pre-register all pool fonts in root layout.

## Security Considerations
- Contact submit: honeypot + rate limit + sanitize inputs + CSRF token.
- Newsletter: existing hook handles validation — extend same pattern.

## Next steps
Last phase. Post-completion: full template regen QA sweep; compare 10 generated sites side-by-side against Wix templates. Kick off follow-up plan if gaps remain.
