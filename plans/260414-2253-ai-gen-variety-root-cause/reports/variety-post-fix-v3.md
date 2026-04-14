# Variety Measurement — post-fix-v3

> Generated: 2026-04-14T19:38:06.845Z
> Mode: offline (direct generateSiteWithAI call, no media pipeline)

## Summary

| Category | Runs | Errors | Top Variant Share | Skeletons | Testim. Collision | Theme Combos | Lib Block Diversity |
|---|---|---|---|---|---|---|---|
| beauty | 10 | 0 | 100% | 10 | 76% | 10 | ser=7/10 fea=9/10 sta=3/5 tea=1/2 |
| restaurant | 10 | 0 | 100% | 10 | 50% | 7 | fea=4/4 sta=8/10 tea=8/9 |
| tech | 10 | 0 | 100% | 10 | 50% | 7 | ser=4/10 fea=9/10 sta=2/5 tea=4/4 |
| realestate | 10 | 0 | 100% | 10 | 67% | 7 | ser=6/10 fea=10/10 sta=1/7 tea=3/4 |
| fitness | 10 | 0 | 100% | 10 | 36% | 8 | ser=6/10 fea=7/10 sta=2/3 tea=5/5 |

## Targets (Plan 2253)

- Top variant share: **≤35%** (baseline ~60%)
- Skeletons distinct: **≥3** per 20 gens
- Content collision: **<20%**
- Theme combos: **≥6** per 20 gens (baseline ~2-3)
- Image uniqueness: **N/A** (offline mode, no media pipeline)

## Per-category details

### beauty

**Variant share per block type:**

- `navigation`: top=`centered` (50%), distinct=3
- `hero`: top=`parallax` (40%), distinct=5
- `gallery`: top=`grid` (60%), distinct=2
- `faq`: top=`accordion` (100%), distinct=1
- `testimonials`: top=`cards` (70%), distinct=2
- `features`: top=`grid-3` (60%), distinct=2
- `service-cards`: top=`grid` (100%), distinct=1
- `cta`: top=`banner` (100%), distinct=1
- `about`: top=`simple` (50%), distinct=3
- `footer`: top=`mega-footer` (40%), distinct=4
- `stats`: top=`highlight` (100%), distinct=1
- `newsletter`: top=`inline` (88%), distinct=2
- `team`: top=`list` (50%), distinct=2

**Skeleton sequences** (10):

- `navigation→hero→gallery→faq→testimonials→features→service-cards→cta→about→footer`
- `navigation→hero→stats→faq→newsletter→service-cards→features→testimonials→cta→footer`
- `navigation→hero→newsletter→team→features→testimonials→cta→service-cards→about→footer`
- `navigation→hero→faq→stats→newsletter→service-cards→features→testimonials→cta→footer`
- `navigation→hero→testimonials→gallery→about→team→newsletter→service-cards→features→cta→footer`
- `navigation→hero→faq→stats→newsletter→about→service-cards→features→testimonials→cta→footer`
- `navigation→hero→newsletter→features→faq→testimonials→service-cards→cta→about→footer`
- `navigation→hero→newsletter→cta→gallery→features→testimonials→service-cards→about→footer`
- `navigation→hero→newsletter→about→gallery→stats→service-cards→features→testimonials→cta→footer`
- `navigation→hero→gallery→stats→faq→about→service-cards→features→testimonials→cta→footer`

**Theme combos** (10):

- `#be185d|editorial`
- `#7c3aed|luxury-brand`
- `#d97706|artisan`
- `#6d28d9|magazine-cover`
- `#f472b6|fresh-rounded`
- `#db2777|elegant-serif`
- `#a16207|boutique-serif`
- `#1d4ed8|modern-clean`
- `#0891b2|pro-corporate`
- `#15803d|contemporary`

### restaurant

**Variant share per block type:**

- `navigation`: top=`mega-menu` (40%), distinct=3
- `hero`: top=`gradient` (30%), distinct=5
- `team`: top=`grid` (56%), distinct=2
- `cta`: top=`banner` (100%), distinct=1
- `testimonials`: top=`spotlight` (70%), distinct=2
- `about`: top=`simple` (90%), distinct=2
- `gallery`: top=`grid` (80%), distinct=2
- `contact`: top=`form` (100%), distinct=1
- `stats`: top=`row` (40%), distinct=3
- `faq`: top=`accordion` (100%), distinct=1
- `footer`: top=`dark-gradient` (30%), distinct=5
- `newsletter`: top=`inline` (80%), distinct=2
- `features`: top=`zigzag` (75%), distinct=2

**Skeleton sequences** (10):

- `navigation→hero→team→cta→testimonials→about→gallery→contact→stats→faq→footer`
- `navigation→hero→stats→testimonials→gallery→cta→about→contact→team→faq→footer`
- `navigation→hero→newsletter→team→testimonials→cta→about→gallery→contact→stats→footer`
- `navigation→hero→testimonials→gallery→newsletter→team→about→contact→stats→cta→footer`
- `navigation→hero→cta→faq→testimonials→gallery→newsletter→about→contact→stats→footer`
- `navigation→hero→newsletter→stats→features→testimonials→gallery→about→contact→team→footer`
- `navigation→hero→faq→features→testimonials→team→stats→about→gallery→contact→footer`
- `navigation→hero→gallery→faq→about→stats→features→testimonials→contact→team→footer`
- `navigation→hero→stats→testimonials→team→features→cta→about→gallery→contact→footer`
- `navigation→hero→newsletter→gallery→stats→cta→team→about→testimonials→contact→footer`

**Theme combos** (7):

- `#c2410c|warm-friendly`
- `#92400e|elegant-serif`
- `#b91c1c|warm-editorial`
- `#3f3f46|contemporary`
- `#e11d48|bold-impact`
- `#ec4899|magazine-cover`
- `#0e7490|magazine-cover`

### tech

**Variant share per block type:**

- `navigation`: top=`centered` (50%), distinct=3
- `hero`: top=`minimal` (50%), distinct=4
- `feature-comparison`: top=`table` (67%), distinct=2
- `video-showcase`: top=`featured` (100%), distinct=1
- `faq`: top=`accordion` (100%), distinct=1
- `features`: top=`grid-3` (50%), distinct=3
- `about`: top=`simple` (43%), distinct=3
- `testimonials`: top=`spotlight` (60%), distinct=2
- `service-cards`: top=`grid` (100%), distinct=1
- `cta`: top=`banner` (80%), distinct=2
- `footer`: top=`mega-footer` (40%), distinct=5
- `team`: top=`grid` (75%), distinct=2
- `pricing`: top=`cards` (100%), distinct=1
- `newsletter`: top=`inline` (100%), distinct=1
- `stats`: top=`highlight` (100%), distinct=1

**Skeleton sequences** (10):

- `navigation→hero→feature-comparison→video-showcase→faq→features→about→testimonials→service-cards→cta→footer`
- `navigation→hero→about→cta→team→pricing→testimonials→service-cards→features→footer`
- `navigation→hero→video-showcase→team→about→newsletter→service-cards→features→testimonials→cta→footer`
- `navigation→hero→faq→cta→features→testimonials→video-showcase→newsletter→service-cards→footer`
- `navigation→hero→about→cta→stats→pricing→newsletter→service-cards→features→testimonials→footer`
- `navigation→hero→testimonials→stats→cta→features→pricing→service-cards→about→footer`
- `navigation→hero→team→stats→features→testimonials→faq→feature-comparison→service-cards→cta→footer`
- `navigation→hero→pricing→video-showcase→stats→about→testimonials→service-cards→features→cta→footer`
- `navigation→hero→testimonials→newsletter→video-showcase→pricing→about→team→service-cards→features→cta→footer`
- `navigation→hero→pricing→features→feature-comparison→faq→testimonials→stats→service-cards→cta→footer`

**Theme combos** (7):

- `#0ea5e9|minimal-swiss`
- `#2563eb|tech-forward`
- `#9333ea|boutique-serif`
- `#0d9488|futuristic`
- `#4f46e5|startup-vibe`
- `#1e293b|contemporary`
- `#0369a1|classical`

### realestate

**Variant share per block type:**

- `navigation`: top=`mega-menu` (40%), distinct=3
- `hero`: top=`parallax` (40%), distinct=4
- `gallery`: top=`carousel` (57%), distinct=2
- `newsletter`: top=`inline` (67%), distinct=2
- `property-card`: top=`grid` (83%), distinct=2
- `stats`: top=`highlight` (71%), distinct=3
- `features`: top=`zigzag` (60%), distinct=4
- `testimonials`: top=`cards` (60%), distinct=2
- `service-cards`: top=`grid` (100%), distinct=1
- `cta`: top=`banner` (80%), distinct=2
- `footer`: top=`dark-gradient` (30%), distinct=6
- `team`: top=`grid` (75%), distinct=2
- `faq`: top=`accordion` (100%), distinct=1
- `about`: top=`simple` (50%), distinct=3

**Skeleton sequences** (10):

- `navigation→hero→gallery→newsletter→property-card→stats→features→testimonials→service-cards→cta→footer`
- `navigation→hero→team→cta→stats→testimonials→faq→gallery→service-cards→features→footer`
- `navigation→hero→newsletter→stats→property-card→about→features→testimonials→service-cards→cta→footer`
- `navigation→hero→faq→features→gallery→testimonials→property-card→service-cards→cta→footer`
- `navigation→hero→team→gallery→stats→features→testimonials→property-card→service-cards→cta→footer`
- `navigation→hero→cta→features→testimonials→faq→property-card→service-cards→about→footer`
- `navigation→hero→features→testimonials→cta→gallery→stats→service-cards→about→footer`
- `navigation→hero→property-card→stats→features→testimonials→team→cta→faq→service-cards→footer`
- `navigation→hero→stats→newsletter→cta→faq→gallery→service-cards→features→testimonials→footer`
- `navigation→hero→features→about→gallery→testimonials→cta→service-cards→team→footer`

**Theme combos** (7):

- `#451a03|classical`
- `#1e1b4b|editorial`
- `#78350f|luxury-brand`
- `#065f46|contemporary`
- `#166534|elegant-serif`
- `#1e1b4b|magazine-cover`
- `#1e3a5f|pro-corporate`

### fitness

**Variant share per block type:**

- `navigation`: top=`centered` (40%), distinct=3
- `hero`: top=`gradient` (30%), distinct=5
- `testimonials`: top=`spotlight` (70%), distinct=2
- `cta`: top=`banner` (100%), distinct=1
- `gallery`: top=`carousel` (78%), distinct=2
- `team`: top=`list` (60%), distinct=2
- `service-cards`: top=`grid` (100%), distinct=1
- `features`: top=`grid-3` (70%), distinct=2
- `about`: top=`split` (88%), distinct=2
- `footer`: top=`dark-gradient` (50%), distinct=5
- `stats`: top=`highlight` (100%), distinct=1
- `faq`: top=`accordion` (100%), distinct=1
- `class-schedule`: top=`grid` (67%), distinct=2
- `newsletter`: top=`inline` (67%), distinct=2

**Skeleton sequences** (10):

- `navigation→hero→testimonials→cta→gallery→team→service-cards→features→about→footer`
- `navigation→hero→about→stats→faq→features→testimonials→class-schedule→service-cards→cta→footer`
- `navigation→hero→testimonials→cta→about→newsletter→gallery→service-cards→features→footer`
- `navigation→hero→stats→gallery→cta→about→service-cards→features→testimonials→footer`
- `navigation→hero→cta→testimonials→gallery→about→faq→service-cards→features→footer`
- `navigation→hero→gallery→features→testimonials→about→service-cards→cta→team→footer`
- `navigation→hero→team→gallery→about→newsletter→testimonials→service-cards→features→cta→footer`
- `navigation→hero→class-schedule→cta→features→testimonials→team→newsletter→gallery→service-cards→footer`
- `navigation→hero→class-schedule→team→faq→gallery→testimonials→service-cards→features→cta→footer`
- `navigation→hero→testimonials→about→gallery→faq→stats→service-cards→features→cta→footer`

**Theme combos** (8):

- `#18181b|contemporary`
- `#0d9488|humanist`
- `#2563eb|geometric`
- `#991b1b|boutique-serif`
- `#d97706|hospitality`
- `#a3e635|futuristic`
- `#dc2626|bold-geometric`
- `#ea580c|bold-impact`
