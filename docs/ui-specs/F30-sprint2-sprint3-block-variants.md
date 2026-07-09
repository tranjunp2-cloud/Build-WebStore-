# UI Design Specs: F30 — Template System v2 Sprint 2 + Sprint 3

> **Feature:** F30 — Block Variant Expansion (Sprint 2) + Industry Blocks (Sprint 3)
> **PRD refs:** `docs/prd/F30-sprint2-variants.md`, `docs/prd/F30-sprint3-industry.md`
> **Created:** 2026-04-06
> **Stack:** Next.js 15 + Tailwind CSS + shadcn/ui + Framer Motion
> **Design tokens:** `ThemeConfig` (primaryColor, secondaryColor, backgroundColor, fontHeading, fontBody, colorMode)

---

## 1. Screen List

| # | Screen | Route | Description | US Ref |
|---|--------|-------|-------------|--------|
| 1 | Site Renderer (Public) | `/{domain}/*` | Renders all blocks for visitors | US-F30-01, US-F30-03 |
| 2 | Visual Builder/Editor | `/dashboard/sites/{id}/editor` | Admin swaps variant, edits content | US-F30-02 |
| 3 | Variant Selector Panel | (Editor sidebar panel) | Browse + swap variants with thumbnails | US-F30-02 |
| 4 | AI Builder | `/dashboard/sites/new` | Auto-generates site, selects variants | US-F30-01 |
| 5 | Template Gallery | `/dashboard/templates` | Browse 50+ templates by category | Sprint 3 FR-11 |
| 6 | Template Preview | `/dashboard/templates/{id}/preview` | Full preview of a template | Sprint 3 FR-11 |

---

## 2. Screen Flows

```
AI Builder (auto-select variants)
    │
    ▼
Site Renderer ◄──── Template Gallery → Template Preview → "Use Template"
    │                                                          │
    ▼                                                          ▼
Visual Builder/Editor                                   Site Renderer (pre-filled)
    │
    ├── Click block → Block Settings Panel
    │       │
    │       └── "Change Variant" → Variant Selector Panel
    │                                   │
    │                                   └── Select variant → Content preserved → Preview updates
    │
    └── Add Block → Block Picker (includes 8 new industry blocks)
```

**Key Flows:**
1. **Visitor browsing** — Site Renderer renders blocks sequentially (nav → hero → sections → footer)
2. **Owner editing** — Click block → sidebar shows variant selector → swap with content preserved
3. **AI generation** — AI Builder selects optimal variant per industry → Site Renderer renders result
4. **Template browsing** — Gallery grid → click template → full preview → "Use" creates site clone

---

## 3. Component Hierarchy

### 3.1 Block Architecture Pattern (shared by ALL blocks)

```
BlockRenderer (src/blocks/registry.ts)
├── ErrorBoundary
│   └── {BlockType}Block (src/blocks/{name}/index.tsx)
│       ├── variant === 'variant-a' → VariantA layout
│       ├── variant === 'variant-b' → VariantB layout
│       └── variant === 'variant-c' → VariantC layout
│
├── Props: BlockProps<T>
│   ├── block: T & BaseBlockConfig (blockType, variant, isVisible, sortOrder)
│   ├── theme: ThemeConfig (primaryColor, secondaryColor, fontHeading, fontBody, colorMode)
│   └── site: SiteData (contactInfo, socialLinks, branding)
│
└── Config: src/blocks/{name}/config.ts
    ├── {Name}Config (TypeScript type)
    ├── {Name}ConfigSchema (Zod)
    └── {name}Meta (BlockMeta: variants[], editableFields[], quickActions[])
```

### 3.2 Sprint 2 — 34 New Variants (8 block families)

#### Hero Block (7 new → 12 total)

```
HeroBlock (src/blocks/hero/index.tsx)
├── [existing] centered, split-left, split-right, fullscreen, video
│
├── magazine
│   ├── Container (grid grid-cols-5 gap-8)
│   ├── ImageColumn (col-span-3, parallax via CSS transform)
│   │   └── <Image> with primaryColor border (20% opacity)
│   └── ContentColumn (col-span-2)
│       ├── Badge (optional)
│       ├── Headline (fontHeading, 4xl→6xl)
│       ├── Subheadline (fontBody, muted)
│       └── CTAButtons[]
│
├── minimal
│   ├── Container (text-center, max-w-4xl mx-auto, py-32)
│   ├── Background (radial-gradient from primaryColor at 5%)
│   ├── Headline (fontHeading, 6xl→8xl)
│   ├── Subheadline (fontBody, text-muted)
│   └── CTAButton (single, centered)
│
├── cards-overlay
│   ├── BackgroundImage (full-width, object-cover)
│   ├── Overlay (bg-black/{overlayOpacity})
│   └── GlassCard (backdrop-blur-xl, bg-white/10, rounded-2xl, p-8)
│       ├── Badge
│       ├── Headline
│       ├── Subheadline
│       └── CTAButtons[]
│
├── gradient
│   ├── AnimatedGradientBg (CSS @keyframes, 3 hue-shifted colors from primaryColor, 8s infinite)
│   ├── Headline (text-white, fontHeading)
│   ├── Subheadline (text-white/70)
│   └── CTAButtons[] (glass style: bg-white/10 backdrop-blur)
│
├── parallax
│   ├── BackgroundImage (background-attachment: fixed on desktop, static on mobile)
│   ├── GradientOverlay (from transparent to black/60 at bottom)
│   ├── Headline (text-white, centered)
│   └── CTAButtons[]
│
├── slideshow
│   ├── ImageCarousel (auto-advance 5s, crossfade transition)
│   │   ├── images[] (preload current + next only)
│   │   └── DotIndicators (primaryColor active dot)
│   ├── ContentOverlay (centered)
│   │   ├── Headline
│   │   ├── Subheadline
│   │   └── CTAButtons[]
│   └── Fallback: single image if images[] empty
│
└── split-video
    ├── Container (grid grid-cols-2 gap-8)
    ├── ContentColumn
    │   ├── Headline
    │   ├── Subheadline
    │   └── CTAButtons[]
    └── VideoColumn
        ├── <video> (autoPlay muted loop, rounded-xl)
        └── PlayPauseToggle (absolute overlay, primaryColor accent)
```

#### Features Block (4 new → 8 total)

```
FeaturesBlock (src/blocks/features/index.tsx)
├── [existing] grid-2, grid-3, grid-4, list
│
├── icon-top
│   └── Grid (3-col desktop, 1-col mobile)
│       └── FeatureCard (border, hover:shadow-lg, hover:translate-y-[-2px])
│           ├── Icon (48px, centered, primaryColor bg at 10%, rounded-full)
│           ├── Title (fontHeading, font-semibold)
│           └── Description (fontBody, text-muted)
│
├── icon-left
│   └── Stack (full-width rows, gap-6)
│       └── FeatureRow (flex, gap-4)
│           ├── IconCircle (48px, primaryColor bg at 10%, rounded-full, shrink-0)
│           └── Content
│               ├── Title (fontHeading, font-semibold)
│               └── Description (fontBody)
│
├── zigzag
│   └── Stack (gap-16 or gap-24)
│       └── FeatureSection (grid grid-cols-2, even:reverse on desktop, stack on mobile)
│           ├── ContentSide
│           │   ├── Icon
│           │   ├── Title
│           │   └── Description
│           └── IllustrationSide (icon enlarged or decorative visual)
│
└── carousel
    └── Container (overflow-x-auto, snap-x snap-mandatory)
        ├── FeatureCard[] (w-[300px], snap-start, shrink-0)
        │   ├── Icon
        │   ├── Title
        │   └── Description
        ├── NavArrows (desktop only, left/right absolute)
        └── DotIndicators (mobile)
```

#### Testimonials Block (5 new → 8 total)

```
TestimonialsBlock (src/blocks/testimonials/index.tsx)
├── [existing] cards, carousel, simple
│
├── masonry
│   └── MasonryGrid (CSS columns: 2 mobile, 3 desktop)
│       └── TestimonialCard (break-inside-avoid, mb-4)
│           ├── QuoteText (variable height)
│           ├── StarRating (1-5 stars, primaryColor fill)
│           ├── Avatar (rounded-full, 40px)
│           └── NameTitle
│
├── spotlight
│   └── Container (relative, flex items-center)
│       ├── SmallCard (left, cursor-pointer, hover:scale-105)
│       ├── SpotlightCard (center, lg:scale-110, border-primaryColor)
│       │   ├── LargeQuote
│       │   ├── LargeAvatar (64px)
│       │   └── NameTitle (prominent)
│       └── SmallCard (right, cursor-pointer, hover:scale-105)
│       └── onClick: swap small → spotlight with Framer Motion layoutId
│
├── minimal-quote
│   └── Container (text-center, max-w-3xl)
│       ├── DecorativeQuoteMark (text-9xl, primaryColor at 20%)
│       ├── QuoteText (text-xl, italic, serif font)
│       ├── NameTitle
│       └── AutoRotate (6s interval, fade transition, pause on hover)
│
├── avatar-row
│   └── Container
│       ├── AvatarRow (flex, gap-3, justify-center)
│       │   └── Avatar[] (rounded-full, 56px, cursor-pointer)
│       │       └── Active: ring-2 ring-primaryColor
│       └── TestimonialContent (slide-down animation on avatar click)
│           ├── QuoteText
│           ├── StarRating
│           └── NameTitle
│
└── video-text
    └── Container (grid grid-cols-2, stack on mobile)
        ├── VideoSide
        │   ├── VideoThumbnail (aspect-video, rounded-xl)
        │   └── PlayIcon (centered overlay, primaryColor)
        │   └── Fallback: Avatar display if no videoUrl
        └── TextSide
            ├── QuoteText
            ├── StarRating
            └── NameTitle
```

#### Pricing Block (6 new → 8 total)

```
PricingBlock (src/blocks/pricing/index.tsx)
├── [existing] cards, table
│
├── horizontal
│   └── Stack (gap-4)
│       └── PlanRow (flex, justify-between, items-center, p-6, border)
│           ├── PlanName (fontHeading)
│           ├── Price (text-2xl, fontHeading)
│           ├── FeatureChips (flex-wrap, gap-2, badge style)
│           ├── CTAButton
│           └── Highlighted: border-l-4 border-primaryColor
│
├── toggle
│   └── Container
│       ├── ToggleSwitch (role="switch", aria-checked, primaryColor track)
│       │   ├── "Monthly" label
│       │   └── "Yearly" label + DiscountBadge ("Save 20%")
│       └── PlanCards (grid grid-cols-3)
│           └── PlanCard (animate price change on toggle)
│
├── tiered
│   └── Stack (gap-6, items-center)
│       ├── BasicTier (minimal card, border-muted)
│       ├── ProTier (elevated, border-primaryColor, shadow-md)
│       └── EnterpriseTier (largest, gradient primaryColor bg, text-white)
│
├── comparison
│   └── ComparisonTable (overflow-x-auto on mobile)
│       ├── TableHeader (plan columns, highlighted col = primaryColor header)
│       └── TableBody
│           └── FeatureRow[]
│               ├── FeatureName
│               └── PlanCell[] (checkmark / dash / text)
│
├── minimal
│   └── Grid (grid-cols-3 desktop, 1-col mobile)
│       └── PlanCard (text-center, spacious p-12)
│           ├── PlanName
│           ├── Price (text-4xl)
│           ├── Description
│           ├── CTAButton
│           └── AccordionFeatures (collapsed by default, click to expand)
│
└── slider
    └── Container (relative, overflow-hidden)
        ├── PlanCard (centered, w-full max-w-lg mx-auto)
        │   ├── PlanName, Price, Description
        │   ├── Features[]
        │   └── CTAButton
        ├── NavArrows (left/right, absolute)
        └── DotIndicators
```

#### Gallery Block (3 new → 6 total)

```
GalleryBlock (src/blocks/gallery/index.tsx)
├── [existing] grid, masonry, carousel
│
├── lightbox
│   ├── Grid (same as existing grid)
│   │   └── ImageCard[] (cursor-pointer, hover:scale-[1.02])
│   └── LightboxOverlay (React.lazy / next/dynamic)
│       ├── Backdrop (bg-black/90, onClick: close)
│       ├── MainImage (max-w/max-h constrained)
│       ├── Caption (bottom)
│       ├── PrevButton / NextButton
│       ├── CloseButton (top-right, primaryColor accent)
│       └── Keyboard: ArrowLeft/ArrowRight/Escape
│       └── Focus trap while open
│
├── filmstrip
│   └── Container
│       ├── MainImage (aspect-video or aspect-[4/3], rounded-xl)
│       │   └── Caption (overlay bottom)
│       └── ThumbnailStrip (overflow-x-auto, flex, gap-2, snap-x)
│           └── Thumbnail[] (w-20 h-20, cursor-pointer, object-cover)
│               └── Active: ring-2 ring-primaryColor
│
└── justified
    └── JustifiedGrid (CSS flexbox row-wrap, each row fills 100% width)
        └── ImageItem[] (flex-grow based on aspect ratio)
            └── Hover: 2px gap reveal + primaryColor tint overlay
```

#### Footer Block (3 new → 6 total)

```
FooterBlock (src/blocks/footer/index.tsx)
├── [existing] simple, expanded, minimal
│
├── centered-stack
│   └── Container (text-center, py-16)
│       ├── Logo (mx-auto)
│       ├── LinkGroups (flex-wrap, justify-center, horizontal lists)
│       ├── SocialIcons (flex, gap-4, justify-center, hover: primaryColor)
│       └── Copyright
│
├── mega-footer
│   └── Container
│       ├── TopBand (bg-primaryColor or newsletter CTA, full-width)
│       │   └── NewsletterForm or CTA text + button
│       ├── LinkGrid (grid grid-cols-4/5, gap-8, py-12)
│       │   └── LinkColumn[] (heading + ul)
│       └── BottomBar (flex justify-between, border-t, py-4)
│           ├── Copyright
│           ├── SocialIcons
│           └── LegalLinks
│
└── dark-gradient
    └── Container (bg-gradient from transparent to dark)
        └── InnerLayout (flex justify-between on desktop, stack on mobile)
            ├── LogoTagline (logo + tagline text)
            ├── LinkColumns (grid grid-cols-2/3)
            └── SocialIcons
```

#### Contact Block (3 new → 6 total)

```
ContactBlock (src/blocks/contact/index.tsx)
├── [existing] form, info-only, split
│
├── card-float
│   └── Container (bg-gradient subtle from primaryColor at 5%)
│       ├── FloatingCard (bg-white shadow-xl rounded-2xl p-8 mx-auto max-w-xl)
│       │   └── ContactForm (fields from formFields[])
│       └── ContactChips (flex, gap-4, justify-center, icon + text)
│           ├── EmailChip, PhoneChip, AddressChip
│
├── map-split
│   └── Container (grid grid-cols-2, stack on mobile)
│       ├── MapSide
│       │   └── MapPlaceholder (bg-muted, rounded-xl, aspect-video)
│       │       └── AddressOverlay or embedded iframe
│       └── FormSide
│           └── ContactForm
│
│   > ⚠️ Removed 2026-07-09 from Block Library + AI gen per #1465 (Google Maps embed resolved wrong location). Retained only as legacy render-as-split; not a selectable variant.
│
└── minimal-inline
    └── Container (py-8)
        └── InlineForm (flex, gap-4, items-end, wrap on mobile)
            ├── Input (name, border-b only, no container box)
            ├── Input (email, border-b only)
            ├── Input (message, border-b only, flex-grow)
            └── SubmitButton (primaryColor)
```

#### Navigation Block (3 new → 6 total)

```
NavigationBlock (src/blocks/navigation/index.tsx)
├── [existing] simple, centered, mega-menu
│
├── transparent
│   └── NavBar (fixed top-0, transition-all duration-300)
│       ├── State: scrollY < 100 → bg-transparent, text-white
│       ├── State: scrollY >= 100 → bg-white/95 backdrop-blur-md, text-dark
│       ├── Logo (left)
│       ├── Links (center)
│       └── CTAButton (right, primaryColor)
│
├── sidebar
│   └── Container
│       ├── HamburgerButton (fixed top-4 left-4, always visible)
│       └── SidebarDrawer (Framer Motion: animate x from -100%)
│           ├── Logo (top)
│           ├── NavLinks (vertical list, gap-2)
│           │   └── Active: primaryColor indicator
│           ├── CTAButton (bottom)
│           └── CloseButton
│           └── Backdrop overlay (click to close)
│
└── pill
    └── PillNav (fixed, top-4, left-1/2 -translate-x-1/2, rounded-full)
        ├── Style: shadow-lg, backdrop-blur-md, bg-white/90, px-6 py-3
        ├── Logo (left inside pill)
        ├── Links (center, gap-6)
        └── CTAButton (right inside pill, primaryColor, rounded-full)
```

### 3.3 Sprint 3 — 8 New Industry Blocks

#### menu-display Block

```
MenuDisplayBlock (src/blocks/menu-display/)
├── Props: MenuDisplayConfig (headline, subheadline, categories[], currency, showDietaryIcons)
│
├── tabs
│   └── Container
│       ├── SectionHeader (headline + subheadline)
│       ├── CategoryTabs (role="tablist", flex, gap-2, overflow-x-auto)
│       │   └── Tab[] (role="tab", aria-selected, active: primaryColor underline)
│       └── TabPanel (role="tabpanel")
│           └── MenuItemList
│               └── MenuItem (flex justify-between, py-3, border-b)
│                   ├── ItemInfo
│                   │   ├── Name (font-semibold) + DietaryIcons (inline badges)
│                   │   ├── PopularBadge / NewBadge (optional)
│                   │   └── Description (text-sm, text-muted)
│                   └── Price ({currency} format, fontHeading)
│
├── photo-grid
│   └── Container
│       ├── SectionHeader
│       ├── CategoryFilter (tabs or pills)
│       └── Grid (grid-cols-2 md:grid-cols-3)
│           └── MenuItemCard
│               ├── ItemImage (aspect-square, rounded-lg, object-cover)
│               ├── Name
│               ├── DietaryIcons
│               ├── Description (line-clamp-2)
│               └── Price
│
└── accordion
    └── Container
        ├── SectionHeader
        └── AccordionGroup
            └── CategoryAccordion[] (collapsible, defaultOpen: first)
                ├── CategoryHeader (flex justify-between, cursor-pointer)
                │   ├── CategoryName + Icon
                │   └── ChevronIcon (rotate on open)
                └── CategoryContent (animate height)
                    └── MenuItemList (same as tabs variant)
```

#### booking-widget Block

```
BookingWidgetBlock (src/blocks/booking-widget/)
├── Props: BookingWidgetConfig (headline, services[], availableDays, timeSlots, bookingUrl, showPrice)
│
├── inline
│   └── Container (bg-muted/50, rounded-xl, p-8)
│       ├── SectionHeader
│       └── BookingForm
│           ├── ServiceSelect (<select> or RadioGroup, shows price + duration)
│           ├── DatePicker (input type="date" or custom calendar)
│           ├── TimeSlotGrid (grid grid-cols-3/4, gap-2)
│           │   └── TimeSlot (button, disabled if unavailable, active: primaryColor)
│           └── SubmitButton ("Book Now", primaryColor)
│           └── ExternalLink (if bookingUrl, redirect instead of form submit)
│
├── sidebar
│   └── Container (grid grid-cols-3, stack on mobile)
│       ├── InfoSide (col-span-2)
│       │   ├── Headline
│       │   └── ServiceList (description cards)
│       └── FormSide (col-span-1, sticky top-24)
│           └── BookingForm (compact version)
│
└── modal-trigger
    └── Container
        ├── TriggerSection
        │   ├── Headline + Subheadline
        │   └── BookButton ("Book Appointment", primaryColor)
        └── BookingModal (Dialog from shadcn/ui)
            ├── DialogHeader
            └── BookingForm (same as inline)
```

#### class-schedule Block

```
ClassScheduleBlock (src/blocks/class-schedule/)
├── Props: ClassScheduleConfig (headline, classes[], showCapacity, highlightToday)
│
├── grid
│   └── Container
│       ├── SectionHeader
│       └── WeekGrid (overflow-x-auto)
│           ├── DayHeaders (Mon-Sun, today: primaryColor highlight)
│           └── TimeGrid
│               └── ClassCell (positioned by day + time)
│                   ├── ClassName (font-semibold, text-sm)
│                   ├── Instructor
│                   ├── Time (start-end)
│                   ├── CapacityBadge ({enrolled}/{capacity})
│                   │   └── Full: "Full" badge, bg-red
│                   └── LevelBadge (beginner/intermediate/advanced)
│
├── list
│   └── Container
│       ├── SectionHeader
│       ├── DayFilter (tabs, Mon-Sun)
│       └── ClassList (gap-3)
│           └── ClassRow (flex justify-between, items-center, p-4, border, rounded-lg)
│               ├── ClassInfo (name, instructor, level)
│               ├── TimeDisplay
│               ├── CapacityDisplay
│               └── BookButton (disabled if full)
│
└── cards
    └── Container
        ├── SectionHeader
        └── Grid (grid-cols-2 md:grid-cols-3)
            └── ClassCard (border, rounded-xl, p-6, hover:shadow)
                ├── DayTimeBadge (top)
                ├── ClassName (text-lg)
                ├── InstructorRow (avatar + name)
                ├── LevelBadge
                ├── CapacityBar (progress bar)
                └── BookButton
```

#### review-cards Block

```
ReviewCardsBlock (src/blocks/review-cards/)
├── Props: ReviewCardsConfig (headline, reviews[], showAverage, totalReviewCount)
│
├── AverageRatingHeader (if showAverage)
│   ├── AverageScore (text-4xl, fontHeading)
│   ├── Stars (filled to average)
│   └── "from {totalReviewCount} reviews"
│
├── grid
│   └── Grid (grid-cols-1 md:grid-cols-2 lg:grid-cols-3, gap-6)
│       └── ReviewCard (border, rounded-xl, p-6)
│           ├── StarRating (1-5, primaryColor)
│           ├── QuoteText
│           ├── ReviewerInfo (name + date)
│           ├── SourceBadge (google/facebook/manual icon)
│           └── VerifiedBadge (if verified)
│
├── carousel
│   └── HorizontalScroll (overflow-x-auto, snap-x, flex)
│       └── ReviewCard[] (min-w-[320px], snap-start)
│       ├── NavArrows (desktop)
│       └── DotIndicators (mobile)
│
└── masonry
    └── MasonryGrid (CSS columns: 2 mobile, 3 desktop)
        └── ReviewCard[] (break-inside-avoid)
```

#### video-showcase Block

```
VideoShowcaseBlock (src/blocks/video-showcase/)
├── Props: VideoShowcaseConfig (headline, videos[], showCategories, autoplay)
│
├── grid
│   └── Container
│       ├── SectionHeader
│       ├── CategoryFilter (if showCategories, pill buttons, "All" default)
│       └── Grid (grid-cols-2 md:grid-cols-3, gap-6)
│           └── VideoCard (cursor-pointer, group)
│               ├── Thumbnail (aspect-video, rounded-lg)
│               │   └── PlayOverlay (centered, group-hover:scale-110)
│               │   └── DurationBadge (bottom-right)
│               ├── Title (font-semibold)
│               └── Category (text-muted, text-sm)
│           └── onClick: open video in lightbox or inline player
│
├── featured
│   └── Container
│       ├── SectionHeader
│       └── Layout (grid grid-cols-3, stack on mobile)
│           ├── HeroVideo (col-span-2)
│           │   ├── VideoPlayer (aspect-video, rounded-xl)
│           │   ├── Title + Description
│           └── PlaylistSidebar (col-span-1, overflow-y-auto, max-h-[500px])
│               └── PlaylistItem[] (flex, gap-3, cursor-pointer)
│                   ├── Thumbnail (w-24, aspect-video)
│                   └── Title + Duration
│
└── fullwidth
    └── Container (max-w-4xl mx-auto)
        └── VideoList (gap-12)
            └── VideoSection[] (full width)
                ├── VideoPlayer (aspect-video, rounded-xl)
                ├── Title (text-xl)
                ├── Description
                └── CategoryBadge
```

#### doctor-profile Block

```
DoctorProfileBlock (src/blocks/doctor-profile/)
├── Props: DoctorProfileConfig (headline, doctors[])
│
├── cards
│   └── Grid (grid-cols-1 md:grid-cols-2 lg:grid-cols-3, gap-6)
│       └── DoctorCard (border, rounded-xl, overflow-hidden)
│           ├── Photo (aspect-[3/4], object-cover)
│           ├── Content (p-6)
│           │   ├── Name (text-lg, fontHeading)
│           │   ├── Specialisation (primaryColor, text-sm)
│           │   ├── Qualifications (comma-separated)
│           │   └── AvailableDays (inline badges)
│
├── detailed
│   └── Stack (gap-8)
│       └── DoctorSection (grid grid-cols-3, border, rounded-xl, p-8)
│           ├── PhotoSide (col-span-1)
│           │   └── Photo (rounded-xl, aspect-[3/4])
│           └── DetailsSide (col-span-2)
│               ├── Name + Specialisation
│               ├── Qualifications (list)
│               ├── Languages (badge list)
│               ├── ConsultationFee (RM format, fontHeading)
│               ├── AvailableDays
│               └── ExpandableBio (collapsible, "Read more")
│
└── list
    └── Stack (gap-4)
        └── DoctorRow (flex, gap-6, items-center, p-4, border, rounded-lg)
            ├── Avatar (rounded-full, 80px)
            ├── Info (flex-grow)
            │   ├── Name + Specialisation
            │   ├── Qualifications (truncated)
            │   └── AvailableDays (inline)
            └── CTAArea
                ├── Fee (if provided)
                └── ViewProfileButton
```

#### property-card Block

```
PropertyCardBlock (src/blocks/property-card/)
├── Props: PropertyCardConfig (headline, properties[], showMap, currency)
│
├── grid
│   └── Grid (grid-cols-1 md:grid-cols-2 lg:grid-cols-3, gap-6)
│       └── PropertyCard (border, rounded-xl, overflow-hidden)
│           ├── ImageCarousel (aspect-video, swipeable)
│           │   └── DotIndicators
│           ├── StatusBadge (available/pending/sold, absolute top-left)
│           ├── TypeBadge (sale/rent, absolute top-right)
│           ├── Content (p-4)
│           │   ├── Price ({currency} format, text-xl, fontHeading)
│           │   ├── Title
│           │   ├── Location (icon + text)
│           │   ├── Specs (flex, gap-4: bedrooms, bathrooms, area)
│           │   └── MapLink (if showMap, Google Maps icon + "View on Map")
│
├── list
│   └── Stack (gap-4)
│       └── PropertyRow (flex, gap-6, border, rounded-xl, overflow-hidden)
│           ├── Image (w-80, aspect-video, object-cover)
│           ├── Content (flex-grow, p-4)
│           │   ├── Price + StatusBadge
│           │   ├── Title
│           │   ├── Location
│           │   └── Specs
│           └── CTAButton (self-center)
│
└── featured
    └── Container
        ├── FeaturedProperty (hero-sized card, grid grid-cols-2)
        │   ├── ImageCarousel (large, col-span-1)
        │   └── Content (col-span-1, p-8)
        │       ├── All details + description
        │       └── CTAButton
        └── MoreProperties (grid grid-cols-3, smaller cards below)
```

#### product-quick-view Block

```
ProductQuickViewBlock (src/blocks/product-quick-view/)
├── Props: ProductQuickViewConfig (headline, products[], columns, showQuickView, currency)
│
├── grid
│   └── Grid (grid-cols-{columns}, gap-6)
│       └── ProductCard (group, cursor-pointer)
│           ├── ImageContainer (aspect-square, overflow-hidden)
│           │   ├── ProductImage (group-hover:scale-105, transition)
│           │   ├── Badge (new/sale/bestseller, absolute top-left)
│           │   └── HoverOverlay (group-hover:opacity-100)
│           │       ├── QuickViewButton
│           │       └── AddToCartButton
│           ├── Content (p-4)
│           │   ├── Name
│           │   ├── PriceRow (price + originalPrice with strikethrough)
│           │   └── VariantIndicators (color dots)
│           └── QuickViewModal (if showQuickView, Dialog)
│               ├── ImageGallery (thumbnails + main image)
│               ├── ProductDetails (name, description, price)
│               ├── VariantSelector (size/color dropdowns)
│               └── AddToCartButton
│
├── carousel
│   └── HorizontalScroll (overflow-x-auto, snap-x, flex, gap-4)
│       └── ProductCard[] (w-[280px], snap-start, shrink-0)
│       ├── NavArrows (desktop)
│       └── ScrollIndicator
│
└── minimal
    └── Grid (grid-cols-{columns}, gap-4)
        └── ProductCard (text-center, no hover effects)
            ├── Image (aspect-square)
            ├── Name (text-sm)
            ├── Price
            └── CTAButton (simple, small)
```

---

## 4. Responsive Breakpoints

| Breakpoint | Width | Tailwind | Layout Changes |
|-----------|-------|----------|----------------|
| Mobile | < 768px | default | Single column, stack all grids, bottom nav, full-width cards |
| Tablet | 768-1023px | `md:` | 2-column grids, sidebar collapses, carousel shows 2 items |
| Desktop | 1024-1439px | `lg:` | 3-column grids, sidebars visible, full layouts |
| Wide | >= 1440px | `xl:` | Max-width containers (max-w-7xl), larger spacing |

### Per Block Family Responsive Rules

| Block | Mobile (< 768px) | Tablet (768px) | Desktop (1024px+) |
|-------|-------------------|----------------|---------------------|
| **Hero** | Stack columns, static bg (no parallax), video poster only | 2-col for split variants | Full layout, parallax active, video autoplay |
| **Features** | 1-col stack, carousel: 1 card visible | 2-col grid | 3-4 col grid, zigzag 2-col alternating |
| **Testimonials** | 1-col masonry, spotlight: stack, avatar-row: horizontal scroll | 2-col masonry | 3-col masonry, spotlight: 3 cards visible |
| **Pricing** | 1-col stack, comparison: horizontal scroll, slider: swipe | 2-col cards | 3-col cards, full comparison table |
| **Gallery** | 2-col grid, filmstrip: thumbnails scroll | 2-3 col grid | 3-4 col grid, lightbox keyboard nav |
| **Footer** | Stack all, links accordion | 2-col links | 4-5 col mega-footer |
| **Contact** | Stack form, map above form | 2-col map-split | Full 2-col, inline form single row |
| | | > ⚠️ Removed 2026-07-09 from Block Library + AI gen per #1465 (Google Maps embed resolved wrong location). Retained only as legacy render-as-split; not a selectable variant. | |
| **Navigation** | Always hamburger menu | Hamburger or compact links | Full links visible, pill/transparent |
| **menu-display** | 1-col, tabs scroll horizontally, photo 1-col | photo 2-col | 3-col photo-grid, full tabs |
| **booking-widget** | Stack form, sidebar → inline | 2-col sidebar | 3-col sidebar layout |
| **class-schedule** | Grid: horizontal scroll, list: day tabs | Grid: 5-day view | Full 7-day grid |
| **review-cards** | 1-col, carousel: 1 card | 2-col grid | 3-col grid/masonry |
| **video-showcase** | 1-col, featured: stack | 2-col grid | 3-col grid, featured sidebar |
| **doctor-profile** | 1-col cards, list: stack | 2-col grid | 3-col cards, detailed 2-col |
| **property-card** | 1-col, swipe image carousel | 2-col grid | 3-col grid, featured hero |
| **product-quick-view** | 2-col small cards, modal: fullscreen | 3-col grid | 4-col grid, inline quick-view |

---

## 5. Interaction States

### 5.1 Carousels & Sliders (hero slideshow, features carousel, pricing slider, review carousel, product carousel)

| State | Visual | Duration |
|-------|--------|----------|
| Default | Current slide visible, dots indicate position | — |
| Auto-advance | Crossfade to next slide | 5-6s interval, 300ms transition |
| Hover (desktop) | Pause auto-advance, show nav arrows | instant |
| Arrow hover | Arrow bg opacity increases | 150ms |
| Arrow click | Slide transition to prev/next | 300ms ease-out |
| Swipe (mobile) | Follows finger, snap to nearest slide | snap scroll behavior |
| Dot click | Jump to specific slide | 300ms crossfade |
| **prefers-reduced-motion** | No auto-advance, instant transitions | — |

### 5.2 Lightbox (gallery lightbox, video showcase)

| State | Visual | Interaction |
|-------|--------|-------------|
| Trigger | Click image, scale-up animation | 200ms ease-out |
| Open | Full-screen overlay, bg-black/90, focus trapped | Keyboard: arrows, Escape |
| Navigate | Crossfade between images | 200ms, arrow keys or buttons |
| Close | Scale-down + fade-out to origin | Escape key or click backdrop |
| Loading | Skeleton placeholder for large images | progressive loading |

### 5.3 Toggles (pricing monthly/yearly)

| State | Visual |
|-------|--------|
| Default (monthly) | Toggle thumb left, "Monthly" label bold |
| Hover | Track highlight (primaryColor at 20%) |
| Click → Yearly | Thumb slides right (200ms spring), prices animate number change, "Save X%" badge appears |
| Focus | Ring-2 ring-primaryColor |
| `role="switch"` | `aria-checked="true/false"`, `aria-label="Billing period"` |

### 5.4 Tabs (menu-display tabs, class-schedule day filter)

| State | Visual |
|-------|--------|
| Default | First tab active, primaryColor underline |
| Hover | Tab text color changes to primaryColor |
| Click | Active underline slides to new tab (200ms), panel crossfade (150ms) |
| Focus | Ring outline on tab |
| `role="tablist"/"tab"/"tabpanel"` | `aria-selected`, `aria-controls`, `aria-labelledby` |

### 5.5 Accordion (menu-display accordion, pricing minimal features)

| State | Visual |
|-------|--------|
| Collapsed | Chevron pointing right/down, content hidden |
| Expand click | Chevron rotates 90deg, content slides down (200ms ease-out) |
| Collapse click | Content slides up, chevron rotates back |
| **Always** | `aria-expanded`, content `aria-hidden` |

### 5.6 Parallax (hero parallax)

| State | Behavior |
|-------|----------|
| Desktop | `background-attachment: fixed`, subtle parallax scroll |
| Mobile | Static image (no parallax — touch devices don't support well) |
| `prefers-reduced-motion` | Static image, no scroll effects |

### 5.7 Animated Gradient (hero gradient)

| State | Behavior |
|-------|----------|
| Default | CSS gradient cycles through 3 hue-shifted colors, 8s ease infinite |
| `prefers-reduced-motion` | Static gradient (first color only), no animation |
| Implementation | Pure CSS `@keyframes`, GPU-composited (background-position only) |

### 5.8 Spotlight Swap (testimonials spotlight)

| State | Visual |
|-------|--------|
| Default | Center card large, flanking cards small |
| Hover flanking | Scale 1.05, cursor-pointer |
| Click flanking | Framer Motion `layoutId` swap: clicked card grows to center, center card shrinks to side (300ms spring) |
| Mobile | Stack vertically, tap to swap |

### 5.9 Booking Form (booking-widget)

| State | Behavior |
|-------|----------|
| Service select | Show price + duration for selected service |
| Date select | Filter available time slots for selected date |
| Time slot select | Highlight selected slot (primaryColor bg) |
| Submit | Loading state on button → success message or redirect to bookingUrl |
| Validation | Inline errors below each field on blur |
| External booking | If bookingUrl provided, redirect instead of form submit |

### 5.10 Hover States (all cards and interactive elements)

| Element | Hover Effect | Duration |
|---------|-------------|----------|
| Cards (feature, product, review) | `shadow-lg`, `translate-y-[-2px]` | 200ms ease-out |
| Buttons (CTA) | Background darken 10%, or scale 1.02 | 150ms |
| Images (gallery, product) | `scale-[1.02]` within overflow-hidden | 200ms |
| Links (nav, footer) | primaryColor text color | 150ms |
| Avatar (testimonial avatar-row) | ring-2 ring-primaryColor | 150ms |
| **All** | `cursor-pointer` on interactive elements | — |

---

## 6. Design Token References

### 6.1 Colors (from ThemeConfig)

| Token | Usage | CSS Variable |
|-------|-------|-------------|
| `primaryColor` | CTA buttons, active states, accents, links, badges | `--primary` |
| `secondaryColor` | Secondary buttons, subtle accents | `--secondary` |
| `backgroundColor` | Page background | `--background` |
| `colorMode: 'light'` | White surfaces, dark text | `--foreground: slate-900` |
| `colorMode: 'dark'` | Dark surfaces, light text | `--foreground: slate-50` |

**Derived Colors (computed from primaryColor):**

| Derived | Calculation | Usage |
|---------|------------|-------|
| `primaryColor/10` | 10% opacity | Icon backgrounds, subtle fills |
| `primaryColor/20` | 20% opacity | Borders, decorative elements |
| `primaryColor/5` | 5% opacity | Section background tints |
| HSL +30deg | Hue shift | Gradient variant secondary stop |
| HSL +60deg | Hue shift | Gradient variant tertiary stop |

### 6.2 Typography

| Token | Tailwind | Usage |
|-------|----------|-------|
| `fontHeading` | `font-heading` (custom) | All headings (h1-h6), prices, plan names |
| `fontBody` | `font-body` (custom) | Body text, descriptions, labels |

**Scale:**

| Level | Mobile | Desktop | Weight |
|-------|--------|---------|--------|
| Hero headline | text-3xl (30px) | text-6xl (60px) → text-8xl for `minimal` | 700-800 |
| Section headline | text-2xl (24px) | text-4xl (36px) | 700 |
| Card title | text-lg (18px) | text-xl (20px) | 600 |
| Body | text-base (16px) | text-base (16px) | 400 |
| Caption/label | text-sm (14px) | text-sm (14px) | 400-500 |
| Badge/chip | text-xs (12px) | text-xs (12px) | 500 |

### 6.3 Spacing

| Context | Value | Tailwind |
|---------|-------|----------|
| Section vertical padding | 64-96px | `py-16` to `py-24` |
| Between sections | 0 (seamless) | — |
| Card padding | 24-32px | `p-6` to `p-8` |
| Grid gap | 24px | `gap-6` |
| Component internal gap | 16px | `gap-4` |
| Inline elements gap | 8px | `gap-2` |

### 6.4 Shadows & Radius

| Element | Shadow | Radius |
|---------|--------|--------|
| Cards (default) | `shadow-sm` or `border` | `rounded-xl` (12px) |
| Cards (hover) | `shadow-lg` | `rounded-xl` |
| Glass cards | `shadow-2xl` | `rounded-2xl` (16px) |
| Buttons | none or `shadow-sm` | `rounded-lg` (8px) |
| Pill nav | `shadow-lg` | `rounded-full` |
| Images | none | `rounded-lg` to `rounded-xl` |
| Avatars | none | `rounded-full` |
| Input fields | `border` | `rounded-md` (6px) |

---

## 7. Accessibility Specs

### 7.1 ARIA Patterns per Interaction Type

| Pattern | ARIA Roles | Required Attributes |
|---------|-----------|---------------------|
| **Carousel/Slider** | `role="region"` with `aria-roledescription="carousel"` | `aria-label="[Block name]"`, slides have `aria-roledescription="slide"`, `aria-label="Slide N of M"` |
| **Lightbox** | `role="dialog"` | `aria-modal="true"`, `aria-label="Image gallery"`, focus trap |
| **Toggle** | `role="switch"` | `aria-checked`, `aria-label="Billing period"` |
| **Tabs** | `role="tablist"`, `role="tab"`, `role="tabpanel"` | `aria-selected`, `aria-controls`, `aria-labelledby` |
| **Accordion** | inherent in `<details>/<summary>` or custom | `aria-expanded`, `aria-controls` |
| **Navigation** | `role="navigation"` or `<nav>` | `aria-label="Main navigation"` |
| **Sidebar drawer** | `role="dialog"` | `aria-modal="true"`, focus trap, Escape to close |
| **Star rating** | `role="img"` | `aria-label="Rated N out of 5 stars"` |
| **Booking form** | standard `<form>` | `<label>` for all inputs, `aria-describedby` for helper text |
| **Capacity badge** | `role="status"` | `aria-label="N of M spots remaining"` |

### 7.2 Keyboard Navigation

| Component | Tab | Enter/Space | Arrow Keys | Escape |
|-----------|-----|-------------|-----------|--------|
| Carousel | Focus prev/next buttons | Activate button | Left/Right navigate slides | — |
| Lightbox | Focus close/prev/next | Activate | Left/Right navigate images | Close lightbox |
| Toggle | Focus toggle | Toggle state | — | — |
| Tabs | Focus tab list | Select tab | Left/Right move between tabs | — |
| Accordion | Focus trigger | Toggle expand/collapse | — | — |
| Sidebar drawer | Focus first element inside | — | — | Close drawer |
| Modal (booking, quick-view) | Focus first input | Submit form | — | Close modal |
| Gallery image | Focus image | Open lightbox | — | — |
| Avatar row | Focus avatar | Select testimonial | Left/Right move avatars | — |

### 7.3 Color Contrast Requirements

| Element | Minimum Ratio | Context |
|---------|--------------|---------|
| Body text | 4.5:1 | All variants, both light and dark colorMode |
| Headings (>= 24px) | 3:1 | Large text exemption |
| Interactive elements | 3:1 | Buttons, links, icons against background |
| Text on images (overlay) | 4.5:1 | Ensure overlay opacity provides sufficient contrast |
| Glass cards text | 4.5:1 | `backdrop-blur` alone is NOT sufficient — need `bg-black/60` or similar |
| Disabled elements | No requirement | But should appear visually distinct |

### 7.4 Motion & Animation

- ALL animated variants MUST respect `prefers-reduced-motion`:
  - Hero gradient: stop animation, show static gradient
  - Hero slideshow: stop auto-advance, manual navigation only
  - Hero parallax: static background, no scroll effect
  - Testimonial auto-rotate: stop auto-rotate, manual only
  - Carousel auto-advance: stop
  - Hover transitions: reduce to opacity change only (no transform)

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

### 7.5 Focus Indicators

- All interactive elements: `focus-visible:ring-2 focus-visible:ring-primaryColor focus-visible:ring-offset-2`
- Never remove focus outlines (`outline: none` only with `:focus-visible` replacement)
- Tab order must follow visual reading order (top-to-bottom, left-to-right)

### 7.6 Image Alt Text

| Context | Alt Text Source |
|---------|----------------|
| Hero image | `image.alt` or `headline` |
| Gallery images | `image.alt` (required field) |
| Product images | Product `name` |
| Property images | Property `title` + "image N" |
| Doctor photos | Doctor `name` + ", " + `specialisation` |
| Menu item photos | Item `name` |
| Decorative backgrounds | `alt=""` (empty, decorative) |

### 7.7 Touch Targets

- All buttons, links, tabs: minimum **44x44px** tap area
- If visual size is smaller (e.g., close button icon), expand hit area with padding
- Carousel nav arrows: at least 44x44px
- Time slot buttons (booking): minimum 44px height
- Gallery thumbnails: minimum 44x44px even if visually smaller

---

## 8. Self-Check

```
📋 UI Specs Self-Check:
├── Goi Skill tool ui-ux-pro-max? [✅]
├── So screens: [6]
├── So components: [42 new variants + 8 new blocks = ~120 component specs]
├── Co Screen Flows? [✅]
├── Co Responsive Breakpoints? [✅ — 4 breakpoints, per-block rules]
├── Co Interaction States? [✅ — 10 interaction patterns]
├── Co Design Token refs? [✅ — colors, typography, spacing, shadows]
├── Co Accessibility specs? [✅ — ARIA, keyboard, contrast, motion, focus, alt text, touch]
├── Map PRD user stories? [✅]
│   ├── US-F30-01: AI Builder + variant catalog → Section 3
│   ├── US-F30-02: Editor variant swap → Screen Flow + Section 5.10
│   ├── US-F30-03: Mobile responsive → Section 4
│   ├── US-F30-04: Developer pattern → Section 3.1 (block architecture)
│   ├── Sprint 3 US-F30-01 to US-F30-04: Industry blocks → Section 3.3
└── Co Component data/API refs? [✅ — all configs reference Zod schemas from PRD]
```

---

## 9. Sprint 2 Variant Catalog Summary

| Block Family | Existing | New | Total | New Variant Names |
|-------------|----------|-----|-------|-------------------|
| Hero | 5 | 7 | 12 | magazine, minimal, cards-overlay, gradient, parallax, slideshow, split-video |
| Features | 4 | 4 | 8 | icon-top, icon-left, zigzag, carousel |
| Testimonials | 3 | 5 | 8 | masonry, spotlight, minimal-quote, avatar-row, video-text |
| Pricing | 2 | 6 | 8 | horizontal, toggle, tiered, comparison, minimal, slider |
| Gallery | 3 | 3 | 6 | lightbox, filmstrip, justified |
| Footer | 3 | 3 | 6 | centered-stack, mega-footer, dark-gradient |
| Contact | 3 | 3 | 6 | card-float, map-split, minimal-inline |
| | | | | > ⚠️ Removed 2026-07-09 from Block Library + AI gen per #1465 (Google Maps embed resolved wrong location). Retained only as legacy render-as-split; not a selectable variant. |
| Navigation | 3 | 3 | 6 | transparent, sidebar, pill |
| **Total** | **26** | **34** | **60** | |

## 10. Sprint 3 Industry Block Summary

| Block | Variants | Key Feature | Industry |
|-------|----------|-------------|----------|
| menu-display | tabs, photo-grid, accordion | Dietary icons, RM prices, categories | Restaurant, F&B |
| booking-widget | inline, sidebar, modal-trigger | Date picker, time slots, service select | Clinic, Salon, Gym |
| class-schedule | grid, list, cards | Weekly timetable, capacity tracking | Gym, Yoga, Dance |
| review-cards | grid, carousel, masonry | Star ratings, source badges, average | All industries |
| video-showcase | grid, featured, fullwidth | Category filter, lightbox player | Creative, Agency |
| doctor-profile | cards, detailed, list | Qualifications, fees in RM, languages | Health, Clinic |
| property-card | grid, list, featured | Image carousel, specs, map link | Real Estate |
| product-quick-view | grid, carousel, minimal | Quick-view modal, variants, badges | E-commerce |
