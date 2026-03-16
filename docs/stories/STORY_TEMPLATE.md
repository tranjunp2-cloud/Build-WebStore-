# User Stories: [Feature Name] ([Feature ID])

<!-- Rules & ID Convention: docs/stories/user-stories-p0.md | SPEC.md §2.4 -->

> **Feature:** [FXX] — [Feature Full Name]
> **Wave:** [N] | **Priority:** P[0/1/2] | **Ref PRD:** [FXX-name.md](../prd/FXX-name.md)

---

## US-F[XX]-[NN]: [Story Title]

**Wave [N]** | **P[0/1/2]** | **[XS/S/M/L/XL]** | **Status:** [Draft / Ready / In Progress / Done ✅]

### Story

```
As a   [user persona]
I want [action / goal]
So that [business benefit]
```

### Acceptance Criteria

#### AC-1: [Happy Path — Tên rõ ràng]

```gherkin
GIVEN [context / trạng thái ban đầu]
WHEN  [hành động của user hoặc trigger]
THEN  [kết quả mong đợi]
  AND [kết quả bổ sung]
```

#### AC-2: [Error / Validation — Tên rõ ràng]

```gherkin
GIVEN [điều kiện lỗi]
WHEN  [trigger]
THEN  [error behavior]
  AND [recovery option]
```

### Additional Criteria

- [ ] [Tiêu chí bổ sung không fit vào Gherkin — performance, mobile, edge cases]

### Market Notes *(nếu có)*

- [BM / EN / Mixed, MY market context, Halal, FPX, v.v.]

### Definition of Done

- [ ] 9-Point Checklist pass (ref: `SPEC.md §13`)
- [ ] [Feature-specific DoD item]

---

<!-- Lặp lại block ## US-F[XX]-[NN] cho mỗi story tiếp theo. Tối đa 5 stories/file. -->
