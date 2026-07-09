# PRD: Studio Log & Issue Tracking (F39)
> **Version:** 1.1 | **Created:** 2026-07-08 | **Agent:** `docs-engineer`
> **Priority:** P1 | **Sprint:** Wave TBD | **Size:** L
> **Depends on:** F02 Auth ✅ (super-admin role + `requireSuperAdmin`), Sentry integration ✅ (already in production), existing Prime Studio shell ✅ (`/studio/*`, `admin-nav-config.ts`, `/studio/issues` pattern)
> **Blocks:** None

---

> [!IMPORTANT]
> **Stories-First Rule (adapted for this PRD):** ech-prime-web-v2's convention normally requires a pre-approved `docs/stories/F[XX]-stories.md` file before a PRD is written. **F39 is a net-new internal tooling feature with no prior story file** — this PRD originates all `US-F39-*` stories directly in Section 6 and copies their AC into Section 11, per the `/prd` skill methodology (Use Cases → INVEST stories → GIVEN/WHEN/THEN AC). Extracting these into a standalone `docs/stories/F39-studio-log-issue-tracking-stories.md` before implementation is recommended in Definition of Ready — it does not block this PRD.

---

## 0. Story Traceability

> No separate approved story file exists yet. All stories below are originated in this PRD (Section 6) and every FR in Section 7 references one of them.

| Story ID | Title | Defined In | Status |
|----------|-------|------|--------|
| US-F39-01 | Unified log & error table | Section 6 (this PRD) | Draft |
| US-F39-02 | Filter & search across sources | Section 6 (this PRD) | Draft |
| US-F39-03 | Error detail view | Section 6 (this PRD) | Draft |
| US-F39-04 | Tenant vs platform attribution | Section 6 (this PRD) | Draft |
| US-F39-05 | Graceful per-source degradation | Section 6 (this PRD) | Draft |
| US-F39-06 | Studio nav integration & RBAC guard | Section 6 (this PRD) | Draft |
| US-F39-07 | Tenant health overview | Section 6 (this PRD) | Draft |

> ⚠️ Every FR in Section 7 maps to one of the Story IDs above.

---

## 1. Problem Statement

Prime Studio (`/studio/*`) is the internal super-admin console for the whole platform — one Next.js deployment on Vercel that serves both platform code and every tenant's public storefront (via subdomain/custom-domain rewrite in `middleware.ts`). Runtime errors already appear in three useful but disconnected places: Sentry (issues/exceptions), Vercel (runtime logs for a selected deployment), and the `AiUsageLogs` Payload collection (AI pipeline failures). Tenant operational state also lives separately in existing `Tenants`, `Sites`, domain status fields, and `AiGenerationRecords`. None of these sources answer the simple ops question "which tenant is unhealthy, where, and why?" in one place. Today, catching a tenant-site error requires an engineer to know which dashboard or collection to check, log into it, and manually search — there is no unified visibility, so incidents are found by user reports rather than by the team. F39 is needed now because Sentry is already instrumented in production (`src/instrumentation.ts`, `global-error.tsx`, `sites/[slug]/error.tsx`) but has no internal-facing surface, and the team is currently flying blind on cross-tenant error volume.

---

## 2. Target User

- **Primary user:** Internal Prime Commerce super-admin — ops/on-call engineer, dev team member, or founder-level staff who already has `super-admin` role and access to `/studio/*`. No external (seller/tenant) user ever sees this page.
- **Technical level:** High — comfortable reading stack traces, HTTP status codes, and log severities. No hand-holding UI copy needed (unlike seller-facing Dashboard features).
- **Language:** English (internal tool; no bilingual EN/MY requirement — Studio is not seller-facing).
- **Behavior:** Primarily desktop, often reactive (checking after a Lark alert or a bug report) but sometimes proactive (daily/weekly error sweep). Wants to triage fast: source, tenant, severity, and a stack trace, in as few clicks as possible.

---

## 3. Solution Overview

F39 adds a new Studio page, **"Logs & Errors"** at `/studio/logs`, that server-side fetches from three event sources — Sentry issues, Vercel deployment runtime logs, and `AiUsageLogs` failures — in parallel, normalizes each into a common row shape, and renders one native table inside Studio. The same page also shows a **Tenant Health** summary built from existing data only: `Tenants`, `Sites`, domain status, `AiGenerationRecords`, `AiUsageLogs`, Sentry, and Vercel. Ops staff can answer "which tenant is unhealthy, where, and why?" before drilling into rows. It is **not** an embedded iframe and it creates **no new MVP database table or collection**. This is a **read-only MVP**: triage and visibility only, no assign/resolve/comment workflow — those actions still happen natively in Sentry, Vercel, or Payload Admin.

---

## 4. Scope

### In Scope
- New Studio route `/studio/logs` guarded by `requireSuperAdmin` (US-F39-06)
- Server-side aggregation from 3 sources: Sentry Issues API, Vercel Runtime Logs API for a selected/latest deployment, and `AiUsageLogs` Payload collection (US-F39-01)
- Unified table: source, severity, message/title, tenant (or Platform/Unknown), timestamp, occurrence count (US-F39-01)
- Tenant Health summary: tenant, health status, affected area, latest issue, source, and last seen, derived from existing collections/APIs only (US-F39-07)
- Filters: source (multi-select), platform-vs-tenant scope, specific tenant slug, severity, time range (US-F39-02)
- Free-text search across message/title/stack (US-F39-02)
- Row → detail view: stack trace, tenant, URL, timestamp, occurrence count, first/last seen, source deep-link (US-F39-03)
- Tenant attribution: attach `tenant_slug`/`tenant_hostname` context to newly captured Sentry events so rows can be filtered by tenant vs platform (US-F39-04)
- Per-source graceful degradation (one source down/rate-limited ≠ page broken) (US-F39-05)
- Server-side response caching to respect external API rate limits (US-F39-05)
- New Studio nav item under "Monitoring" section in `admin-nav-config.ts` (US-F39-06)
- Manual refresh + polling auto-refresh with visible "data as of" timestamp (US-F39-01)
- Pagination for the unified table (US-F39-01)

### Out of Scope
- **Any write-back action** — assign, resolve, mute, comment, change status. Resolving an issue still happens natively in Sentry/Vercel/Payload Admin; F39 only links out to them.
- Two-way sync back to Sentry (no bidirectional state).
- A custom log ingestion pipeline — F39 only reads from selected existing sources; it does not become a new log destination.
- PostHog integration — PostHog is not installed in this repo today and is deferred to backlog until there is a clear product analytics/error-tracking decision.
- New database collection/table for tenant health — MVP computes health at request time from existing collections and external APIs.
- Persisted health history, SLA reporting, or incident timelines — can be added later only if the runtime aggregator is not enough.
- Merging into or modifying `/studio/issues` (`template-issues` collection) — that page remains the separate, manual template-feedback tool and is untouched.
- Cross-source deduplication of the same underlying incident (e.g. a crash that produces both a Sentry exception and a Vercel function-error log line is shown as two separate rows, each clearly source-tagged — no fuzzy matching in MVP).
- Alerting / notification rules (Lark, email, PagerDuty-style) — F39 is a pull (visit-the-page) tool, not a push system.
- Historical backfill/re-tagging of pre-F39 events that lack tenant attribution (see BR-08, Risk R-04).
- Multi-org or cross-project Sentry support — single Sentry org/project matching this deployment only.
- Vercel Log Drains, build logs, static logs, and persisted historical log ingestion — deferred unless a separate managed log-ingestion decision is approved.

### Related PRDs / Boundaries

| Related doc | Relationship to F39 | F39 decision |
|-------------|---------------------|--------------|
| F18 CMS Layout | F18 is seller-facing CMS layout, not the Prime Studio shell. | F39 does not depend on F18 and must not add seller dashboard nav. |
| F03 Dashboard | F03 owns seller-facing business analytics, SEO dashboard, and Google/GSC roadmap. | F39 Tenant Health is internal ops only; it does not replace seller dashboard analytics. |
| F19 Store Configuration + Vercel Domain Migration | F19 owns seller domain setup and Vercel domain verification. | F39 reads existing domain/site status only; no new domain schema, no auto-verify workflow, no mutation. |
| F22 Tracking & Analytics | F22 owns seller-entered GA/Pixel/TikTok tracking scripts. | F39 does not use seller tracking scripts and does not introduce PostHog in MVP. |
| F01 AI Builder / F05 AI Editor | These own generation, editor, publish, autosave, and maintenance-mode user flows. | F39 can surface failed generation/publish signals, but intentional maintenance/unpublish is not automatically unhealthy. |
| F04 Block Renderer | F04 owns storefront block rendering and graceful block-level errors. | F39 can surface Sentry runtime issues from block rendering; it must not change renderer behavior. |
| F09/F13/F34 Commerce & Payments | These own checkout, order creation, Stripe/Xendit payment flows. | F39 can classify related issues as `checkout`, but it does not reconcile orders or mutate payment state. |
| F37 Local SEO | F37 owns local SEO, GBP/GSC OAuth, NAP consistency, and technical SEO score. | F39 may read `Sites` fields for context only; it does not duplicate Local SEO scoring or Google OAuth scope. |
| F99 CI/CD Monitoring | F99 owns CI/CD, Sentry alerting, health checks, and Lark notification architecture. | F39 is a pull-based Studio surface; alerting/push rules stay outside MVP. |

---

## 5. Success Metrics

| Metric | Target | Measured By |
|--------|--------|-------------|
| Time-to-detect a tenant-site error (report → visible on `/studio/logs`) | < 5 min from Sentry ingest (bounded by cache TTL) | Compare Sentry event timestamp vs. row appearance in aggregator cache |
| % of production incidents triaged starting from `/studio/logs` (vs. logging into Sentry/Vercel/Payload Admin directly) | ≥ 70% within 60 days of launch | Team self-report / internal survey each sprint retro |
| MTTR proxy: time from row-click (detail view opened) to source deep-link click | Tracked, no hard target in MVP — establish baseline in first 30 days | Studio-side click event (reuse Payload `analytics` collection or simple log) |
| Page availability when 1 of 3 sources is failing | 100% (page still renders other available sources, zero full-page 500s attributable to a single source outage) | Synthetic test / incident review |
| Time to identify unhealthy tenant + affected area | < 30 seconds from opening `/studio/logs` | Manual ops check in staging/production incident drills |
| Aggregation API p95 latency | < 3s server-side | APM / Sentry performance span on `/api/studio/logs` |

---

## 6. User Story Summary

> AC in full at Section 11. Summarized here for readability.

### US-F39-01 — Unified log & error table
```
AS A  super-admin on-call for the platform
I WANT to see issues/logs from Sentry, Vercel, and AiUsageLogs in one table
SO THAT I don't have to check separate dashboards and admin collections to know what's broken
```

### US-F39-02 — Filter & search across sources
```
AS A  super-admin triaging incidents
I WANT to filter by source, tenant vs platform, specific tenant, severity, and time range, and free-text search
SO THAT I can narrow thousands of log rows down to the ones relevant to the incident I'm investigating
```

### US-F39-03 — Error detail view
```
AS A  super-admin who found a suspicious row
I WANT to open a detail view with the full stack trace, tenant/URL context, and a link back to the source system
SO THAT I can diagnose the root cause without leaving Studio, then jump to the source tool if I need to act
```

### US-F39-04 — Tenant vs platform attribution
```
AS A  super-admin scanning the table
I WANT every row clearly labeled as a specific tenant, "Platform", or "Unknown"
SO THAT I never confuse a platform-wide outage with a single seller's storefront bug
```

### US-F39-05 — Graceful per-source degradation
```
AS A  super-admin relying on this page during an incident
I WANT the page to keep working even if one source API (e.g. Sentry or Vercel) is down or rate-limited
SO THAT a third-party outage never blocks me from seeing Sentry data, which is the primary source
```

### US-F39-06 — Studio nav integration & RBAC guard
```
AS A  Prime Commerce internal team
I WANT "Logs & Errors" to appear in the Studio nav and be restricted to super-admins only
SO THAT the tool is discoverable internally and never exposed to sellers or the public
```

### US-F39-07 — Tenant health overview
```
AS A  super-admin monitoring tenant websites
I WANT to see each tenant's health status, affected area, latest issue, source, and last seen
SO THAT I can quickly know which website needs attention and where to investigate first
```

---

## 7. Functional Requirements

> **Priority key:** P0 = must have (blocker) / P1 = important / P2 = nice to have

| FR-ID | Requirement | Story Ref | Priority | Notes |
|-------|-------------|-----------|----------|-------|
| FR-01 | System MUST expose a new route `/studio/logs`, server-rendered, guarded by `requireSuperAdmin()` in addition to the existing `middleware.ts` `/studio/*` role check | US-F39-06 | P0 | Reuse `src/lib/admin/auth-guard.ts` pattern from `src/app/studio/issues/page.tsx` |
| FR-02 | System MUST add a nav item `{ href: '/studio/logs', label: 'Logs & Errors' }` under the existing "Monitoring" section in `admin-nav-config.ts`, alongside "User generations" and "Issues & feedback" | US-F39-06 | P0 | `src/app/studio/_components/admin-nav-config.ts` |
| FR-03 | System MUST fetch recent issues from the Sentry REST API (organization issues endpoint), server-side, scoped to this project | US-F39-01 | P0 | Sentry = PRIMARY source |
| FR-04 | System MUST fetch recent runtime logs for a selected/latest Vercel deployment via `GET /v1/projects/{projectId}/deployments/{deploymentId}/runtime-logs`, server-side, scoped to `VERCEL_TEAM_ID`/`VERCEL_PROJECT_ID` | US-F39-01 | P0 | Requires `deploymentId`; build/static logs are not part of the REST MVP and require Log Drains if approved later |
| FR-05 | System MUST query the `ai-usage-logs` Payload collection directly (Payload local API) for rows where `success = false`, surfacing `errorCode`, `endpoint`, `model`, `user`, `tenant` | US-F39-01 | P0 | No new collection — reuse `src/collections/AiUsageLogs.ts` |
| FR-06 | System MUST NOT include PostHog in the MVP source list; PostHog remains backlog until a separate analytics/error-tracking decision is approved | US-F39-01 | P0 | Keeps MVP focused on already-used Sentry, Vercel, and Payload data |
| FR-07 | Each unified row MUST display: source badge (Sentry/Vercel/AI Usage), severity, message/title (truncated), tenant label (tenant slug, "Platform", or "Unknown"), timestamp, occurrence count | US-F39-01 | P0 | Common `LogEntry` shape — see §13.3 |
| FR-08 | Filter bar MUST support multi-select filtering by source | US-F39-02 | P0 | |
| FR-09 | Filter bar MUST support a platform-vs-tenant scope toggle (All / Platform only / Tenant only) | US-F39-02 | P0 | |
| FR-10 | Filter bar MUST support filtering by a specific tenant slug (searchable input/dropdown) | US-F39-02 | P0 | Disabled/no-op when scope = "Platform only" |
| FR-11 | Filter bar MUST support multi-select filtering by severity, normalized across sources into a shared scale (Critical / Error / Warning / Info) | US-F39-02 | P0 | Cross-source severity mapping owned by Dev — see Open Question #2 |
| FR-12 | Filter bar MUST support a time range selector (Last 1h / 24h / 7d / 30d / custom range) | US-F39-02 | P0 | Default range TBD — see Open Question #3 |
| FR-13 | Filter bar MUST support free-text search across message/title and (where available) stack trace content | US-F39-02 | P1 | Client-side filter over the already-fetched page is acceptable for MVP; server-side full-text search is P2 |
| FR-14 | Clicking a row MUST open a detail view showing: full stack trace (or raw payload for non-exception sources), tenant, URL, timestamp, occurrence count, first seen, last seen, and a deep link to the record in its source system (Sentry/Vercel console, or the Payload admin record for AI Usage Logs) | US-F39-03 | P0 | No inline mutation controls rendered — read-only, see BR-03 |
| FR-15 | The unified table MUST be paginated (cursor or offset-based), default page size 50 | US-F39-01 | P0 | Mirrors `LIMIT = 50` pattern already used in `src/app/studio/issues/page.tsx` |
| FR-16 | `src/instrumentation.ts`'s `onRequestError` handler MUST set a Sentry tag (`tenant_slug` or `tenant_type: platform`) derived from the `x-tenant-slug`/`x-tenant-type` request headers already set by `middleware.ts`, before calling `captureRequestError` | US-F39-04 | P0 | New instrumentation work — headers exist today but are not yet attached to Sentry events |
| FR-17 | `src/app/global-error.tsx` and `src/app/sites/[slug]/error.tsx` (client boundaries, no access to request headers) MUST set a best-effort `tenant_hostname` Sentry tag derived from `window.location.hostname` before `Sentry.captureException(error)` | US-F39-04 | P0 | Client-side fallback — subdomain parsing mirrors the logic already in `middleware.ts` |
| FR-18 | The unified table MUST render events lacking any tenant tag as "Unknown" rather than silently defaulting them to "Platform" | US-F39-04 | P0 | Protects against mis-attribution of legacy events (Risk R-04) |
| FR-19 | Each source fetch MUST run independently (e.g. `Promise.allSettled`) — a failure or timeout on one source MUST show an inline per-source error banner in the table, while the other sources still render their rows | US-F39-05 | P0 | Never let one 3rd-party outage 500 the whole page |
| FR-20 | Server-side aggregation responses MUST be cached with a short TTL (target ~60s) to stay within Sentry/Vercel rate limits, and the UI MUST show a "data as of {time}" timestamp | US-F39-05 | P0 | |
| FR-21 | The page MUST support a manual "Refresh" button and MAY auto-refresh on a polling interval (target ~60s); no WebSocket/SSE requirement for MVP | US-F39-01 | P1 | Precedent: `liveDot` on `/studio/generations` nav item signals "live" UX exists elsewhere, but polling is sufficient here — see Open Question #4 |
| FR-22 | System MUST render a Tenant Health summary above or beside the logs table, showing at minimum: tenant slug/name, health status, affected area, latest issue/message, source, and last seen | US-F39-07 | P0 | Health is computed from existing data only |
| FR-23 | Tenant Health MUST use existing `Tenants`, `Sites`, `AiGenerationRecords`, `AiUsageLogs`, Sentry, and Vercel data; it MUST NOT add a new Payload collection, DB table, or persistent cache in MVP | US-F39-07 | P0 | Least DB expansion rule |
| FR-24 | Tenant Health MUST classify affected area into a small fixed set: `runtime`, `generation`, `publish`, `domain`, `checkout`, or `unknown` | US-F39-07 | P1 | Simple labels for triage, not a workflow engine |
| FR-25 | Clicking a Tenant Health row MUST apply the tenant filter to the unified table or open a read-only tenant health detail panel with related log rows | US-F39-07 | P1 | No mutation controls |

---

## 8. Business Rules

- **BR-01:** `/studio/logs` is accessible ONLY to users with role `super-admin` — enforced at both `middleware.ts` (`/studio/*` JWT role check, routing hint) and `requireSuperAdmin()` server-side (real security boundary), matching the existing `/studio/issues` pattern.
- **BR-02:** F39 introduces NO new PII collection. It aggregates telemetry that already exists in Sentry, Vercel, and `AiUsageLogs`. `AiUsageLogs` already excludes prompt/completion content by design (see `src/collections/AiUsageLogs.ts` comment) — F39 does not change that policy or surface prompt content.
- **BR-03:** F39 is **strictly read-only**. No assign/resolve/mute/comment/status-change controls are rendered anywhere in the UI. All such mutation actions happen in the native source tool (Sentry, Vercel, or Payload Admin); the detail view's only actionable control besides "Close" is "Open in {source}".
- **BR-04:** `/studio/issues` (`template-issues` Payload collection, manual template feedback) is NOT modified, merged, cross-linked, or referenced by F39. It remains a fully separate feature.
- **BR-05:** All external API secrets (Sentry API token, Vercel API token) MUST be sourced from environment variables and never committed or hardcoded. The existing `SENTRY_AUTH_TOKEN` (build-time, GitHub Secrets, sourcemap upload only) is NOT reused for runtime API reads — a separate runtime-scoped token is required (see §14 Dependencies). Vercel token usage must be confirmed because the existing domain-management code already reads `VERCEL_TOKEN` at runtime.
- **BR-06:** A failure, timeout, or rate-limit response from any single external source MUST NOT produce an HTTP 500 for `/studio/logs` as a whole. Each source fetch is isolated (`Promise.allSettled` or equivalent) with its own error state.
- **BR-07:** Whenever cached data is served instead of a fresh fetch, the UI MUST display the cache timestamp ("data as of {time}") so ops staff can judge staleness during a rate-limit backoff window.
- **BR-08:** Tenant attribution defaults to "Platform" ONLY for requests confirmed to be platform-side (non-`/sites/[slug]/*` routes, e.g. `/studio`, `/dashboard`, `/admin`). Any event with a missing or unparseable tenant tag renders as "Unknown" — it is never guessed to be "Platform" or a specific tenant.
- **BR-09:** Tenant Health is computed at request time from existing sources only. MVP MUST NOT create a new health collection/table, write health snapshots, or introduce a persistent cache schema. If short TTL caching is needed, use in-memory/runtime cache only.
- **BR-10:** Tenant Health status is a triage label, not a workflow state. MVP uses simple precedence: `unhealthy` if there is a recent critical/error log, failed AI generation, failed AI usage call, or broken domain signal; `warning` if there are recent warnings or stale/unknown status signals; `healthy` if no issue is found in the selected time range; `unknown` if source data cannot be loaded.
- **BR-11:** Intentional seller/platform states (e.g. maintenance mode, unpublished site, disabled payment method) are NOT automatically unhealthy. Tenant Health should only mark them unhealthy when paired with an unexpected error, failed workflow, or broken configuration signal.
- **BR-12:** Vercel source scope in MVP is limited to runtime logs returned by the official deployment logs REST endpoint. F39 MUST NOT claim build/static log coverage unless a later Log Drains integration exists.

---

## 9. User Flow

> No wireframe file exists yet for F39 — `ui-ux-designer` should produce `docs/design/F39-studio-log-issue-tracking-wireframes.md` before implementation. The flows below describe the primary happy path and key alternate paths.

### Flow A: Triage a tenant-site error (happy path)

```text
Super-admin gets a report ("bobs-cafe checkout is broken")
  ↓
Opens Studio → clicks "Logs & Errors" in Monitoring section
  ↓
Tenant Health shows bobs-cafe as Unhealthy, affected area = checkout/runtime
  ↓
Sets scope filter to "Tenant only", types tenant slug "bobs-cafe"
  ↓
Table refreshes: shows Sentry + AiUsageLogs rows tagged tenant_slug=bobs-cafe
  ↓
Sorts/scans by timestamp, clicks the most recent Critical row
  ↓
Detail view opens: stack trace, URL /sites/bobs-cafe/checkout, first/last seen, count = 12
  ↓
Clicks "Open in Sentry" → jumps to native Sentry issue to assign/resolve
```

### Flow B: Daily sweep across all sources

```text
Super-admin opens `/studio/logs` with no filters (default: All sources, All scope, Last 24h)
  ↓
Scans unified table sorted by timestamp desc, severity color-coded
  ↓
Notices a spike of "Unknown" tenant rows from Sentry
  ↓
Filters source = Sentry only, scope = Unknown/unattributed
  ↓
Opens a few detail views to confirm root cause pattern (e.g. shared checkout bug)
  ↓
Files a ticket referencing the deep-linked source records
```

### Flow C: One source is down (degraded state)

```text
Super-admin opens `/studio/logs`
  ↓
Sentry and AiUsageLogs fetch and render normally
  ↓
Vercel Runtime Logs API times out / rate-limited
  ↓
Table renders available rows + an inline banner:
  "Could not load Vercel logs — showing cached data from 42 min ago" (or "no cache available, retry")
  ↓
Super-admin continues triage using Sentry and AI Usage; clicks "Retry" for Vercel later
```

### Flow D: Non-super-admin attempts access

```text
Non-super-admin user (or unauthenticated) navigates to /studio/logs
  ↓
middleware.ts decodes payload-token JWT → role check fails (or no token)
  ↓
Redirected to /admin (same behavior as any other /studio/* route today)
```

### Flow E: Daily Tenant Health sweep

```text
Super-admin opens `/studio/logs`
  ↓
Scans Tenant Health summary sorted by worst status / latest issue
  ↓
Sees tenant "bobs-cafe" with status = Unhealthy, affected area = domain, source = Sites
  ↓
Clicks the row
  ↓
Unified table filters to bobs-cafe and the detail panel shows related domain/log context
```

---

## 10. Screen Layout

> **[Prime Studio Constraint]** Render inside the existing Prime Studio shell under `/studio/*`, matching the `/studio/issues` page pattern. Do not use or modify the seller-facing F18 CMS layout.

### 10.1. Main Screen — Tenant Health + Logs & Errors table

- **Description:** Single-page monitoring view with a Tenant Health summary and unified table. No new navigation item beyond `/studio/logs`.
- **Main components:**
  - **Header:** Title "Logs & Errors", "Data as of {time}" indicator, manual "Refresh" button.
  - **Tenant Health summary:** Compact table or cards showing Tenant, Health, Affected area, Latest issue, Source, Last seen. Computed from existing sources only.
  - **Filter bar:** Source multi-select · Scope toggle (All / Platform / Tenant) · Tenant slug search (enabled when scope = Tenant) · Severity multi-select · Time range picker · Free-text search box.
  - **Data table:** Columns — Severity (icon+color), Source (badge), Message/Title (truncated, click to open detail), Tenant (slug / "Platform" / "Unknown"), Last seen (relative time), Count. Row click opens detail view.
  - **Per-source status strip:** small row of chips ("Sentry ✓", "Vercel ✓", "AI Usage ✓") so degraded sources are visible without opening detail.
  - **Pagination:** footer, "Load more" or numbered pages, page size 50.
- **Design / Wireframe:** TBD — `docs/design/F39-studio-log-issue-tracking-wireframes.md` (not yet created, see §9 note).

### 10.2. Detail View — Error/Log Record

- **Description:** Slide-over drawer (preferred, keeps table context) or dedicated route, opened from a table row click. Read-only.
- **Main components:**
  - **Header:** Severity + source badge + title/message, "Read-only" indicator, Close (X).
  - **Metadata block:** Tenant, URL/route, environment, first seen, last seen, occurrence count.
  - **Stack trace / payload viewer:** monospace, collapsible, syntax-highlighted where available (Sentry/Vercel); raw JSON fallback for AiUsageLogs entries without a trace.
  - **CTA:** "Open in {Sentry / Vercel / Payload Admin}" — external link, opens in new tab. This is the ONLY actionable control besides Close.
- **Design / Wireframe:** TBD — same file as §10.1.

### 10.3. Tenant Health Detail

- **Description:** Read-only detail panel opened from a Tenant Health row.
- **Main components:**
  - **Header:** Tenant name/slug, health status, affected area, last seen.
  - **Context block:** Site/domain status from existing `Sites` data where available.
  - **Related rows:** Matching `LogEntry[]` from Sentry, Vercel, and AI Usage for the selected tenant and time range.
  - **CTA:** "Filter logs to this tenant" and source deep-links only. No mutation controls.
- **Database rule:** No health snapshot is written for MVP.

### 10.4. UI States & Modals

- **Empty State:** No rows match current filters — "No errors found for this filter" + a "Clear filters" action. Distinct from "source failed to load" (§10.1 status strip).
- **Loading State:** Skeleton table rows (5–8 shimmering rows), matching the loading pattern used elsewhere in Studio.
- **Per-Source Error State:** Inline banner in the status strip (not a full-page error) — "Could not load {source}" + "Retry" button; if a cached response exists, show it with a staleness timestamp instead of blocking.
- **Access Denied:** No dedicated screen — `middleware.ts` redirects non-super-admins to `/admin` before the page renders (Flow D).
- **Modals:** None required for MVP — detail view is a drawer, not a modal dialog.

---

## 11. Acceptance Criteria

### AC-1: Unified table loads rows from all MVP sources

> Source: US-F39-01

```gherkin
GIVEN a super-admin opens /studio/logs with default filters (All sources, All scope, Last 24h)
  AND Sentry, Vercel, and AiUsageLogs all respond successfully
WHEN  the page finishes loading
THEN  the table renders rows from all three MVP sources, each carrying a visible source badge
  AND rows are sorted by timestamp descending by default
  AND the "Data as of {time}" indicator is shown
```

### AC-2: Filter by source

> Source: US-F39-02

```gherkin
GIVEN the unified table is showing rows from all three MVP sources
WHEN  the super-admin selects only "Sentry" and "AI Usage" in the source filter
THEN  the table shows only rows whose source is Sentry or AI Usage
  AND the per-source status strip still reflects the fetch status of Sentry, Vercel, and AI Usage
```

### AC-3: Platform vs tenant scope filter

> Source: US-F39-02

```gherkin
GIVEN rows exist tagged as specific tenants, "Platform", and "Unknown"
WHEN  the super-admin sets scope = "Tenant only"
THEN  only rows with a resolved tenant slug are shown
  AND "Platform" and "Unknown" rows are hidden

WHEN  the super-admin instead sets scope = "Platform only"
THEN  only rows tagged tenant_type=platform are shown
```

### AC-4: Filter by specific tenant slug

> Source: US-F39-02

```gherkin
GIVEN scope filter is set to "Tenant only"
WHEN  the super-admin types "bobs-cafe" into the tenant slug filter
THEN  the table shows only rows whose tenant slug equals "bobs-cafe"
  AND no rows from other tenants or Platform/Unknown appear
```

### AC-5: Severity filter

> Source: US-F39-02

```gherkin
GIVEN rows exist across Critical, Error, Warning, and Info severities
WHEN  the super-admin selects only "Critical" and "Error"
THEN  the table shows only rows normalized to Critical or Error severity, regardless of source
```

### AC-6: Time range filter

> Source: US-F39-02

```gherkin
GIVEN the default time range is "Last 24h"
WHEN  the super-admin switches to "Last 7d"
THEN  the aggregator re-fetches (or re-filters cached data) for the wider window
  AND the table updates to include older rows within the new range
```

### AC-7: Free-text search

> Source: US-F39-02

```gherkin
GIVEN the table has rows loaded for the current filter set
WHEN  the super-admin types "checkout" into the search box
THEN  only rows whose message/title (or stack trace, where available) contains "checkout" (case-insensitive) remain visible
```

### AC-8: Detail view shows full context

> Source: US-F39-03

```gherkin
GIVEN a row is visible in the unified table
WHEN  the super-admin clicks the row
THEN  a detail view opens showing: stack trace (or raw payload), tenant, URL, timestamp, first seen, last seen, occurrence count
  AND a CTA "Open in {source}" links to the record in its native system
  AND no edit/assign/resolve/comment controls are rendered anywhere in the detail view
```

### AC-9: Pagination

> Source: US-F39-01

```gherkin
GIVEN more than 50 rows match the current filters
WHEN  the super-admin scrolls to the bottom of the table / clicks "Load more"
THEN  the next page of up to 50 rows loads and appends (or replaces, per pagination pattern chosen) without losing current filters
```

### AC-10: RBAC guard blocks non-super-admins

> Source: US-F39-06

```gherkin
GIVEN a user without the super-admin role (or an unauthenticated visitor)
WHEN  they navigate to /studio/logs directly
THEN  middleware.ts redirects them to /admin before any log data is fetched or rendered
  AND requireSuperAdmin() in the page component provides the same guarantee as defense-in-depth
```

### AC-11: Graceful degradation when one source fails

> Source: US-F39-05

```gherkin
GIVEN Sentry and AiUsageLogs respond successfully
  AND the Vercel Runtime Logs API call times out or returns an error
WHEN  the super-admin loads /studio/logs
THEN  the table still renders all rows from Sentry and AiUsageLogs
  AND the status strip shows a Vercel error/degraded chip with a "Retry" action
  AND the page does NOT return an HTTP 500 or blank screen
```

### AC-12: Cached fallback and rate-limit handling

> Source: US-F39-05

```gherkin
GIVEN a source's fresh fetch fails due to rate limiting
  AND a cached response from within the TTL window exists
WHEN  the page renders
THEN  the cached rows for that source are shown
  AND a "cached {N} min ago" indicator is shown in that source's status chip
  AND no rate-limit error is surfaced to the user as a page-breaking error
```

### AC-13: Missing tenant tag renders as "Unknown", never mis-attributed

> Source: US-F39-04

```gherkin
GIVEN a Sentry event was captured before F39's tagging instrumentation shipped (no tenant_slug/tenant_type tag)
WHEN  it appears in the unified table
THEN  its tenant column shows "Unknown"
  AND it is NOT shown when the scope filter is set to "Platform only" or a specific tenant slug
  AND it IS shown when scope = "All"
```

### AC-14: Mobile / tablet responsive

> Source: Additional Criteria (internal tool — best-effort, not primary target)

```gherkin
GIVEN screen width < 768px
WHEN  a super-admin accesses /studio/logs on a tablet
THEN  the filter bar collapses into a single "Filters" expandable panel
  AND the table remains horizontally scrollable without breaking layout
  AND the detail view opens full-screen instead of as a side drawer
```

### AC-15: Tenant Health overview uses existing data only

> Source: US-F39-07

```gherkin
GIVEN a super-admin opens /studio/logs
  AND tenant/site records, AI generation records, AI usage failures, Sentry issues, and Vercel logs are available
WHEN  the page finishes loading
THEN  a Tenant Health summary shows tenant, health status, affected area, latest issue, source, and last seen
  AND unhealthy tenants are visible without typing a tenant filter first
  AND no new Payload collection or database table is created or required for Tenant Health

WHEN  the super-admin clicks a tenant health row
THEN  the unified table is filtered to that tenant or a read-only tenant detail panel opens
  AND the user can inspect related rows without any mutation controls
```

---

## 12. Non-Functional Requirements

| Category | Requirement | Notes |
|----------|-------------|-------|
| **Performance** | Aggregation API (`GET /api/studio/logs`) p95 < 3s server-side; initial page paint uses skeleton rows while sources load | Parallel fetch via `Promise.allSettled`, not sequential |
| **Security** | Route requires `super-admin` role, enforced at both `middleware.ts` and `requireSuperAdmin()`; all external API tokens read server-side only, never exposed to the client bundle | See BR-01, BR-05 |
| **Reliability** | A single external source outage/timeout/rate-limit MUST NOT produce a full-page failure — per-source isolation and graceful degradation (BR-06) | Covered by AC-11, AC-12 |
| **Rate limiting** | Server-side caching (~60s TTL) on every external API response to stay within Sentry/Vercel quotas; exponential backoff on retry | See FR-20, BR-07 |
| **Data / Privacy** | No new PII is collected; `AiUsageLogs`'s existing no-prompt-content policy is preserved; stack traces may contain source snippets — visible to super-admins only | See BR-02 |
| **Database footprint** | Tenant Health MUST use existing collections/APIs only for MVP; no new collection/table or persisted health snapshot | See BR-09 |
| **Accessibility** | Filter bar and table are keyboard-navigable; severity is conveyed by icon + text, not color alone; WCAG 2.1 AA target | Internal tool, but Studio-wide a11y bar still applies |
| **Browser support** | Chrome, Safari, Edge — latest 2 versions (internal team's actual browsers) | |
| **Device support** | Desktop-first (primary use case); tablet 768px best-effort per AC-14; mobile 375px not a hard requirement for this internal tool | Differs from seller-facing Dashboard features which require full mobile parity |

---

## 13. Technical Architecture

### 13.1 Components

| Component | File | Description |
|-----------|------|--------------|
| `LogsPage` | `src/app/studio/logs/page.tsx` | Server component — `requireSuperAdmin()` guard + initial parallel fetch of all 3 MVP sources |
| `LogsTable` | `src/app/studio/logs/_components/logs-table.tsx` | Client component — renders unified rows, handles pagination, opens detail view |
| `LogFilters` | `src/app/studio/logs/_components/log-filters.tsx` | Client component — source/scope/tenant/severity/time-range/search controls |
| `LogDetailPanel` | `src/app/studio/logs/_components/log-detail-panel.tsx` | Client component — read-only drawer with stack trace + source deep-link |
| `TenantHealthSummary` | `src/app/studio/logs/_components/tenant-health-summary.tsx` | Client component — renders computed tenant health rows and applies tenant filters |
| `TenantHealthDetailPanel` | `src/app/studio/logs/_components/tenant-health-detail-panel.tsx` | Client component — read-only tenant health context + related rows |
| `SourceStatusStrip` | `src/app/studio/logs/_components/source-status-strip.tsx` | Client component — per-source fetch status chips (ok / cached / error) |
| Sentry client | `src/lib/studio/logs/sentry-client.ts` | Wraps Sentry organization issues API call |
| Vercel client | `src/lib/studio/logs/vercel-client.ts` | Wraps Vercel deployment runtime logs API call, scoped to `VERCEL_TEAM_ID`/`VERCEL_PROJECT_ID` and a selected/latest `deploymentId` |
| AI Usage client | `src/lib/studio/logs/ai-usage-client.ts` | Queries `ai-usage-logs` Payload collection for `success = false` rows |
| Tenant data client | `src/lib/studio/logs/tenant-health-client.ts` | Reads existing `tenants`, `sites`, `ai-generation-records`, and related status data; no writes |
| Aggregator | `src/lib/studio/logs/aggregator.ts` | `Promise.allSettled` fan-out, normalizes each source into `LogEntry`, computes `TenantHealthRow[]`, applies cache, returns per-source status |
| API route | `src/app/api/studio/logs/route.ts` | `GET` endpoint used by client-side filter changes/refresh; super-admin guarded |
| Sentry tagging (server) | `src/instrumentation.ts` | Extend `onRequestError` to set `tenant_slug`/`tenant_type` tag from request headers |
| Sentry tagging (client) | `src/app/global-error.tsx`, `src/app/sites/[slug]/error.tsx` | Extend to set `tenant_hostname` tag from `window.location.hostname` before capture |
| Nav config | `src/app/studio/_components/admin-nav-config.ts` | Add `{ href: '/studio/logs', label: 'Logs & Errors' }` to "Monitoring" section |

### 13.2 API Endpoints

```
GET /api/studio/logs
Query params: source[], scope (all|platform|tenant), tenantSlug, severity[], range (1h|24h|7d|30d|custom), from, to, q, cursor
Response: {
  success: boolean,
  data: {
    items: LogEntry[],
    tenantHealth: TenantHealthRow[],
    nextCursor: string | null,
    sourceStatus: {
      sentry: { ok: boolean, cachedAt?: string, error?: string },
      vercel: { ok: boolean, cachedAt?: string, error?: string },
      aiUsageLogs: { ok: boolean, cachedAt?: string, error?: string }
    },
    fetchedAt: string
  }
}
Auth: super-admin only (session cookie + requireSuperAdmin(), same as page route)
```

```
type LogEntry = {
  id: string                       // source-prefixed unique id, e.g. "sentry:1234"
  source: 'sentry' | 'vercel' | 'ai-usage-logs'
  severity: 'critical' | 'error' | 'warning' | 'info'
  title: string
  tenant: { slug: string; label: string } | { label: 'Platform' } | { label: 'Unknown' }
  url?: string
  timestamp: string                // last seen
  firstSeen?: string
  count: number
  stackTrace?: string
  raw?: Record<string, unknown>    // fallback payload for sources without a trace
  sourceUrl: string                // deep link to native system
}

type TenantHealthRow = {
  tenantId: string
  tenantSlug: string
  tenantName?: string
  status: 'healthy' | 'warning' | 'unhealthy' | 'unknown'
  affectedArea: 'runtime' | 'generation' | 'publish' | 'domain' | 'checkout' | 'unknown'
  latestIssue: string
  source: 'sentry' | 'vercel' | 'ai-usage-logs' | 'site-status' | 'ai-generation-records'
  lastSeen: string
  relatedLogIds: string[]
  siteUrl?: string
}
```

### 13.3 Data Flow

```
Browser (GET /studio/logs or filter change → /api/studio/logs)
        │
        ▼
requireSuperAdmin() guard ──fail──▶ redirect /admin
        │ pass
        ▼
aggregator.ts: Promise.allSettled([
   sentry-client.fetchIssues(filters)      ──▶ Sentry Org Issues API
   vercel-client.fetchLogs(filters)        ──▶ Vercel Runtime Logs API (deploymentId required)
   ai-usage-client.fetchFailures(filters)  ──▶ Payload local API (ai-usage-logs)
   tenant-health-client.fetchBaseData()    ──▶ Payload local API (tenants/sites/ai-generation-records)
])
        │  normalize each fulfilled result → LogEntry[]
        │  compute TenantHealthRow[] from LogEntry[] + existing tenant/site/generation data
        │  each rejected/timed-out promise → sourceStatus[x].error + serve cache if present
        ▼
Merge, sort by timestamp desc, paginate → { items, tenantHealth, sourceStatus, fetchedAt }
        │
        ▼
TenantHealthSummary renders health rows + LogsTable renders rows + SourceStatusStrip renders per-source chips
        │
        ▼
Row click → LogDetailPanel (uses already-fetched LogEntry, no extra round-trip for MVP)
```

**Tenant tagging data flow (background, feeds Sentry rows):**
```
Request hits middleware.ts → sets x-tenant-slug / x-tenant-type headers
        │
        ▼ (server errors)                         ▼ (client errors)
instrumentation.ts onRequestError                  global-error.tsx / sites/[slug]/error.tsx
  reads request headers                              reads window.location.hostname
  Sentry.setTag('tenant_slug', ...)                   Sentry.setTag('tenant_hostname', ...)
  Sentry.setTag('tenant_type', 'platform'|'tenant')
        │                                             │
        └──────────────► Sentry event stored with tenant tags ◄──────────────┘
                                     │
                                     ▼
                    sentry-client.ts reads tags → LogEntry.tenant
```

---

## 14. Dependencies

| Dependency | Status | Action Needed |
|-----------|--------|---------------|
| `requireSuperAdmin()` guard | ✅ | Reuse as-is (`src/lib/admin/auth-guard.ts`) |
| `middleware.ts` `/studio/*` role check | ✅ | No change needed — already covers new route by prefix |
| `AiUsageLogs` Payload collection | ✅ | Reuse as-is, query `success = false` |
| `AiGenerationRecords` Payload collection | ✅ | Reuse as-is for generation/publish health signals |
| `Tenants` / `Sites` Payload collections | ✅ | Reuse as-is for tenant list, site status, and domain health signals |
| Sentry SDK already integrated (`@sentry/nextjs`) | ✅ | Extend `instrumentation.ts` + error boundaries for tenant tagging (FR-16, FR-17) |
| Sentry runtime-readable API token (org auth token, minimum scope `event:read` for the verified issue/event endpoints) | ⬜ | Create in Sentry org settings; add as NEW env var (e.g. `SENTRY_API_TOKEN`) to Vercel Dashboard per `.env.staging.example` / `.env.production.example` — distinct from the existing build-time `SENTRY_AUTH_TOKEN` |
| Vercel runtime-readable API token | ⬜ | Confirm whether the existing `VERCEL_TOKEN` used by domain-management runtime code can also be used for logs, or add a separate least-privilege runtime token if needed |
| `VERCEL_TEAM_ID` / `VERCEL_PROJECT_ID` | ✅ | Already present in `.env.staging.example` — reuse |
| Vercel `deploymentId` source | ⬜ | Required by the official runtime logs endpoint. Implementation must resolve the latest production deployment or accept a selected deployment before calling Vercel logs. |
| Vercel Log Drains | ⬜ Deferred | Needed only for build/static/persistent historical logs; out of MVP. |
| `admin-nav-config.ts` edit | ⬜ | Add one `NavItem` entry under "Monitoring" |
| `docs/design/F39-*-wireframes.md` | ⬜ | `ui-ux-designer` to produce before implementation kickoff |
| `docs/stories/F39-studio-log-issue-tracking-stories.md` | ⬜ | Recommended extraction from Section 6/11 of this PRD |

### 14.1 Official API Verification

| Source | Verified endpoint / capability | MVP decision |
|--------|--------------------------------|--------------|
| Sentry Issues | `GET /api/0/organizations/{organization_id_or_slug}/issues/` with `environment`, `project`, `statsPeriod`/`start`/`end`, `query`, `sort`, `limit`, and `cursor`; token requires `event:read` or broader event scope | Use as the primary list source for Sentry rows |
| Sentry Issue Events | `GET /api/0/organizations/{organization_id_or_slug}/issues/{issue_id}/events/`; `full=true` includes full event body including stack trace | Use when a Sentry row needs stack trace/detail data |
| Vercel Runtime Logs | `GET https://api.vercel.com/v1/projects/{projectId}/deployments/{deploymentId}/runtime-logs` with bearer token and optional `teamId`/`slug` | Use only for runtime logs tied to a deployment |
| Vercel Log Drains | Log Drains can stream sources such as `build`, `lambda`, `edge`, and `static` into an external destination | Defer; do not include build/static/persistent log coverage in MVP |

---

## 15. API Contract

> Full request/response shape defined in §13.2. Summary:

```
GET /api/studio/logs
Request: { source[], scope, tenantSlug?, severity[], range, from?, to?, q?, cursor? }
Response: { success: boolean, data: { items: LogEntry[], tenantHealth: TenantHealthRow[], nextCursor, sourceStatus, fetchedAt }, error?: { code, message } }
Auth: required — super-admin only
```

---

## 16. Open Questions

| # | Question | Owner | Status |
|---|----------|-------|--------|
| 1 | How should the implementation obtain `deploymentId` for Vercel runtime logs — latest production deployment by default, explicit deployment selector, or both? | Dev/DevOps | ⬜ Open |
| 2 | Should severity levels be normalized with a fixed, documented cross-source mapping table (Sentry `fatal/error/warning` → our `Critical/Error/Warning`, Vercel log level → same scale, AI failures → Error by default), and who owns maintaining that mapping as sources evolve? | Dev | ⬜ Open |
| 3 | What should the default time range/lookback window be, given each source has a different native retention (Sentry issue history is long, Vercel's log window can be short)? Proposed default is "Last 24h" — confirm. | PM | ⬜ Open |
| 4 | Should "Logs & Errors" carry the same `liveDot` real-time indicator already used on `/studio/generations`, or is polling-only refresh (FR-21) sufficient for MVP without implying true real-time? | Dev | ⬜ Open |
| 5 | Do we need per-source rate-limit budget alerts (e.g. notify ops if the Sentry API quota nears exhaustion), or is the ~60s cache TTL (FR-20) sufficient protection for MVP? | Dev | ⬜ Open |

---

## 17. 10-Point Done Checklist

- [ ] Loading State — skeleton table rows while all 3 MVP sources are in flight
- [ ] Empty State — "No errors found for this filter" + Clear filters action
- [ ] Error State — per-source inline banner/chip, never a full-page failure (AC-11, AC-12)
- [ ] Tenant Health State — healthy/warning/unhealthy/unknown rows render without adding a DB collection/table (AC-15, BR-09)
- [ ] Form Validation — filter inputs (tenant slug, custom date range) validate before triggering a fetch
- [ ] Button States — Refresh/Retry/Load more show disabled+loading states during in-flight requests
- [ ] Toast Feedback — N/A for reads; error toasts only on manual Retry failure
- [ ] Auth Redirect — non-super-admin → `/admin` (AC-10)
- [ ] Mobile 375px — best-effort only (tablet 768px is the real bar per §12); confirm detail view goes full-screen below 768px
- [ ] TypeScript Clean — `tsc --noEmit` pass, including the shared `LogEntry` type used across all 3 MVP source clients

---

## 18. Definition of Ready

- [ ] User Stories in Section 6 reviewed and approved (no pre-existing story file — this PRD originates them, see top note)
- [ ] AC in Section 11 confirmed to match Section 6 stories
- [ ] FR in Section 7 all have a Story Ref
- [ ] `docs/architecture/F39-studio-log-issue-tracking.md` created (Dev)
- [ ] API contract (§15) reviewed by Dev
- [ ] Dependencies in §14 confirmed — especially the Vercel `deploymentId` source for runtime logs (Open Question #1)
- [ ] Business Rules confirmed with PM
- [ ] Open Questions #1–#2 resolved (blocking); #3–#5 may be resolved during implementation

---

## 19. Definition of Done

- [ ] All FR items implemented and verified
- [ ] All AC in Section 11 pass
- [ ] 10-Point Checklist all pass
- [ ] QA report written (`docs/qa/F39-studio-log-issue-tracking.md`)
- [ ] No mutation/write-back controls exist anywhere in the shipped UI (BR-03 verified by code review)
- [ ] `/studio/issues` confirmed untouched (BR-04 verified by diff review)
- [ ] Tenant tagging instrumentation (FR-16, FR-17) verified in staging by triggering a test tenant-site error and confirming it appears correctly tagged on `/studio/logs`
- [ ] Tenant Health verified with at least one runtime issue, one AI failure, and one domain/status issue using existing data only
- [ ] Non-Functional Requirements validated, especially graceful degradation (kill/rate-limit one source in staging and confirm the other three still render)
