# User Stories: AI Editor (F05)

> **Feature:** F05 — AI Editor (Split Screen)
> **Wave:** 3 | **Priority:** P0 🌟 | **Ref PRD:** [F05-ai-editor.md](../prd/F05-ai-editor.md)

---

## US-F05-01: AI Editor — Split Screen Chat + Preview ⭐

**Wave 3** | **P0 🌟** | **XL** | **Status:** Ready

### Story

```
As a   site owner sau khi AI generate
I want chỉnh sửa website qua chat hoặc click trực tiếp
So that tôi tinh chỉnh nội dung mà không cần biết code
```

### Acceptance Criteria

#### AC-1: Happy Path — Layout 3 Panel

```gherkin
GIVEN user ở /editor/:siteId
WHEN  load trang
THEN  AI chat panel trái (380px, collapsible)
  AND live preview giữa (iframe, sandboxed)
  AND settings panel phải (320px, context-sensitive)
  AND toolbar: [Undo] [Redo] [Save] [Preview] [Publish]
  AND status bar: autosave ON, draft/published badge
```

#### AC-2: Happy Path — AI Chat Edit

```gherkin
GIVEN user nhập lệnh chat (VD: "Đổi màu chủ thành xanh mint")
WHEN  gửi message
THEN  AI stream response
  AND changes apply lên preview realtime
  AND AI giải thích: "Đã đổi primary color thành #B2DFDB"
  AND có nút "Hoàn tác" trong chat message
```

#### AC-3: Undo — Ctrl+Z Revert

```gherkin
GIVEN user đã thực hiện thay đổi (AI hoặc manual)
WHEN  nhấn Ctrl+Z
THEN  revert change gần nhất (cả AI changes và manual edits)
  AND preview cập nhật trong < 200ms
```

#### AC-4: Inline Edit — Click Element

```gherkin
GIVEN user hover element trên preview
WHEN  hover trên element 200ms
THEN  hiện ✨ AI edit button tại element
WHEN  click ✨
THEN  mini popup xuất hiện, user type instruction ngắn
WHEN  accept
THEN  chỉ element đó thay đổi, phần còn lại không ảnh hưởng
```

#### AC-5: Auto-save — Prevent Data Loss

```gherkin
GIVEN user chỉnh sửa nhưng chưa publish
WHEN  đóng tab hoặc navigate đi
THEN  auto-save (debounce 3s) đảm bảo không mất data
  AND badge "Draft" hiện trên header
```

### Definition of Done

- [ ] 9-Point Checklist pass (ref: `SPEC.md §13`)
- [ ] 3-panel layout responsive — chat collapsible trên mobile
- [ ] Undo/Redo hoạt động đúng với cả AI changes

---

## US-F05-02: Page Manager

**Wave 3** | **P0** | **M** | **Status:** Ready

### Story

```
As a   site owner
I want xem và quản lý tất cả pages của website
So that tôi biết page nào live, thêm/xóa page khi cần
```

### Acceptance Criteria

#### AC-1: Happy Path — Xem Danh Sách Pages

```gherkin
GIVEN user ở editor, click tab "Pages"
WHEN  tab load
THEN  list pages với: status (Published/Draft), block count, last edited
```

#### AC-2: Thêm Page Mới

```gherkin
GIVEN click "Thêm trang mới"
WHEN  điền tên (VD: "Khuyến mãi") và confirm
THEN  tạo page với slug = "khuyen-mai"
  AND redirect sang editor của page đó
```

#### AC-3: Xóa Page — Soft Delete

```gherkin
GIVEN click Delete trên 1 page
WHEN  confirm xóa
THEN  soft delete (deletedAt set)
  AND toast "Đã xóa. Hoàn tác?" hiện trong 5s
```

### Definition of Done

- [ ] 9-Point Checklist pass (ref: `SPEC.md §13`)
- [ ] Soft delete works — page deleted không hiển thị trên published site

---

## US-F05-03: Inline Click-to-Edit Element

**Wave 3** | **P0** | **L** | **Status:** Draft

### Story

```
As a   store owner
I want click trực tiếp lên bất kỳ element trong preview và yêu cầu AI thay đổi
So that tôi edit chính xác từng phần của trang mà không cần dùng chat
```

### Acceptance Criteria

#### AC-1: Happy Path — Hiện Edit Button khi Hover

```gherkin
GIVEN I hover over a text element in the preview pane
WHEN  my cursor rests on the element for 200ms
THEN  a blue "✨ Edit with AI" button appears overlaid on the element
  AND positioned at top-right, không che text
```

#### AC-2: Happy Path — Apply Inline Edit

```gherkin
GIVEN I click "Edit with AI" on the hero headline element
WHEN  the popup appears
THEN  an input popup shows current text pre-filled
  AND an instruction field: "How would you like to change this?"
  AND I type instruction và press Enter để apply
```

### Additional Criteria

- [ ] Inline edit popup closes on Escape key hoặc click outside
- [ ] Applied change reflected in preview within 300ms
- [ ] AI edits inline → chat panel shows same action in history (full transparency)

### Definition of Done

- [ ] 9-Point Checklist pass (ref: `SPEC.md §13`)
- [ ] Hover button xuất hiện đúng trên mọi block type

---

## US-F05-04: Add New Section via AI

**Wave 3** | **P0** | **L** | **Status:** Draft

### Story

```
As a   store owner
I want thêm section nội dung mới vào trang qua AI chat
So that tôi mở rộng website mà không cần tự build block
```

### Acceptance Criteria

#### AC-1: Happy Path — Add Section qua Chat

```gherkin
GIVEN I type "Add a testimonials section with 3 customer reviews" in AI chat
WHEN  AI processes the request
THEN  a Testimonials section with 3 placeholder reviews is added
  AND I can drag it to reposition
```

### Additional Criteria

- [ ] AI-added sections match existing store's colour scheme và fonts
- [ ] Section added at bottom by default — drag handle to reposition
- [ ] Supported types: Testimonials, FAQ, Gallery, Features, Team, Newsletter, Banner, CTA
- [ ] Adding a section là 1 single undoable action

### Definition of Done

- [ ] 9-Point Checklist pass (ref: `SPEC.md §13`)
- [ ] Tất cả supported section types được add đúng

---

## US-F05-05: Drag-and-Drop Block Reorder in Editor

**Wave 3** | **P0** | **M** | **Status:** Draft

### Story

```
As a   store owner editing my website
I want to easily rearrange sections by dragging and dropping them in the preview pane
So that I can quickly modify the page layout without typing instructions or using a complex menu
```

### Business Value

Visual editing (what you see is what you get) là kỳ vọng cơ bản của mọi website builder. Gõ lệnh chat để "move hero section below about" rất cồng kềnh so với việc kéo thả trực tiếp bằng chuột. Tính năng này bổ trợ hoàn hảo cho AI chat.

### Acceptance Criteria

#### AC-1: Happy Path — Drag Handle & Reorder

```gherkin
GIVEN user đang ở trang editor `/editor/:siteId`
WHEN  user hover lên bất kỳ block nào trong iframe preview (trừ Nav/Footer)
THEN  hiển thị drag handle (⠿) bên cạnh khu vực block
WHEN  user kéo thả block đến vị trí mới
THEN  vị trí block được cập nhật ngay lập tức trong iframe
  AND state (Zustand) được cập nhật
```

#### AC-2: Undo Integration

```gherkin
GIVEN user vừa kéo thả đổi vị trí 1 block
WHEN  user nhấn nút "Undo" (hoặc Ctrl+Z)
THEN  block quay trở lại vị trí cũ
  AND action kéo thả được coi là 1 bước trong history stack
```

#### AC-3: Auto-save Sau Khi Reorder

```gherkin
GIVEN user thay đổi vị trí block bằng drag-and-drop
WHEN  thao tác drop hoàn thành
THEN  auto-save trigger (sau debounce 3s)
  AND payload PATCH /api/sites/:id/pages/:pageId chứa mảng blocks với thứ tự mới
  AND status bar hiển thị "Saved"
```

#### AC-4: Tương tác với AI Chat

```gherkin
GIVEN user vừa kéo thả block thủ công
WHEN  user chat "Move it back" hoặc "Undo that"
THEN  AI hiểu context là user vừa reorder
  AND AI có thể gọi action undo thao tác drag-drop vừa rồi
```

### Definition of Done

- [ ] 9-Point Checklist pass (ref: `SPEC.md §13`)
- [ ] Drag-and-drop hoạt động mượt trong sandboxed iframe
- [ ] Action drag-drop push đúng vào history stack của Undo/Redo
- [ ] Auto-save kích hoạt sau khi drop
- [ ] Drag handle không cản trở thao tác click-to-edit (US-F05-03)
