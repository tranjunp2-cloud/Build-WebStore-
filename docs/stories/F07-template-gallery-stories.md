# User Stories: Template Gallery (F07)

<!-- Rules & ID Convention: docs/stories/user-stories-p0.md | SPEC.md §2.4 -->

> **Feature:** F07 — Template Gallery (AI Editor Integration)
> **Wave:** 3 | **Priority:** P1 | **Ref PRD:** [F07-template-gallery.md](../prd/F07-template-gallery.md)

---

## US-F07-04: AI-Powered Template Search

**Wave 3** | **P1** | **S** | **Status:** Ready

### Story

```
As a   user in the AI Editor
I want to search for design templates using natural language chat
So that I can find a relevant style without browsing categories manually
```

### Acceptance Criteria

#### AC-1: Happy Path — Hiển thị chat input trong Templates Modal

```gherkin
GIVEN user đang ở trong AI Editor
WHEN  user click vào icon Templates
THEN  Templates Modal mở ra hiển thị 1 dòng nhập liệu chat (Gemini-style)
  AND danh sách template mặc định hiển thị bên dưới dưới dạng thumbnails
```

#### AC-2: Tìm kiếm và hiển thị kết quả

```gherkin
GIVEN user đang mở Templates Modal với chat input
WHEN  user nhập text tìm kiếm (ví dụ: "mẫu cho shop thể thao")
  AND nhấn Enter hoặc click tìm kiếm
THEN  hệ thống trả về danh sách template liên quan trong < 2 giây
  AND kết quả hiển thị dưới dạng card thumbnails ngay trong popup
  AND nếu không có kết quả phù hợp, hiển thị thông báo "Không tìm thấy mẫu phù hợp"
```

### Additional Criteria

- [ ] Search input hỗ trợ Tiếng Việt, Bahasa Melayu và Tiếng Anh.
- [ ] Kết quả tìm kiếm phải trả về ít nhất 2 mẫu nếu có kết quả.

### Market Notes

- Người dùng MY có thể nhập từ khóa BM như "kedai baju", "restoran" — AI search phải hiểu ngữ cảnh Malaysia.

### Definition of Done

- [ ] 9-Point Checklist pass (ref: `SPEC.md §13`)
- [ ] AI search response < 2 giây với query BM và VI
- [ ] Templates Modal hiển thị đúng trên mobile 375px

---

## US-F07-05: Content-Preserving Template Swap

**Wave 3** | **P1** | **M** | **Status:** Ready

### Story

```
As a   user who found a better template
I want to apply it to my current website while keeping my images and text
So that I don't have to re-enter my content from scratch
```

### Acceptance Criteria

#### AC-1: Happy Path — Apply template với Smart Mapping

```gherkin
GIVEN user đã chọn 1 template mới trong Templates Modal
WHEN  user click "Apply Template"
THEN  hệ thống thực hiện mapping nội dung hiện tại sang các block tương ứng của template mới
  AND các trường dữ liệu (Header title, Hero text, Image blocks) được bảo toàn 100% nếu template mới có block tương đương
  AND quá trình chuyển đổi có hiệu ứng animation mượt mà (Smooth transition)
  AND template mới được render trong Editor trong < 2 giây
```

#### AC-2: Edge case — Template thiếu block tương ứng

```gherkin
GIVEN user apply template mới không có block tương đương (VD: template cũ có Gallery, template mới không có)
WHEN  quá trình mapping hoàn tất
THEN  các block không có tương ứng bị bỏ qua (không làm mất nội dung nguồn)
  AND hiển thị thông báo: "Một số section không được chuyển sang template mới"
```

### Additional Criteria

- [ ] Nếu hệ thống lỗi trong quá trình swap, rollback về trạng thái cũ (không mất dữ liệu).
- [ ] Smooth transition duration không quá 500ms để tránh cảm giác lag.

### Market Notes

- SME owners MY thường đã đầu tư thời gian vào nội dung (ảnh sản phẩm, mô tả). Content preservation là yếu tố then chốt tạo trust.

### Definition of Done

- [ ] 9-Point Checklist pass (ref: `SPEC.md §13`)
- [ ] QA verify 0% data loss trên 10+ template swaps
- [ ] Smooth animation hoạt động trên Chrome, Safari, Edge latest 2 versions

---

## US-F07-06: Undo Template Application

**Wave 3** | **P1** | **S** | **Status:** Ready

### Story

```
As a   user experimenting with designs
I want to undo the template application if it doesn't look right
So that I can safely try different styles without fear of losing my previous layout
```

### Acceptance Criteria

#### AC-1: Happy Path — Undo sau khi apply template

```gherkin
GIVEN user vừa apply 1 template mới trong Editor
WHEN  user nhìn vào thanh công cụ Editor
THEN  nút Undo xuất hiện rõ ràng và có thể click được
WHEN  user click nút Undo
THEN  Editor quay lại trạng thái ngay trước khi apply template (1 bước duy nhất)
  AND nội dung và template cũ được khôi phục hoàn toàn
```

#### AC-2: Giới hạn Undo — Ghi đè khi apply tiếp

```gherkin
GIVEN user đã apply template A và có thể Undo
WHEN  user apply tiếp template B (chưa Save)
THEN  điểm Undo cũ (template A) bị ghi đè bằng trạng thái trước khi apply B
  AND user chỉ có thể Undo về trạng thái trước khi apply B, không thể về trước A
```

#### AC-3: Guard Rail — Cảnh báo trước khi Save

```gherkin
GIVEN user đang ở trạng thái có thể Undo (sau khi apply template)
WHEN  user click nút SAVE
THEN  hệ thống hiển thị modal cảnh báo xác nhận: "Thay đổi sẽ được lưu vĩnh viễn, bạn không thể hoàn tác sau bước này."
  AND có 2 nút: "Xác nhận Lưu" và "Huỷ"
WHEN  user click "Xác nhận Lưu"
THEN  hệ thống lưu trạng thái mới và xoá bỏ điểm Undo cũ
```

#### AC-4: Undo bị vô hiệu sau khi SAVE

```gherkin
GIVEN user đã click "Xác nhận Lưu" thành công
WHEN  user nhìn vào thanh công cụ Editor
THEN  nút Undo bị ẩn hoặc disabled (không thể click)
```

### Additional Criteria

- [ ] Nút Undo chỉ xuất hiện sau khi user đã apply ít nhất 1 template.
- [ ] Nút Undo tự động biến mất sau khi Save thành công.

### Market Notes

- Người dùng MY (kỹ năng tech cơ bản) cần được bảo vệ khỏi việc vô ý mất công việc. Guard rail trước Save giúp giảm support tickets.

### Definition of Done

- [ ] 9-Point Checklist pass (ref: `SPEC.md §13`)
- [ ] Modal cảnh báo Save hiển thị đúng và có đủ 2 nút hành động
- [ ] Nút Undo disabled/ẩn sau khi Save thành công

---

## US-F07-07: Full Preview (View Only)

**Wave 3** | **P2** | **S** | **Status:** Ready

### Story

```
As a   user previewing a template
I want to see the full website layout in view-only mode
So that I can evaluate the design before deciding to apply it
```

### Acceptance Criteria

#### AC-1: Happy Path — Mở Full Preview modal

```gherkin
GIVEN user đang xem danh sách templates trong Templates Modal
WHEN  user click "Preview" trên 1 template cụ thể
THEN  modal full-screen mở ra hiển thị template rendered đầy đủ với nội dung hiện tại của site
  AND người dùng có thể cuộn trang (scroll) để xem toàn bộ
  AND nếu template có nhiều trang, có thể switch giữa các trang
```

#### AC-2: View Only — Không thể edit trong Preview

```gherkin
GIVEN user đang ở Full Preview mode
WHEN  user thử click/tap vào các elements trong preview
THEN  không có gì thay đổi — preview chỉ là view-only
  AND không hiển thị editor controls hay hover effects của editor
```

#### AC-3: Apply từ Preview

```gherkin
GIVEN user đang ở Full Preview mode và hài lòng với template
WHEN  user click nút "Apply This Template" (nổi bật, fixed bottom)
THEN  preview đóng lại và US-F07-05 (Content-Preserving Swap) được kích hoạt
```

### Additional Criteria

- [ ] Modal có nút "Đóng" (✕) rõ ràng ở góc trên phải.
- [ ] Preview sử dụng iframe sandbox để không ảnh hưởng đến editor state hiện tại.

### Market Notes

- Preview full-screen cho phép user hình dung được trải nghiệm khách hàng cuối — quan trọng với SME muốn "thấy trước khi quyết định".

### Definition of Done

- [ ] 9-Point Checklist pass (ref: `SPEC.md §13`)
- [ ] Full Preview hoạt động trên Desktop (1280px+) và Tablet (768px)
- [ ] Nút "Apply This Template" visible và clickable trong mọi trạng thái scroll

---

<!-- Lặp lại block ## US-F[XX]-[NN] cho mỗi story tiếp theo. Tối đa 5 stories/file. -->
