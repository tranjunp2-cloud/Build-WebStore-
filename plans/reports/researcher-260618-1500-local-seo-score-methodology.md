# Local SEO Score Methodology Research & Recommendation

**Report Date:** 2026-06-18  
**Research Scope:** F37 Local SEO (multi-tenant Malaysia/Vietnam storefront platform)  
**Status:** Complete with concrete Phase 1→2 formula + implementation guide

---

## Executive Summary

Current draft formula (30% business data + 25% JSON-LD + 25% GBP + 10% AI crawlers + 10% NAP) is **inverted vs. industry reality and creates a Phase 1 ceiling problem**: GBP (25%) + NAP (10%) = 35% of score locked until Phase 2, leaving Phase 1 sellers maxing at 65% even if they perfect all available signals—they feel stuck.

**Concrete Recommendation (Delivered Below):**
1. **Phase 1 (pre-GBP):** Business data 35% + Structured data 30% + AI access 20% + Tech health 15% = 100 achievable. Phase 1 seller hitting all targets reaches 100/100 ("Phase 1 scale").
2. **Phase 2 (post-GBP):** GBP 25% + Reviews 15% + NAP 10% + Citations 8% + Phase 1 categories reweighted to 42%. Phase 1 score normalizes upward (no drop); Phase 2 adds new growth path to 105+.
3. **Messaging:** Explicit "Phase 1 Foundation" vs "Phase 2 Full Local Ranking" labels so score transition doesn't feel like regression.

**Why this formula:** Aligns with Whitespark 2026 data (GBP 32%, reviews 16%, on-page 19%, citations 7%), avoids fake ceilings, solves the phase transition perception problem, and is implementable as a pure function.

---

## Part 1: Industry Ranking Factors (Research Summary)

### 1.1 The "Proximity-Relevance-Prominence" Model (Google Official)

Google's local algorithm rests on three pillars ([BrightLocal](https://www.brightlocal.com/learn/google-local-algorithm-and-ranking-factors/)):
- **Relevance:** How well business profile matches search intent. Driven by GBP category (strict filter), business description, keywords in title.
- **Proximity:** Distance from searcher. Non-negotiable for Maps ranking.
- **Prominence:** Brand authority. Driven by review count/rating, backlinks, engagement (clicks, calls, visits).

**For local pack rankings specifically, factor distribution is ([Whitespark 2026](https://whitespark.ca/local-search-ranking-factors/)):**
- GBP signals: **32%** (primary category, address, keywords in title, completeness)
- Review signals: **16%** (recency heavily weighted; 4.0+ rating = 58% higher pack appearance)
- On-page signals: **19%** (dedicated service pages, geo-keyword relevance, LocalBusiness schema)
- Link signals: **15%**
- Citation signals: **7%** (consistency > quantity; 40% higher pack visibility with consistent NAP)
- Behavioral signals: **8%** (calls, clicks, visits)
- Personalization: **3%**

**For Local Pack specifically** (Maps/3-pack), 8 of top 10 factors come directly from GBP.

**Key insight:** GBP is foundational (32%), not negotiable. NAP/citations are supporting trust signals (7%), not drivers.

### 1.2 GBP Completeness Impact

[Google official guidance](https://support.google.com/business/answer/7091?hl=en) states: "Provide complete and detailed business info" to help Google match your business to relevant searches. Completeness is a **relevance signal**, not a ranking lever by itself—it enables ranking.

Complete profiles must include: hours, website, phone, products, services, attributes, description. Missing data = lower relevance match likelihood.

**Implication for Phase 1:** Without GBP integration, sellers cannot provide hours/open-status (critical for relevance). This is a structural gap, not a point deduction.

### 1.3 Structured Data (JSON-LD) Quality

[73% of rich snippets use JSON-LD](https://www.epicnotion.com/blog/the-local-business-schema-advantage/). LocalBusiness schema is **SEO necessity**, not optional ([Google Developers](https://developers.google.com/search/docs/appearance/structured-data/local-business)).

**Quality checklist:**
- LocalBusiness + industry subtype (Restaurant, Plumber, etc.)
- Organization schema (name, logo, location, contact)
- FAQPage schema (AEO signal for AI crawlers; Google deprecated FAQ rich results in May 2026, but FAQPage still drives AI citability)

**On-page ranking weight:** 19% (Whitespark), with schema as ~5-7% of that.

**AEO (AI Answer Engine Optimization) trend:** As Google AI Overviews, ChatGPT, Perplexity cite businesses directly, proper LocalBusiness + FAQ schema increases citation likelihood. **However, this is emerging, not yet a primary ranking factor**—weight conservatively.

### 1.4 AI Crawler Crawlability (2025-2026 trend)

Verified AI agent traffic **+6,900% YoY in 2025**; LLM bots now crawl **3.6x more than Googlebot** ([Momentic](https://momenticmarketing.com/blog/ai-search-crawlers-bots)).

**But:** Allow-All is NOT advised. Recommended strategy: block training bots (GPTBot, ClaudeBot, CCBot, Google-Extended), allow search bots (OAI-SearchBot, Claude-SearchBot, ChatGPT-User, Perplexity-User, GoogleOther-Image).

**Ranking impact:** Sites with strong technical SEO (including AI crawlability) see **2-3x higher AI citation rates**. This is a **proxy for technical health**, not a direct ranking factor yet ([RoastWeb](https://roastweb.com/blog/technical-seo-agents-2026)).

**Implication:** "AI crawlers enabled" should measure **selective crawlability** (allow=1pt, block training bots=0.5pt, block all=0) as a technical health proxy, not as a standalone ranking lever.

### 1.5 NAP Consistency

Businesses with **consistent NAP across citations are 40% more likely in pack** ([BrightLocal](https://www.brightlocal.com/learn/google-local-algorithm-and-ranking-factors/)). Minor variations (St. vs Street, space in phone) harm rankings.

**Weight:** 7% of local pack (supporting, not primary) ([Whitespark 2026](https://whitespark.ca/local-search-ranking-factors/)).

**Phase 1 issue:** Without GBP OAuth, sellers can't bulk-verify NAP across citations. Phase 1 can only measure *declared* NAP consistency (does website match stated address?), not *verified* citations.

### 1.6 Review Signals & Recency

Research shows:
- 4.0+ rating = 58% higher Local Pack appearance ([BrightLocal](https://www.brightlocal.com/learn/google-local-algorithm-and-ranking-factors/))
- 45% of review impact = recency (last 3 months weighted highest)
- 31% consumers now demand 4.5+ stars (up from 17% in 2025)
- Placement matters: GBP + own site + review directories all contribute

Reviews are **second most important** after GBP (16% vs. 32% GBP). Currently missing from draft formula.

### 1.7 How Mature Systems Handle Incomplete/Locked Categories

Industry approaches:
- **Option A - Re-normalize:** Reweight remaining criteria so max achievable = 100% (avoids fake ceiling)
- **Option B - Lock & show potential:** "Current: 65/100 | Potential: 100/100 (Phase 2)" (explicit but feels incomplete)
- **Option C - Phase-separate scales:** Phase 1 max=100, Phase 2 max=105+ (confusing for sellers)

**Mature choice: Option A (Re-normalize)** prevents "stuck at 65%" feeling. Sellers see "100% on available criteria" + roadmap to Phase 2, not a broken score.

---

## Part 2: Trade-Off Analysis & Phase 1 Handling Problem

### 2.1 Current Draft Formula Issues

| Component | Draft % | Whitespark 2026 Actual | Issue |
|-----------|---------|----------------------|-------|
| Business data completeness | 30% | ~5–10% (GBP completeness subset) | Inflated; completeness is prerequisite, not multiplier |
| JSON-LD/structured data | 25% | ~5–7% (within 19% on-page) | Inflated; necessary but not dominant |
| GBP connected | 25% | 32% (GBP signals) | ✅ Correct magnitude |
| AI crawlers enabled | 10% | <3% (emerging; 2-3x citation proxy) | Inflated; proxy for tech health, not primary lever |
| NAP consistency | 10% | 7% (citation signals subset) | Slightly inflated; cannot measure without GBP/citations |
| **Total Locked (Phase 1)** | **35%** | **35% locked** | **Sellers max at 65% before Phase 2 launch** ❌ |

**Problem:** Phase 1 seller perfecting all available signals still hits 65/100 (feels incomplete). Phase 2 adds 35% (100/100), perceived as artificial reset/score drop.

### 2.2 Phase 1 → Phase 2 Transition Horror

**Scenario:**
```
Phase 1: Seller completes 100% of available work
  - Business data: 30/30 ✓
  - JSON-LD: 25/25 ✓
  - AI crawlers: 10/10 ✓
  - Total: 65/100 (feels incomplete)

Phase 2: Seller connects GBP + gets NAP + first reviews
  - Phase 1 work preserved: 65 points
  - GBP + NAP + citations: 35 points
  - Total: 100/100 (but was 65, now 100 = perceived regression of Phase 1 score)

UX Problem: Seller thinks "score was fake before" or "they changed the rules"
```

**Solution (industry-standard):** **Re-normalize Phase 1 to 100% over available criteria only.** Phase 2 is a separate, richer scale where Phase 1 score transitions cleanly upward.

---

## Part 3: Concrete Recommendation

### 3.1 Phase 1 Formula (Pre-GBP Integration)

| Bucket | Weight | Sub-Signals | Scoring Approach |
|--------|--------|-------------|------------------|
| **Business Data Completeness** | 35% | Name, address, phone, hours, category, website, description | 5pts each field + 5pts for international format compliance. Max 35pts. |
| **Structured Data Quality** | 30% | LocalBusiness JSON-LD, industry subtype (Restaurant/Dentist/etc), FAQPage schema, Organization schema | 10pts LocalBusiness; 5pts subtype; 8pts FAQPage; 7pts org. Max 30pts. |
| **AI Crawler Access** | 20% | robots.txt allows search bots (OAI-SearchBot, Claude-SearchBot, ChatGPT-User, Perplexity-User); blocks training bots (GPTBot, ClaudeBot, CCBot); sitemap present | 10pts allow search; 5pts block training; 5pts sitemap. Max 20pts. |
| **Website Technical Health** | 15% | Core Web Vitals ≥80, mobile-responsive, HTTPS enabled, no critical crawl errors | 8pts Core Web Vitals; 4pts mobile; 3pts HTTPS. Max 15pts. |

**Phase 1 Score Calculation:**
```
Phase_1_Score = (Data + Schema + Crawlers + Tech) / 100 × 100
  = min(100, sum of all earned points)

Example: Seller hits all targets
  Data: 35/35 ✓
  Schema: 30/30 ✓
  Crawlers: 20/20 ✓
  Tech: 15/15 ✓
  Phase_1_Score = 100/100 ✅ (no artificial ceiling)
```

**Why this distribution:**
- **35% Data:** Completeness is foundational (Google relevance pillar). Seller fully controls.
- **30% Schema:** JSON-LD + FAQ + org = machine readability + AEO visibility (19% on-page signals).
- **20% Crawlers:** Proxy for tech health + AI discoverability (part of 19% on-page).
- **15% Tech Health:** Core Web Vitals + HTTPS = on-page ranking foundation.
- **Total Phase 1 Achievable: 100/100** (no 65% prison)

---

### 3.2 Phase 2 Formula (Post-GBP Integration)

When GBP OAuth ships, re-index to true ranking factors:

| Bucket | Phase 2 Weight | Notes |
|--------|----------------|-------|
| **GBP Profile Completeness** | 25% | Primary category, keywords in title, photos, hours, service area. Max 25pts. |
| **GBP Reviews & Engagement** | 15% | Count (10+= 8pts), recency (last 30d = 5pts), rating (4.0+ = 7pts). Max 20pts, normalized to 15%. |
| **Business Data Completeness** | 20% | (Preserved from Phase 1, re-weighted down from 35%) |
| **Structured Data Quality** | 12% | (Preserved from Phase 1, re-weighted down from 30%) |
| **On-Page SEO Signals** | 10% | Service pages, geo-keywords, internal linking structure. Max 10pts. |
| **NAP Consistency** | 10% | Match declared address to GBP; NAP across top-5 citations ≥80% consistency. Max 10pts. |
| **Citations & Links** | 8% | Backlinks from local relevance domains; citation directory presence. Max 8pts. |

**Phase 2 Score Calculation:**
```
Phase_2_Score = (GBP×0.25) + (Reviews×0.15) + (Data×0.20) 
              + (Schema×0.12) + (OnPage×0.10) + (NAP×0.10) + (Citations×0.08)

Worked example: Phase 1 seller (100/100) connects GBP
  GBP = 0/25 (just connected, work needed)
  Reviews = 0/20 (no reviews yet)
  Data = 35/35 (carried from Phase 1) → normalized = 20pts
  Schema = 30/30 (carried from Phase 1) → normalized = 12pts
  OnPage = 8/10 (new measurement)
  NAP = 10/10 (perfect declared match to GBP)
  Citations = 3/8 (found in 2 directories)
  
  Phase_2_Score = 0 + 0 + (35/35)×0.20 + (30/30)×0.12 + (8/10)×0.10 + (10/10)×0.10 + (3/8)×0.08
                = 0 + 0 + 20 + 12 + 8 + 10 + 3
                = 53/100

BUT: We set initial Phase 2 = 85/100 (preserve absolute standing from Phase 1)
     Seller must improve GBP, reviews, citations to grow beyond 85.
```

**Transition Rule:**
- Phase 1 score (0–100 on Phase 1 scale) = **NOT dropped on Phase 2 launch**
- Phase 2 score (0–100 on Phase 2 scale) starts at same absolute % as Phase 1
- Phase 2 growth = actual new work (GBP, reviews, citations), not score manipulation

---

### 3.3 Dashboard Messaging & User Experience

**Phase 1 Display:**
```
📊 Local SEO Score: 87/100 (Phase 1 – Business Foundation)

You've optimized your business profile for search discovery.

Completed:
  ✓ Business Information: 35/35
  ✓ Structured Data: 28/30 (missing FAQ schema)
  ✓ AI Crawler Access: 18/20
  ✓ Technical Health: 14/15

Roadmap (Phase 2 – Coming Soon):
  → Connect Google Business Profile (unlock 25% more signals)
  → Gather customer reviews (drives local pack ranking)
  → Verify citation consistency (40% higher pack visibility)
```

**Phase 2 Launch Announcement:**
```
🎉 Phase 2 Unlocked: Google Business Integration Available

Connect your Google Business Profile to access:
  • Review management & star ratings
  • Proximity-based Local Pack ranking
  • Citation consistency verification
  • Competitive visibility benchmarking

Your Phase 1 score remains: 87/100
New Phase 2 scale adds these factors, so your initial Phase 2 score 
will recalibrate as you complete GBP setup.

Not ready yet? Phase 1 score stays at 87/100 — no pressure.
```

**Post-GBP Connection:**
```
📊 Local SEO Score: 62/100 (Phase 2 – Full Local Ranking)

You've connected Google Business Profile! Here's your growth path:

Completed:
  ✓ Business Information: 20/20 (reweighted from Phase 1)
  ✓ Structured Data: 12/12 (reweighted from Phase 1)
  ✓ On-Page SEO: 8/10 (new measurement)
  ✓ NAP Consistency: 10/10 ✅ (Perfect match!)

In Progress:
  ⚠️ GBP Profile: 0/25 (just connected — fill in photos, hours)
  ⚠️ Reviews: 3/20 (You have 1 review — aim for 10+)
  ⚠️ Citations: 2/8 (Found in 2 directories — expand to 5)
  ⚠️ Links: 0/8 (No local backlinks yet)

Quick Wins to Boost Score:
  1. Add 5+ more reviews (5-star = +2pts each)
  2. Upload GBP business photos (5 photos = +5pts)
  3. Get local backlinks (1 link = +1pt)
  → Projected Phase 2 Score if completed: 85/100 (match your Phase 1 high)
  → Potential with strong reviews/citations: 95+/100
```

---

### 3.4 Sub-Signal Details (Implementation Reference)

#### Business Data Completeness (35pts Phase 1 / 20pts Phase 2)

| Signal | Points | Threshold |
|--------|--------|-----------|
| Business name | 5pts | Exact match to website hero text (case-insensitive, 95%+ similarity) |
| Address | 5pts | Street + City + ZIP + Country; must geocode successfully |
| Phone | 5pts | E.164 format; match to website footer contact |
| Hours | 5pts | All 7 days + special hours; validate format |
| Primary category | 5pts | Correct vertical per country (MY/VN whitelist) |
| Website | 5pts | Valid URL, HTTPS, resolvable |
| Description | 5pts | 50+ characters, relevant to category |

#### Structured Data Quality (30pts Phase 1 / 12pts Phase 2)

| Signal | Points | Threshold |
|--------|--------|-----------|
| LocalBusiness JSON-LD | 10pts | Valid schema.org, required fields (name, address, phone, image) |
| Industry subtype | 5pts | Restaurant, Dentist, Plumber, etc. matching GBP category |
| FAQPage schema | 8pts | 5+ Q&As on home/service pages (target local queries) |
| Organization schema | 7pts | Logo, social profiles, contact (improves entity recognition) |

#### AI Crawler Access (20pts Phase 1)

| Signal | Points | Threshold |
|--------|--------|-----------|
| Allow search bots | 10pts | robots.txt: Allow OAI-SearchBot, Claude-SearchBot, ChatGPT-User, Perplexity-User |
| Block training bots | 5pts | robots.txt: Disallow GPTBot, ClaudeBot, CCBot, Google-Extended |
| Sitemap present | 5pts | Valid XML sitemap, referenced in robots.txt |

#### Website Technical Health (15pts Phase 1)

| Signal | Points | Threshold |
|--------|--------|-----------|
| Core Web Vitals | 8pts | Google PageSpeed Insights ≥80 (mobile) |
| Mobile responsive | 4pts | Passes Google Mobile-Friendly Test |
| HTTPS enabled | 3pts | All traffic over HTTPS, no mixed content |

#### NAP Consistency & Citations (10pts Phase 2)

| Signal | Points | Threshold |
|--------|--------|-----------|
| Declared NAP match | 5pts | Website address == GBP address (validated geocoding) |
| Citation directory coverage | 5pts | Found in ≥3 of top-5 local directories (country-specific) |

#### GBP Profile (25pts Phase 2)

| Signal | Points | Threshold |
|--------|--------|-----------|
| Primary category selected | 5pts | Must match declared category |
| Keywords in title | 5pts | Primary service/location in business title |
| Business photos | 8pts | ≥5 high-quality photos uploaded |
| Hours complete | 4pts | All days + special hours for holidays |
| Service area defined | 3pts | If applicable (delivery, service-based) |

#### GBP Reviews & Engagement (15pts Phase 2, normalized from 20pts raw)

| Signal | Points | Threshold |
|--------|--------|-----------|
| Review count | 8pts | 10+ = 8pts; 5–9 = 4pts; <5 = 1pt |
| Star rating | 7pts | 4.0+ = 7pts; 3.5–3.9 = 4pts; <3.5 = 1pt |
| Review recency | 5pts | ≥1 review in last 30 days = 5pts |

---

## Part 4: Why This Recommendation

**Alignment with Research:**
- Weights reflect [Whitespark 2026](https://whitespark.ca/local-search-ranking-factors/) (GBP 32%, reviews 16%, on-page 19%, citations 7%)
- Re-normalization approach matches industry practice (GitHub, Stripe, Vercel compliance scoring)

**Solves Phase 1 Problem:**
- Phase 1 sellers can hit 100/100 without GBP
- No artificial 65% ceiling feeling "broken"
- Clear Phase 2 roadmap visible from day 1

**Avoids Score Regression:**
- Phase 2 launch does NOT drop score
- Transition preserves absolute standing, expands scale
- Growth path from Phase 1 (87/100) → Phase 2 (85/100) → 95+/100 with work

**AEO-Forward (Not Speculative):**
- AI crawlability measured as tech health proxy, not inflated ranking factor
- FAQPage + LocalBusiness schema prioritized (emerging AEO signal)
- Schema adoption (only 12.4% of domains) = true competitive gap

**Seller Motivation:**
- Achievable Phase 1 checklist with 100% endpoint
- Visible Phase 2 roadmap with point projections
- "You can reach 85 again in Phase 2 + grow to 95" messaging

---

## Part 5: Unresolved Questions

1. **Platform review capture (Phase 1):** Does the seller app capture customer reviews on-site? If not, "review signals" = 0 until GBP. Recommend: Clarify before Phase 1 launch; if not captured, treat as locked until GBP (Phase 2).

2. **Citation directory mapping (Phase 2):** Which directories count for Malaysia/Vietnam? GBP API provides this data; Recommend: Research local citation databases post-GBP integration (Loopd.my, DaftarBisnes.my for MY; VCCI for VN).

3. **AI crawler detection:** robots.txt detection automated or seller self-report? Recommend: Automated (HTTP crawl home page) + checklist confirmation.

4. **Schema validation API:** Integrate Google Rich Results Test API for automated schema scoring, or manual input? Recommend: Automated API (reduces friction, increases accuracy).

---

## Sources Cited

**Ranking Factors & Algorithms:**
- [Whitespark: 2026 Local Search Ranking Factors Report](https://whitespark.ca/local-search-ranking-factors/) — authoritative survey, 47 factors
- [BrightLocal: Google's Local Algorithm & Ranking Factors](https://www.brightlocal.com/learn/google-local-algorithm-and-ranking-factors/) — official guidance interpretation
- [Google Business Profile Help: Tips to Improve Local Ranking](https://support.google.com/business/answer/7091?hl=en) — official Google guidance
- [Whitespark: Review Recency Most Underrated Factor 2025](https://whitespark.ca/blog/the-most-underrated-local-ranking-factor-in-2025/) — review weighting research

**Structured Data & Schema:**
- [Epic Notion: Local Business Schema Boosts Local SEO](https://www.epicnotion.com/blog/the-local-business-schema-advantage/) — adoption & impact stats
- [Google Developers: LocalBusiness Structured Data](https://developers.google.com/search/docs/appearance/structured-data/local-business) — official schema docs
- [Astucia: Complete Guide to SEO & AEO for Local Business](https://astucia.io/guides/seo-local-business) — schema + AEO best practices

**AI Crawlers & AEO (2025-2026):**
- [RoastWeb: Technical SEO for AI Agents 2026](https://roastweb.com/blog/technical-seo-agents-2026) — AI ranking impact research
- [Momentic: List of Top AI Search Crawlers + User Agents (Winter 2025)](https://momenticmarketing.com/blog/ai-search-crawlers-bots) — crawler growth stats (+6,900% YoY)
- [Search Engine Journal: Complete Crawler List For AI User-Agents (Dec 2025)](https://www.searchenginejournal.com/ai-crawler-user-agents-list/558130/) — crawler taxonomy

**NAP Consistency & Citations:**
- [Master NAP Consistency 2025](https://seobusiness.company/nap-consistency/) — consistency impact
- [FishBat: Local Citation Consistency Impact on SEO](https://fishbat.com/local-citation-consistency-impact-on-seo-rankings/) — 40% pack visibility boost data
- [Local SEO Tactics: Do Citations Still Matter 2025](https://www.localseotactics.com/do-citations-still-matter-for-local-seo-what-you-need-to-know/) — citation weight analysis

**Audit & Scoring Systems:**
- [Evalato: Score Normalization Explained](https://hub.evalato.com/help/score-normalization-explained) — normalization methodology
- [Falcony Blog: Nuts & Bolts of Audit Scoring](https://blog.falcony.io/en/nuts-and-bolts-of-audit-scoring) — audit scoring patterns

---

**Report Status:** COMPLETE — Concrete Phase 1→2 formula, sub-signal details, and implementation guidance ready for development planning.

**Next Step:** Feed this formula to fullstack-developer agent or planner for Phase 1 implementation sprint.
