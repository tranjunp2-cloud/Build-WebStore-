# Phase 03 — QA docs + verify

**Status:** done

## Steps
1. `docs/qa/F01-template-first-gen.md`:
   - Add TC-TF-028 (ms sample product shortDescription BM), TC-TF-029 (ms gallery headline + `/gallery` title, no `/galeri` link), TC-TF-030 (ms newsletter heading).
   - TC-TF-007 expected: replace "Template body content = English (known limitation until Phase 04)" with: gallery/newsletter/products localized; remaining known gap = Blog page headings, SEO of other pages.
2. `npm run verify` (oxlint, typecheck, related tests).
3. Manual BM repro (issue steps) on local; check homepage gallery + newsletter, nav, product cards.

## Out of scope — evaluation (follow-up candidates)
| Item | Visible | Effort | Recommend |
|------|---------|--------|-----------|
| Blog page hero/blog-list headings + CTA w/o language (`template-composer.ts:1273-1282`, `:1588`) | Yes, /blog | M — new i18n keys (BlockStrings typed for 8 locales) or optional key | Follow-up issue |
| Sample category name = composer key "Fnb" (`generate-site-service.ts:2145`) | Yes, product card + filter | S — label map category × locale | Follow-up issue (bad in EN too) |
| Other page titles/SEO EN ("About · X") | Tab/Google only; nav already BM | S | Low |
| EN curated fallback when AI fails & nothing listed (`generate-sample-products.ts:401`) | Rare | S, tradeoff vs empty catalogue (vi) | Defer |
| BM product names when nothing listed | Yes | XS, may affect photo matching | Defer |
| Remove `descriptionBM` | — | — | Don't (schema bilingual) |
| Testimonial invite title EN | No (internal marker) | — | Don't |

## Localhost repro result (issue input, `language: 'auto'` + `generationLocale: 'ms'`, site 2921)
- Log: `path=template-first category=fnb … lang=ms`
- `/gallery` title `Galeri`; gallery headlines `Galeri — Kopi Ipoh UAT` / `Galeri`
- Homepage newsletter `Ikuti Perkembangan Terbaru Kopi Ipoh UAT | Langgan untuk berita dan tawaran.`
- Products shortDescription BM (e.g. `Kopi tarik pekat berkrim, tarik sampai berbuih.`)
- Remaining EN (out of scope, see table): `/blog` newsletter, page titles About/Contact/Home/Blog
