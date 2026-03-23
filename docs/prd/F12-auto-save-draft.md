# PRD: Auto-Save & Draft (F12)
> **Version:** 1.1 | **Updated:** 2026-03-16 | **Agent:** `project-planner`
> **Priority:** P0 | **Sprint:** Wave 3 | **Size:** M
> **Depends on:** F05 AI Editor | **Integrated into:** editorStore (Zustand)

---

> [!IMPORTANT]
> **Stories-First Rule:** PRD này được xây dựng từ các User Stories đã approve.
> Mọi FR phải có Story Ref. AC được copy từ story file.

> [!NOTE]
> Scope được quy định chi tiết trong F12 stories.


---

## 0. Story Traceability

| Story ID | Title | File | Status |
|----------|-------|------|--------|
| US-F12-01 | Auto-Save debounce 3s | [F12-auto-save-draft-stories.md](../stories/F12-auto-save-draft-stories.md) | Ready |
| US-F12-02 | Draft Recovery | [F12-auto-save-draft-stories.md](../stories/F12-auto-save-draft-stories.md) | Ready |
| US-F12-03 | Mobile Web UX — Compact Auto-Save Indicator | [F12-auto-save-draft-stories.md](../stories/F12-auto-save-draft-stories.md) | Ready |

---

## 1. Problem Statement

Users lose work when they close the browser, navigate away, or experience a network issue. There's no auto-save mechanism, no draft recovery, and no visual indicator of save status.

---

## 2. Target User

- Site owner đang edit website
- Không muốn lo về mất data khi đóng tab

---

## 3. Solution Overview

Auto-save debounce 3s, manual save (Ctrl+S), save status indicator (Saved Xs ago / Saving... / ⚠️ Not saved), retry với exponential backoff, draft recovery khi quay lại editor.

---

## 4. Scope

### In Scope
- Auto-save debounce 3s sau mỗi change (US-F12-01)
- Status indicator: Saving... / Saved Xs ago / ⚠️ Not saved
- Retry với backoff: 5s, 10s, 20s (3 lần)
- Manual save Ctrl+S → immediate + toast
- Draft recovery khi return to /editor/:siteId

### Out of Scope
- Persistent version history (Wave 6+)
- Named snapshots
- Collaborative conflict resolution

---

## 7. Functional Requirements

| FR-ID | Requirement | Story Ref | Priority | Notes |
|-------|-------------|-----------|----------|-------|
| FR-01 | Auto-save debounce 3s sau bất kỳ change nào | US-F12-01 | P0 | PATCH /api/pages |
| FR-02 | Status bar: "Saving..." khi đang save | US-F12-01 | P0 | |
| FR-03 | Status bar: "Saved Xs ago" sau success | US-F12-01 | P0 | |
| FR-04 | Status bar: "⚠️ Not saved" khi fail | US-F12-01 | P0 | Warning color |
| FR-05 | Auto-retry: 5s, 10s, 20s backoff (3 attempts) | US-F12-01 | P0 | |
| FR-06 | Persistent banner sau 3 retries fail: "Changes not saved. Check connection." | US-F12-01 | P0 | |
| FR-07 | Manual save: Ctrl+S → immediate save + toast "Saved!" | US-F12-01 | P1 | |
| FR-08 | Browser "unsaved changes" dialog khi navigate away với isDirty = true | US-F12-01 | P0 | |
| FR-09 | Draft recovery: return to /editor/:siteId → load latest saved state | US-F12-01 | P0 | |
| FR-10 | **[Mobile]** Thu gọn Auto-Save Indicator thành Icon-only (không text) để tiết kiệm diện tích thanh Toolbar. | US-F12-03 | P2 | Ngăn text dài đẩy label khác |

---

## 8. Business Rules

- **BR-01:** isDirty = true → block navigation với browser dialog
- **BR-02:** Draft valid nếu saved within 24h
- **BR-03:** Auto-save không spam API — debounce 3s bắt buộc
- **BR-04:** Manual Ctrl+S overrides debounce timer

---

## 10. Screen Layout

> **[Global CMS Constraint]** Tính năng Auto-Save là một indicator trạng thái nền (Background Process Indicator) tích hợp ngay trong Toolbar của AI Editor (F05).

> **[BẮT BUỘC]** Liệt kê chi tiết các màn hình (screens) và các state quan trọng (ví dụ: Empty, Loading, Error, Success). Mỗi màn hình cần mô tả UI component chính và luồng hiển thị.

> **[Wireframe & Design Rule]** Không cần dùng ASCII để minh hoạ. Dẫn nguồn trực tiếp từ wireframe ở thư mục design nếu có.
> **[Quy tắc Cập nhật]** Mỗi khi 1 design/wireframe mới được thêm, BẮT BUỘC phải bổ sung ở Screen Layout đường dẫn tới file đó.

### 10.1. Màn hình chính (Save Status Indicator)
- **Mô tả:** Khu vực nhỏ hiển thị trạng thái lưu trữ đám mây.
- **Components chính:**
  - Status Text / Icon Box: Dạng một Text Label nằm cạnh nút [Publish], kèm theo Icon cloud/check.
- **Design / Wireframe:**
  - [Link tới file wireframe/design trong thư mục docs/design/...]

### 10.2. Mobile View (Tiny Cloud Status)
- **Mô tả:** Indicator siêu nhỏ gọn trên thanh menu bar của Mobile Editor. Thay vì hiện chữ "Saved", chỉ hiện 1 icon mây đánh dấu tick xanh.
- **Design / Wireframe:**
  - [Link tới file wireframe/design trong thư mục docs/design/...]

### 10.3. Các trạng thái UI (UI States) & Modals
- **Idle/Saved (Success State):** Biểu tượng Checkmark Cloud, text màu xám dịu ghi rõ timestamp: "Saved 2 mins ago" hoặc "Saved just now".
- **Loading State:** Khi đang gửi Request API, Icon Cloud hiện vòng Spin xoay mượt, Text ghi: "Saving...".
- **Error State / Edge Cases:** Icon Alert Tam giác ⚠️, text chữ đỏ: "Không thể lưu thay đổi (No Connection)". Khi đó, hiện thêm một Button nhỏ [Thử Lại Ngay]. Chặn Browser Navigation Popup: Cảnh báo "Có thay đổi chưa được lưu, bạn có chắc muốn thoát?".
- **Modals:** Không có Modal, chỉ sử dụng Native Browser Dialog khi user ấn X tắt Tab giữa chừng lúc đang unsaved.

---

## 13. Technical Architecture

```typescript
// In editorStore
const DEBOUNCE_MS = 3000
const MAX_RETRIES = 3
const RETRY_DELAYS = [5000, 10000, 20000]

// On any state change:
// 1. Set isDirty = true, status = 'unsaved'
// 2. Reset debounce timer
// 3. After DEBOUNCE_MS → call saveToServer()
// 4. On success → isDirty = false, status = 'saved', update lastSaved
// 5. On failure → retry with backoff, status = 'error'

// API: PATCH /api/sites/:id/pages/:pageId { blocks, theme }
```

---

## 17. 9-Point Done Checklist

- [ ] Loading State — "Saving..." indicator
- [ ] Empty State — N/A
- [ ] Error State — "⚠️ Not saved" + retry + persistent banner
- [ ] Form Validation — N/A
- [ ] Button States — Save button spinner during save
- [ ] Toast Feedback — "Saved!" on manual save
- [ ] Auth Redirect — N/A (part of editor)
- [ ] Mobile 375px — Status bar visible in toolbar
- [ ] TypeScript Clean — `tsc --noEmit` pass

---

## 18. Definition of Ready

- [ ] User Stories F12 approved
- [ ] F05 Editor editorStore designed

---

## 19. Definition of Done

- [ ] Auto-save fires 3s after change
- [ ] Retry with backoff: 3 attempts
- [ ] Draft recovery works
- [ ] Mobile status bar visible

