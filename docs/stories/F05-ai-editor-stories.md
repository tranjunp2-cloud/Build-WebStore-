# User Stories: AI Editor (F05)

> **Feature:** F05 — AI Editor (Split Screen)  
> **Wave:** 3 | **Priority:** P0 🌟 | **Ref PRD:** [F05-ai-editor.md](../prd/F05-ai-editor.md) (pending)

---

## US-004: AI Editor — Split Screen Chat + Preview ⭐

**Wave 3** | **P0 🌟** | **XL** | Status: Ready

### Story
```
As a   site owner sau khi AI generate
I want chỉnh sửa website qua chat hoặc click trực tiếp
So that tôi tinh chỉnh nội dung mà không cần biết code
```

### Acceptance Criteria
```gherkin
GIVEN user ở /editor/:siteId
WHEN  load trang
THEN  AI chat panel trái (380px, collapsible)
AND   live preview giữa (iframe, sandboxed)
AND   settings panel phải (320px, context-sensitive)
AND   toolbar: [Undo] [Redo] [Save] [Preview] [Publish]
AND   status bar: autosave ON, draft/published badge

GIVEN user nhập lệnh chat (VD: "Đổi màu chủ thành xanh mint")
WHEN  gửi message
THEN  AI stream response
AND   changes apply lên preview realtime
AND   AI giải thích: "Đã đổi primary color thành #B2DFDB"
AND   có nút "Hoàn tác" trong chat message

GIVEN user nhấn Ctrl+Z
WHEN  undo
THEN  revert change (cả AI changes và manual edits)

GIVEN user hover element trên preview
WHEN  hover
THEN  hiện ✨ AI edit button tại element
WHEN  click ✨
THEN  mini popup, user type instruction ngắn
WHEN  accept
THEN  chỉ element đó thay đổi, phần còn lại không ảnh hưởng

GIVEN user chỉnh sửa nhưng chưa publish
WHEN  đóng tab hoặc navigate đi
THEN  auto-save (debounce 3s) đảm bảo không mất data
AND   badge "Draft" hiện trên header
```

---

## US-005: Page Manager

**Wave 3** | **P0** | **M** | Status: Ready

### Story
```
As a   site owner
I want xem và quản lý tất cả pages
So that tôi biết page nào live, thêm/xóa page
```

### Acceptance Criteria
```gherkin
GIVEN user ở editor, click tab "Pages"
WHEN  load
THEN  list pages: status (Published/Draft), block count, last edited

GIVEN click "Thêm trang mới"
WHEN  điền tên (VD: "Khuyến mãi")
THEN  tạo page, slug = "khuyen-mai", redirect editor page đó

GIVEN click Delete page
WHEN  confirm
THEN  soft delete (deletedAt)
AND   toast "Đã xóa. Hoàn tác?" 5s
```

### Definition of Done
- [ ] 9-Point Checklist pass
- [ ] Soft delete works (page not on published site)

---

## US-006: Inline Click-to-Edit Element

**Wave 3** | **P0** | **L** | Status: Draft

### Story
```
As a   store owner
I want to click directly on any element in the preview and tell AI what to change
So that I can make precise edits to specific parts of my page
```

### Acceptance Criteria
```gherkin
GIVEN I hover over a text element in the preview pane
WHEN  my cursor rests on the element for 200ms
THEN  a blue "✨ Edit with AI" button appears overlaid on the element
  AND positioned at top-right of the element, not obscuring text

GIVEN I click "Edit with AI" on the hero headline element
WHEN  the popup appears
THEN  an input popup shows the current text pre-filled
  AND an instruction field: "How would you like to change this?"
  AND I can type my instruction and press Enter to apply
```

### Additional Criteria
- [ ] Inline edit popup closes on Escape key or clicking outside
- [ ] Applied change reflected in preview within 300ms
- [ ] If AI edits inline, chat panel shows same action in history — full transparency

---

## US-007: Add New Section via AI

**Wave 3** | **P0** | **L** | Status: Draft

### Story
```
As a   store owner
I want to add new content sections to my page via chat
So that I can expand my website without manual block building
```

### Acceptance Criteria
```gherkin
GIVEN I type "Add a testimonials section with 3 customer reviews" in AI chat
WHEN  AI processes the request
THEN  a Testimonials section with 3 placeholder reviews is added
  AND I can drag it to reposition it
```

### Additional Criteria
- [ ] AI-added sections match existing store's colour scheme and fonts
- [ ] Section added at bottom by default — drag handle to reposition
- [ ] Supported types: Testimonials, FAQ, Gallery, Features, Team, Newsletter, Banner, CTA
- [ ] Adding a section is a single undoable action
