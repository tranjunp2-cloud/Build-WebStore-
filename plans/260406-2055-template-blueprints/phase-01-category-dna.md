---
parent: plan.md
phase: 1
---

# Phase 1: Define Category DNA cho 10 Ngành

## Overview
- **Description:** Xác định DNA riêng cho mỗi ngành — signature blocks, section order, visual mood, page set
- **Priority:** P1
- **Implementation status:** done

## Key Insight
Anh muốn nhìn vào template là BIẾT NGAY ngành nào. Không phải đổi màu là xong.
DNA = tổ hợp: blocks đặc trưng + thứ tự sections + mood + pages.

## Category DNA Matrix

### 🍽️ Restaurant / F&B
- **Signature blocks:** menu-display, booking-widget, gallery (food photos)
- **Section order:** hero(parallax/fullscreen food) → menu → gallery → testimonials → booking → contact
- **Visual mood:** warm colors, relaxed spacing, soft radius, artisan/serif fonts
- **Pages:** Home, Menu, About Us, Contact, Gallery
- **Content DNA:** RM pricing, halal badges, local dishes, operating hours

### 🛍️ E-commerce / Retail
- **Signature blocks:** products-grid, product-quick-view, pricing-table
- **Section order:** hero(slideshow/magazine) → products featured → categories → promo CTA → testimonials → newsletter
- **Visual mood:** clean/modern, default spacing, rounded radius, geometric fonts
- **Pages:** Home, Products, About, Contact, Blog
- **Content DNA:** product cards with prices, discount badges, "Add to Cart" CTAs

### 💄 Beauty / Spa
- **Signature blocks:** gallery-masonry, booking-widget, before-after
- **Section order:** hero(gradient/split) → services(features) → gallery → before-after → testimonials → booking → newsletter
- **Visual mood:** pastel/rose, relaxed spacing, pill radius, elegant fonts
- **Pages:** Home, Services, Gallery, About, Contact
- **Content DNA:** treatment packages with RM prices, "Book Now" CTAs, calming imagery

### 💻 Tech / SaaS
- **Signature blocks:** feature-comparison, pricing-table, video-showcase, stats
- **Section order:** hero(gradient/split-video) → features → stats → pricing → feature-comparison → testimonials → FAQ → CTA
- **Visual mood:** dark/blue, compact spacing, sharp/subtle radius, tech fonts
- **Pages:** Home, Features, Pricing, About, Contact
- **Content DNA:** SaaS metrics, feature lists, tier pricing, "Start Free Trial" CTAs

### 🏥 Health / Medical
- **Signature blocks:** doctor-profile, booking-widget, stats
- **Section order:** hero(split-left/minimal) → services → doctor-profile → stats → testimonials → FAQ → booking → contact
- **Visual mood:** teal/blue, default spacing, rounded radius, clean fonts
- **Pages:** Home, Services, Our Team, About, Contact
- **Content DNA:** doctor credentials, appointment booking, patient testimonials, insurance info

### 📚 Education
- **Signature blocks:** class-schedule, pricing-table, stats
- **Section order:** hero(split-left) → features(programs) → class-schedule → stats → testimonials → pricing → FAQ → CTA
- **Visual mood:** blue/purple, default spacing, rounded radius, friendly fonts
- **Pages:** Home, Programs, Schedule, About, Contact
- **Content DNA:** course listings, class timetables, enrollment CTAs, student testimonials

### 🏠 Real Estate
- **Signature blocks:** property-card, gallery-masonry, stats
- **Section order:** hero(fullscreen/video) → property-card → stats → gallery → testimonials → about → CTA → contact
- **Visual mood:** dark/luxury, relaxed spacing, subtle radius, editorial fonts
- **Pages:** Home, Properties, About, Gallery, Contact
- **Content DNA:** property specs (sqft, rooms, RM price), location maps, agent profiles

### 💪 Fitness / Gym
- **Signature blocks:** class-schedule, pricing-table, before-after
- **Section order:** hero(fullscreen/split-video) → features(programs) → class-schedule → before-after → pricing → testimonials → CTA
- **Visual mood:** bold/dark, compact spacing, sharp radius, impact fonts
- **Pages:** Home, Classes, Pricing, About, Contact
- **Content DNA:** workout programs, class times, membership pricing, transformation photos

### 🎨 Creative / Portfolio
- **Signature blocks:** portfolio-grid, gallery-masonry, video-showcase
- **Section order:** hero(minimal/cards-overlay) → portfolio-grid → about → testimonials → team → CTA → contact
- **Visual mood:** minimal hoặc vibrant, varied spacing, sharp radius, creative fonts
- **Pages:** Home, Portfolio, About, Services, Contact
- **Content DNA:** project showcases, client logos, case studies, "Let's Work Together" CTAs

### 🏢 Business / Corporate
- **Signature blocks:** stats, feature-comparison, team
- **Section order:** hero(gradient/split-left) → features → stats → team → testimonials → pricing → FAQ → CTA
- **Visual mood:** corporate blue/dark, default spacing, subtle radius, professional fonts
- **Pages:** Home, Services, About, Team, Contact
- **Content DNA:** company metrics, service packages, team profiles, client logos

## Chuẩn Chung MỌI Category PHẢI CÓ (từ Wix/Envato/SEO research)

### Homepage Blocks BẮT BUỘC (theo standards doc)
Mọi template homepage PHẢI có đủ 8 blocks chuẩn sau (ngoài signature blocks):
1. **navigation** — sticky, transparent on hero
2. **hero** — headline + CTA + visual trong 600px đầu
3. **logo-cloud / trust-bar** — 4-6 logos ngay sau hero (trust signal)
4. **[signature blocks]** — blocks đặc trưng ngành
5. **testimonials** — 3-5 reviews, star rating
6. **mid-page CTA** — banner CTA giữa trang (conversion checkpoint)
7. **FAQ** — 4-8 câu accordion (SEO: FAQPage schema)
8. **newsletter** — lead capture
9. **footer** — links, socials, copyright

### CTA Placement (5 positions)
1. Hero CTA (primary, high contrast)
2. After features/services (secondary, softer)
3. Mid-page banner CTA (full-width, contrasting bg)
4. After testimonials (reinforcement)
5. Footer CTA (last chance)

### SEO per Page Type
| Page | JSON-LD Schema | H1 Rule |
|------|---------------|---------|
| Home | Organization + WebSite + BreadcrumbList | Business name + value prop |
| About | Organization + Person | "About [Business]" |
| Services | Service + Offer + BreadcrumbList | "[Category] Services" |
| Contact | LocalBusiness + BreadcrumbList | "Contact Us" |
| Blog | BlogPosting + BreadcrumbList | Post title |
| FAQ | FAQPage + BreadcrumbList | "[Category] FAQ" |

### Animation per Block Type
| Block | Animation | Duration |
|-------|-----------|----------|
| Hero | None (instant load) | — |
| Features | Stagger fade-in | 0.3s + 0.1s delay |
| Stats | Counter animation (0→target) | 1.5-2s |
| Testimonials | Carousel slide OR fade-in | 0.5s |
| Gallery | Stagger scale-in | 0.3s + 0.05s delay |
| CTA | Slide-up on scroll | 0.4s |
| All others | Fade-in on scroll | 0.4-0.6s |

## Implementation
- Create `CATEGORY_DNA` object trong `template-definitions.ts`
- Mỗi entry: signatureBlocks[], sectionOrder[], visualMood, pageSet[], contentDNA
- Mỗi entry PHẢI include: logo-cloud, mid-CTA, newsletter, FAQ trong section order

## Todo
- [ ] Define CATEGORY_DNA cho 10 ngành
- [ ] Map signature blocks to available block types
- [ ] Verify all signature blocks exist (từ 56 available blocks)
- [ ] Document page sets per category
- [ ] Verify mỗi DNA có đủ 8 blocks chuẩn + signature blocks
- [ ] Map SEO schema type per page trong mỗi DNA
- [ ] Map animation type per block

## Success Criteria
- [ ] 10 DNA definitions, mỗi cái có ≥2 signature blocks unique
- [ ] Section order KHÁC nhau giữa categories (≥5 variations)
- [ ] Visual mood mapping tới theme presets (5 presets/category đã có)
- [ ] MỌI DNA có: logo-cloud, mid-CTA, newsletter, FAQ, footer
- [ ] MỌI DNA có SEO schema mapping cho mỗi page type
- [ ] MỌI DNA có animation spec cho mỗi block
