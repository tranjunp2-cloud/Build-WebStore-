# PRD: [Feature Name] ([Feature ID])
> **Version:** 1.0 | **Created:** [DATE] | **Agent:** `project-planner`  
> **Priority:** P[0/1/2] | **Sprint:** Wave [N] — Sprint [N] | **Size:** [S/M/L/XL]  
> **Depends on:** [Feature IDs] | **Blocks:** [Feature IDs]

---

## 1. Problem Statement

[What problem does this feature solve? Why is it needed now? 2-3 sentences max.]

## 2. Target User

- [Who is the primary user?]
- [What is their technical level?]
- [What language do they speak?]

## 3. Success Metrics

| Metric | Target | Measured By |
|--------|--------|-------------|
| [Metric 1] | [Target] | [How measured] |
| [Metric 2] | [Target] | [How measured] |

## 4. User Story

```
AS A [user type]
I WANT TO [action]
SO THAT [benefit]
```

## 5. Screen Layout

```
[ASCII wireframe of the UI]
[Include mobile layout if applicable]
```

## 6. Acceptance Criteria

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

## 7. Technical Architecture

### 7.1 Components

| Component | File | Description |
|-----------|------|-------------|
| `ComponentName` | `path/to/file.tsx` | [What it does] |

### 7.2 API Endpoints

```
[METHOD] /api/[path] → [response type]
Request: { [fields] }
Response: { success: boolean, data: {...} }
Auth: [required/public]
```

### 7.3 Data Flow

```
[Flow diagram showing data movement]
```

## 8. Dependencies

| Dependency | Status | Action Needed |
|-----------|--------|---------------|
| [Dep 1] | ✅/⬜ | [Action] |

## 9. API Contract

> Full details in SPEC.md §8 or AI_BUILDER_SPEC.md §14

```
[METHOD] /api/[endpoint]
Request: { ... }
Response: { success: boolean, data: { ... }, error?: { code, message } }
```

## 10. 9-Point Done Checklist

- [ ] Loading State — [specific implementation]
- [ ] Empty State — [specific implementation]
- [ ] Error State — [specific implementation]
- [ ] Form Validation — [specific fields]
- [ ] Button States — [disabled, loading, etc.]
- [ ] Toast Feedback — [success/error messages]
- [ ] Auth Redirect — 401 → /login
- [ ] Mobile 375px — [layout changes]
- [ ] TypeScript Clean — `tsc --noEmit` pass

## 11. Definition of Ready

- [ ] This PRD reviewed and approved
- [ ] Architecture doc exists (`docs/architecture/{feature}.md`)
- [ ] API contract defined
- [ ] Dependencies confirmed

## 12. Definition of Done

- [ ] 9-Point Checklist all pass
- [ ] QA report written (`docs/qa/{feature}.md`)
- [ ] Bilingual EN/MY verified
- [ ] Mobile responsive verified (375px)
