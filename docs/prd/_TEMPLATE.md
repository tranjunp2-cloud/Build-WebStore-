# PRD: [Feature Name] ([Feature ID])
> **Version:** 1.0 | **Created:** [DATE] | **Agent:** `project-planner`  
> **Priority:** P[0/1/2] | **Sprint:** Wave [N] — Sprint [N] | **Size:** [S/M/L/XL]  
> **Depends on:** [Feature IDs] | **Blocks:** [Feature IDs]

---

## 1. Problem Statement

[What problem does this feature solve? Why is it needed now? 2-3 sentences max.]

---

## 2. Target User

- [Who is the primary user?]
- [What is their technical level?]
- [What language do they speak?]

---

## 3. Solution Overview

> **What are we building and why?**

[Describe the proposed solution in 2-4 sentences. What does the user experience look like? What is the core approach/mechanism? Give dev a mental model before they read the details.]

---

## 4. Scope

### In Scope
- [Feature / behavior 1 that is included]
- [Feature / behavior 2 that is included]

### Out of Scope
- [Explicitly what we are NOT building in this ticket]
- [Deferred to future phase / other feature]

---

## 5. Success Metrics

| Metric | Target | Measured By |
|--------|--------|-------------|
| [Metric 1] | [Target] | [How measured] |
| [Metric 2] | [Target] | [How measured] |

---

## 6. User Story

```
AS A [user type]
I WANT TO [action]
SO THAT [benefit]
```

---

## 7. Functional Requirements

| FR-ID | Requirement | Priority | Notes |
|-------|-------------|----------|-------|
| FR-01 | [System/User must...] | P0 | [Critical for MVP] |
| FR-02 | [System/User should...] | P1 | |
| FR-03 | [System/User may...] | P2 | [Nice to have] |

> **Priority key:** P0 = must have (blocker) / P1 = important / P2 = nice to have

---

## 8. Business Rules

> Rules that define correct system behavior — independent from UI. Dev must enforce these in code.

- **BR-01:** [e.g. Only users with role `admin` can access this feature]
- **BR-02:** [e.g. Price must be greater than 0]
- **BR-03:** [e.g. Product name must not exceed 100 characters]
- **BR-04:** [e.g. Email must be unique per account]

---

## 9. User Flow

> End-to-end user journey for the happy path and key alternative paths.

```
[Entry point: e.g. User clicks "Create" button on Dashboard]
  ↓
Step 1: [User sees / does ...]
  ↓
Step 2: [User inputs / selects ...]
  ↓
  ├── Success → [Redirect to / Show ...]
  └── Failure → [Show error: "..." / Stay on page]
```

> Include additional flows if needed (e.g. unauthenticated access, empty state, edge case path).

---

## 10. Screen Layout

```
[ASCII wireframe of the UI]
[Include mobile layout if applicable]
```

---

## 11. Acceptance Criteria

### AC-1: Happy Path
```gherkin
GIVEN [context]
WHEN [action]
THEN [expected outcome]
AND [additional check]
```

### AC-2: Error Handling
```gherkin
GIVEN [error condition]
WHEN [trigger]
THEN [error behavior]
AND [recovery option]
```

### AC-3: Mobile Responsive
```gherkin
GIVEN screen width < 768px
WHEN user accesses [page]
THEN [mobile behavior]
```

---

## 12. Non-Functional Requirements

| Category | Requirement | Notes |
|----------|-------------|-------|
| **Performance** | [e.g. Page load < 2s on 4G] | |
| **Security** | [e.g. Route requires auth token / role check] | |
| **Accessibility** | [e.g. WCAG 2.1 AA / keyboard navigable] | |
| **Browser support** | [e.g. Chrome, Safari, Edge latest 2 versions] | |
| **Device support** | [e.g. Mobile 375px, Tablet 768px, Desktop 1280px+] | |
| **Data / Privacy** | [e.g. No PII stored in logs] | |

---

## 13. Technical Architecture

### 13.1 Components

| Component | File | Description |
|-----------|------|-------------|
| `ComponentName` | `path/to/file.tsx` | [What it does] |

### 13.2 API Endpoints

```
[METHOD] /api/[path] → [response type]
Request: { [fields] }
Response: { success: boolean, data: {...} }
Auth: [required/public]
```

### 13.3 Data Flow

```
[Flow diagram showing data movement]
```

---

## 14. Dependencies

| Dependency | Status | Action Needed |
|-----------|--------|---------------|
| [Dep 1] | ✅/⬜ | [Action] |

---

## 15. API Contract

> Full details in SPEC.md §8 or AI_BUILDER_SPEC.md §14

```
[METHOD] /api/[endpoint]
Request: { ... }
Response: { success: boolean, data: { ... }, error?: { code, message } }
```

---

## 16. Open Questions

| # | Question | Owner | Status |
|---|----------|-------|--------|
| 1 | [Question blocking implementation?] | [BA/PO/Dev] | ⬜ Open |
| 2 | [Design or logic uncertainty?] | | ⬜ Open |

---

## 17. 9-Point Done Checklist

- [ ] Loading State — [specific implementation]
- [ ] Empty State — [specific implementation]
- [ ] Error State — [specific implementation]
- [ ] Form Validation — [specific fields]
- [ ] Button States — [disabled, loading, etc.]
- [ ] Toast Feedback — [success/error messages]
- [ ] Auth Redirect — 401 → /login
- [ ] Mobile 375px — [layout changes]
- [ ] TypeScript Clean — `tsc --noEmit` pass

---

## 18. Definition of Ready

- [ ] This PRD reviewed and approved
- [ ] Architecture doc exists (`docs/architecture/{feature}.md`)
- [ ] API contract defined
- [ ] Dependencies confirmed
- [ ] Business Rules confirmed with PO
- [ ] Open Questions resolved

---

## 19. Definition of Done

- [ ] All FR items implemented and verified
- [ ] 9-Point Checklist all pass
- [ ] QA report written (`docs/qa/{feature}.md`)
- [ ] Bilingual EN/MY verified
- [ ] Mobile responsive verified (375px)
- [ ] Non-Functional Requirements validated
