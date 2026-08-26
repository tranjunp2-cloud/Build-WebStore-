# F37 Local SEO Wireframes

> Current US-F37-04 direction, reconciled with the implemented Dashboard on 2026-08-04. Future GBP/Analytics concepts remain roadmap-only.

## 1. Design System Fit

This wireframe follows the current repo layout:

- Use the existing F18 CMS shell: fixed top header, left sidebar, main content area.
- Do not add a new top-level `Local SEO` sidebar item.
- Use the existing Dashboard tab model: `Overview`, `Analytics`, `SEO`.
- Put Local SEO status inside the existing `Dashboard > SEO` screen.
- Put editable business data under the existing `SETTINGS` sidebar group as `Business Info`.
- Use current dashboard components visually: dark cards, rounded 12-16px panels, blue-to-teal primary action, neutral secondary buttons, status pills.

## 2. User Direction

Target user is a low-tech SME business owner. The UI should feel like a business setup assistant, not an SEO tool.

Use plain words:

- Business info
- Address
- Phone
- Opening hours
- Google Business Profile
- Calls
- Directions
- Website visits
- Website visitors
- Clicks

Avoid seller-facing words:

- NAP
- JSON-LD
- Schema
- Crawlers
- Bucket formula
- Google permission jargon

## 3. Information Architecture

```text
Existing sidebar
	Dashboard
	    Analytics tab
	      Website activity overview (existing tab, updated)
	      Traffic: visitors/pageviews (Vercel) + clicks/orders/sales (Payload)
	      Views + clicks chart (new)
	      Where visitors come from (Vercel) / Top products (Payload)
	    SEO tab
	      SEO Health Overview (existing)
	      Local SEO card (new)
	      Simple next steps (new)
	      Google activity from GBP (new)

  SETTINGS
    Payments
    Shipping
    Domains
    Business Info (new)
    Notifications
    Team & Account
```

## 4. Screen A - Dashboard > Analytics Tab

Purpose: show website activity in the existing Analytics tab. Two data sources, split by funnel stage — **Vercel Web Analytics** (audience: visitors, pageviews, country/device, referrer) + **Payload analytics** (conversion: clicks, orders, sales, top products). No PostHog, no GA4/GSC. Source of each block noted in `( )` for dev only — never surfaced in UI.

### Desktop

```text
[F18 Sidebar]                     [F18 Top Header]
Dashboard *                       Store selector / bell / avatar

Main Content
Analytics                                           [7 days v]

[Overview] [Analytics *] [SEO]                      existing tabs

+------------------+ +------------------+ +------------------+ +------------------+
| Visitors (Vercel)| | Clicks (Payload) | | Orders (Payload) | | Sales (Payload)  |
| 1,240            | | 86               | | 24               | | RM 2,860         |
+------------------+ +------------------+ +------------------+ +------------------+

+--------------------------------------+ +------------------------------+
| Views + clicks by day                | | Top products (Payload)       |
|                                      | | Nasi Lemak Special  182  21o |
|  bar chart, 7 days                   | | Teh Tarik Set        94   8o |
|  views=Vercel · clicks=Payload       | | Kopi Bundle          61   5o |
+--------------------------------------+ +------------------------------+

+-------------------------------------------------------------+
| Where visitors come from (Vercel)                           |
| Country:  MY 78%  ·  SG 11%  ·  Other 11%                    |
| Device:   Mobile 82%  ·  Desktop 18%                         |
| Referrer: google 40%  ·  facebook 22%  ·  direct 26%         |
+-------------------------------------------------------------+
```

### Mobile

```text
Dashboard
[Overview] [Analytics *] [SEO]

Analytics
[7 days v]

Visitors 1,240          (Vercel)
Clicks 86               (Payload)
Orders 24               (Payload)
Sales RM 2,860          (Payload)

Views + clicks by day
[simple bar chart]      views=Vercel · clicks=Payload

Top products            (Payload)
Nasi Lemak Special  21o
Teh Tarik Set        8o

Where visitors come from (Vercel)
MY 78% · Mobile 82% · google 40%
```

### Rules

- Reuse the existing Analytics tab.
- Two sources, split by funnel: Vercel = visitors/pageviews/country/device/referrer; Payload = clicks/orders/sales/top products. Each metric has exactly ONE source — never show pageviews from both (two mismatched numbers confuse sellers).
- Do not show "Vercel", "Payload", or any tool name as a seller-facing brand in UI — source labels here are dev-only.
- No GA4, Search Console, impressions, average position, or technical analytics terms.
- Keep one simple chart and a couple of ranked lists.

## 5. Screen B - Dashboard > SEO Tab

Purpose: show one authoritative SEO Health surface. The previous side-by-side legacy SEO Health + Local SEO cards, Score History, Action Tools, and max-three issue list are retired.

### Desktop

```text
[F18 Sidebar]                     [F18 Top Header]
Dashboard *                       Store selector / bell / avatar

Main Content
SEO Dashboard
[Overview] [Analytics] [SEO *]

+------------------------------------------------------------------+
| SEO Health                                                       |
|                                                                  |
|      67 / 100            Business Data      [======----] Needs work |
|      Needs work          Schema             [========--] Good       |
|                          AI Discoverability [==========] Good       |
|                          Technical Health   [=====-----] Needs work |
|                                                                  |
|  AI can fix 101 metadata issues          [Fix next 100 with AI]   |
|                                                                  |
|  SEO Issues                                      7 open           |
|  [AI] Missing meta titles (12)                       [Fix]         |
|  [AI] Missing meta descriptions (8)                  [Fix]         |
|  [You] Business address incomplete                   [Edit]        |
|  [You] Opening hours missing                         [Edit]        |
|  [You] Primary domain missing                        [Set up]      |
|  [You] Store is not published                       [Publish]     |
|  [You] Search verification missing                  [Set up]      |
+------------------------------------------------------------------+
```

### Mobile (375px)

```text
Dashboard
[Overview] [Analytics] [SEO *]

SEO Health
+--------------------------------------+
| 67 / 100          Needs work         |
|                                      |
| Business Data       [======----]     |
| Schema              [========--]     |
| AI Discoverability  [==========]     |
| Technical Health    [=====-----]     |
|                                      |
| AI can fix 101 metadata issues       |
| [Fix next 100 with AI]               |
|                                      |
| SEO Issues                    7 open  |
| [AI] Missing meta titles             |
| [Fix — full width, >=44px]           |
| [You] Business address incomplete    |
| [Edit — full width, >=44px]          |
| ...every remaining root cause...     |
+--------------------------------------+
```

### Rules

- Exactly one score card and one score source; no second Local SEO card or Score History.
- Four bucket bars show qualitative status, not point values or seller-facing formula details.
- Render all deduplicated seller-owned root causes; never truncate to three.
- Platform-managed crawler, Organization, and indexability signals never render seller controls.
- Metadata title/description issues use actor `AI`; seller-owned issues use actor `You`.
- AI action appears only for metadata gaps. Backlogs over 100 use “Fix next 100 with AI”; Local Business data never enters the AI proposal/apply flow.
- Actions use the allowlisted destination map: focused Editor settings, Domains, publish flow, page content, or product image alt.
- The `business-address` Edit action targets Contact Info Address, the single seller-edited street-address control.
- At 375px, issue actions are single-column, full-width, at least 44px high, with no horizontal overflow.
- Loading and error states show no numeric score.

## 6. Screen C - Settings > Business Info

Purpose: one familiar settings page for all business details used by website, Google, Maps, Waze, and Local SEO.

### Desktop

```text
[F18 Sidebar]                     [F18 Top Header]
Dashboard
My Website
Core Operations
CRM
SETTINGS
  Payments
  Shipping
  Domains
  Business Info *
  Notifications
  Team & Account

Main Content
Business Info
Used on your website and Google

+-------------------------------------------------------------+
| Google Business Profile                                     |
| Not connected                                               |
| Connect Google to import business details, show calls and   |
| directions, and sync opening hours.                         |
|                                                             |
| [Connect Google]                                            |
+-------------------------------------------------------------+

+-----------------------------+ +-----------------------------+
| Basic info                  | | Location                    |
| Business name               | | Paste Google Maps URL       |
| Phone number                | | [Find location]             |
| Business category           | | Map preview                 |
| Halal certified   [toggle]  | | [Google Maps] [Waze]        |
+-----------------------------+ +-----------------------------+

+-------------------------------------------------------------+
| Address                                                     |
| Contact Info address                                        |
| City                          Postcode                       |
| State dropdown                                               |
| Country is implicit Malaysia (MY); no Country control        |
+-------------------------------------------------------------+

+-------------------------------------------------------------+
| Opening hours                                               |
| Mon 09:00-18:00   Tue 09:00-18:00   Wed 09:00-18:00         |
| Thu 09:00-18:00   Fri 09:00-21:00   Sat 10:00-22:00         |
| Sun Closed                                                  |
+-------------------------------------------------------------+

                                      [Cancel] [Save changes]
```

### Mobile

```text
Business Info
Used on your website and Google

Google Business Profile
+--------------------------------------+
| Not connected                         |
| Connect to import details and show    |
| calls, directions, website visits.    |
| [Connect Google]                      |
+--------------------------------------+

Basic info
[Business name]
[Phone number]
[Business category]
[Halal certified toggle]

Location
[Paste Google Maps URL] [Find location]
[Map preview]
[Open Google Maps] [Navigate with Waze]

Address
[Contact Info address]
[City] [Postcode]
[State dropdown]
[Country is implicit MY; no field]

Opening hours
Mon [09:00] [18:00]
Tue [09:00] [18:00]
Wed [09:00] [18:00]
Thu [09:00] [18:00]
Fri [09:00] [21:00]
Sat [10:00] [22:00]
Sun [Closed]

[Save changes]
```

### Connected Google Variant

```text
Google Business Profile                         Linked
Kedai Makan Ali
Last synced: 3 hours ago

Imported from Google:
- Phone number
- Address
- Opening hours

Differences found: phone number
[Review differences] [Sync to Google]
```

Difference review:

```text
Phone number is different

Website: +60 12 345 6789
Google:  +60 19 888 7777

[Use website phone] [Use Google phone]
```

Do not label this as `NAP` in seller-facing UI.

## 7. Storefront Output

Business Info powers the storefront contact block.

```text
Visit us
12 Jalan Example, Kuala Lumpur
Open today: 09:00 - 18:00

[Open in Google Maps] [Navigate with Waze]
Halal Certified
```

Rules:

- Show Waze only when latitude and longitude exist.
- Show Halal badge only when enabled.
- If Google is not connected, use manually saved Business Info.

## 8. Component Mapping

| UI Need | Existing Pattern To Match |
|---------|---------------------------|
| Page shell | F18 CMS layout |
| Analytics entry point | F03 `DashboardTabs` Analytics tab |
| SEO entry point | F03 `DashboardTabs` SEO tab |
| Cards | Existing dashboard/card panels |
| Primary action | `Button` dash primary style |
| Secondary action | `Button` dash secondary style |
| Status label | `Badge` success/warning/secondary |
| Inputs | Existing settings form inputs |
| Save bar | Existing settings footer pattern |

## 9. Hidden System Work

Do not create seller screens for:

- LocalBusiness JSON-LD
- FAQ schema
- `llms.txt`
- AI crawler rules
- GBP token refresh
- Analytics event capture (Vercel auto / Payload track)
- Raw score formula and per-issue point values (the four qualitative bucket bars remain visible)

Only show these when seller action is needed.

## 10. HTML Alignment Checklist

- Replace current standalone 5-screen HTML with this design-system-aligned 3-screen structure.
- Remove standalone AI Discovery tab.
- Remove new `Local SEO` sidebar route from wireframe.
- Show website analytics on existing Dashboard Analytics tab.
- Show Local SEO on existing Dashboard SEO tab.
- Show editable business data under Settings > Business Info.
- Analytics sources = Vercel Web Analytics (audience) + Payload analytics (conversion); Google Business Profile for local actions only. No PostHog, no GA4/Search Console screen.
