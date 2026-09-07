# User Stories: QA Control Center (F40)

> **Feature:** F40 — QA Control Center
> **Wave:** 8 | **Priority:** P1 | **Ref PRD:** [F40-qa-control-center.md](../prd/F40-qa-control-center.md)
> **Owner:** QA Lead Ary – Phạm Thị Thảo Ngân
> **Scope:** CMS PrimeWeb only. Studio admin is the internal host, never a QA product target.

---

## US-F40-00: Define QA Control Center Delivery Baseline

**Wave 8** | **P1** | **S** | Status: Ready

### Story

```
As a   QA Lead
I want approve a single PRD and delivery backlog for QA Control Center
So that every later implementation PR has one approved story, Acceptance Criteria, and GitHub Issue.
```

### Acceptance Criteria

#### AC-1: One approved source of scope

```gherkin
GIVEN F40 is proposed
WHEN this story is complete
THEN one CMS-only PRD and one versioned story source define scope, exclusions, owners and Acceptance Criteria
```

#### AC-2: One issue per implementation story

```gherkin
GIVEN the F40 backlog contains implementation stories
WHEN a developer starts work
THEN each US-F40-01 through US-F40-07 has exactly one GitHub Issue
AND each later branch and PR can link to exactly one story
```

#### AC-3: Documentation-only boundary

```gherkin
GIVEN this baseline PR is reviewed
WHEN its changed files are inspected
THEN it contains no application code, schema/migration, workflow or runtime credential
```

### Definition of Done

- [ ] PRD and story source parse successfully.
- [ ] Seven implementation issues exist and link to the source story.
- [ ] Baseline PR uses `Relates to #1748` only.

---

## US-F40-01: CMS Target Catalog and Project Health

**Wave 8** | **P1** | **L** | Status: Ready

### Story

```
As a   QA tester
I want see all CMS targets and their explainable health in one Project Health view
So that I know which area is stable, weak, or unknown without running full regression.
```

### Acceptance Criteria

#### AC-1: Full CMS inventory

```gherkin
GIVEN I am a super-admin
WHEN I open /studio/qa Project Health
THEN I see every active target in the versioned CMS registry grouped by domain
AND Studio admin features are not shown as product test targets
AND every target displays coverage and one of Healthy, Watch, Needs attention, Critical, Unknown
```

#### AC-2: No false green state

```gherkin
GIVEN a target has no valid pack, result, or confirmed issue mapping
WHEN its health is calculated
THEN it is Unknown
AND it is never displayed as Healthy merely because no failure is recorded
```

#### AC-3: Explainable state

```gherkin
GIVEN a target has a health state other than Healthy
WHEN I open its summary
THEN I see its reason code and links to the relevant run, finding, issue, coverage gap, or stale evidence
```

### Definition of Done

- [ ] All active registry targets render once with a deterministic state.
- [ ] Health calculation has unit coverage for every state precedence rule.
- [ ] E2E covers super-admin access and an Unknown target.

---

## US-F40-02: QA Run, Result, and Change-impact Data Contract

**Wave 8** | **P1** | **L** | Status: Ready

### Story

```
As an engineering system
I want persist sanitized test runs, results, and deployed-code impact idempotently
So that QA Health is based on traceable evidence rather than a dashboard guess.
```

### Acceptance Criteria

#### AC-1: Idempotent ingestion

```gherkin
GIVEN GitHub Actions sends the same signed terminal summary more than once
WHEN the ingestion endpoint processes it
THEN exactly one run and one result per run/suite/TC-ID exist
AND the response is safe to retry
```

#### AC-2: Deploy impact evidence

```gherkin
GIVEN a staging deployment has a PR, SHA and changed paths
WHEN impact resolution completes
THEN an immutable snapshot records mapped target IDs, coverage-map version and unmapped paths
AND unmapped paths are surfaced as coverage gaps
```

#### AC-3: Safe retention

```gherkin
GIVEN a result includes artifacts or CI output
WHEN it is stored
THEN Payload stores only sanitized metadata and approved artifact URL with expiry
AND it stores no credential, request body, cookie, raw trace, screenshot blob or video
```

### Definition of Done

- [ ] Additive Payload collections have matching `scripts/db-setup.js` migrations and indexes.
- [ ] Signed-ingest, replay, idempotency and unauthorized API tests pass.
- [ ] E2E proves a run summary can be listed after ingestion.

---

## US-F40-03: Automatic Targeted Smoke after Staging Deploy

**Wave 8** | **P1** | **L** | Status: Ready

### Story

```
As a QA tester
I want relevant Smoke packs to run automatically after a PR deploys to staging
So that I review only risks introduced by the deployed change.
```

### Acceptance Criteria

#### AC-1: Selective automatic dispatch

```gherkin
GIVEN a PR deployment to staging succeeds
WHEN its changed paths map to active targets
THEN only the mapped Smoke packs are dispatched through GitHub Actions
AND the system never defaults to a full-project run
```

#### AC-2: Preconditions and blocked work

```gherkin
GIVEN a selected pack lacks an exclusive fixture lease or capacity
WHEN dispatch is evaluated
THEN the run is recorded as blocked with a recovery reason
AND no destructive test begins
```

#### AC-3: Result reaches Studio

```gherkin
GIVEN an automatically dispatched pack reaches terminal status
WHEN GitHub sends its result
THEN QA Inbox and Feature Health update with the run, PR/SHA and safe evidence link
```

### Definition of Done

- [ ] Workflow dispatch is server-side and browser receives no GitHub credential.
- [ ] E2E/API tests cover mapped, unmapped and blocked deployment cases.
- [ ] Manual staging verification records one real targeted smoke run.

---

## US-F40-04: QA Inbox and Feature Health Detail

**Wave 8** | **P1** | **L** | Status: Ready

### Story

```
As a QA tester
I want a prioritized inbox and feature detail with exact failed scenario evidence
So that I can review and retest a real product risk quickly.
```

### Acceptance Criteria

#### AC-1: Actionable inbox

```gherkin
GIVEN I open /studio/qa
WHEN actionable signals exist
THEN QA Inbox orders Critical, Needs attention, Watch and Unknown mapping ahead of non-actionable history
AND each row states target, reason, latest evidence and suggested next action
```

#### AC-2: Failed scenario details

```gherkin
GIVEN Product Grid variants fails a run
WHEN I open Feature Health Detail
THEN I see TC-ID, fixture reference, expected/actual, PR/SHA, classification and safe screenshot/trace link
AND I can start a targeted retest from that target
```

#### AC-3: Visual review is human confirmed

```gherkin
GIVEN visual comparison exceeds its approved threshold
WHEN its detail is opened
THEN baseline/current/diff evidence is shown
AND no GitHub bug is created until a tester confirms it
```

### Definition of Done

- [ ] Desktop and 375px layouts meet QA UX specification and keyboard navigation.
- [ ] E2E covers inbox priority, detail evidence and retest affordance.
- [ ] Error/empty/loading states never present an unknown target as healthy.

---

## US-F40-05: GitHub Issue Sync and Confirmed Target Mapping

**Wave 8** | **P1** | **M** | Status: Ready

### Story

```
As QA Lead Ary
I want open GitHub bugs synchronized and mapped to affected CMS targets
So that Project Health reflects known product problems, including issues created before QA Control Center.
```

### Acceptance Criteria

#### AC-1: Lightweight issue mirror

```gherkin
GIVEN a relevant GitHub issue is open or updated
WHEN synchronization runs
THEN Studio stores its number, URL, title, state, labels, severity, updated time and mapping metadata
AND GitHub remains the source of truth for body and comments
```

#### AC-2: Safe historical mapping

```gherkin
GIVEN a historical GitHub issue has no confirmed target marker
WHEN it is synchronized
THEN it appears as Unknown mapping for Ary to assign
AND title-keyword suggestion does not affect feature health until Ary confirms it
```

#### AC-3: Issue changes health

```gherkin
GIVEN Ary confirms an open P1 issue maps to a target
WHEN health refreshes
THEN that target becomes Critical with a link to the GitHub issue
AND closing or remapping the issue refreshes the affected target deterministically
```

### Definition of Done

- [ ] Sync is idempotent and has retry/reconciliation coverage.
- [ ] Mapping confirmation is audited with actor and time.
- [ ] Tests cover unmapped, mapped-open and mapped-closed issues.

---

## US-F40-06: Finding Review and Manual GitHub Ticket Creation

**Wave 8** | **P1** | **M** | Status: Ready

### Story

```
As a QA tester
I want review a failed test as an internal finding before creating a GitHub ticket
So that flaky tests or expected UI changes do not create noisy bugs.
```

### Acceptance Criteria

#### AC-1: Finding lifecycle and deduplication

```gherkin
GIVEN a product test failure occurs
WHEN a finding is created
THEN it has a stable fingerprint, target, result, lifecycle, owner and safe evidence
AND the same active fingerprint does not create a duplicate finding
```

#### AC-2: Explicit human promotion

```gherkin
GIVEN I review a finding
WHEN I choose Create GitHub ticket and confirm
THEN one GitHub issue is created with target marker, severity, reproduction and safe evidence links
AND no issue is created before that confirmation
```

#### AC-3: Fix verification

```gherkin
GIVEN a developer supplies a fix PR and a tester retests the same target
WHEN the required pack passes
THEN the finding can be marked verify-fix
AND a later failure reopens it with the new run evidence
```

### Definition of Done

- [ ] Finding lifecycle and active-fingerprint dedupe have automated tests.
- [ ] E2E covers review, cancel promotion and confirmed promotion.
- [ ] GitHub failure is reported safely without losing the internal finding.

---

## US-F40-07: Targeted Manual Runs and Run History

**Wave 8** | **P1** | **M** | Status: Ready

### Story

```
As a QA tester
I want choose one target and Smoke or Regression profile for a controlled retest
So that I can verify a concern without overloading staging.
```

### Acceptance Criteria

#### AC-1: Preflight before dispatch

```gherkin
GIVEN I choose an active target and profile
WHEN I view pack preview
THEN I see selected test types, TC-IDs, prerequisites, fixture, duration and staging environment
AND dispatch is disabled with a reason when role, capacity or fixture is invalid
```

#### AC-2: Controlled execution

```gherkin
GIVEN preflight passes and I confirm a run
WHEN the dispatcher accepts it
THEN exactly one targeted workflow is created with target, pack version, profile and optional PR/SHA context
AND there is no Run All command
```

#### AC-3: Traceable history

```gherkin
GIVEN I open run history
WHEN I filter by target, state, PR/SHA or profile
THEN I receive paginated terminal and active run summaries with evidence expiry state
AND I can cancel only a permitted non-terminal run
```

### Definition of Done

- [ ] API validates target/profile/context and authorizes every dispatch/cancel request.
- [ ] E2E covers valid preflight, blocked preflight, dispatch and filtered history.
- [ ] Run tests follow `docs/TEST_CONVENTION.md` and use only `[x] AUTO` cases.

---

## US-F40-09: Dual-Mode Ingestion & Aggregate Reconciliation Dashboard

**Wave 8** | **P1** | **L** | Status: Done (PR #1792) | Relates to #1787

### Story

```
As a QA Lead
I want an aggregate reconciliation dashboard for all 2,000 migrated stores
So that I can monitor overall migration pass rates, filter by template/domain, and identify stores with P0 blockers.
```

### Acceptance Criteria

#### AC-1: Aggregate Metrics Header
```gherkin
GIVEN I navigate to /studio/migration
WHEN the migration metrics load
THEN I see Total Stores (2,000), Passed Stores count and percentage, Warning Stores, and Failed Stores count
AND a real-time progress bar reflecting total cutover readiness.
```

#### AC-2: Search & Canonical Template Filter
```gherkin
GIVEN the stores table on /studio/migration
WHEN I search by store domain or owner email, or select one of the 9 canonical template codes (FB101, C101, C102, F102, FN101, FN102, FN103, FN104, PA101)
THEN the table filters stores in real-time matching the query with instant pagination.
```

---

## US-F40-10: Deep Visual Block Tree, Media & RichText Formatting Audit

**Wave 8** | **P1** | **L** | Status: Done (PR #1793) | Relates to #1788

### Story

```
As a QA Tester
I want an in-depth visual block tree navigator and dedicated Media & RichText formatting tabs
So that I can verify image aspect ratios, detect broken 404 assets, and audit table structures after AST conversion.
```

### Acceptance Criteria

#### AC-1: Block Tree Navigator & Status Badges
```gherkin
GIVEN I open the detail inspection modal for a store
WHEN viewing the Block Tree sidebar
THEN every page block (#01, #02...) is listed with its component mapping (PW1 -> PW2) and status badge (Passed / Warning / Failed)
AND clicking a block smoothly scrolls to that block in the comparison stream.
```

#### AC-2: Media & RichText Lexical Audit
```gherkin
GIVEN a store with embedded images and formatted blog tables
WHEN switching to 'Soi Ảnh & Link' or 'Soi Chữ & Bảng'
THEN I can inspect HTTP response status, alt text, pixel dimensions, and detect unflattened table structures.
```

---

## US-F40-11: Field-by-Field Database Entity Diff Inspector & Fix Recommendations

**Wave 8** | **P1** | **L** | Status: Done (PR #1794) | Relates to #1789

### Story

```
As a QA Engineer
I want a 1-to-1 database field reconciliation tab comparing MySQL PW1 with PostgreSQL PW2
So that I can detect missing product variants, mismatched pricing, broken menu links, and provide exact migration fix code to Devs.
```

### Acceptance Criteria

#### AC-1: 7-Group Entity Field Filtering
```gherkin
GIVEN I switch to the 'Soi CSDL 1-to-1' tab
WHEN I select an entity group (Products, Variants, Banners, RichText, Menus, Categories, Shop Settings)
THEN the table shows exact database fields comparing Legacy PW1 Value vs Migrated PW2 Value with Match/Mismatch/Missing status.
```

#### AC-2: Dev Remediation & Migration Script Guidance
```gherkin
GIVEN a field with missing data (e.g. missing 1L variant price)
WHEN expanding the diff row
THEN an actionable Dev Remediation box is shown containing the exact SQL/Payload migration script to fix the defect.
```

---

## US-F40-12: Visual & Layout Parity Inspector (Swipe Slider, 375px Mobile & Live Webview)

**Wave 8** | **P1** | **L** | Status: Done (PR #1795) | Relates to #1790

### Story

```
As a QA Tester
I want an interactive visual parity inspector with a Split Swipe Slider, 375px Mobile iPhone mockup, and Live Storefront Iframe
So that I can verify pixel-perfect layout parity and interact with the real live storefront before domain cutover.
```

### Acceptance Criteria

#### AC-1: Split Swipe Slider Compare
```gherkin
GIVEN the visual block comparison stream
WHEN toggling to 'Kéo Trượt (Swipe Slider)' and dragging the handle (0% to 100%)
THEN the slider smoothly clips the PW2 Next.js overlay over the PW1 Laravel view in real-time via hardware-accelerated CSS clip-path.
```

#### AC-2: Responsive Viewport Switcher (Desktop & Mobile 375px)
```gherkin
GIVEN the visual parity inspector
WHEN switching between 'Desktop' and 'Mobile (375px)'
THEN both browser frames adjust into authentic iPhone shells with dynamic island, speaker notch, and home bar.
```

#### AC-3: Dual Live Storefront Webview (Iframe)
```gherkin
GIVEN I switch to the 'Xem Web Thật (Live Iframe)' tab
WHEN a store is selected
THEN dual iframes load the 100% full working HTML/CSS/JS storefront for that template archetype via /api/qa/template-preview/[code].
```

