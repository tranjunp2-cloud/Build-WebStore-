# Architecture: [Feature Name]
> **Version:** 1.0 | **Created:** [DATE] | **Agent:** `[frontend/backend]-specialist`  
> **PRD:** [`docs/prd/{feature}.md`](../prd/{feature}.md)

---

## 1. Overview

[1-2 sentences: what this document covers and the high-level approach.]

## 2. System Context

```
[Show how this feature fits into the overall PrimeWeb architecture]
[Use ASCII diagram or mermaid]
```

## 3. Component Tree

```
[page/route]
├── ParentComponent
│   ├── ChildComponent1
│   │   ├── SubComponent
│   │   └── SubComponent
│   └── ChildComponent2
└── SharedComponent
```

### Component Responsibility

| Component | File | Responsibility |
|-----------|------|---------------|
| `ComponentName` | `src/path/to/file.tsx` | [What it does, what props it takes] |

## 4. Data Flow

```
[Show data flow from user action → API → database → UI update]
```

## 5. State Management

| State | Location | Type | Description |
|-------|----------|------|-------------|
| `stateName` | Zustand / useState / server | `Type` | [What it tracks] |

## 6. API Design

### [Endpoint Name]
```
[METHOD] /api/[path]

Request:
{
  field1: string    // required — description
  field2?: number   // optional — description
}

Response (success):
{
  success: true,
  data: { ... }
}

Response (error):
{
  success: false,
  error: { code: "ERROR_CODE", message: "Human readable" }
}
```

## 7. Database / Collection Changes

| Collection | Change | Fields |
|-----------|--------|--------|
| `CollectionName` | NEW / MODIFY | [Fields being added/changed] |

## 8. Error Handling Matrix

| Error | HTTP Code | User Message | Recovery |
|-------|-----------|-------------|----------|
| [Error type] | [4xx/5xx] | [Toast message] | [What user can do] |

## 9. Security Considerations

- [ ] Auth required? → [JWT / public]
- [ ] Tenant-scoped access? → [How enforced]
- [ ] Input validation? → [Zod schema / manual]
- [ ] Rate limiting? → [Limits per plan]

## 10. Performance Considerations

- [ ] SSR vs CSR → [Which pages and why]
- [ ] Caching strategy → [What to cache]
- [ ] Lazy loading → [What to lazy load]
- [ ] Bundle impact → [Expected impact]

## 11. Testing Strategy

| Type | What to Test | Tool |
|------|-------------|------|
| Unit | [Functions/utils] | Jest |
| Integration | [API routes] | Jest + Payload test utils |
| E2E | [User flows] | Playwright |

## 12. Migration / Rollback Plan

- **Migration**: [Steps to deploy this feature]
- **Rollback**: [Steps to revert if something breaks]
- **Feature flag**: [If applicable, how to toggle]
