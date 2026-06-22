# Malaysia Local SEO & Discovery Levers for Storefront Platform
**Report:** researcher-260615-1619-malaysia-local-seo-levers.md  
**Date:** 2026-06-15  
**Researcher:** Technical Analyst  
**Scope:** Malaysia-specific local SEO automation for Next.js 15 + Payload CMS 3 platform targeting non-tech SME merchants (F&B, retail, services).

---

## 1. WAZE FOR LOCAL BUSINESS (Malaysia)

### Current State (2025-2026)

**Status:** Waze acquired into Google Geo; remains standalone app with ~151M MAU globally.

**For SMEs:**
- **Google Business Profile ↔ Waze sync is THE lever** ([source](https://gmbapi.com/news/waze-journey-from-app-to-advertising-powerhouse/))
  - No separate Waze-only listing needed; GBP data flows to Waze automatically
  - Accurate GBP (name, phone, address, hours) = appears in Waze
  - Updates to GBP sync within ~24h to Waze
  - **Platform implication:** Force merchants to claim/complete GBP; sync becomes free

- **Waze Ads still active** for paid discovery (not free tier focus here, but exists)

### Deep Links for Website Integration

**URL Format (documented):** ([source](https://developers.google.com/waze/deeplinks))

```
https://waze.com/ul?ll=LATITUDE,LONGITUDE&navigate=yes&z=ZOOM
https://waze.com/ul?q=SEARCH_TERM
https://waze.com/ul?q=Kedai+Kopi+Berhampiran+KL&navigate=yes
```

**Key parameters:**
- `ll` = latitude,longitude (coordinate center)
- `navigate=yes` = auto-start navigation
- `q` = search query (location name or address)
- `z` = zoom level (6–8192)
- `avoid_tolls`, `avoid_ferries`, `avoid_freeways` = route preferences
- `vehicle_type` = private | taxi | motorcycle
- `utm_source` = for partner tracking with Google

**Platform capability:**
- Generate "Navigate with Waze" button from store lat/lng + name
- Template: `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`
- Fallback to web if app not installed (handles automatically)

### Schema.org + LocalBusiness JSON-LD

**Can `hasMap` point to Waze?**  
Technically yes — `hasMap` accepts any Map URL. However:
- Google prioritizes official Google Maps in search results
- Best practice: use `hasMap` for Google Maps only; Waze button as separate UI element (not schema)
- Recommend: `hasMap` → Google Maps; "Navigate" button → Waze deep link

---

## 2. MULTILINGUAL + HREFLANG FOR MALAYSIA (en + ms)

### Language Search Behavior (MY 2025-2026)

**Code-switching is dominant** ([source](https://hashmeta.com/blog/bahasa-marketing-malaysia-the-complete-guide-to-malay-language-content-strategy/)):
- Malaysians use mixed-language queries: "tempat makan best KL" (food place great KL), "restoran sedap di Kuala Lumpur" (delicious restaurant in KL)
- English + Bahasa Melayu equally relevant; Chinese less dominant for SME discovery
- BM speakers: 20M+; internet penetration: 90%+
- Search behavior: pragmatic split (product info in English, local discovery in BM or mixed)

**Platform recommendation:** en-MY + ms-MY required. zh-MY optional (lower ROI for now).

### hreflang Implementation (Next.js 15)

**Correct format** ([source](https://fridamarketing.com/seo/technical-seo/hreflang-complete-guide-nextjs-2026)):
- Use **hyphen, never underscore**: `en-MY`, `ms-MY` (not `en_MY`)
- **Always include `x-default`** as fallback
- **Every variant links to all others** (reciprocal requirement)
- 96% of sites with hreflang errors miss self-reference

**Next.js 15 App Router implementation** ([source](https://next-intl.dev/docs/routing/configuration)):

```typescript
// app/[locale]/page.tsx or generateMetadata()
export async function generateMetadata({ params }) {
  const locale = params.locale; // "en" or "ms"
  
  return {
    title: locale === 'ms' ? 'Cari Kedai Tempatan' : 'Find Local Shops',
    alternates: {
      canonical: `https://yoursite.com/${locale}/shops`,
      languages: {
        'en-MY': 'https://yoursite.com/en/shops',
        'ms-MY': 'https://yoursite.com/ms/shops',
        'x-default': 'https://yoursite.com/en/shops'
      }
    }
  };
}
```

**Renders as:**
```html
<link rel="alternate" hreflang="en-MY" href="https://yoursite.com/en/shops" />
<link rel="alternate" hreflang="ms-MY" href="https://yoursite.com/ms/shops" />
<link rel="alternate" hreflang="x-default" href="https://yoursite.com/en/shops" />
<link rel="canonical" href="https://yoursite.com/ms/shops" /> <!-- self -->
```

**Platform design choice:** Subpath routing (`/en/`, `/ms/`) vs query param (`?lang=en`)?  
→ **Subpath is SEO-stronger** (hreflang clarity, cache isolation). Query param complicates hreflang.

### Local Search Keywords (Bahasa Melayu)

**"Near me" equivalents** ([source](https://hashmeta.com/blog/local-seo-malaysia-rank-1-on-google-maps-for-near-me-searches-in-kl-pj-penang-jb/)):
- **"Terdekat"** ← most common (literally "nearest")
- **"Berdekatan"** ← "in the vicinity of" (common compound searches)
- **"Berhampiran"** ← "near/adjacent" (formal)
- Example queries: "Kedai Kopi Terdekat", "Bakeri Berdekatan Petaling Jaya", "Klinik Berhampiran Saya"

**Platform strategy:** Include BM equivalents in merchant landing pages, help text, keyword suggestions.

---

## 3. HALAL AS TRUST + SEARCH SIGNAL (Malaysia)

### Current State & Significance

**Halal certification is HIGH-impact for F&B in Malaysia** ([source](https://www.ajobthing.com/resources/blog/halal-certification-malaysia-apply-requirements)):
- JAKIM (Department of Islamic Development Malaysia) = sole authority
- As of May 2025: **All certification now fully digital** ([source](https://www.halaltimes.com/malaysias-halal-certification-goes-fully-digital/))
- Halal certification enhances consumer trust significantly; impacts purchase decisions & local ranking signals
- Relevant for: food delivery (GrabFood, Foodpanda), F&B merchants, cosmetics, other certified categories

### Structured Data Approach

**Schema.org does NOT have native `Halal` property** ([source](https://schema.org/Restaurant)).  
Options ranked by clarity:

**Best: `additionalProperty` with PropertyValue** ([source](https://schema.org/additionalProperty)):
```json
{
  "@context": "https://schema.org",
  "@type": "Restaurant",
  "name": "Restoran Nasi Lemak Halal",
  "address": { ... },
  "additionalProperty": {
    "@type": "PropertyValue",
    "name": "Halal Certified",
    "value": "JAKIM Certified"
  },
  "sameAs": "https://myehalal.halal.gov.my/..." // link to JAKIM cert
}
```

**Good: Menu-level attribute** (if certifying individual items):
```json
{
  "@type": "MenuItem",
  "name": "Rendang Daging",
  "additionalProperty": {
    "@type": "PropertyValue",
    "name": "Halal",
    "value": "true"
  }
}
```

**Acceptable: `keywords` field** (less structured, but quick):
```json
{
  "@type": "Restaurant",
  "keywords": "Halal, JAKIM Certified, Pork-Free"
}
```

### Platform Implementation

**Merchant-facing features:**
1. **Halal toggle** in store settings → renders badge on storefront + product listings
2. **Certificate upload** → store JAKIM e-cert number or PDF
3. **Structured data auto-generation** → `additionalProperty` injected into Restaurant schema when `halal_certified = true`
4. **Trust badge** → renders JAKIM logo (if rights obtained) on product/store pages
5. **Link to JAKIM registry** → `//<merchant-name>` searchable in [Halal Malaysia Portal](https://myehalal.halal.gov.my/portal-halal/v1/)

**Impact:** Visible trust signal in Google local pack + SERP snippets. AI assistants (Google AI Overview, ChatGPT) can consume structured data for "Halal?" answer.

---

## 4. MALAYSIA COMMERCE + LOCAL SPECIFICS

### Currency & Price Formatting

**Schema.org:** `priceCurrency="MYR"` (ISO 4217 code for Malaysian Ringgit)

**Display conventions:**
- Amount: RM 25.50 (standard) or MYR 25.50
- Decimal: comma (RM 25,50) or period (RM 25.50) — both accepted; period preferred in English contexts
- No leading zeros for fractions (RM 25.5 acceptable)

**Platform template:**
```json
{
  "@type": "Offer",
  "priceCurrency": "MYR",
  "price": "25.50"
}
```

Render in UI as: `RM {{price.toFixed(2)}}`

### 13 States + 3 Federal Territories (Complete List)

**For dropdown, location pages, areaServed schema** ([source](https://en.wikipedia.org/wiki/States_and_federal_territories_of_Malaysia)):

| # | State (English) | Negeri (Bahasa Melayu) | Region |
|---|---|---|---|
| 1 | Johor | Johor | Peninsular |
| 2 | Kedah | Kedah | Peninsular |
| 3 | Kelantan | Kelantan | Peninsular |
| 4 | Malacca (Melaka) | Melaka | Peninsular |
| 5 | Negeri Sembilan | Negeri Sembilan | Peninsular |
| 6 | Pahang | Pahang | Peninsular |
| 7 | Penang (Pulau Pinang) | Pulau Pinang | Peninsular |
| 8 | Perak | Perak | Peninsular |
| 9 | Perlis | Perlis | Peninsular |
| 10 | Selangor | Selangor | Peninsular |
| 11 | Terengganu | Terengganu | Peninsular |
| 12 | Sabah | Sabah | East Malaysia (Borneo) |
| 13 | Sarawak | Sarawak | East Malaysia (Borneo) |

**Federal Territories (Wilayah Persekutuan):**
- Kuala Lumpur (Wilayah Persekutuan Kuala Lumpur)
- Putrajaya (Wilayah Persekutuan Putrajaya)
- Labuan (Wilayah Persekutuan Labuan)

**Platform use:**
- Dropdown for merchant store location selection
- `areaServed` in LocalBusiness schema
- Location landing pages (`/my/selangor/`, `/my/pulau-pinang/`)

### Top Local Directories for SME Discovery (Ranked by Impact)

| Directory | Coverage | Impact for SME | Authority | 2025 Status |
|---|---|---|---|---|
| **Google Maps** | National | Critical (1–2 positions dominate local pack) | Highest | Active, integrating Waze |
| **GrabFood** | 95% population (100+ districts) | **60% market share**; F&B dominant | Very High | No. 1 food delivery |
| **Foodpanda** | ~85% coverage | ~30% market share | High | Second-largest; consolidation ongoing |
| **Waze** | National | Growing; traffic-aware, navigation-focused | High (Google-owned) | Sync via GBP; active in MY |
| **Foursquare/Swarm** | Major urban areas (KL, PJ, Penang, JB) | Niche (check-ins, local discovery) | Medium | Stable, less critical for MY SME |
| **Mudah.my** | National | High for classified/marketplace buys; low for F&B/services | Medium | Active; classifieds focus |
| **Apple Maps** | National | Lower in MY than Android; still relevant for iOS users | Medium | Secondary to Google |
| **Local industry portals** (e.g., HalalSearch.my) | Niche | Relevant for halal-certified F&B only | Niche | Emerging |

**Recommendation rank for platform automation:**
1. **Google Business Profile** (no choice; enables Maps + Waze)
2. **GrabFood** (highest ROI for F&B; 60% market; direct API possible via Grab Business)
3. **Foodpanda** (secondary F&B; declining share but still relevant)
4. **Waze deep-link buttons** (automated via GBP sync; minimal effort)
5. Optional: Apple Maps (lower priority unless iOS-heavy merchant demographic emerges)

### Phone Number Format

**International:** `+60 12 345 6789` (country code +60, leading 0 removed)  
**Domestic:** `012-345-6789` or `01 2-345-6789`

**Schema.org `telephone`:**
```json
{
  "telephone": "+60 12 345 6789"
}
```

**Mobile prefixes (all valid):** 010–019 (10–19 in domestic, 010–019 internationally)  
**Landline example (KL):** `+60 3 2167 1234`

---

## ACTIONABLE AUTOMATION CHECKLIST FOR PLATFORM

### High Impact (Do First)

- [ ] **GBP Completion Wizard**
  - Force merchants through name, address, phone, hours, category setup before launch
  - Sync to Waze happens automatically via GBP
  - **Effort:** Medium | **ROI:** 9/10 | **Timeline:** 2–3 sprints
  
- [ ] **Multilingual SEO Setup (en + ms)**
  - Implement `alternates.languages` in Next.js 15 generateMetadata (subpath routing)
  - Auto-generate hreflang tags + canonical per locale
  - Add BM keyword suggestions in store naming / description fields
  - **Effort:** Low-Medium | **ROI:** 8/10 | **Timeline:** 1–2 sprints

- [ ] **Halal Toggle + Schema Injection**
  - Add boolean "Halal Certified" field in merchant settings
  - Auto-inject `additionalProperty` into Restaurant schema when enabled
  - Render JAKIM logo + link to portal on storefront
  - **Effort:** Medium | **ROI:** 7/10 | **Timeline:** 1 sprint (F&B merchants especially)

- [ ] **States + MYR Price Formatting**
  - Populate state dropdown from canonical list (13 states + 3 FT)
  - Ensure all price schema uses `priceCurrency: "MYR"` + proper formatting
  - Add state to `areaServed` in LocalBusiness schema
  - **Effort:** Low | **ROI:** 6/10 (foundational) | **Timeline:** 1 sprint

### Medium Impact (Phase 2)

- [ ] **Waze Deep-Link Buttons**
  - Auto-generate "Navigate with Waze" button from merchant lat/lng
  - Template: `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`
  - Show on storefront detail page + mobile app
  - **Effort:** Low | **ROI:** 5/10 | **Timeline:** 0.5 sprint

- [ ] **GrabFood API Integration** (if partnership exists)
  - One-click merchant sync to GrabFood catalog (if they integrate)
  - Syncs menu, hours, address, photos
  - **Effort:** High | **ROI:** 9/10 (if F&B-focused) | **Timeline:** 2–3 sprints + legal negotiation

- [ ] **Location Landing Pages** (state/district level)
  - Auto-generate `/my/selangor/restaurants`, `/my/penang/hotels` pages
  - Embed schema with `areaServed` + merchant listings
  - Improves local pack visibility for state-level searches
  - **Effort:** Medium | **ROI:** 6/10 | **Timeline:** 1 sprint

### Lower Priority (Phase 3 / Future)

- [ ] Local keyword optimization (e.g., "Kedai Kopi Terdekat" suggestions in store name helpers)
- [ ] Citation management for Foursquare, Mudah (if user demand grows)
- [ ] Industry-specific portals (halal registry integration, e.g. auto-register with HalalSearch.my if cert uploaded)

---

## CAVEATS & UNRESOLVED QUESTIONS

1. **Waze API for Platform Integration?**
   - Research found no official Waze Partner API for bulk merchant listing management (like GBP Partner API).
   - **Status:** All Waze sync flows through Google Business Profile. No separate direct Waze integration possible.
   - **Implication:** Platform cannot bypass GBP; must push merchants to GBP completion.

2. **Foodpanda Consolidation Status (ongoing 2026)**
   - Search results mention potential acquisition by Grab; actual integration timeline unclear.
   - **Status:** As of mid-2025, Foodpanda still operational as separate entity. Recommend waiting for clarity before heavy Foodpanda API investment.

3. **Halal Schema Adoption by Google Search?**
   - `additionalProperty` approach is valid but not Google-native (no special snippet handling yet).
   - **Status:** Halal designation will likely improve E-E-A-T signals + AI Overview responses, but no dedicated SERP feature confirmed.
   - **Implication:** Implement for future-proofing + AI consumption; don't expect immediate Google SERP visibility boost.

4. **Malaysia Chinese Language (zh-MY)?**
   - Research inconclusive on ROI. Chinese speakers in MY use mix of Mandarin + English, not "zh-MY" as distinct locale.
   - **Status:** Not recommended for Phase 1. Consider only if data shows significant Mandarin-only search volume.

5. **Citation Automation (Foursquare, Mudah)?**
   - No verified APIs found for bulk merchant listing on these platforms (unlike GBP API).
   - **Status:** Manual or via third-party citation management SaaS (e.g., Yext) required.
   - **Implication:** Low priority; focus on GBP first.

---

## SUMMARY: "WHAT THE PLATFORM CAN AUTOMATE FOR MY"

**Tier 1 (Direct, high ROI):**
1. GBP completion wizard → auto-syncs to Google Maps + Waze
2. Multilingual hreflang (en-MY, ms-MY) in Next.js App Router
3. Halal certified toggle → schema injection + badge rendering
4. MYR price formatting + state dropdown
5. Waze deep-link button generation from lat/lng

**Tier 2 (Requires partnership or phase 2):**
6. GrabFood menu sync (requires Grab API partnership)
7. Location landing pages (`/my/state/`) with local schema

**Tier 3 (Future, lower priority):**
8. Foodpanda sync (wait for consolidation clarity)
9. Citation management for secondary directories
10. Industry portal integrations (halal registry auto-registration)

---

## SOURCES CITED

- [Google Waze Deep Links Documentation](https://developers.google.com/waze/deeplinks)
- [Waze Business Profile Guide](https://gmbapi.com/news/waze-journey-from-app-to-advertising-powerhouse/)
- [Halal Malaysia Portal (JAKIM)](https://myehalal.halal.gov.my/portal-halal/v1/)
- [Malaysia Halal Certification Goes Fully Digital (May 2025)](https://www.halaltimes.com/malaysias-halal-certification-goes-fully-digital/)
- [Hreflang Complete Guide 2026 + Next.js](https://fridamarketing.com/seo/technical-seo/hreflang-complete-guide-nextjs-2026)
- [Next.js Internationalization (next-intl)](https://next-intl.dev/docs/routing/configuration)
- [Malaysia Local SEO: Language & Search Behavior](https://hashmeta.com/blog/bahasa-marketing-malaysia-the-complete-guide-to-malay-language-content-strategy/)
- [GrabFood Market Share & Expansion 2025](https://www.grab.com/my/press/others/grabfood-malaysia-no-1-food-delivery/)
- [Malaysia SME Local SEO Best Practices 2025–2026](https://hashmeta.com/blog/local-seo-malaysia-rank-1-on-google-maps-for-near-me-searches-in-kl-pj-penang-jb/)
- [Schema.org Restaurant Type](https://schema.org/Restaurant)
- [Schema.org additionalProperty](https://schema.org/additionalProperty)
- [Malaysia States & Federal Territories](https://en.wikipedia.org/wiki/States_and_federal_territories_of_Malaysia)
- [Malaysia Phone Number Format](https://callhippo.com/blog/general/malaysia-phone-number-format)
- [Google Business Profile + Waze Integration 2025](https://www.pinmeto.com/blog/google-business-profile-guidelines-2025/)

---

**Report Status:** DONE  
**Reviewer:** Ready for PRD inclusion + implementation planning.
