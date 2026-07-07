# F37 Local SEO Wireframes

> Approved direction. HTML wireframe follows this markdown.

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
	      Simple chart (new)
	      Top pages / products (new)
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

Purpose: show website activity from PostHog in the existing Analytics tab. This is where sellers see traffic, clicks, and orders.

### Desktop

```text
[F18 Sidebar]                     [F18 Top Header]
Dashboard *                       Store selector / bell / avatar

Main Content
Analytics                                           [7 days v]

[Overview] [Analytics *] [SEO]                      existing tabs

+------------------+ +------------------+ +------------------+ +------------------+
| Visitors         | | Clicks           | | Orders           | | Sales            |
| 1,240            | | 86               | | 24               | | RM 2,860         |
+------------------+ +------------------+ +------------------+ +------------------+

+--------------------------------------+ +------------------------------+
| Visitors by day                      | | Top pages                    |
|                                      | | 1. Home              520     |
|  bar chart, 7 days                   | | 2. Nasi Lemak        184     |
|                                      | | 3. Contact            76     |
+--------------------------------------+ +------------------------------+

+-------------------------------------------------------------+
| Top products                                                |
| Nasi Lemak Special        182 views       21 orders          |
| Teh Tarik Set             94 views        8 orders           |
+-------------------------------------------------------------+
```

### Mobile

```text
Dashboard
[Overview] [Analytics *] [SEO]

Analytics
[7 days v]

Visitors 1,240
Clicks 86
Orders 24
Sales RM 2,860

Visitors by day
[simple bar chart]

Top pages
Home 520
Nasi Lemak 184
Contact 76

Top products
Nasi Lemak Special
Teh Tarik Set
```

### Rules

- Reuse the existing Analytics tab.
- Do not show PostHog as a seller-facing brand in UI.
- No GA4, Search Console, impressions, average position, or technical analytics terms.
- Keep one simple chart and two ranked lists.

## 5. Screen B - Dashboard > SEO Tab

Purpose: show Local SEO as an extension of the existing SEO dashboard, not a separate product area.

### Desktop

```text
[F18 Sidebar]                     [F18 Top Header]
Dashboard *                       Store selector / bell / avatar
My Website
Core Operations
CRM
SETTINGS

Main Content
SEO Dashboard                                      [7 days v]

[Overview] [Analytics] [SEO *]                     existing tabs

+-----------------------------+ +-----------------------------+
| SEO Health Overview         | | Local SEO                   |
| existing card               | | Help nearby customers find  |
|                             | | your business               |
| Score: 75/100               | |                             |
| [AI Fix All Issues]         | | 45/100  Needs setup         |
|                             | | Missing: address, hours,    |
|                             | | Google connection           |
+-----------------------------+ |                             |
                                | [Continue setup]            |
                                +-----------------------------+

+-------------------------------------------------------------+
| Next steps                                                  |
| 1. Add business info                         [Continue]     |
| 2. Connect Google Business Profile           [Connect]      |
| 3. Allow AI search                           [Turn on]      |
+-------------------------------------------------------------+

+-------------------------------------------------------------+
| Google activity                                             |
| Calls --        Directions --        Website visits --       |
+-------------------------------------------------------------+
```

### Mobile

```text
Dashboard
[Overview] [Analytics] [SEO *]

SEO Health Overview
[existing SEO score card]

Local SEO
+--------------------------------------+
| 45/100                               |
| Needs setup                          |
| Missing: address, hours, Google      |
| [Continue setup]                     |
+--------------------------------------+

Next steps
1. Add business info          [Continue]
2. Connect Google             [Connect]
3. Allow AI search            [Turn on]

Google activity
Calls --   Directions --   Website visits --
```

### Rules

- Reuse the current SEO tab, card style, and action button style.
- Do not introduce a new dashboard top tab unless product explicitly approves later.
- Maximum 3 next steps.
- No formula, no crawler list, no technical score breakdown.
- "Allow AI search" is the friendly label for the one-click crawler setting.
- Google activity uses Google Business Profile only.

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
| Street                                                      |
| City                          Postcode                      |
| State dropdown                 Country: Malaysia             |
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
[Street]
[City] [Postcode]
[State dropdown]
[Country: Malaysia]

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
- PostHog event capture
- Score bucket calculation

Only show these when seller action is needed.

## 10. HTML Alignment Checklist

- Replace current standalone 5-screen HTML with this design-system-aligned 3-screen structure.
- Remove standalone AI Discovery tab.
- Remove new `Local SEO` sidebar route from wireframe.
- Show website analytics on existing Dashboard Analytics tab.
- Show Local SEO on existing Dashboard SEO tab.
- Show editable business data under Settings > Business Info.
- Keep PostHog + Google Business Profile only; no GA4/Search Console screen.
