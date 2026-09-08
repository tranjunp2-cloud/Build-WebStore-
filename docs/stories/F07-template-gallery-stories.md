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

- [ ] 10-Point Checklist pass (ref: `SPEC.md §13`)
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

- [ ] 10-Point Checklist pass (ref: `SPEC.md §13`)
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

- [ ] 10-Point Checklist pass (ref: `SPEC.md §13`)
- [ ] Modal cảnh báo Save hiển thị đúng và có đủ 2 nút hành động
- [ ] Nút Undo disabled/ẩn sau khi Save thành công

---

## US-F07-07: Full Preview (View Only)

**Wave 3** | **P1** | **M** | **Status:** Refinement

> **BA scope confirmed:** 2026-09-08. Pending Architecture, Design, QA handoff và Dev re-estimate trước khi chuyển `Ready`.

### Story

```
As a   user previewing a template
I want to see the full website layout in view-only mode
So that I can evaluate the design before deciding to apply it
```

### Acceptance Criteria

#### AC-1: Happy Path — Preview bằng nội dung hiện tại của site

```gherkin
GIVEN user đang chỉnh sửa một site trong AI Editor
  AND site có nội dung hiện tại gồm text, image và các page đã lưu hoặc đang có trong Editor
WHEN  user click "Preview" trên một template cụ thể trong Templates Modal
THEN  Full Preview modal mở ở chế độ full-screen
  AND template được render bằng nội dung hiện tại của chính site đó sau khi chạy Smart Mapping ở chế độ dry-run
  AND người dùng có thể cuộn trang (scroll) để xem toàn bộ
  AND các field/block map được luôn dùng current site content
  AND field/block đích không có source tương ứng chỉ được dùng template default content khi có nhãn "Sample content" rõ ràng
  AND không thay thế toàn bộ Preview hoặc current content đã map được bằng sample/default content
```

#### AC-2: Multi-page Preview — Chọn đúng trang cần xem

```gherkin
GIVEN template được chọn có nhiều hơn một page khả dụng trong template page inventory
  AND user đang ở Full Preview mode
WHEN  Full Preview được tải thành công
THEN  Page Selector hiển thị bên ngoài vùng website preview
  AND liệt kê các page của template được chọn
  AND page được template khai báo `isHomepage` được chọn mặc định
  AND template phải có đúng một page `isHomepage`; nếu thiếu hoặc có nhiều hơn một thì hiển thị lỗi theo AC-6
WHEN  user chọn một page khác
THEN  hệ thống render đúng template page được chọn
  AND ưu tiên map current site page có cùng page role hoặc normalized slug
  AND nếu không có source page tương ứng, chỉ được dùng template default content kèm nhãn "Sample content"
  AND current site page không có target template page tương ứng không xuất hiện trong Page Selector và không bị thay đổi trong quá trình Preview
  AND không tự động fallback về Home hoặc page đầu tiên nếu page được chọn không tồn tại hoặc tải lỗi
  AND hiển thị lỗi tại vùng preview kèm hành động "Thử lại"
```

```gherkin
GIVEN template chỉ có một page khả dụng trong template page inventory
WHEN  Full Preview được tải thành công
THEN  Page Selector không hiển thị
```

#### AC-3: View Only — Không thể edit hoặc điều hướng trong Preview

```gherkin
GIVEN user đang ở Full Preview mode
WHEN  user click/tap vào link, button, form field hoặc thành phần tương tác bên trong website preview
THEN  dữ liệu và trạng thái Editor không thay đổi
  AND không điều hướng sang page, route hoặc website khác
  AND không submit form hoặc thực thi CTA của website
  AND form control không nhận focus, không cho nhập dữ liệu và không thay đổi local preview state
  AND user vẫn có thể scroll để xem toàn bộ page
  AND không hiển thị editor controls hay hover effects của editor
```

#### AC-4: Apply từ Preview có bước xác nhận

```gherkin
GIVEN user đang ở Full Preview mode và hài lòng với template
WHEN  user click nút "Apply This Template" tại fixed bottom action bar
THEN  hệ thống hiển thị Confirmation Dialog trước khi thay đổi site
WHEN  user xác nhận Apply
THEN  Preview đóng lại
  AND US-F07-05 (Content-Preserving Template Swap) được kích hoạt đúng một lần
```

```gherkin
GIVEN user đang xem Confirmation Dialog của thao tác Apply
WHEN  user chọn Cancel
THEN  Confirmation Dialog đóng
  AND user vẫn ở Full Preview
  AND site không thay đổi
```

#### AC-5: Close Preview — Thoát an toàn

```gherkin
GIVEN user đang ở Full Preview mode
WHEN  user click nút Close (X), chọn Back hoặc nhấn phím Escape
THEN  Full Preview đóng lại
  AND focus được trả về Template Card hoặc nút Preview đã mở modal
  AND không có thay đổi nào được ghi vào site
  AND không tạo Undo point hoặc revision mới
```

#### AC-6: Loading và Error — Phản hồi đúng theo từng loại lỗi

```gherkin
GIVEN user mở Full Preview hoặc chuyển page trong Preview
WHEN  hệ thống đang chuẩn bị nội dung preview
THEN  hiển thị Loading state tại vùng preview
```

```gherkin
GIVEN session của user hết hạn khi mở Preview
WHEN  hệ thống nhận lỗi Authentication Required (401)
THEN  không hiển thị website content
  AND hiển thị hành động "Đăng nhập lại"
```

```gherkin
GIVEN site/template không tồn tại hoặc user không có quyền truy cập
WHEN  hệ thống nhận lỗi Forbidden (403) hoặc Not Found (404)
THEN  không tiết lộ site/template có tồn tại hay không
  AND không hiển thị content của site/tenant khác hoặc sample content để thay thế
  AND hiển thị thông báo "Preview unavailable" kèm hành động "Quay lại" hoặc "Đóng"
```

```gherkin
GIVEN Preview bị timeout hoặc render failure
WHEN  hệ thống không thể hoàn tất Preview
THEN  hiển thị Error state kèm hành động "Thử lại" hoặc "Đóng"
  AND không silent fallback về Home, page đầu tiên hoặc sample content
```

#### AC-7: Performance và Timeout

```gherkin
GIVEN user sử dụng môi trường được hỗ trợ với reference test dataset
WHEN  user mở Full Preview
THEN  Preview sẵn sàng để xem trong p95 không quá 3 giây
WHEN  user chuyển sang một page khác
THEN  page được chọn sẵn sàng để xem trong p95 không quá 2 giây
  AND nếu một lần tải vượt quá 10 giây, hệ thống dừng Loading state và hiển thị Error state theo AC-6
```

### Business Rules / BA Decisions

- **Content source trong Editor:** luôn dùng nội dung hiện tại của site sau Smart Mapping dạng **dry-run**; Preview không được ghi dữ liệu vào site.
- **Mapping fallback:** matched field/block luôn dùng current content. Unmatched target field/block/page chỉ được dùng template default content khi có nhãn **"Sample content"**; không được thay thế toàn bộ Preview bằng sample content.
- **View-only:** chỉ cho phép scroll và các control thuộc Preview shell (Back/Close, Page Selector, Apply); mọi tương tác bên trong website preview phải inert. Device viewport toggle hiện có không thay đổi trong US-F07-07.
- **Multi-page:** nằm trong scope hiện tại. Selector lấy page inventory từ template được chọn và yêu cầu đúng một `isHomepage`. Smart Mapping ưu tiên source page cùng role hoặc normalized slug; source page không có target tương ứng không hiển thị và không bị Preview thay đổi.
- **CTA:** tên chuẩn là **"Apply This Template"**, đặt tại fixed bottom action bar và luôn nhìn thấy khi user scroll.
- **Apply safety:** user phải xác nhận trước khi bắt đầu US-F07-05; trong lúc Apply, CTA bị disabled để chống double-submit.
- **No side effects:** mở, đóng, scroll hoặc đổi page Preview không được mutate/persist site content, tạo revision/Undo point hoặc tính quota Apply; technical telemetry/audit log vẫn được phép.
- **Data isolation:** chỉ preview site thuộc tenant mà user có quyền truy cập; tuyệt đối không fallback sang dữ liệu site khác.

### Additional Criteria

- [ ] Modal có nút "Đóng" (✕) rõ ràng ở góc trên phải.
- [ ] Preview shell hỗ trợ Back/Close và Page Selector (khi cần); thay đổi device viewport toggle hiện có không thuộc scope US-F07-07.
- [ ] Full Preview của US-F07-07 bắt buộc hỗ trợ Desktop (1280px+) và Tablet (768px); Mobile Gallery/Preview UX thuộc US-F07-08.
- [ ] Giải pháp kỹ thuật phải cô lập preview và đáp ứng toàn bộ hành vi view-only; cơ chế cụ thể do Tech Lead xác nhận trong Architecture Document.
- [ ] CTA Apply có Loading/Disabled state và không gửi trùng request.

### Market Notes

- Preview full-screen cho phép user hình dung được trải nghiệm khách hàng cuối — quan trọng với SME muốn "thấy trước khi quyết định".

### Definition of Done

- [ ] 10-Point Checklist pass (ref: `SPEC.md §13`)
- [ ] Full Preview hoạt động trên Desktop (1280px+) và Tablet (768px)
- [ ] Nút "Apply This Template" visible và clickable trong mọi trạng thái scroll
- [ ] QA verify Preview dùng current site content sau dry-run Smart Mapping, không dùng sample content trong Editor context
- [ ] QA verify scroll hoạt động nhưng link/button/form/navigation bên trong preview không có tác dụng
- [ ] QA verify đúng page được chọn; không silent fallback về Home/page đầu tiên
- [ ] QA verify Preview không mutate/persist site content, tạo revision, Undo point hoặc Apply quota trước khi user xác nhận
- [ ] QA verify tenant authorization và không rò rỉ content giữa các site/tenant
- [ ] QA verify initial Preview p95 ≤ 3 giây, page switch p95 ≤ 2 giây và timeout sau 10 giây trên reference test dataset
- [ ] Architecture, Design và QA Spec đã được owner tương ứng cập nhật theo BA Decisions phía trên

---

## US-F07-08: Mobile Web UX — Touch-Friendly Template Gallery

**Wave 3** | **P1** | **M** | **Status:** Ready

### Story

```
As a   mobile user (Store Owner)
I want the Template Gallery to open as a Bottom Sheet with a thumb-friendly grid
So that I can easily browse and preview templates on a small screen
```

### Acceptance Criteria

#### AC-1: Bottom Sheet Gallery

```gherkin
GIVEN the user is in the Editor on a mobile device (< 768px)
WHEN  they tap the "Templates" icon
THEN  instead of a floating modal, a Bottom Sheet slides up covering 90% of the screen height
  AND the AI Chat search input is fixed at the top of this sheet
```

#### AC-2: Optimized Mobile Grid

```gherkin
GIVEN the Template Gallery is open on mobile
WHEN  viewing the template list
THEN  the templates are displayed in a 2-column grid to maximize visible options
  AND tap targets for "Preview" and "Apply" are at least 44x44px
```

### Definition of Done

- [ ] 10-Point Checklist pass.
