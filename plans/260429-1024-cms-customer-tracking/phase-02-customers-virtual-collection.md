# Phase 02 — Customers Virtual Collection + List View

## Context links
- Plan: [plan.md](./plan.md)
- Depends on: [phase-01-tenant-access-refactor.md](./phase-01-tenant-access-refactor.md)
- Pattern reference: Payload 3.79 `admin.components.views.list` override
- Related: `src/payload.config.ts:104-143`

## Overview
- Date: 2026-04-29
- Description: Register `customers` virtual collection (no fields persisted, no DB table) with custom List view that aggregates ContactSubmissions + Subscribers by `lower(trim(email))` per `site_id`. Detail view = deep-link to filtered child lists (no synthetic doc).
- Priority: P2
- Implementation status: pending
- Review status: pending

## Key insights
- Payload 3.79 allows registering a collection with no DB persistence by skipping `MIGRATIONS` entry AND defining `dbName` collisions — but cleanest path: register a real (empty) collection AND override List view; never create/update docs through it. To avoid DB churn, set all access to `read: () => true` filtered by helper, and `create/update/delete: () => false`. Payload still creates an empty `customers` table (1 col `id`); acceptable, single migration entry needed.
- **REVISED**: Add a minimal migration `CREATE TABLE IF NOT EXISTS customers (id serial PRIMARY KEY)` to satisfy Payload Drizzle expectations + CI gate. Single line, no field columns. Triggers `payload_locked_documents_rels.customers_id` + `payload_preferences_rels.customers_id` ALTERs (mandatory per pattern in db-setup.js:1285).
- Aggregation runs server-side in custom List view component (Payload 3 supports React Server Components in admin views).
- Identity key = `email.trim().toLowerCase() + '|' + siteId`.

## Requirements
**Functional**
1. Sidebar shows "Customers" entry under tenant-owner + super-admin nav.
2. List columns: Email · Name (from latest contact) · Site · Contact count · Newsletter (yes/no) · Last activity.
3. Filters: `siteId` (dropdown, scoped), source-type (contact/newsletter/both), date range (createdAt).
4. Detail view (clicking row): two-tab page — "Contact submissions" tab links to `/admin/collections/contact-submissions?where[email][equals]=X&where[site][equals]=Y` + "Newsletter" tab same for subscribers.
5. Tenant-owner sees only own sites' customers; super-admin sees all + optional `siteId` filter.

**Non-functional**
- Render <2s on 1000 contact + 1000 subscriber rows.
- Component file ≤200 LOC; aggregator helper ≤100 LOC.

## Architecture
```
src/collections/Customers.ts                  ← virtual collection config
  slug: 'customers'
  access: { read: siteScopedReadAlwaysTrue, create/update/delete: false }
  admin.components.views.list = './customers-list-view'
  fields: [ { name: 'id', type: 'text' } ]   ← stub (Payload requires fields[])

src/components/admin/customers-list-view.tsx  ← RSC List override
  ├─ resolves req.user → tenantSiteIds
  ├─ parallel: fetch contact-submissions + subscribers (where site IN siteIds)
  ├─ groupBy(lower(trim(email)) + '|' + siteId)
  ├─ render Payload <DefaultListView> with computed rows + columns
  └─ handles filters via URL query params

src/lib/customers/aggregate.ts                ← pure aggregator (testable)
  type CustomerRow = { key, email, name?, siteId, contactCount, isSubscriber, lastActivityAt }
  function aggregate(contacts, subscribers): CustomerRow[]

src/payload.config.ts                         ← +1 import, +1 array entry

scripts/db-setup.js                           ← +3 MIGRATIONS entries
  - customers.create_table
  - payload_locked_documents_rels.customers_id
  - payload_preferences_rels.customers_id
```

Data flow:
```
Admin → /admin/collections/customers
   → customers-list-view (RSC) reads searchParams (siteId, sourceType, from, to)
   → tenantSiteIds(req)
   → payload.find({ collection: 'contact-submissions', where: {...}, limit: 5000, depth: 0 })
   → payload.find({ collection: 'subscribers',          where: {...}, limit: 5000, depth: 0 })
   → aggregate(contacts, subscribers) → rows[]
   → render columns + pagination (in-memory after aggregate)
```

## Related code files
**READ**
- `src/payload.config.ts` (registration shape)
- `scripts/db-setup.js:1285,2387` (MIGRATIONS pattern + locked_docs_rels pattern)
- `src/access/tenant-scope.ts` (from phase-01)
- Payload docs: custom views (`/ck:docs-seeker payload custom views 3.79`)

**MODIFY**
- `src/payload.config.ts` (add Customers import + array entry)
- `scripts/db-setup.js` (3 migration entries; update `COLLECTION_SLUGS[]` line ~3595 to include `'customers'`)

**CREATE**
- `src/collections/Customers.ts`
- `src/components/admin/customers-list-view.tsx`
- `src/lib/customers/aggregate.ts`

**DELETE**
- none

## Implementation steps
1. **Verify** Payload 3.79 view override API: `admin.components.views.list` accepts component path. Check via docs-seeker. If signature differs, switch to `views.list.Component`.
2. **Create** `src/lib/customers/aggregate.ts` — pure function:
   - Input: `contacts: ContactSubmission[]`, `subs: Subscriber[]`.
   - Normalize key = `${email.trim().toLowerCase()}|${typeof site === 'object' ? site.id : site}`.
   - Build Map<key, CustomerRow>; merge contact = increment `contactCount`, set `name` from latest, update `lastActivityAt = max(lastActivityAt, createdAt)`.
   - Merge subscriber = set `isSubscriber = true`, update `lastActivityAt`.
   - Return sorted by `lastActivityAt desc`.
3. **Create** `src/collections/Customers.ts`:
   ```ts
   export const Customers: CollectionConfig = {
     slug: 'customers',
     admin: {
       useAsTitle: 'email',
       defaultColumns: ['email','name','site','contactCount','isSubscriber','lastActivityAt'],
       components: { views: { list: '/components/admin/customers-list-view#default' } },
     },
     access: {
       read: siteScopedRead,    // reuse helper for permission gate (table is empty anyway)
       create: () => false,
       update: () => false,
       delete: () => false,
     },
     fields: [{ name: 'placeholder', type: 'text', admin: { hidden: true } }],
   }
   ```
4. **Create** `src/components/admin/customers-list-view.tsx` (RSC):
   - Read `searchParams`: `siteId?`, `sourceType?` (contact|newsletter|both), `from?`, `to?`.
   - Resolve `req` via Payload's `getServerSideProps`-equivalent for admin views (verify exact API in step 1).
   - Build `where` for both queries. Cap `limit: 5000`. If either returns ≥5000 → render warning banner "Dataset truncated. Filter or contact admin."
   - Call `aggregate()`, render table with columns. Use Payload's UI primitives (`@payloadcms/ui`) for theming.
5. **Register** in `src/payload.config.ts`: add `import { Customers } from './collections/Customers'` and append to `collections[]`.
6. **Add migrations** to `scripts/db-setup.js` (atomic with collection registration per orchestration rule):
   ```js
   { name: 'customers.create_table',
     sql: `CREATE TABLE IF NOT EXISTS customers (
       id serial PRIMARY KEY,
       placeholder varchar,
       updated_at timestamp(3) with time zone DEFAULT now() NOT NULL,
       created_at timestamp(3) with time zone DEFAULT now() NOT NULL);` },
   { name: 'payload_locked_documents_rels.customers_id',
     sql: `ALTER TABLE payload_locked_documents_rels ADD COLUMN IF NOT EXISTS customers_id integer;` },
   { name: 'payload_preferences_rels.customers_id',
     sql: `ALTER TABLE payload_preferences_rels ADD COLUMN IF NOT EXISTS customers_id integer;` },
   ```
   Add `'customers'` to `COLLECTION_SLUGS[]` (line ~3595).
7. **Run** `node scripts/check-migrations.js origin/staging` locally → must pass.
8. **Run** `npm run build` → confirm Payload generates types for Customers and admin loads.
9. **Manual smoke** (defer detailed scenarios to phase-03): log into admin as super-admin → /admin/collections/customers → verify rows render.

## Todo
- [ ] Verify view override API on Payload 3.79
- [ ] Create `aggregate.ts` + cover edge cases (empty email, missing site, casing)
- [ ] Create `Customers.ts` collection
- [ ] Create `customers-list-view.tsx`
- [ ] Register in `payload.config.ts`
- [ ] Add 3 migrations to `db-setup.js` + add slug to COLLECTION_SLUGS
- [ ] `check-migrations.js` passes
- [ ] Build passes
- [ ] Smoke: list view loads for super-admin

## Success criteria
- `/admin/collections/customers` renders aggregated rows.
- Filter by `siteId` query param narrows results.
- `contactCount` reflects actual ContactSubmissions count for that email+site.
- `isSubscriber` true iff Subscribers row exists for email+site.
- Page renders <2s with seeded 100/100 dataset.
- `check-migrations.js` exit 0.

## Risk assessment
| Risk | L×I | Mitigation |
|------|-----|------------|
| Payload 3.79 view override path syntax wrong | M×H | Verify in step 1 via docs-seeker BEFORE writing component |
| Aggregator runs on >5k rows → slow | M×M | Hard cap + warning banner; document fallback to materialized table |
| Empty `customers` table breaks Payload schema sync | L×H | Mirror exact pattern from `subscribers` migration; include locked_docs_rels + preferences_rels ALTERs |
| RSC fetch lacks `req.user` context | M×H | Verify Payload exposes user in admin RSC views; if not, switch to client component + REST fetch |
| Aggregation key collision (super-admin sees same email across sites) | L×L | Key includes siteId → distinct rows by design |

## Security considerations
- `read` access uses `siteScopedRead` from phase-01 — same default-deny posture.
- Aggregator must never leak rows from sites NOT in `tenantSiteIds`.
- All `payload.find` calls use `overrideAccess: false` (default) so access control still applies.
- No PII logged (email never sent to logger).

## Next steps
- Phase 03 verifies tenant isolation + UX matrix.
- Post-merge docs-manager: create `docs/architecture/F24-customer-tracking.md`, append to `docs/CHANGELOG.md`, update `docs/CODEBASE_SUMMARY.md` collections list.
