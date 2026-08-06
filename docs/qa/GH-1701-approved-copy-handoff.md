# GH-1701 Approved Copy QA Handoff

## Scope

Review the English and Malay copy applied from `docs/translation-dev-view.csv`.
Runtime logic, locale codes, loaders, APIs, and schemas are unchanged.

Use `docs/issue-1701-phase2-qa-matrix.csv` as the old/new source of truth.
Filter by `area`, `location`, or `key` before testing a surface.

## Manual Smoke Matrix

| Surface | Routes / state | Desktop | 375px | Focus |
|---|---|:---:|:---:|---|
| Auth | `/login`, `/register`, `/forgot-password`, validation errors | [ ] | [ ] | Labels, placeholders, CTA and error copy |
| Dashboard | `/dashboard`, navigation, modal and destructive states | [ ] | [ ] | Long Malay text, tables, confirmations |
| Products | Product list/form, categories, AI draft drawer | [ ] | [ ] | Draft wording, singular/plural, currency labels |
| Editor | `/editor/[siteId]`, panels, AI prompts, SEO overwrite dialog | [ ] | [ ] | No removed suggestion-chip copy or raw keys |
| Settings | Payments, email templates, profile, shipping | [ ] | [ ] | Upload error spacing, `{time}`, current SSO copy |
| Storefront | Products, cart, checkout, order confirmation | [ ] | [ ] | Payment/shipping copy and concatenated values |
| Landing | `/` and `/templates` | [ ] | [ ] | List boundaries and long Malay array items |
| Help | `/help`, modules and Q&A | [ ] | [ ] | Step objects render normally, never `[object Object]` |
| Emails | Preview/send representative templates | [ ] | N/A | Placeholders and HTML remain valid |

## Required Checks

- Switch between EN and MS without raw keys or blank labels.
- Trigger modal, toast, validation, empty, and error states listed in the QA
  matrix; initial page load does not expose all changed copy.
- Confirm no `[object Object]`, broken HTML, or unresolved `{placeholder}` is
  rendered.
- Confirm long Malay copy wraps without clipping or horizontal overflow at
  375px.
- Confirm landing string arrays retain the intended number and order of items.
- Confirm removed editor/profile/discount/blog UI is not reintroduced.

## Preserved Decisions

- 15 context-changed keys retain current behavior-aware copy.
- Three order-detail Malay keys retain `Nama`, `Kaedah`, and `Percuma`
  because the CSV incorrectly proposes `Email` for all three.
- 23 branding-conflict keys retain `Web Store`.
- 55 obsolete or superseded paths remain absent.
- `landing.solutions.industries.retail.points` retains its current four-item
  array pending corrected Malay item boundaries.
- Four help step object arrays retain their current nested content because the
  CSV contains only `[object Object]`.
- `dashboard.settings.emailTemplates.lastEdited` retains `{time}`.

Log visual defects separately unless the approved copy directly causes the
layout failure. Attach screenshots for any 375px overflow finding.
