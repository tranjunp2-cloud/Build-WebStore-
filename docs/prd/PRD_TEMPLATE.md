# PRD: [Feature Name] ([Feature ID])
> **Version:** 1.0 | **Created:** [DATE] | **Agent:** `project-planner`
> **Priority:** P[0/1/2] | **Sprint:** Wave [N] — Sprint [N] | **Size:** [S/M/L/XL]
> **Depends on:** [Feature IDs] | **Blocks:** [Feature IDs]

---

> [!IMPORTANT]
> **Stories-First Rule:**
> PRD này PHẢI được xây dựng dựa trên các User Stories đã tồn tại và được approve.
> - Mọi Acceptance Criteria (Section 11) phải được copy từ file story, KHÔNG tự viết mới.
> - Mọi Functional Requirement (Section 7) PHẢI có Story ID tham chiếu trong cột `Story Ref`.
> - Nếu FR không có story cover → đó là scope chưa approve → tạo story mới trước, sau đó mới update PRD.
> - **Rule:** Stories → PRD. Không bao giờ ngược lại.

---

## 0. Story Traceability

> **[BẮT BUỘC]** Liệt kê đầy đủ các User Stories mà PRD này implement.
> Tham chiếu file stories tại `docs/stories/F[XX]-stories.md`.

| Story ID | Title | File | Status |
|----------|-------|------|--------|
| US-F[XX]-[NN] | [Story title] | [F[XX]-stories.md](../stories/F[XX]-[name]-stories.md) | Draft / Ready / Done |
| US-F[XX]-[NN] | [Story title] | [F[XX]-stories.md](../stories/F[XX]-[name]-stories.md) | Draft / Ready / Done |

> ⚠️ **Kiểm tra:** Mọi FR trong Section 7 phải có Story ID ở bảng trên.
> Nếu một FR không có story tương ứng → **STOP. Tạo story đó trước.**

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
- [Feature / behavior 1 that is included — ref Story ID nếu có]
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

## 6. User Story Summary

> AC đầy đủ nằm trong Section 11. Đây là bản tóm tắt để dễ đọc.

```
AS A [user type]
I WANT TO [action]
SO THAT [benefit]
```

> Source Story: [US-F[XX]-[NN]](../stories/F[XX]-[name]-stories.md#us-f[xx]-[nn])

---

## 7. Functional Requirements

> **[BẮT BUỘC]** Cột Story Ref PHẢI được điền. FR không có story tham chiếu = scope chưa approve.

| FR-ID | Requirement | Story Ref | Priority | Notes |
|-------|-------------|-----------|----------|-------|
| FR-01 | [System/User must...] | US-F[XX]-[NN] | P0 | [Critical for MVP] |
| FR-02 | [System/User should...] | US-F[XX]-[NN] | P1 | |
| FR-03 | [System/User may...] | US-F[XX]-[NN] | P2 | [Nice to have] |

> **Priority key:** P0 = must have (blocker) / P1 = important / P2 = nice to have

---

## 8. Business Rules

> Rules that define correct system behavior — independent from UI. Dev must enforce these in code.

- **BR-01:** [e.g. Only users with role `admin` can access this feature]
- **BR-02:** [e.g. Price must be greater than 0]
- **BR-03:** [e.g. Product name must not exceed 100 characters]

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

> **[Global CMS Constraint]** Đối với các tính năng quản trị, yêu cầu bắt buộc phải render bên trong Main Content Area của F18 CMS Layout (ngoại trừ các tính năng đặc thù cần Full-screen Editor).

> **[BẮT BUỘC]** Liệt kê chi tiết các màn hình (screens) và các state quan trọng (ví dụ: Empty, Loading, Error, Success). Mỗi màn hình cần mô tả UI component chính và luồng hiển thị.

### 10.1. Màn hình chính (Main Screen: List / Overview / Homepage)
- **Mô tả:** [Mục đích của màn hình, ví dụ: Hiển thị danh sách items]
- **Components chính:**
  - Header: [Tiêu đề, Breadcrumb, buttons thao tác chính như Add, Export]
  - Filter/Search bar: [Các fields filter, tìm kiếm]
  - Data Table / Grid / View: [Các columns, data hiển thị]
  - Pagination / CTA: [Phân trang hoặc action chính]
- **Wireframe:**
  ```text
  [ASCII wireframe for Main Screen]
  ```

### 10.2. Màn hình Chi tiết / Tạo mới (Detail / Create / Edit Screen)
- **Mô tả:** [Mục đích của màn hình]
- **Components chính:**
  - Form fields: [Các trường nhập liệu, validation]
  - CTAs: [Save, Cancel, Delete, Stepper]
- **Wireframe:**
  ```text
  [ASCII wireframe for Detail Screen]
  ```

### 10.3. Các trạng thái UI (UI States) & Modals
- **Empty State:** [Nội dung, Icon, Action Call-to-action khi không có dữ liệu]
- **Loading State:** [Sử dụng Skeleton hay Spinner]
- **Error State / Edge Cases:** [Thông báo lỗi, nút retry]
- **Modals (nếu có):** [Mô tả form popup hoặc delete confirmation]

---

## 11. Acceptance Criteria

> **[BẮT BUỘC]** AC ở đây được copy từ file story đã approve. KHÔNG tự viết AC mới.
> Nếu cần thêm AC kỹ thuật → bổ sung vào file story trước, sau đó copy sang đây.

### AC-1: [Tên AC — Copy từ Story US-F[XX]-[NN]]

> 📌 Source: [US-F[XX]-[NN]](../stories/F[XX]-[name]-stories.md) — AC-[N]: [Tên AC]

```gherkin
GIVEN [context]
WHEN  [action]
THEN  [expected outcome]
  AND [additional check]
```

### AC-2: [Tên AC — Copy từ Story US-F[XX]-[NN]]

> 📌 Source: [US-F[XX]-[NN]](../stories/F[XX]-[name]-stories.md) — AC-[N]: [Tên AC]

```gherkin
GIVEN [error condition]
WHEN  [trigger]
THEN  [error behavior]
  AND [recovery option]
```

### AC-3: Mobile Responsive

> 📌 Source: [US-F[XX]-[NN]](../stories/F[XX]-[name]-stories.md) — Additional Criteria

```gherkin
GIVEN screen width < 768px
WHEN  user accesses [page]
THEN  [mobile behavior]
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

- [ ] User Stories approved và linked ở Section 0
- [ ] AC ở Section 11 đã được copy từ story file
- [ ] FR ở Section 7 có đầy đủ Story Ref
- [ ] Architecture doc exists (`docs/architecture/{feature}.md`)
- [ ] API contract defined
- [ ] Dependencies confirmed
- [ ] Business Rules confirmed với PO
- [ ] Open Questions resolved

---

## 19. Definition of Done

- [ ] All FR items implemented và verified
- [ ] All AC in Section 11 pass (traced back to story)
- [ ] 9-Point Checklist all pass
- [ ] QA report written (`docs/qa/{feature}.md`)
- [ ] Bilingual EN/MY verified
- [ ] Mobile responsive verified (375px)
- [ ] Non-Functional Requirements validated
