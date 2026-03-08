# PrimeWeb — Malaysia Market Context

> **Version:** 1.0 | **Updated:** 2026-03-08  
> **Purpose:** Living reference document for all PRDs, user stories, and design decisions.  
> **Authority:** This document supplements SPEC.md §1 with Malaysia-specific market insights.

---

## 1. 🎯 Target Market Overview

- **Country:** Malaysia (MY)
- **Population:** ~34 million (2026)
- **Internet penetration:** 97%+
- **Mobile commerce:** 97.4% of online shoppers use smartphones
- **E-commerce market:** Growing 15-20% YoY
- **Languages:** Bahasa Melayu (BM), English (EN), Manglish (mixed BM/EN)
- **Currency:** MYR (Malaysian Ringgit) — format: `RM XX.XX`
- **Tax:** SST 6% (Sales & Service Tax)

---

## 2. 👤 Persona Cards

### Persona A: SME Owner (Local Seller)

| Field | Detail |
|-------|--------|
| **Who** | Small business owner — Modest Wear, F&B (Halal), Beauty/Cosmetics |
| **Age** | 25-45 |
| **Tech level** | Low — uses phone daily, but no web development experience |
| **Language** | BM primary, Manglish in daily life, some English |
| **Current tools** | WhatsApp Business, Instagram/TikTok for sales, Shopee/Lazada marketplace |
| **Goal** | "I want my own website so I look more legit than just selling on IG" |
| **Pain points** | Scared of technical setup, doesn't want to spend > 5 minutes configuring, price-sensitive |
| **Trigger** | Hari Raya / CNY / Deepavali season → needs a professional-looking shop fast |
| **Success = ** | Has a live website with products in < 10 minutes |

### Persona B: Dropshipper / Social Seller

| Field | Detail |
|-------|--------|
| **Who** | Resells products via TikTok Shop, Facebook, Instagram |
| **Age** | 20-35 |
| **Tech level** | Medium — uses multiple apps, familiar with order management |
| **Language** | Mix of BM and EN |
| **Current tools** | WhatsApp for order-taking, Excel/Google Sheets for inventory, multiple marketplace accounts |
| **Goal** | "I need one place to manage all my orders instead of juggling 5 apps" |
| **Pain points** | Inventory desyncs across channels, time wasted explaining shipping costs, no professional checkout |
| **Trigger** | Losing sales because WhatsApp DM checkout is unreliable |
| **Success = ** | Centralized inventory + professional checkout page they can share |

### Persona C: Malay Consumer (End-User / Buyer)

| Field | Detail |
|-------|--------|
| **Who** | Online shopper, mostly mobile |
| **Age** | 18-50 |
| **Tech level** | Medium — familiar with Shopee, Grab, food delivery apps |
| **Language** | BM or EN depending on context |
| **Behavior** | 97% mobile shopping, trusts known payment methods (FPX, e-wallets), checks for Halal cert |
| **Pain points** | Fears online fraud, wants order tracking via WhatsApp/SMS, prefers familiar payment |
| **Trust signals** | Halal certification badge, real business address, SSM registration number, customer reviews |
| **Success = ** | Easy checkout, familiar payment, order confirmation on WhatsApp |

---

## 3. 📋 Jobs-to-be-Done (JTBD)

| # | Job | Who | Priority |
|---|-----|-----|----------|
| J1 | **Create professional online presence in < 10 min** | SME Owner, Dropshipper | P0 |
| J2 | **Accept payments via local methods** (FPX, Touch 'n Go, GrabPay, Boost) | All | P0 |
| J3 | **Mobile-first shopping experience** (97% mobile users) | Consumer | P0 |
| J4 | **Build trust** — Halal cert display, SSM number, real address | Consumer → SME Owner | P1 |
| J5 | **Automate shipping cost calculation** (J&T, Pos Laju, Ninja Van) | SME Owner, Dropshipper | P1 |
| J6 | **Get found on Google** with local SEO (e.g., "Baju Raya 2026") | SME Owner | P1 |
| J7 | **Sync inventory across channels** (Shopee, Lazada, TikTok Shop) | Dropshipper | P2 |
| J8 | **Send order notifications via WhatsApp** (preferred channel in MY) | All | P1 |
| J9 | **Support cross-border sales** (SGD, IDR) | Dropshipper | P2 |

---

## 4. 💰 Payment Landscape (Malaysia 2026)

### Must-Have (P0)

| Method | Provider | Coverage | Notes |
|--------|----------|----------|-------|
| **FPX** | PayNet (via Stripe/Ipay88) | All Malaysian banks | Most trusted online banking method |
| **Credit/Debit Card** | Visa, Mastercard (via Stripe) | International | Standard for larger purchases |

### Should-Have (P1)

| Method | Provider | Coverage | Notes |
|--------|----------|----------|-------|
| **Touch 'n Go eWallet** | TNG Digital | 20M+ users | Most popular e-wallet in MY |
| **GrabPay** | Grab | 15M+ users | Integrated with Grab ecosystem |
| **Boost** | Axiata Digital | 10M+ users | Strong in small-town Malaysia |

### Integration Strategy
- **Wave 5-6:** Start with Stripe (cards) + manual bank transfer
- **Wave 7+:** Add FPX via Stripe Malaysia, then e-wallets via Ipay88 or Revenue Monster

---

## 5. 📦 Shipping Landscape (Malaysia)

| Carrier | Coverage | API | Notes |
|---------|----------|-----|-------|
| J&T Express | Nationwide | REST API | Most popular for e-commerce |
| Pos Laju | Nationwide | EasyParcel API | Government postal, trusted |
| Ninja Van | Nationwide + SEA | REST API | Good for cross-border |
| DHL eCommerce | International | REST API | For cross-border (P2) |

### Integration Strategy
- **Wave 5:** Flat-rate shipping (RM 5-15 by state)
- **Wave 7+:** API integration with EasyParcel (aggregates J&T, Pos Laju, Ninja Van)

---

## 6. 🕌 Cultural & UX Considerations

### Islamic Commerce
- **Halal certification** is critical for F&B and cosmetics businesses
- Display Halal cert badge prominently on product pages
- Support Halal cert upload & verification in product management
- Consider prayer time awareness for marketing emails/notifications

### Seasonal Commerce Peaks
| Season | When | Relevance |
|--------|------|-----------|
| **Hari Raya Aidilfitri** | April-May | Biggest shopping season — Baju Raya, kuih, hampers |
| **Chinese New Year** | Jan-Feb | Second biggest — red packets, decorations, F&B |
| **Deepavali** | Oct-Nov | Indian community — saris, sweets, decorations |
| **Year-end Sales** | Nov-Dec | 11.11, 12.12 mega sales (Shopee/Lazada influence) |
| **Back to School** | Dec-Jan | Uniforms, stationery, bags |

### Language & Communication
- WhatsApp is the #1 communication channel (90%+ penetration)
- SMS is fallback for order confirmations
- Manglish is common in casual copy — AI should understand mixed-language prompts
- Formal business copy should be proper BM or EN

### Trust Signals for MY Market
1. **SSM Registration Number** (Suruhanjaya Syarikat Malaysia)
2. **Halal Certification Badge** (JAKIM)
3. **Physical Business Address**
4. **WhatsApp Contact Button** (not just email)
5. **COD (Cash on Delivery) option** — still preferred by many
6. **Customer Reviews / Testimonials** with real photos

---

## 7. 🏷️ Feature Priority Matrix (Malaysia-Specific)

| Priority | Feature | Rationale for MY Market |
|----------|---------|------------------------|
| **🔴 P0** | AI Chat Builder (BM/EN) | Removes language + tech barrier for SMEs |
| **🔴 P0** | Mobile-First Storefront | 97.4% shop on mobile |
| **🔴 P0** | Card Payment (Stripe) | Basic payment — launch requirement |
| **🔴 P0** | SST 6% Tax Calculation | Legal requirement in Malaysia |
| **🟡 P1** | FPX Bank Transfer | Most trusted payment method in MY |
| **🟡 P1** | E-wallet Integration | Touch 'n Go, GrabPay, Boost |
| **🟡 P1** | WhatsApp Order Notifications | #1 communication channel |
| **🟡 P1** | AI SEO (MY Keywords) | "Baju Raya 2026", "Kuih Raya murah" |
| **🟡 P1** | Shipping Calculator | J&T, Pos Laju rates by state |
| **🟢 P2** | Halal Traceability Badge | Competitive advantage for F&B/cosmetics |
| **🟢 P2** | Cross-border Currency (SGD/IDR) | Singapore and Indonesia buyers |
| **🟢 P2** | Multi-channel Sync | Shopee, Lazada, TikTok Shop integration |
| **🟢 P2** | COD Payment Option | Still preferred in rural areas |

---

## 8. 📊 Key Metrics for MY Market

| Metric | Target | Why |
|--------|--------|-----|
| Time to live site | < 10 min | SME attention span — lose them after 10 min |
| Mobile Lighthouse score | > 90 | 97% mobile users — speed is critical |
| Payment conversion rate | > 40% | Cart → successful payment |
| WhatsApp integration adoption | > 60% | If we build it, adoption should be high |
| BM content generation quality | > 8/10 | AI must produce natural BM copy |

---

> [!NOTE]
> This document should be updated as we learn more from beta users.  
> Cross-reference this when writing PRDs for payment (F17), shipping, and trust features.
