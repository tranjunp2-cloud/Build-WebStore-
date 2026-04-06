# Website Template Standards — ECH Prime Web v2

> Tài liệu chuẩn cho template website. Tổng hợp từ Wix (900+ templates), Envato Elements, Shopify, Unbounce, và SEO best practices 2026.
> Dùng làm baseline để thiết kế + đánh giá chất lượng templates.

---

## 1. Chuẩn Sections/Blocks cho Template

### 1.1 Homepage — Section Order (Conversion-Optimized)

| # | Section | Bắt buộc | Mục đích | Chuẩn |
|---|---------|----------|----------|-------|
| 1 | **Navigation** | ✅ | Điều hướng + brand identity | Sticky, transparent on hero, logo trái, CTA phải |
| 2 | **Hero** | ✅ | Ấn tượng đầu tiên, value proposition | Headline + subheadline + CTA + visual trong 600px đầu |
| 3 | **Trust Bar / Logo Cloud** | Khuyên | Social proof ngay sau hero | 4-6 logos khách hàng/đối tác/báo chí |
| 4 | **Features / Services** | ✅ | Giải thích giá trị cốt lõi | 3-6 items, icon + title + description |
| 5 | **Industry Section** | ✅ | Đặc trưng ngành | Menu (F&B), Products (ecom), Gallery (beauty), Property cards (RE) |
| 6 | **Stats / Social Proof** | Khuyên | Tạo credibility | 3-4 con số ấn tượng (years, customers, rating) |
| 7 | **Gallery / Portfolio** | Tùy ngành | Showcase visual | 6-12 images, masonry/grid/carousel |
| 8 | **Testimonials** | ✅ | Trust signal | 3-5 reviews, star rating, avatar, company |
| 9 | **Mid-page CTA** | Khuyên | Conversion checkpoint | Banner hoặc highlight CTA giữa trang |
| 10 | **Pricing** | Tùy ngành | So sánh plans/packages | 2-4 tiers, highlight recommended |
| 11 | **FAQ** | Khuyên | Giải đáp objections | 4-8 câu hỏi, accordion |
| 12 | **Blog Preview** | Optional | SEO + freshness signal | 3 bài mới nhất, thumbnail + title + date |
| 13 | **Newsletter** | Khuyên | Lead capture | Email input + CTA, mô tả value |
| 14 | **Contact** | ✅ | Conversion cuối cùng | Form + address + phone + map |
| 15 | **Footer** | ✅ | Navigation + legal | Links, socials, copyright, payment badges |

### 1.2 Sub-pages (Minimum 4-5 pages per template)

| Page | Sections | Mục đích |
|------|----------|----------|
| **About** | Mini hero → Story (text+image split) → Timeline/milestones → Team → Stats → CTA | Brand trust |
| **Services/Products** | Mini hero → Service cards → Industry blocks → Pricing → FAQ → CTA | Conversion |
| **Gallery/Portfolio** | Mini hero → Gallery (masonry/filter) → CTA | Visual showcase |
| **Blog** | Mini hero → Blog list → Newsletter → Sidebar (categories, popular) | SEO + content |
| **Contact** | Mini hero → Contact form + Map → Address/Phone/Email → FAQ | Direct conversion |

---

## 2. Chuẩn Visual & Design

### 2.1 Design Tokens (Minimum)

| Token | Số lượng | Ví dụ |
|-------|----------|-------|
| **Colors** | 6 minimum | primary, secondary, accent, surface, text, muted |
| **Fonts** | 2-3 | heading (display), body (readable), accent (optional) |
| **Spacing** | 3 presets | compact, default, relaxed |
| **Border Radius** | 5 options | sharp (0), subtle (4px), rounded (8px), soft (12px), pill (999px) |
| **Shadow** | 4 presets | none, subtle, medium, dramatic |
| **Color Mode** | 2 | light, dark |

### 2.2 Typography Standards

| Element | Size Range | Weight | Line Height |
|---------|-----------|--------|-------------|
| H1 (Hero) | 36-72px | 700-900 | 1.1-1.2 |
| H2 (Section title) | 28-48px | 600-700 | 1.2-1.3 |
| H3 (Card title) | 20-28px | 600 | 1.3 |
| Body | 16-18px (min 16px!) | 400 | 1.5-1.7 |
| Small/Caption | 12-14px | 400 | 1.4 |

> **QUAN TRỌNG:** Font size tối thiểu 16px cho body — iOS tự zoom nếu nhỏ hơn.

### 2.3 Responsive Breakpoints

| Breakpoint | Width | Layout |
|------------|-------|--------|
| Mobile | < 640px | 1 column, stack everything |
| Tablet | 640-1024px | 2 columns, compact nav |
| Desktop | > 1024px | Multi-column, full nav |
| Wide | > 1280px | Max-width container, centered |

### 2.4 Animation Standards (2026)

| Type | Khi nào dùng | Duration | Easing |
|------|-------------|----------|--------|
| **Fade-in on scroll** | Sections xuất hiện khi scroll tới | 0.4-0.6s | ease-out |
| **Slide-up** | Cards, features, testimonials | 0.3-0.5s | ease-out |
| **Stagger** | List items, grid cards (delay 0.1s mỗi item) | 0.3s + delay | ease-out |
| **Counter/Number** | Stats section — đếm từ 0 lên | 1.5-2s | ease-in-out |
| **Hover scale** | Cards, buttons, images | 0.2-0.3s | ease |
| **Parallax** | Hero background, section backgrounds | Scroll-based | linear |
| **Carousel slide** | Hero, testimonials, gallery | 0.5s | ease-in-out |

> **BẮT BUỘC:** Respect `prefers-reduced-motion` — tắt animation cho users chọn.

---

## 3. Chuẩn SEO cho Template

### 3.1 HTML Structure

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Page Title — Site Name (50-60 chars)</title>
  <meta name="description" content="Compelling description (150-160 chars)">
  <link rel="canonical" href="https://example.com/page">
  <!-- Structured Data -->
  <script type="application/ld+json">...</script>
</head>
<body>
  <header><nav>...</nav></header>
  <main>
    <article><!-- or section -->
      <h1>One H1 per page</h1>
      <section>
        <h2>Section heading</h2>
        <h3>Subsection</h3>
      </section>
    </article>
  </main>
  <footer>...</footer>
</body>
</html>
```

### 3.2 Heading Hierarchy (BẮT BUỘC)

| Level | Số lượng/page | Dùng cho |
|-------|---------------|----------|
| H1 | **1 duy nhất** | Page title / hero headline |
| H2 | 3-8 | Section titles |
| H3 | Unlimited | Subsections, card titles |
| H4-H6 | Sparingly | Deep nesting |

> **KHÔNG ĐƯỢC** skip levels (H1 → H3 bỏ H2).

### 3.3 Structured Data (JSON-LD) per Page Type

| Page | Schema Type | Bắt buộc |
|------|-------------|----------|
| **Homepage** | Organization + WebSite + SearchAction | ✅ |
| **About** | Organization + Person (founder) | ✅ |
| **Services** | Service + Offer | Khuyên |
| **Blog post** | Article / BlogPosting (author, date, image) | ✅ |
| **Contact** | LocalBusiness (address, phone, hours) | ✅ |
| **FAQ** | FAQPage (enables rich snippets) | ✅ |
| **Products** | Product + Review + AggregateRating | ✅ |
| **Pricing** | Offer + PriceSpecification | Khuyên |
| **All pages** | BreadcrumbList | ✅ |

### 3.4 Image SEO

| Requirement | Rule |
|-------------|------|
| **Format** | WebP hoặc AVIF (fallback PNG/JPG) |
| **Alt text** | Mô tả nội dung, có keyword tự nhiên |
| **Width/Height** | BẮT BUỘC set trong HTML (tránh CLS) |
| **Loading** | `loading="eager"` cho above-fold, `loading="lazy"` cho below-fold |
| **srcset** | Responsive images cho mobile/tablet/desktop |
| **Size** | < 200KB cho images, < 50KB cho thumbnails |

### 3.5 Core Web Vitals Targets

| Metric | Target | Ý nghĩa |
|--------|--------|---------|
| **LCP** | < 2.5s | Largest Contentful Paint — hero image/text load time |
| **INP** | < 200ms | Interaction to Next Paint — response time khi click |
| **CLS** | < 0.1 | Cumulative Layout Shift — visual stability |
| **TTFB** | < 800ms | Time to First Byte — server response time |

### 3.6 Mobile SEO

- Min tap target: **48×48px** với 8px spacing
- Min font size: **16px** (iOS auto-zoom issue)
- Responsive images with `srcset`
- No hidden content on mobile (`display:none` = excluded from index)
- Test trên real device, không chỉ emulator

---

## 4. Chuẩn Category-Specific (Wix + Envato Reference)

### 4.1 Wix Category Map (900+ templates, 15+ categories)

| Category | Key Blocks | Unique Features | Visual Style |
|----------|-----------|-----------------|-------------|
| 🍽️ **Restaurant** | Menu, Reservation, Gallery | Online ordering, social media feed | Warm, food photography |
| 🛍️ **E-commerce** | Product grid, Cart, Checkout | Wishlist, quick view, size swatches | Clean, product-focused |
| 💄 **Beauty/Spa** | Booking, Gallery, Before-After | Online scheduling, treatment packages | Pastel, elegant |
| 💻 **Tech/SaaS** | Features, Pricing, Comparison | Interactive animations, video demo | Dark/blue, modern |
| 🏥 **Health** | Doctor profiles, Booking, FAQ | Insurance info, emergency contacts | Teal, trustworthy |
| 📚 **Education** | Class schedule, Pricing, Blog | Subscription/membership, video tutorials | Blue, academic |
| 🏠 **Real Estate** | Property listings, Gallery, Map | Search/filter, virtual tours | Dark luxury, premium |
| 💪 **Fitness** | Class schedule, Pricing, Video | Membership, workout plans, streaming | Bold, energetic |
| 🎨 **Portfolio** | Gallery, Portfolio grid, Video | Full-screen showcases, case studies | Minimal, creative |
| 🏢 **Business** | Team, Stats, Case studies | Consultation scheduling, testimonials | Corporate, trust |
| 📝 **Blog** | Blog list, Newsletter, Social | Categories, search, monetization | Content-focused |
| 🎉 **Events** | Booking, Gallery, Countdown | RSVP, venue info, photo sharing | Elegant, celebratory |

### 4.2 Envato Template Types

| Type | Mô tả | Frameworks |
|------|--------|-----------|
| **Site Templates** | Full multi-page websites | React, Next.js, Bootstrap, Tailwind |
| **Landing Pages** | Single-page conversion | HTML, React |
| **Admin Templates** | Dashboard/management | React, Vue, Angular |
| **Email Templates** | Newsletter/transactional | MJML, HTML |
| **CMS Templates** | WordPress, Shopify | PHP, Liquid |

---

## 5. Conversion Rate Optimization (CRO) Patterns

### 5.1 CTA Strategy

| Vị trí | Type | Best Practice |
|--------|------|---------------|
| **Hero** | Primary CTA | High contrast, action-oriented ("Start Free", "Get Quote") |
| **After features** | Secondary CTA | Contextual, softer ("Learn More", "See Pricing") |
| **Mid-page** | Banner CTA | Full-width, contrasting background |
| **After testimonials** | Reinforcement CTA | Repeats primary action |
| **Footer** | Final CTA | Last chance conversion |

### 5.2 Trust Signals (theo thứ tự ưu tiên)

1. **Star ratings** (visible above fold nếu có)
2. **Customer count** ("10,000+ businesses trust us")
3. **Press logos** (báo/tạp chí uy tín)
4. **Video testimonials** (mạnh nhất cho emotional connection)
5. **Case studies** (đặc biệt cho B2B/SaaS)
6. **Security badges** (SSL, payment logos cho ecommerce)
7. **Awards/certifications** (industry-specific)

### 5.3 Above-the-Fold Checklist (trong 600px đầu)

- [ ] Headline rõ ràng, problem-focused
- [ ] Subheadline giải thích value proposition
- [ ] Primary CTA button (high contrast)
- [ ] Visual element (image/video/illustration)
- [ ] Trust signal (rating hoặc customer count)
- [ ] Navigation không chiếm quá nhiều space

---

## 6. Gaps hiện tại của ECH Prime Web v2

### 6.1 Blocks CÓ rồi (56 block types) ✅

Navigation, Hero (12 variants), Features, Testimonials, FAQ, Contact, Gallery, Footer, Pricing, CTA, Stats, Team, Newsletter, Video, Blog-list, Products-grid, Menu-display, Booking-widget, Doctor-profile, Class-schedule, Property-card, Portfolio-grid, Before-after, Video-showcase, Review-cards, Feature-comparison, Social-proof, Logo-cloud, Gallery-masonry, etc.

### 6.2 Blocks/Components CẦN THÊM hoặc CẢI THIỆN

| Component | Priority | Lý do |
|-----------|----------|-------|
| **Trust Bar / Brag Bar** | P1 | Press logos + customer count ngay dưới hero — Wix có, mình chưa |
| **Announcement Bar** | P2 | Top banner cho promotions/news — Wix templates hay dùng |
| **Step Process** | P2 | "How it works" section — SaaS/service templates cần |
| **Client Logos** (enhanced) | P1 | Logo carousel với grayscale → color on hover |
| **Video Testimonials** | P2 | Embed video + quote — CRO mạnh hơn text testimonials |
| **Case Study Cards** | P2 | Project showcase với metrics — B2B/SaaS cần |
| **Map Integration** | P1 | Google Maps embed trong contact — real estate/restaurant cần |

### 6.3 SEO Gaps CẦN FIX

| Gap | Priority | Action |
|-----|----------|--------|
| **Heading hierarchy** | P0 | Verify H1 → H2 → H3 không skip, 1 H1/page |
| **JSON-LD Schema** | P0 | Organization, BreadcrumbList, FAQPage, LocalBusiness |
| **Image optimization** | P1 | WebP format, width/height attributes, lazy loading, srcset |
| **Meta tags** | P0 | Title (50-60 chars), description (150-160 chars) per page |
| **Canonical URLs** | P1 | Self-referencing canonical trên mọi page |
| **Semantic HTML** | P1 | `<main>`, `<article>`, `<nav>`, `<aside>`, `<section>` |
| **Core Web Vitals** | P1 | LCP < 2.5s, INP < 200ms, CLS < 0.1 |
| **Hreflang tags** | P2 | EN + MS multilingual support |

### 6.4 Animation Gaps

| Gap | Priority | Action |
|-----|----------|--------|
| **Scroll-triggered animations** | P1 | Fade-in, slide-up cho sections khi scroll tới |
| **Stagger animations** | P1 | Cards/features xuất hiện lần lượt |
| **Counter animation** | P1 | Stats block đếm từ 0 lên |
| **Parallax scrolling** | P2 | Hero background, section backgrounds |
| **Reduced motion** | P0 | `prefers-reduced-motion` respect cho accessibility |

---

## 7. Template Quality Checklist (dùng để đánh giá mỗi template)

### Visual Quality
- [ ] Hero ấn tượng, value proposition rõ trong 3 giây
- [ ] Color palette consistent xuyên suốt (6 tokens)
- [ ] Typography hierarchy rõ ràng (H1 > H2 > H3 > body)
- [ ] Spacing đều đặn, breathing room giữa sections
- [ ] Images chất lượng cao, không placeholder gray
- [ ] Dark mode support (nếu template dark)

### Content Quality
- [ ] Copy realistic, industry-specific (không generic "Lorem ipsum")
- [ ] Malaysian/SEA context (RM pricing, local names, local addresses)
- [ ] Bilingual ready (EN + MS)
- [ ] Industry jargon đúng (menu items cho restaurant, features cho SaaS)

### Technical Quality
- [ ] Responsive: test 375px, 768px, 1024px, 1280px
- [ ] Loading fast: hero render < 2.5s (LCP)
- [ ] No layout shift: images có width/height (CLS < 0.1)
- [ ] Semantic HTML: proper heading hierarchy
- [ ] Animations smooth: 60fps, respect reduced-motion
- [ ] Accessibility: alt text, focus states, keyboard nav

### SEO Quality
- [ ] 1 H1 per page
- [ ] Meta title + description set
- [ ] JSON-LD schema (Organization + BreadcrumbList minimum)
- [ ] Canonical URL set
- [ ] Images: alt text, WebP, lazy loading
- [ ] Internal links giữa pages

### Conversion Quality
- [ ] CTA visible above fold
- [ ] Trust signals present (testimonials, stats, logos)
- [ ] Clear conversion path (hero CTA → features → testimonials → pricing → CTA)
- [ ] Contact info accessible
- [ ] Mobile CTA thumb-friendly (48×48px minimum)

---

*Last updated: 2026-04-06*
*Sources: Wix.com, Envato Elements, Shopify, Unbounce, Google Web Vitals, Schema.org, SEO best practices 2026*
