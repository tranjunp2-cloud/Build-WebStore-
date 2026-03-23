# PRD: AI Editor — Split Screen (F05)
> **Version:** 1.2 | **Updated:** 2026-03-19 | **Agent:** `project-planner` & `ba-copilot`
> **Priority:** P0 🌟 | **Sprint:** Wave 1 | **Size:** XL
> **Depends on:** F04 Block Renderer ✅, F01 AI Builder ✅, F07 Template Gallery 🎨 | **Blocks:** F11 Undo/Redo, F12 Auto-Save

---

> [!IMPORTANT]
> **Stories-First Rule:** PRD này được xây dựng từ các User Stories đã approve.
> Mọi FR phải có Story Ref. AC được copy từ story file. Không tự mở rộng scope.

## 0. Story Traceability

| Story ID | Title | File | Status |
|----------|-------|------|--------|
| US-F05-01 | AI Editor — Split Screen Chat + Preview | [F05-ai-editor-stories.md](../stories/F05-ai-editor-stories.md) | Ready |
| US-F05-02 | Page Manager | [F05-ai-editor-stories.md](../stories/F05-ai-editor-stories.md) | Ready |
| US-F05-03 | Inline Click-to-Edit Element | [F05-ai-editor-stories.md](../stories/F05-ai-editor-stories.md) | Ready |
| US-F05-04 | Add New Section via AI | [F05-ai-editor-stories.md](../stories/F05-ai-editor-stories.md) | Ready |
| US-F05-05 | Drag-and-Drop Block Reorder in Editor | [F05-ai-editor-stories.md](../stories/F05-ai-editor-stories.md) | Ready |
| US-F05-06 | Manual Visual Editing (WYSIWYG Text & Image) | [F05-ai-editor-stories.md](../stories/F05-ai-editor-stories.md) | Ready |
| US-F05-07 | Global Header & Footer Management | [F05-ai-editor-stories.md](../stories/F05-ai-editor-stories.md) | Ready |
| US-F05-08 | Drag-and-Drop Component Library | [F05-ai-editor-stories.md](../stories/F05-ai-editor-stories.md) | Ready |
| US-F05-09 | Tùy chỉnh Trang 404 (404 Not Found Page) | [F05-ai-editor-stories.md](../stories/F05-ai-editor-stories.md) | Ready |
| US-F05-10 | Tạm ẩn/Unpublish Toàn Bộ Website | [F05-ai-editor-stories.md](../stories/F05-ai-editor-stories.md) | Ready |
| US-F05-11 | Interactive Widgets (Giỏ hàng & Social Media) | [F05-ai-editor-stories.md](../stories/F05-ai-editor-stories.md) | Ready |
| US-F05-12 | Global Business Info & Settings Panel | [F05-ai-editor-stories.md](../stories/F05-ai-editor-stories.md) | Ready |
| US-F05-13 | Page-Level SEO & AI Optimization | [F05-ai-editor-stories.md](../stories/F05-ai-editor-stories.md) | Ready |
| US-F05-14 | Mobile Web UX — Adaptive Editor Interface | [F05-ai-editor-stories.md](../stories/F05-ai-editor-stories.md) | Ready |

---

## 1. Problem Statement

After AI generates a website, users need to refine and customize it. Currently, the editor relies too heavily on writing text prompts. Users need a powerful Hybrid Visual Builder where they can manually edit text/images, drag and drop rich components from a library, manage global structures (Header/Footer), while still keeping an AI Chat assistant as an intelligent overlay. Focus is on user-friendliness comparable to top-tier market products (Framer, Shopify, Bolt.new).

---

## 2. Target User

- SME owner vừa generate website (Persona A)
- Muốn chỉnh màu, text, images mà không cần code
- Comfortable chatting trong BM/EN/Manglish

---

## 3. Solution Overview

3-panel layout: Chat/Blocks (380px trái), Live Preview iframe (giữa), Settings panel (320px phải). User chat hoặc kéo thả block để dựng trang. Panel Settings hiển thị tuỳ chọn theo ngữ cảnh (Context-sensitive): Nếu click block thì sửa block, nếu không click gì thì là Global Site Settings (SEO, Tên Doanh Nghiệp, Mạng Xã Hội). Undo/Redo support cả AI và manual edits. Auto-save mỗi 3 giây.

---

## 4. Scope

### In Scope
- 3-panel layout: Chat/Blocks + Preview + Settings (US-F05-01)
- AI chat → realtime preview update (US-F05-01)
- Manual Visual Editing: Double-click text (WYSIWYG), upload/replace images with AI Auto-Scaling (US-F05-06)
- Component Library (Side panel): Drag and drop new pre-defined blocks (Product List, Blog, Forms, Carousel, Banner, etc) into the live preview (US-F05-08)
- All blocks are auto-responsive without explicit breakpoint configuration
- Global Header & Footer management across pages (US-F05-07)
- Page Manager: CRUD pages, soft delete, and Toggle Visibility (Hide/Show page from users & menu) (US-F05-02)
- Custom 404 Not Found page design through the editor (US-F05-09)
- Site-wide "Unpublish / Maintenance Mode" toggle (US-F05-10)
- Interactive Widgets Component: Cart icon/drawer and Social Media link buttons (FB, WA, IG, LinkedIn, YT) (US-F05-11)
- Global Site Settings Panel: Centralized management of Business Info (Name, Address, Phone, Social links) and SEO in the right sidebar (US-F05-12)
- Page-Level SEO settings với tính năng AI tự động đọc nội dung trang để sinh Meta Title/Description (US-F05-13)
- Undo/Redo (Ctrl+Z/Y) cho cả AI và manual changes (US-F05-01)
- Hover element → inline AI edit popup (US-F05-03)
- Drag-drop block reordering within iframe (US-F05-05)
- Auto-save debounce 3s (US-F05-01)

### Out of Scope
- Custom HTML/CSS injection / Custom Breakpoint styling (Code override)

---

## 5. Success Metrics

| Metric | Target | Measured By |
|--------|--------|-------------|
| Chat edit → preview update | < 3 seconds | Custom timing |
| User satisfaction (editing exp) | > 7/10 | In-app survey |
| Undo/Redo usage | > 30% sessions | PostHog |

---

## 6. User Story Summary

```
AS A   site owner sau khi AI generate
I WANT chỉnh sửa website qua chat hoặc click trực tiếp
SO THAT tôi tinh chỉnh nội dung mà không cần biết code
```

> Source: [US-F05-01](../stories/F05-ai-editor-stories.md#us-f05-01)

---

## 7. Functional Requirements

| FR-ID | Requirement | Story Ref | Priority | Notes |
|-------|-------------|-----------|----------|-------|
| FR-01 | 3-panel layout: Chat (380px) + Preview (iframe) + Settings (320px) | US-F05-01 | P0 | Collapsible panels |
| FR-02 | Toolbar: Undo, Redo, Save, Preview, Publish | US-F05-01 | P0 | |
| FR-03 | AI chat → apply changes to preview realtime (SSE) | US-F05-01 | P0 | < 3s |
| FR-04 | Tính năng Undo / Redo toàn diện | US-F11-01 | P0 | Xem chi tiết tại PRD F11 |
| FR-05 | Tính năng Auto-save & Draft recovery | US-F12-01 | P0 | Xem chi tiết tại PRD F12 |
| FR-06 | Badge: Draft / Published visible in header | US-F05-01 | P0 | |
| FR-07 | Page Manager: list pages với status, block count, last edited | US-F05-02 | P0 | |
| FR-08 | Add page: điền tên → slug auto-generated → redirect editor | US-F05-02 | P0 | |
| FR-09 | Delete page: soft delete + undo toast 5s | US-F05-02 | P0 | |
| FR-10 | Hover element 200ms → hiện "✨ Edit with AI" button | US-F05-03 | P0 | top-right position |
| FR-11 | Click ✨ → instruction popup → apply changes trong 300ms | US-F05-03 | P0 | |
| FR-12 | Drag handle on hover → drag to reorder blocks in preview | US-F05-05 | P0 | |
| FR-13 | Drag-drop action pushes to Undo/Redo stack and triggers auto-save | US-F05-05 | P0 | |
| FR-14 | Manual Edit (Rich-Text): Double click text → popup Floating Toolbar xuất hiện với các nút format: Kiểu chữ (B, I, U), Canh lề (Trái, Giữa, Phải, Đều), Heading level (H1-H6, Body). | US-F05-06 | P0 | WYSIWYG Editor style |
| FR-15 | Image Upload & Replace: Upload local file, AI/system **auto-crops/compresses** mọi ảnh >2MB trước khi lưu để giảm tải. | US-F05-06 | P0 | Limit 2MB in FE/BE, auto downscale |
| FR-16 | Global Header: Sửa 1 lần áp dụng mọi trang. Hỗ trợ tạo Menu, Sub-menu nhiều cấp (nested). Người dùng có thể kéo thả để gom nhóm item, tạo dropdown menu. Đổi Logo tự adapt width/height. | US-F05-07 | P1 | Draggable tree menu |
| FR-17 | Block Library Panel: Danh sách component chuẩn (Product, Blog, Form...) | US-F05-08 | P0-XL | |
| FR-18 | Drag Block từ Sidebar thả vào iframe preview → Insert block + Save | US-F05-08 | P0-XL | |
| FR-19 | Auto-Responsive: Các block kéo vào tự tương thích Mobile/Tablet/Desk | US-F05-08 | P0 | |
| FR-20 | Toggle Visibility: Ẩn một page khỏi menu header và chặn truy cập (404) | US-F05-02 | P0 | |
| FR-21 | Tùy chỉnh 404 Page bằng AI Editor (như một page thông thường) | US-F05-09 | P1 | |
| FR-22 | Site Unpublish: Bật/Tắt trạng thái public toàn bộ website (Maintenance)  | US-F05-10 | P0 | 503 HTTP Code |
| FR-23 | Widget Social Media: Thêm nút liên kết (FB, WA, IG, LinkedIn, YT) | US-F05-11 | P0 | |
| FR-24 | Widget Cart: Tích hợp nút giỏ hàng, mở xem giỏ, ấn Mua → sang Checkout | US-F05-11 | P0 | |
| FR-25 | Logo Scaling & AI Favicon: Upload Logo → tự resize/adapt theo chuẩn (VD: max-height 60px). AI tự xử lý extract ra Favicon (file .ico/png nhỏ). | US-F05-07 | P1 | |
| FR-26 | Global Settings Panel (Right Sidebar): Khi không focus block nào, hiển thị Cấu hình Toàn cục. Chứa mục Nhận diện (Tên cửa hàng, Logo), Liên hệ (SDT, Email, Trụ sở), Mạng xã hội, và Cấu hình SEO cơ bản (Title, Description). | US-F05-12 | P0 | Data bound |
| FR-27 | Page-Level SEO & AI Content: Trong Page Manager hoặc Settings, cho phép tùy chỉnh Meta Title, Description, Slug cho từng trang. Bổ sung nút "✨ Tự động Tối ưu SEO" để AI đọc các text blocks trên canvas và tự sinh metadata phù hợp. | US-F05-13 | P1 | Content-aware AI |
| FR-28 | Template Gallery Integration: Entry point để mở Template Gallery modal, hỗ trợ AI Search và Smart Swap. | US-F07-04 | P0 | Integrated with F07 |
| FR-29 | **[Mobile]** Layout Editor trên mobile từ bỏ Split-Screen, thay bằng `Live Preview` làm background chiếm toàn màn hình, và `AI Chat` trở thành nút nổi (FAB) góc phải dưới màn hình. | US-F05-14 | P0 | Tiết kiệm diện tích |
| FR-30 | **[Mobile]** Hủy tính năng Drag & Drop component blocks trên viewport mobile. Thay bằng nút `[+] Tap to Add` chèn thẳng vào đầu/cuối trang. | US-F05-14 | P0 | Tránh xung đột cuộn mượt |
| FR-31 | **[Mobile]** Khi chạm (Tap) vào element muốn Edit, công cụ Formatting và AI command hiện lên dưới định dạng Bottom Sheet vuốt từ dưới lên thay vì floating popup. | US-F05-14 | P0 | Công thái học |

---

## 8. Business Rules

- **BR-01:** Mọi query scope theo tenant + siteId — không access cross-tenant
- **BR-02:** Soft delete page only — không hard delete
- **BR-03:** AI chat action được ghi vào chat history để user trace được
- **BR-04:** Inline edit chỉ modify element được click — không affect phần còn lại
- **BR-05:** **[System Pages]** Bắt buộc vô hiệu hóa (Disable) tính năng Ẩn (Hide) và Xóa (Delete) đối với Trang Chủ (Homepage), kèm Tooltip giải thích.
- **BR-06:** **[System Pages]** Trang 404 (Not Found) chỉ cấp quyền Edit nội dung, KHÔNG cho phép Ẩn, Xóa hoặc thay đổi URL Slug.
- **BR-07:** **[Offline Fallback]** Tiến trình Auto-save nếu gặp lỗi Mạng (Network Failed) thì phải lưu payload vào LocalStorage (Offline queue), hiển thị trạng thái cảnh báo trên UI và chặn hành vi đóng Tab (window.onbeforeunload).
- **BR-08:** **[Feature Fallback]** Mọi nút có chức năng "Checkout" hoặc "Thanh Toán" (trong Cart widget / Product block) chỉ hiển thị Toast Message: "Tính năng Checkout đang được phát triển". Không thực hiện trigger redirect gây lỗi 404.

---

## 9. User Flow

```
[Entry point: CMS Sidebar > My Webstore > Editor]
  ↓
/editor/:siteId (authenticated)
  ↓
Load 3-panel layout + fetch site blocks
  ↓
User action:
  ├── Chat "Đổi màu chủ → xanh mint"
  │     → AI stream → preview update → chat shows "Done + Undo"
  ├── Templates Icon → Open Gallery Modal → AI Search/Browse → Apply
  │     → Smooth Swap (Preserve content) → Undo support
  ├── Hover element → Click ✨ → mini popup → type instruction → apply
  ├── Drag handle → block reorder → update Zustand state + auto save
  ├── Pages tab → add/delete page → soft delete + undo toast
  └── Ctrl+Z → revert last change (preview updates < 200ms)
```

---

## 10. Screen Layout

> **[Global CMS Constraint]** Tính năng Editor là một ngoại lệ do cần không gian tối ưu cho live preview, màn hình này chiếm toàn bộ diện tích trình duyệt.

> **[BẮT BUỘC]** Liệt kê chi tiết các màn hình (screens) và các state quan trọng (ví dụ: Empty, Loading, Error, Success). Mỗi màn hình cần mô tả UI component chính và luồng hiển thị.

> **[Wireframe & Design Rule]** Không cần dùng ASCII để minh hoạ. Dẫn nguồn trực tiếp từ wireframe ở thư mục design nếu có.
> **[Quy tắc Cập nhật]** Mỗi khi 1 design/wireframe mới được thêm, BẮT BUỘC phải bổ sung ở Screen Layout đường dẫn tới file đó.

### 10.1. Màn hình chính (Split-Screen Editor)
- **Mô tả:** Màn hình làm việc chính khi chỉnh sửa trang web.
- **Components chính:**
  - Header Toolbar: Nút điều hướng Pages, Templates, Undo/Redo, Viewport Toggle, Publish.
  - Left Panel (Chat & Blocks): Tab quản lý library blocks và chat AI thao tác.
  - Center Panel (Live Preview): Iframe sandbox hiển thị nội dung website đang chỉnh sửa.
  - Right Panel (Contextual Settings): Global Settings hoặc Settings riêng của block đang click.
- **Design / Wireframe:**
  - [Link tới file wireframe/design trong thư mục docs/design/...]text
  - [Link tới file wireframe/design trong thư mục docs/design/...]

Khi Tap vào một Element (Ví dụ: Hero Text), Bottom Sheet mở lên:
  - [Link tới file wireframe/design trong thư mục docs/design/...]

### 10.2. Các màn hình phụ & Modals (Sub-screens & Modals)

- **Design / Wireframe (Page Manager Modal):**
```text
  - [Link tới file wireframe/design trong thư mục docs/design/...]

- **Design / Wireframe (Inline Edit & Context Settings):**
```text
[Trên Live Preview - Khi Hover/Click vào Text]

  - [Link tới file wireframe/design trong thư mục docs/design/...]

[Right Sidebar - Cấu hình Component / Global]
  - [Link tới file wireframe/design trong thư mục docs/design/...]

### 10.3. Các trạng thái UI (UI States)
- **Loading State:** Thấy Skeleton frame cho preview khi mở Editor; typing indicator khi AI chat response.
- **Error State / Edge Cases:** Inline field errors; Toast "Failed to fetch response" khi chat AI có lỗi.
- **Success State:** Toast màu xanh báo Apply thay đổi thành công, hiển thị nút "Undo" nổi bật.

---


## 11. Acceptance Criteria

> AC được copy từ `F05-ai-editor-stories.md`. Không tự thêm AC không có trong story.

### AC-1: Layout 3 Panel
> 📌 Source: [US-F05-01](../stories/F05-ai-editor-stories.md) — AC-1

```gherkin
GIVEN user ở /editor/:siteId
WHEN  load trang
THEN  AI chat panel trái (380px, collapsible)
  AND live preview giữa (iframe, sandboxed)
  AND settings panel phải (320px, context-sensitive)
  AND toolbar: [Undo] [Redo] [Save] [Preview] [Publish]
  AND status bar: autosave ON, draft/published badge
```

### AC-2: AI Chat Edit
> 📌 Source: [US-F05-01](../stories/F05-ai-editor-stories.md) — AC-2

```gherkin
GIVEN user nhập lệnh chat (VD: "Đổi màu chủ thành xanh mint")
WHEN  gửi message
THEN  AI stream response
  AND changes apply lên preview realtime
  AND AI giải thích: "Đã đổi primary color thành #B2DFDB"
  AND có nút "Hoàn tác" trong chat message
```

### AC-3: Undo & Auto-Save (Delegated)
> 📌 Source: [US-F11-01](../stories/F11-undo-redo-stories.md) and [US-F12-01](../stories/F12-auto-save-draft-stories.md)

*Ghi chú: Các tiêu chí nghiệm thu về hoàn tác (Undo/Redo) và lưu tự động (Auto-save) đã được tách thành feature độc lập F11 và F12 để quản lý. Vui lòng xem chi tiết tại story files tương ứng.*

### AC-4: Inline Click-to-Edit
> 📌 Source: [US-F05-03](../stories/F05-ai-editor-stories.md) — AC-1 & AC-2

```gherkin
GIVEN I hover over a text element in the preview pane
WHEN  cursor rests on element for 200ms
THEN  blue "✨ Edit with AI" button appears at top-right of element

GIVEN I click "✨ Edit with AI"
WHEN  popup opens
THEN  instruction field shows, I type + press Enter
```

### AC-5: Page Manager — Add & Delete
> 📌 Source: [US-F05-02](../stories/F05-ai-editor-stories.md) — AC-2 & AC-3

```gherkin
GIVEN click "Thêm trang mới" và điền tên "Khuyến mãi"
THEN  tạo page với slug = "khuyen-mai"
  AND redirect sang editor của page đó

GIVEN click Delete trên 1 page và confirm
THEN  soft delete (deletedAt set)
  AND toast "Đã xóa. Hoàn tác?" 5s
```

### AC-6: Trải Nghiệm Biên Tập Trên Mobile
> 📌 Source: [US-F05-14](../stories/F05-ai-editor-stories.md)

Khi truy cập vào Editor qua điện thoại, giao diện Split-Screen bị vô hiệu hóa vì không đủ diện tích. Phần Live Preview của website chiếm 100% tỷ lệ khung hình. Các công cụ thiết kế chuyển tiếp thành Bottom Sheets (vuốt từ dưới lên khi tap), AI Chat biến thành nút Floating Action Button (FAB). Tính năng kéo thả bị tắt hoàn toàn khỏi thư viện (Component Library), thay bằng phương thức Tap the Component (Click) để tự động Insert block xuống dưới cùng của giao diện và cuộn tới vị trí đó.

---

### AC-7: Ràng buộc An toàn Hệ thống & Edge Cases (Business Rules)
> 📌 Source: Phân tích bảo vệ rủi ro và các điểm mù của kiến trúc

```gherkin
GIVEN user thao tác trên bảng quản lý Page Manager
WHEN  chọn Trang Chủ (Homepage) hoặc Trang 404
THEN  nút Ẩn (Hide) và Xóa (Delete) sẽ bị mờ (Disabled) hoàn toàn
  AND hover vào sẽ hiện Tooltip: "Không thể chỉnh sửa trạng thái hiển thị của trang hệ thống"
  AND đối với trang 404, field URL Slug bị khóa (Read-only)

GIVEN tiến trình Auto-save (3s) đang chạy ngầm
WHEN  trình duyệt bị mất kết nối mạng và API calls failed
THEN  trạng thái Saving (Icon góc trên) đổi màu đỏ báo lỗi
  AND hiện thông báo Toast: "Mất kết nối mạng. Hãy giữ nguyên trang để tránh mất dữ liệu."
  AND dữ liệu tạm được queue vào bộ nhớ LocalStorage
  AND kích hoạt popup cảnh báo của trình duyệt nếu user nhấn nút Close Tab (window.onbeforeunload)

GIVEN user đang trải nghiệm Widget Giỏ hàng (Cart)
WHEN  bấm vào nút chức năng "Checkout / Mua hàng"
THEN  hệ thống hiển thị Toast báo: "Tính năng thanh toán đang được phát triển cho bản sau"
  AND ngăn chặn (Prevent default) mọi hành vi Redirect ra khỏi Editor gây lỗi 404
```

---

## 12. Non-Functional Requirements

| Category | Requirement | Notes |
|----------|-------------|-------|
| **Performance** | Chat edit → preview < 3s | SSE streaming |
| **Security** | Route requires auth, tenant-scoped | |
| **Device support** | Mobile 375px, Desktop 1280px+ | |
| **iframe** | Sandboxed — no cross-origin leaks | |

---

## 13. Technical Architecture

### 13.1 Components

| Component | File | Description |
|-----------|------|-------------|
| `EditorPage` | `app/(editor)/editor/[siteId]/page.tsx` | Layout orchestrator |
| `EditorSidebar` | `components/editor/EditorSidebar.tsx` | Tabs for AI Chat / Blocks |
| `BlockLibrary` | `components/editor/BlockLibrary.tsx` | Draggable component list |
| `EditorPreview` | `components/editor/EditorPreview.tsx` | Sandboxed iframe, drop zone |
| `EditorToolbar` | `components/editor/EditorToolbar.tsx` | Top actions bar |
| `EditorSettingsPanel` | `components/editor/EditorSettingsPanel.tsx` | 320px Right panel (Global & Contextual settings) |
| `InlineEditTools`| `components/editor/InlineEditTools.tsx`| text contentEditable, upload img |
| `PageManager` | `components/editor/PageManager.tsx` | Pages CRUD |

### 13.2 API Endpoints

```
POST /api/ai/chat-edit        → structured changes (SSE)
PATCH /api/sites/:id/pages/:pageId → Save block changes
POST /api/pages               → Add new page
DELETE /api/pages/:id         → Soft delete page
```

### 13.3 iframe Communication

```
Parent → iframe: UPDATE_BLOCK, HIGHLIGHT_BLOCK, SET_THEME
iframe → Parent: BLOCK_CLICKED, BLOCK_HOVERED (with rect position)
```

---

## 14. Dependencies

| Dependency | Status | Action Needed |
|-----------|--------|---------------|
| F04 Block Renderer | ✅ Done | — |
| F01 AI Builder | ✅ Done | — |
| F11 Undo/Redo | ⬜ | Build concurrently |
| F12 Auto-Save | ⬜ | Build concurrently |

---

## 17. 9-Point Done Checklist

- [ ] Loading State — Skeleton preview, typing indicator chat
- [ ] Empty State — Welcome + suggestion prompts in chat
- [ ] Error State — Toast + retry cho AI failures
- [ ] Form Validation — N/A (chat input)
- [ ] Button States — Send disabled during streaming, Undo/Redo greyed khi empty
- [ ] Toast Feedback — Success/Error cho all actions
- [ ] Auth Redirect — 401 → /login
- [ ] TypeScript Clean — `tsc --noEmit` pass

---

## 18. Definition of Ready

- [ ] User Stories approved và linked ở Section 0
- [ ] F04 Block Renderer done ✅
- [ ] F01 AI Builder done ✅
- [ ] iframe communication protocol agreed

---

## 19. Definition of Done

- [ ] All FR items implemented
- [ ] All AC pass
- [ ] 9-Point Checklist all pass
- [ ] Chat edit → preview < 3s measured
- [ ] Undo/Redo works cho cả AI + manual
