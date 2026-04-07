# PRD: F30 — Sprint 3: Industry Blocks + Templates

> **Feature ID:** F30
> **Sprint:** 3 — Industry & Templates
> **Duration:** 5 days
> **Depends on:** Sprint 1 (Block Architecture v2)
> **Author:** PM
> **Date:** 2026-04-06
> **Status:** Draft

---

## 1. Overview

Sprint 3 delivers 8 industry-specific blocks, localized content files for 11 categories (Malaysian market), and a template composer system that seeds 50+ production-ready templates into the database. This sprint transforms ECH Prime Web from a generic website builder into an industry-aware platform where Malaysian business owners get templates pre-filled with realistic local content.

### 1.1 Goals

- Ship 8 new blocks that solve real industry pain points (menu display, booking, class schedule, etc.)
- Create Malaysian-localized content for all 11 template categories
- Build a template composer that programmatically generates 50+ templates from block + content combinations
- Generate thumbnail images for all templates
- Expand `POST /api/templates/seed` to handle 50+ templates with idempotent seeding

### 1.2 Success Metrics

| Metric | Target |
|--------|--------|
| New blocks available in editor | 8 |
| Templates in database after seeding | >= 50 |
| Categories with MY-localized content | 11 |
| Template thumbnails generated | >= 50 |
| Block render time (p95) | < 200ms |

---

## 2. User Stories

### US-F30-01: Restaurant Owner — Menu Display

**As a** restaurant owner in Malaysia,
**I want** a professional menu block with categories, prices in RM, and dietary icons,
**so that** my customers can browse my menu online before visiting.

**Acceptance Criteria:**

- AC-01: Given a `menu-display` block with 3 categories (Mains, Appetisers, Beverages), when rendered, then shows category tabs + items with RM prices + dietary icons (halal, vegetarian, spicy)
- AC-02: Given a menu item with `dietaryTags: ['halal', 'spicy']`, when rendered, then displays the corresponding icons next to the item name
- AC-03: Given a `menu-display` block with `variant: 'photo-grid'`, when rendered, then shows each item as a card with image, name, price, and description

### US-F30-02: Gym / Fitness Studio Owner — Class Schedule & Booking

**As a** gym owner in Kuala Lumpur,
**I want** a class schedule block and a booking widget on my website,
**so that** members can view available classes and book sessions online.

**Acceptance Criteria:**

- AC-04: Given a `class-schedule` block with 5 classes across Mon-Fri, when rendered, then shows a weekly timetable grid with class name, instructor, time, and capacity
- AC-05: Given a `class-schedule` block with a class at full capacity, when rendered, then shows "Full" badge and disables the "Book" button
- AC-06: Given a `booking-widget` block, when rendered, then shows date picker + service dropdown + available time slots
- AC-07: Given a `booking-widget` block with `services: [{ name: 'Personal Training', duration: 60, price: 'RM 150' }]`, when user selects date and service, then shows available time slots for that day

### US-F30-03: Clinic / Doctor — Profile & Reviews

**As a** clinic owner in Petaling Jaya,
**I want** to showcase my doctors' profiles and patient reviews on the website,
**so that** potential patients can find the right specialist and trust our clinic.

**Acceptance Criteria:**

- AC-08: Given a `doctor-profile` block with 3 doctors, when rendered, then shows each doctor's photo, name, specialisation, qualifications, and available days
- AC-09: Given a `doctor-profile` block with `variant: 'detailed'`, when rendered, then shows expandable bio section with languages spoken and consultation fees in RM
- AC-10: Given a `review-cards` block with 6 reviews, when rendered, then shows star rating (1-5), reviewer name, date, and review text in a responsive grid
- AC-11: Given a `review-cards` block with `showAverage: true`, when rendered, then displays aggregate rating (e.g., "4.8 out of 5 from 128 reviews") at the top

### US-F30-04: Agency / Creative — Video Showcase & Property Listing

**As a** creative agency owner in Bangsar,
**I want** a video showcase block to display my portfolio, and property cards for real estate clients,
**so that** potential clients can see my work quality and property agents can list properties.

**Acceptance Criteria:**

- AC-12: Given a `video-showcase` block with 4 videos, when rendered, then shows video thumbnails in a grid with play overlay, title, and category filter
- AC-13: Given a `video-showcase` block with `variant: 'featured'`, when rendered, then shows one large hero video with playlist sidebar
- AC-14: Given a `property-card` block with 6 properties, when rendered, then shows each property with image carousel, price (RM), location, bedrooms/bathrooms count, and area (sq ft)
- AC-15: Given a `property-card` block with `showMap: true`, when rendered, then displays a mini map pin icon linking to the Google Maps location
- AC-16: Given a `product-quick-view` block with 8 products, when rendered, then shows product grid with hover-to-preview, price in RM, and "Add to Cart" / "Quick View" buttons
- AC-17: Given a `product-quick-view` block with a product clicked, when modal opens, then shows product image gallery, description, variants (size/color), and price

---

## 3. Functional Requirements

### Phase 3.1: 8 New Industry Blocks (3 days)

#### FR-01: `menu-display` Block

Enhanced menu block (extends existing `menu-food` pattern) with:

- **Variants:** `tabs` | `photo-grid` | `accordion`
- **Props:**
  - `headline: string`
  - `subheadline?: string`
  - `categories: MenuDisplayCategory[]` — each with `name`, `description?`, `icon?`, `items: MenuDisplayItem[]`
  - `currency: string` (default `'RM'`)
  - `showDietaryIcons: boolean` (default `true`)
- **MenuDisplayItem:** `name`, `description?`, `price: string`, `originalPrice?: string` (for discounts), `imageUrl?`, `dietaryTags: ('halal' | 'vegetarian' | 'vegan' | 'spicy' | 'gluten-free')[]`, `isPopular?: boolean`, `isNew?: boolean`
- **Config file:** `src/blocks/menu-display/config.ts`
- **Zod schema:** `MenuDisplayConfigSchema` extending `BaseBlockSchema`
- **Meta:** `menuDisplayMeta` with `editableFields`, `quickActions`, `variants`

```typescript
// Type definition
export type MenuDisplayConfig = {
    blockType: 'menu-display'
    variant?: 'tabs' | 'photo-grid' | 'accordion'
    headline: string
    subheadline?: string
    categories: MenuDisplayCategory[]
    currency?: string
    showDietaryIcons?: boolean
}
```

#### FR-02: `booking-widget` Block

Embeddable booking form for service businesses:

- **Variants:** `inline` | `sidebar` | `modal-trigger`
- **Props:**
  - `headline: string`
  - `subheadline?: string`
  - `services: BookingService[]` — each with `name`, `duration` (minutes), `price: string`, `description?`
  - `availableDays: number[]` (0=Sun, 6=Sat, default `[1,2,3,4,5]`)
  - `timeSlotInterval: number` (minutes, default `30`)
  - `startTime: string` (HH:mm, default `'09:00'`)
  - `endTime: string` (HH:mm, default `'18:00'`)
  - `bookingUrl?: string` (external booking system URL)
  - `showPrice: boolean` (default `true`)
- **Config file:** `src/blocks/booking-widget/config.ts`

#### FR-03: `class-schedule` Block

Weekly timetable for gyms, yoga studios, dance schools:

- **Variants:** `grid` | `list` | `cards`
- **Props:**
  - `headline: string`
  - `classes: ScheduleClass[]` — each with `name`, `instructor`, `day` (0-6), `startTime`, `endTime`, `capacity`, `enrolled?`, `category?`, `level?: 'beginner' | 'intermediate' | 'advanced'`
  - `showCapacity: boolean` (default `true`)
  - `highlightToday: boolean` (default `true`)
- **Config file:** `src/blocks/class-schedule/config.ts`

#### FR-04: `review-cards` Block

Customer/patient reviews with star ratings:

- **Variants:** `grid` | `carousel` | `masonry`
- **Props:**
  - `headline: string`
  - `subheadline?: string`
  - `reviews: ReviewItem[]` — each with `name`, `rating` (1-5), `text`, `date?`, `avatar?`, `source?: 'google' | 'facebook' | 'manual'`, `verified?: boolean`
  - `showAverage: boolean` (default `true`)
  - `totalReviewCount?: number`
- **Config file:** `src/blocks/review-cards/config.ts`

#### FR-05: `video-showcase` Block

Video portfolio/gallery with filtering:

- **Variants:** `grid` | `featured` | `fullwidth`
- **Props:**
  - `headline: string`
  - `subheadline?: string`
  - `videos: VideoItem[]` — each with `title`, `thumbnailUrl?`, `videoUrl` (YouTube/Vimeo embed), `category?`, `duration?`, `description?`
  - `showCategories: boolean` (default `true`)
  - `autoplay: boolean` (default `false`)
- **Config file:** `src/blocks/video-showcase/config.ts`

#### FR-06: `doctor-profile` Block

Medical professional profiles for clinics/hospitals:

- **Variants:** `cards` | `detailed` | `list`
- **Props:**
  - `headline: string`
  - `subheadline?: string`
  - `doctors: DoctorItem[]` — each with `name`, `specialisation`, `qualifications: string[]`, `photoUrl?`, `availableDays: string[]`, `languages?: string[]`, `consultationFee?: string`, `bio?`
- **Config file:** `src/blocks/doctor-profile/config.ts`

#### FR-07: `property-card` Block

Property listings for real estate agents:

- **Variants:** `grid` | `list` | `featured`
- **Props:**
  - `headline: string`
  - `subheadline?: string`
  - `properties: PropertyItem[]` — each with `title`, `price: string`, `location`, `bedrooms`, `bathrooms`, `area: string`, `imageUrls: string[]`, `type: 'sale' | 'rent'`, `status?: 'available' | 'pending' | 'sold'`, `mapUrl?`, `description?`
  - `showMap: boolean` (default `false`)
  - `currency: string` (default `'RM'`)
- **Config file:** `src/blocks/property-card/config.ts`

#### FR-08: `product-quick-view` Block

E-commerce product grid with quick-view modal:

- **Variants:** `grid` | `carousel` | 'minimal'
- **Props:**
  - `headline: string`
  - `subheadline?: string`
  - `products: QuickViewProduct[]` — each with `name`, `price: string`, `originalPrice?`, `imageUrls: string[]`, `description?`, `variants?: { name: string, options: string[] }[]`, `badge?: 'new' | 'sale' | 'bestseller'`, `ctaLabel?: string`, `ctaUrl?`
  - `columns: 2 | 3 | 4` (default `4`)
  - `showQuickView: boolean` (default `true`)
  - `currency: string` (default `'RM'`)
- **Config file:** `src/blocks/product-quick-view/config.ts`

---

### Phase 3.2: Category Content Files (1 day)

#### FR-09: Malaysian Content Files for 11 Categories

Create content definition files under `src/lib/ai/content/` with realistic Malaysian data for each industry category. Each file exports a `CategoryContent` object:

```typescript
// src/lib/ai/content/types.ts
export type CategoryContent = {
    category: string
    locale: 'en-MY'
    businesses: BusinessSample[]   // 4-6 sample businesses per category
    testimonials: TestimonialSample[]
    faqItems: FAQSample[]
    industryBlocks: IndustryBlockSample[]  // pre-filled block configs
}

export type BusinessSample = {
    name: string          // e.g., "Warung Pak Ali"
    tagline: string
    description: string
    address: string       // Real Malaysian format: "No. 12, Jalan Bukit Bintang, 55100 KL"
    phone: string         // +60 format
    email: string
    heroHeadline: string
    heroSubheadline: string
}
```

**11 Category content files:**

| File | Category | Content Examples |
|------|----------|-----------------|
| `restaurant.ts` | restaurant | Nasi lemak RM 12, Roti canai RM 3, names: Ahmad, Siti, Aminah |
| `ecommerce.ts` | ecommerce | Baju kurung RM 89, Tudung RM 35, addresses: Jalan Tuanku Abdul Rahman |
| `beauty.ts` | beauty | Facial treatment RM 120, Manicure RM 45, names: Farah, Nurul |
| `tech.ts` | tech | SaaS pricing RM 99/mo, names: Wei Liang, Raj Kumar |
| `health.ts` | health | Consultation RM 80, dental cleaning RM 150, Dr. Tan, Dr. Aishah |
| `education.ts` | education | Tuition RM 200/mo, STEM camp RM 500, Cikgu Hafiz |
| `realestate.ts` | realestate | Condo RM 450,000, Semi-D RM 850,000, locations: Mont Kiara, Bangsar |
| `fitness.ts` | fitness | Gym membership RM 120/mo, Yoga class RM 35, Coach Amir |
| `creative.ts` | creative | Logo design RM 800, Web design RM 3,500, Studio Kreatif Nusantara |
| `business.ts` | business | Consulting RM 500/hr, names: Dato' Hassan, Puan Lim |
| `fnb.ts` | fnb (cafe/bakery) | Kopi O RM 3.50, Croissant RM 8, Kopitiam Ah Huat |

**Content requirements per file:**
- All prices in **RM** (Ringgit Malaysia) format — realistic market prices
- Malaysian names: mix of Malay (Ahmad, Siti, Aminah), Chinese (Wei Liang, Tan), Indian (Raj, Priya) names
- Malaysian addresses: real street naming conventions (Jalan, Lorong, Taman)
- Phone numbers: +60 format
- All text in English (en-MY locale) — natural Malaysian English style
- 4-6 sample businesses per category
- 3-5 testimonials per category
- 3-5 FAQ items per category
- Pre-filled industry block samples (e.g., restaurant content file includes `menu-display` block with nasi lemak, char kuey teow, etc.)

#### FR-10: Content Validator

`src/lib/ai/content/validator.ts` — validates all content files at build time:

- All prices match RM format (`RM X` or `RM X.XX` or `RM X,XXX`)
- All phone numbers match `+60` format
- All addresses contain Malaysian keywords (Jalan, Taman, Lorong, etc.)
- No placeholder text (`Lorem ipsum`, `TODO`, `XXX`)
- Each category has minimum required fields populated

---

### Phase 3.3: Template Composer + Seed 50 Templates + Thumbnails (1 day)

#### FR-11: Template Composer Algorithm

`src/lib/ai/template-composer.ts` — programmatically generates template configurations:

```typescript
export type ComposerInput = {
    category: string
    businessIndex: number      // which sample business to use
    blockSelection: string[]   // which blocks to include
    variant: 'starter' | 'professional' | 'premium'
    themePreset: ThemePreset
}

export function composeTemplate(input: ComposerInput): TemplateSeed {
    // 1. Load category content file
    // 2. Select business sample by index
    // 3. Build block array based on blockSelection
    // 4. Fill blocks with business-specific content
    // 5. Apply theme preset
    // 6. Generate multi-page layout (home + about + contact)
    // 7. Return TemplateSeed object
}
```

**Variant definitions:**

| Variant | Blocks Count | Pages | Features |
|---------|-------------|-------|----------|
| `starter` | 5-7 | 1 (home only) | nav, hero, features/services, testimonials, contact, footer |
| `professional` | 8-12 | 3 (home, about, contact) | + stats, gallery, FAQ, CTA, industry blocks |
| `premium` | 12-16 | 4-5 (+ products/blog) | + all industry blocks, pricing, team, newsletter |

**Theme presets** (at least 5 per category):

```typescript
export type ThemePreset = {
    name: string
    primaryColor: string
    secondaryColor: string
    fontHeading: string
    fontBody: string
    colorMode: 'light' | 'dark'
}
```

**Target: 50+ templates** distributed as:

| Category | Starter | Professional | Premium | Total |
|----------|---------|-------------|---------|-------|
| restaurant | 1 | 2 | 1 | 4 |
| ecommerce | 1 | 2 | 2 | 5 |
| beauty | 1 | 2 | 1 | 4 |
| tech | 1 | 2 | 2 | 5 |
| health | 1 | 2 | 1 | 4 |
| education | 1 | 2 | 1 | 4 |
| realestate | 1 | 2 | 1 | 4 |
| fitness | 1 | 2 | 1 | 4 |
| creative | 1 | 2 | 2 | 5 |
| business | 1 | 2 | 2 | 5 |
| fnb | 1 | 2 | 1 | 4 |
| **Total** | **11** | **22** | **15** | **~50** |

Premium templates: `isPremium: true` (Pro/Business plans only).

#### FR-12: Seed API Enhancement

Update `POST /api/templates/seed` to handle 50+ templates:

- **Batch creation** — use `Promise.allSettled()` for parallel seeding (batches of 10)
- **Progress tracking** — return partial results if some fail
- **Validation** — validate each template against `TemplateSeed` schema before insertion
- **Deduplication** — skip templates that already exist (match by `name`)
- **Response shape:**

```json
{
    "success": true,
    "data": {
        "total": 52,
        "created": 50,
        "skipped": 2,
        "failed": 0,
        "templates": [{ "id": "...", "name": "...", "status": "created" }]
    }
}
```

#### FR-13: Template Thumbnails

Generate preview thumbnails for all templates:

- **Size:** 1200x800px (OG image compatible)
- **Format:** WebP (with PNG fallback)
- **Storage:** Upload to Payload media collection, link to template `thumbnail` field
- **Generation method:** Script that renders each template's home page blocks to HTML, captures screenshot via Playwright, uploads to media
- **Script:** `scripts/generate-thumbnails.ts`
- **CLI:** `npx tsx scripts/generate-thumbnails.ts --category=restaurant` (or `--all`)

---

## 4. Non-Functional Requirements

### NFR-01: Block Render Performance

Each new block MUST render in < 200ms (p95) on a mid-range mobile device (Moto G Power equivalent). Blocks must use lazy loading for images and defer non-critical JavaScript.

### NFR-02: Bundle Size Impact

All 8 new blocks combined MUST NOT increase the main JavaScript bundle by more than 50KB (gzipped). Each block component should be dynamically imported (`next/dynamic`) and only loaded when present on the page.

### NFR-03: Zod Schema Validation

Every block config MUST have a corresponding Zod schema that validates all props. AI-generated block content MUST pass schema validation before being saved to the database. Invalid blocks should be rejected with descriptive error messages.

### NFR-04: Content Localization Accuracy

All Malaysian content MUST use:
- Correct RM pricing (realistic market prices, not random numbers)
- Valid Malaysian phone format (`+60 1X-XXX XXXX` or `+60 3-XXXX XXXX`)
- Real Malaysian naming conventions (Malay, Chinese, Indian mix)
- Actual Malaysian locations and address formats
- Content reviewed by Malaysian team member before merge

### NFR-05: Seed API Reliability

`POST /api/templates/seed` MUST:
- Complete within 30 seconds for 50+ templates
- Be idempotent — running twice should not create duplicates
- Handle partial failures gracefully (create as many as possible, report failures)
- Work on both local development and staging/production environments

### NFR-06: Accessibility

All new blocks MUST meet WCAG 2.1 AA:
- Proper heading hierarchy (h2/h3 within blocks)
- Alt text on all images
- Keyboard navigable tabs/filters
- Color contrast ratio >= 4.5:1 for text
- ARIA labels on interactive elements (date picker, dropdowns)

### NFR-07: Responsive Design

All new blocks MUST render correctly on:
- Mobile: 320px - 767px (single column, stacked layout)
- Tablet: 768px - 1023px (2-column where applicable)
- Desktop: 1024px+ (full layout with all columns)

---

## 5. Technical Specification

### 5.1 Block Registration

Each new block must be registered in `src/blocks/types.ts`:

```typescript
// Add to BLOCK_TYPES array
export const BLOCK_TYPES = [
    // ... existing blocks ...
    // v2.0 — Industry Blocks
    'menu-display', 'booking-widget', 'class-schedule', 'review-cards',
    'video-showcase', 'doctor-profile', 'property-card', 'product-quick-view',
] as const
```

### 5.2 Block File Structure

Each block follows the established pattern:

```
src/blocks/{block-name}/
├── config.ts          # Type, Zod schema, BlockMeta
├── renderer.tsx       # React component (SSR-safe)
└── index.ts           # Re-exports
```

### 5.3 Content File Structure

```
src/lib/ai/content/
├── types.ts           # CategoryContent, BusinessSample types
├── validator.ts       # Build-time validation
├── restaurant.ts
├── ecommerce.ts
├── beauty.ts
├── tech.ts
├── health.ts
├── education.ts
├── realestate.ts
├── fitness.ts
├── creative.ts
├── business.ts
├── fnb.ts
└── index.ts           # Re-exports all + categoryMap
```

### 5.4 Template Composer Flow

```
                          ┌───────────────┐
                          │  Category     │
                          │  Content File │
                          └──────┬────────┘
                                 │
┌───────────┐           ┌───────▼────────┐           ┌──────────────┐
│ ComposerInput │──────▶│  composeTemplate() │──────▶│ TemplateSeed │
│ (category,    │       │                    │       │ (name, blocks,│
│  variant,     │       │ 1. Load content    │       │  theme, pages)│
│  theme)       │       │ 2. Select business │       └──────┬───────┘
└───────────┘           │ 3. Build blocks    │              │
                        │ 4. Apply theme     │     ┌────────▼────────┐
                        │ 5. Multi-page      │     │ Payload.create() │
                        └────────────────────┘     │ → DB template   │
                                                   └─────────────────┘
```

### 5.5 Malaysian Content Examples

**Restaurant (`restaurant.ts`):**

```typescript
export const restaurantContent: CategoryContent = {
    category: 'restaurant',
    locale: 'en-MY',
    businesses: [
        {
            name: 'Warung Pak Ali',
            tagline: 'Authentic Kampung Flavours Since 1985',
            description: 'Family-run restaurant serving traditional Malay cuisine...',
            address: 'No. 23, Jalan Tun Razak, 50400 Kuala Lumpur',
            phone: '+60 12-345 6789',
            email: 'info@warungpakali.my',
            heroHeadline: 'Taste the Heart of Malaysian Cuisine',
            heroSubheadline: 'From our kampung kitchen to your table — halal, fresh, unforgettable.',
        },
        // ... 3-5 more
    ],
    industryBlocks: [
        {
            blockType: 'menu-display',
            variant: 'tabs',
            headline: 'Our Menu',
            currency: 'RM',
            showDietaryIcons: true,
            categories: [
                {
                    name: 'Nasi & Rice',
                    items: [
                        { name: 'Nasi Lemak Special', price: '12.00', dietaryTags: ['halal'], isPopular: true,
                          description: 'Coconut rice with sambal, ikan bilis, peanuts, egg & rendang' },
                        { name: 'Nasi Goreng Kampung', price: '10.00', dietaryTags: ['halal', 'spicy'] },
                        { name: 'Nasi Kerabu', price: '14.00', dietaryTags: ['halal'] },
                    ],
                },
                {
                    name: 'Roti & Breads',
                    items: [
                        { name: 'Roti Canai', price: '3.00', dietaryTags: ['halal', 'vegetarian'] },
                        { name: 'Roti Telur', price: '4.50', dietaryTags: ['halal'] },
                        { name: 'Murtabak Ayam', price: '8.00', dietaryTags: ['halal'] },
                    ],
                },
                {
                    name: 'Beverages',
                    items: [
                        { name: 'Teh Tarik', price: '3.50', dietaryTags: ['halal', 'vegetarian'] },
                        { name: 'Kopi O', price: '3.00', dietaryTags: ['halal', 'vegetarian'] },
                        { name: 'Air Bandung', price: '4.00', dietaryTags: ['halal', 'vegetarian'] },
                    ],
                },
            ],
        },
    ],
    // ... testimonials, faqItems
}
```

**Real Estate (`realestate.ts`):**

```typescript
// Property card sample
{
    blockType: 'property-card',
    headline: 'Featured Properties',
    currency: 'RM',
    properties: [
        {
            title: 'Sunway Mont Residences',
            price: '680,000',
            location: 'Mont Kiara, Kuala Lumpur',
            bedrooms: 3,
            bathrooms: 2,
            area: '1,200 sq ft',
            type: 'sale',
            status: 'available',
        },
        {
            title: 'Bangsar South Condo',
            price: '2,800/month',
            location: 'Bangsar South, Kuala Lumpur',
            bedrooms: 2,
            bathrooms: 1,
            area: '850 sq ft',
            type: 'rent',
            status: 'available',
        },
    ],
}
```

**Health / Clinic (`health.ts`):**

```typescript
// Doctor profile sample
{
    blockType: 'doctor-profile',
    headline: 'Our Specialists',
    doctors: [
        {
            name: 'Dr. Aishah binti Mohd Yusof',
            specialisation: 'General Practitioner',
            qualifications: ['MBBS (UM)', 'MRCGP (UK)'],
            availableDays: ['Monday', 'Wednesday', 'Friday'],
            languages: ['Malay', 'English'],
            consultationFee: 'RM 80',
            bio: '15 years of clinical experience in family medicine.',
        },
        {
            name: 'Dr. Tan Wei Ming',
            specialisation: 'Dental Surgeon',
            qualifications: ['BDS (USM)', 'FDSRCS (Edinburgh)'],
            availableDays: ['Tuesday', 'Thursday', 'Saturday'],
            languages: ['English', 'Mandarin', 'Malay'],
            consultationFee: 'RM 60',
        },
    ],
}
```

---

## 6. Block Props Reference (Full TypeScript)

### `menu-display`

```typescript
export type MenuDisplayItem = {
    name: string
    description?: string
    price: string
    originalPrice?: string
    imageUrl?: string
    dietaryTags?: ('halal' | 'vegetarian' | 'vegan' | 'spicy' | 'gluten-free')[]
    isPopular?: boolean
    isNew?: boolean
}

export type MenuDisplayCategory = {
    name: string
    description?: string
    icon?: string
    items: MenuDisplayItem[]
}

export type MenuDisplayConfig = {
    blockType: 'menu-display'
    variant?: 'tabs' | 'photo-grid' | 'accordion'
    headline: string
    subheadline?: string
    categories: MenuDisplayCategory[]
    currency?: string
    showDietaryIcons?: boolean
}
```

### `booking-widget`

```typescript
export type BookingService = {
    name: string
    duration: number  // minutes
    price: string
    description?: string
}

export type BookingWidgetConfig = {
    blockType: 'booking-widget'
    variant?: 'inline' | 'sidebar' | 'modal-trigger'
    headline: string
    subheadline?: string
    services: BookingService[]
    availableDays?: number[]
    timeSlotInterval?: number
    startTime?: string
    endTime?: string
    bookingUrl?: string
    showPrice?: boolean
}
```

### `class-schedule`

```typescript
export type ScheduleClass = {
    name: string
    instructor: string
    day: number       // 0=Sun, 6=Sat
    startTime: string // HH:mm
    endTime: string   // HH:mm
    capacity: number
    enrolled?: number
    category?: string
    level?: 'beginner' | 'intermediate' | 'advanced'
}

export type ClassScheduleConfig = {
    blockType: 'class-schedule'
    variant?: 'grid' | 'list' | 'cards'
    headline: string
    classes: ScheduleClass[]
    showCapacity?: boolean
    highlightToday?: boolean
}
```

### `review-cards`

```typescript
export type ReviewItem = {
    name: string
    rating: number    // 1-5
    text: string
    date?: string
    avatar?: string
    source?: 'google' | 'facebook' | 'manual'
    verified?: boolean
}

export type ReviewCardsConfig = {
    blockType: 'review-cards'
    variant?: 'grid' | 'carousel' | 'masonry'
    headline: string
    subheadline?: string
    reviews: ReviewItem[]
    showAverage?: boolean
    totalReviewCount?: number
}
```

### `video-showcase`

```typescript
export type VideoItem = {
    title: string
    thumbnailUrl?: string
    videoUrl: string
    category?: string
    duration?: string
    description?: string
}

export type VideoShowcaseConfig = {
    blockType: 'video-showcase'
    variant?: 'grid' | 'featured' | 'fullwidth'
    headline: string
    subheadline?: string
    videos: VideoItem[]
    showCategories?: boolean
    autoplay?: boolean
}
```

### `doctor-profile`

```typescript
export type DoctorItem = {
    name: string
    specialisation: string
    qualifications: string[]
    photoUrl?: string
    availableDays: string[]
    languages?: string[]
    consultationFee?: string
    bio?: string
}

export type DoctorProfileConfig = {
    blockType: 'doctor-profile'
    variant?: 'cards' | 'detailed' | 'list'
    headline: string
    subheadline?: string
    doctors: DoctorItem[]
}
```

### `property-card`

```typescript
export type PropertyItem = {
    title: string
    price: string
    location: string
    bedrooms: number
    bathrooms: number
    area: string
    imageUrls?: string[]
    type: 'sale' | 'rent'
    status?: 'available' | 'pending' | 'sold'
    mapUrl?: string
    description?: string
}

export type PropertyCardConfig = {
    blockType: 'property-card'
    variant?: 'grid' | 'list' | 'featured'
    headline: string
    subheadline?: string
    properties: PropertyItem[]
    showMap?: boolean
    currency?: string
}
```

### `product-quick-view`

```typescript
export type QuickViewProduct = {
    name: string
    price: string
    originalPrice?: string
    imageUrls?: string[]
    description?: string
    variants?: { name: string; options: string[] }[]
    badge?: 'new' | 'sale' | 'bestseller'
    ctaLabel?: string
    ctaUrl?: string
}

export type ProductQuickViewConfig = {
    blockType: 'product-quick-view'
    variant?: 'grid' | 'carousel' | 'minimal'
    headline: string
    subheadline?: string
    products: QuickViewProduct[]
    columns?: 2 | 3 | 4
    showQuickView?: boolean
    currency?: string
}
```

---

## 7. Risks & Mitigations

### Risk 1: Block count increases bundle size significantly

**Impact:** High — affects page load performance for all users
**Likelihood:** Medium
**Mitigation:** All 8 blocks use `next/dynamic` with `ssr: false` where possible. Block renderer lazy-loads each block component only when the block type is present on the page. Run Lighthouse CI check before merge. Bundle budget: max 50KB gzipped for all 8 combined.

### Risk 2: Content localization inaccuracies

**Impact:** Medium — incorrect prices/names reduce credibility with Malaysian users
**Likelihood:** Medium
**Mitigation:** Content validator script runs in CI. Malaysian team member reviews content files before merge. Use real-world price references (GrabFood, PropertyGuru, Google Maps listings).

### Risk 3: Template seeding timeout on production

**Impact:** Medium — seed API may timeout with 50+ templates on slower DB connections
**Likelihood:** Low
**Mitigation:** Batch seeding in groups of 10 with `Promise.allSettled()`. Add 30-second timeout to API route. Implement deduplication to allow re-running without duplicates. Add progress callback for monitoring.

### Risk 4: Thumbnail generation dependency on Playwright

**Impact:** Low — thumbnails are non-blocking for template functionality
**Likelihood:** Medium
**Mitigation:** Thumbnail generation is a separate offline script, not part of seed API. Templates work without thumbnails (fallback to category placeholder image). Can run thumbnails generation on local machine and upload to staging.

---

## 8. Dependencies

| Dependency | Type | Status |
|------------|------|--------|
| Sprint 1 (Block Architecture v2) | Sprint | Must be complete |
| `BaseBlockSchema` + `BlockMeta` types | Code | Exists (`src/blocks/types.ts`) |
| `TemplateSeed` interface | Code | Exists (`src/lib/ai/seed-templates.ts`) |
| Template collection schema | Code | Exists (`src/collections/Templates.ts`) |
| Seed API endpoint | Code | Exists (`src/app/api/templates/seed/route.ts`) |
| Payload media collection | Code | Exists (for thumbnail uploads) |
| Playwright | Dev dependency | Required for thumbnail generation only |

---

## 9. Acceptance Checklist

### Development DoD

- [ ] All 8 blocks have `config.ts` with TypeScript types + Zod schema + BlockMeta
- [ ] All 8 blocks have `renderer.tsx` with responsive layout
- [ ] All 8 block types registered in `BLOCK_TYPES` array
- [ ] 11 content files created with realistic Malaysian data
- [ ] Content validator passes for all files
- [ ] Template composer generates 50+ unique templates
- [ ] Seed API handles 50+ templates with deduplication
- [ ] Thumbnails generated for all templates
- [ ] Unit tests for each block config schema validation
- [ ] Unit tests for template composer
- [ ] No TypeScript errors (`tsc --noEmit`)
- [ ] No lint errors

### QC Acceptance

- [ ] Each block renders correctly in AI Editor preview
- [ ] All blocks responsive on mobile/tablet/desktop
- [ ] Template gallery shows 50+ templates with thumbnails
- [ ] Seed API idempotent — running twice yields same result
- [ ] Malaysian content is realistic and culturally appropriate
- [ ] Block performance < 200ms render time

---

## 10. Timeline

| Day | Phase | Deliverables |
|-----|-------|-------------|
| Day 1 | 3.1 | `menu-display`, `booking-widget`, `class-schedule` blocks |
| Day 2 | 3.1 | `review-cards`, `video-showcase`, `doctor-profile` blocks |
| Day 3 | 3.1 | `property-card`, `product-quick-view` blocks + block tests |
| Day 4 | 3.2 | 11 content files + validator + content review |
| Day 5 | 3.3 | Template composer + seed 50 templates + thumbnails |

---

## 11. Appendix

### A. Category → Industry Block Mapping

| Category | Primary Industry Blocks | Generic Blocks |
|----------|------------------------|----------------|
| restaurant | `menu-display`, `review-cards` | hero, gallery, contact, footer |
| ecommerce | `product-quick-view`, `review-cards` | hero, features, pricing, footer |
| beauty | `booking-widget`, `review-cards` | hero, service-cards, gallery, footer |
| tech | `video-showcase`, `review-cards` | hero, features, pricing, FAQ, footer |
| health | `doctor-profile`, `booking-widget`, `review-cards` | hero, features, contact, footer |
| education | `class-schedule`, `review-cards` | hero, features, team, FAQ, footer |
| realestate | `property-card`, `review-cards` | hero, stats, contact, footer |
| fitness | `class-schedule`, `booking-widget`, `review-cards` | hero, pricing, gallery, footer |
| creative | `video-showcase`, `review-cards` | hero, portfolio-grid, team, footer |
| business | `review-cards`, `video-showcase` | hero, features, stats, team, footer |
| fnb | `menu-display`, `review-cards` | hero, gallery, contact, footer |

### B. Theme Presets (sample)

```typescript
const THEME_PRESETS: Record<string, ThemePreset[]> = {
    restaurant: [
        { name: 'Warm Spice', primaryColor: '#D97706', secondaryColor: '#DC2626', fontHeading: 'Playfair Display', fontBody: 'Lato', colorMode: 'dark' },
        { name: 'Fresh Garden', primaryColor: '#059669', secondaryColor: '#D97706', fontHeading: 'Poppins', fontBody: 'Open Sans', colorMode: 'light' },
        { name: 'Modern Dine', primaryColor: '#1E293B', secondaryColor: '#F59E0B', fontHeading: 'Inter', fontBody: 'Inter', colorMode: 'light' },
    ],
    health: [
        { name: 'Clinical Blue', primaryColor: '#0284C7', secondaryColor: '#0D9488', fontHeading: 'Inter', fontBody: 'Open Sans', colorMode: 'light' },
        { name: 'Calm Care', primaryColor: '#4F46E5', secondaryColor: '#06B6D4', fontHeading: 'Outfit', fontBody: 'Inter', colorMode: 'light' },
    ],
    fitness: [
        { name: 'Power Red', primaryColor: '#DC2626', secondaryColor: '#F97316', fontHeading: 'Oswald', fontBody: 'Roboto', colorMode: 'dark' },
        { name: 'Energy Green', primaryColor: '#16A34A', secondaryColor: '#FACC15', fontHeading: 'Montserrat', fontBody: 'Open Sans', colorMode: 'dark' },
    ],
    // ... more presets per category
}
```
