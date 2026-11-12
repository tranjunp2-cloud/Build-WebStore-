# User Stories: Media Management (F48) — Phần 2 (US-F48-06..10)

<!-- Rules & ID Convention: docs/stories/user-stories-p0.md | SPEC.md §2.4 -->

> **Feature:** F48 — Media Management
> **Sprint:** S2–S3 | **Priority:** P0/P1 | **PRD:** [F48-media-management-overview.md](../prd/F48-media-management-overview.md) | **Architecture:** [F48-media-management.md](../architecture/F48-media-management.md) | **Design:** [F48-media-management-design.md](../design/F48-media-management-design.md) | **QA:** [F48-media-management.md](../qa/F48-media-management.md) | **Mục lục + persona:** [F48-media-management-stories.md](./F48-media-management-stories.md)

---

## US-F48-06: MediaPicker dùng chung (Upload / Thư viện / URL) + chọn 1 hoặc nhiều
**Sprint S2** | **P0** | **M** | **Status:** Draft
### Story
```
As a   chủ shop hoặc staff đang sửa sản phẩm, blog, trang
I want một hộp chọn media duy nhất cho phép upload mới, chọn ảnh có sẵn trong thư viện hoặc dán URL
So that tôi không phải upload lại cùng một ảnh cho mỗi sản phẩm/block
```
### Acceptance Criteria
#### AC-1: Chọn 1 ảnh có sẵn
```gherkin
GIVEN chủ shop mở picker từ một field ảnh đơn (vd blog cover)
WHEN  chuyển tab "Thư viện", chọn 1 ảnh, bấm "Chọn"
THEN  picker đóng, field nhận { mediaId, url } của ảnh đó, không upload thêm object nào
  AND tab Thư viện dùng chung API phân trang/tìm/lọc của US-F48-05
```
#### AC-2: Chọn nhiều có giới hạn theo nơi gọi
```gherkin
GIVEN picker mở ở chế độ đa chọn với tối đa N (vd gallery SP còn 3 chỗ)
WHEN  chủ shop chọn đến ảnh thứ N
THEN  các ô còn lại bị vô hiệu, hiện "Đã chọn 3/3"
  AND bấm "Chọn" trả về danh sách theo đúng thứ tự đã chọn
```
#### AC-3: Lọc theo loại chấp nhận
```gherkin
GIVEN nơi gọi chỉ nhận ảnh (logo) hoặc chỉ nhận video (video block)
WHEN  mở picker
THEN  tab Thư viện chỉ liệt kê loại phù hợp, tab Upload chỉ nhận định dạng phù hợp
  AND favicon nhận png/jpeg/webp (chuẩn hoá về PNG) hoặc ico ≤ 256×256 giữ nguyên (D37)
```
#### AC-4: Upload trong picker
```gherkin
GIVEN chủ shop ở tab "Upload"
WHEN  thả 1 ảnh mới
THEN  ảnh đi qua pipeline US-F48-04, xong thì tự được chọn
  AND nếu trùng hash với media có sẵn → chọn media có sẵn, báo "Đã dùng ảnh có trong thư viện"
  AND vượt quota (US-F48-13) → báo lỗi "MEDIA_QUOTA_EXCEEDED" + liên kết xem dung lượng, không đóng picker
  AND đóng picker khi đang upload → upload vẫn chạy tiếp vào thư viện kèm toast, field đang mở không được gán (D40)
```
#### AC-5: Staff không có quyền `media` vẫn dùng được picker
```gherkin
GIVEN staff có quyền `products`, không có `media`
WHEN  mở picker trong màn sửa sản phẩm
THEN  xem/chọn được media của tenant, upload được ảnh mới
  AND không có nút xoá, không thấy link "Manage library"; không sửa được alt/caption của media do người khác upload
  AND sửa alt của file do chính mình upload ngay tại nơi dùng: popover "Edit alt text" trong gallery SP (`ProductGallery`) và field alt của `MediaFieldControl` (editor, blog, danh mục); file của người khác → field alt disabled + tooltip `mediaLibrary.forbiddenEditOther` "You can only edit files you uploaded…" (D26)
GIVEN staff không có quyền của màn hình gọi picker (vd không có `products`)
THEN  API picker không trả dữ liệu (403 "MEDIA_FORBIDDEN")
```
#### AC-6: Bàn phím và mobile
```gherkin
GIVEN picker đang mở
WHEN  dùng Tab/Shift+Tab, phím mũi tên trong lưới, Space chọn, Enter xác nhận, Esc đóng
THEN  focus bị giữ trong dialog, trở về nút mở sau khi đóng, mỗi ảnh có aria-label (displayName hoặc alt)
  AND ở 375px (design S3) picker là bottom sheet cao 92dvh có tay nắm, tabs full-width, lưới 3 cột (ô ≥ 104 px), footer cố định (safe-area) với nút "Select (n)" luôn thấy
```

### Additional Criteria
- [ ] NFR-07 WCAG AA: tương phản trạng thái đã chọn, `aria-selected`, thông báo `aria-live` khi upload xong.
- [ ] Tab "URL" thuộc US-F48-08; nếu US-F48-08 chưa xong thì ẩn tab, không hiển thị tab hỏng.
- [ ] Picker lazy-load ảnh lưới qua `next/image` với kích thước thumbnail, không tải ảnh gốc.

### Definition of Done
- [ ] TC-F48-06-01..06 ↔ AC-1..6; test a11y tự động (axe) cho dialog.
- [ ] FR-19 có Story Ref US-F48-06; screenshot en/ms desktop + 375px.

---

## US-F48-07: Gắn picker vào 18 điểm upload; block mới lưu `{mediaId,url}`
**Sprint S2** | **P0** | **L** | **Status:** Draft
### Story
```
As a   chủ shop
I want mọi chỗ cần ảnh trong dashboard và editor dùng cùng một cách chọn/upload, cùng giới hạn và cùng ngôn ngữ
So that tôi không gặp giới hạn 2/5/10 MB khác nhau, thông báo lẫn tiếng, và hệ thống biết ảnh nào đang được dùng
```

**Phạm vi 18 điểm (theo thứ tự tích hợp, FR-20):**

| # | Điểm upload | Cách tích hợp |
|---|---|---|
| 1 | Ảnh SP `ImageUploader.tsx` (+ halal cert) | Picker |
| 2–4 | Block overlay `media-upload-overlay.tsx` (~10 block), `BlockImageEditor.tsx`, `ImageToolbar.tsx` (iframe) | Picker |
| 5–6 | Blog cover `BlogEditorPageClient.tsx`, blog body `BlogRichEditor.tsx` | Picker |
| 7–10 | Logo, favicon, OG image, footer logo (`SettingsPanel.tsx`) | Picker (1 component chung) |
| 11 | `RichTextBlockEditor.tsx` | Picker |
| 12 | QR chuyển khoản `PaymentsFormClient.tsx` | Picker |
| 13 | Trang `/media` | Pipeline US-F48-04 |
| 14–18 | Avatar, payment proof người mua (`ConfirmClient.tsx`), feedback, studio issue evidence, AI chat attachments | Giữ route riêng, dùng chung validator |

### Acceptance Criteria
#### AC-1: Ảnh sản phẩm chọn từ thư viện
```gherkin
GIVEN chủ shop sửa sản phẩm, thư viện đã có ảnh "baju-kurung-merah.webp"
WHEN  bấm thêm ảnh, chọn ảnh đó trong tab Thư viện, lưu sản phẩm
THEN  Products.images[] nhận FK tới media có sẵn, không tạo media mới
  AND storefront hiển thị ảnh đó
```
#### AC-2: Block mới lưu `{mediaId,url}`, block cũ vẫn chạy
```gherkin
GIVEN block gallery/hero/client-logos/before-after/content-cards
WHEN  chủ shop chọn ảnh qua picker và lưu trang
THEN  JSON block lưu { mediaId, url } cho mỗi ảnh
GIVEN block cũ chỉ có URL string
WHEN  render storefront hoặc mở editor
THEN  hiển thị bình thường, không tự chuyển đổi dữ liệu (không backfill)
  AND lần sửa ảnh kế tiếp của block đó lưu theo dạng mới
```
#### AC-3: Một bộ giới hạn, một ngôn ngữ
```gherkin
GIVEN 18 điểm upload
WHEN  upload file vượt giới hạn hoặc sai định dạng ở bất kỳ điểm nào
THEN  giới hạn và thông báo lấy từ upload-limits.ts + khoá i18n chung
  AND ở locale ms không còn chuỗi tiếng Anh/Việt cứng (BlockImageEditor, toast ImageUploader, trang confirm của người mua, studio)
```
#### AC-4: Luồng riêng vẫn dùng validator chung
```gherkin
GIVEN người mua upload biên lai ở trang xác nhận đơn
WHEN  gửi file PDF 4 MB hoặc JPEG
THEN  file lưu private dưới `pw2/private/t/{tenantId}/...`, đọc qua /api/media/private/[id]
  AND PDF > 5 MB, file giả mạo đuôi, vượt rate limit → bị chặn với thông báo theo locale storefront (en/ms)
  AND biên lai không xuất hiện trong picker/thư viện của merchant
```
#### AC-5: Tenant isolation khi gắn media
```gherkin
GIVEN user tenant A gửi lưu sản phẩm/trang/site kèm mediaId thuộc tenant B
WHEN  server lưu
THEN  bị từ chối 400 "MEDIA_INVALID_REFERENCE" ("Invalid media reference"), dữ liệu không đổi
```
#### AC-6: Logo/Favicon/OG dùng chung component
```gherkin
GIVEN chủ shop đổi logo, favicon, OG image, footer logo
WHEN  dùng từng editor
THEN  cùng một component với cùng hành vi (xem trước, thay, gỡ, alt)
  AND gỡ ảnh chỉ gỡ tham chiếu, không xoá media khỏi thư viện
```
#### AC-7: Ảnh trong iframe editor
```gherkin
GIVEN chủ shop click ảnh trong preview iframe và mở ImageToolbar
WHEN  bấm "Đổi ảnh"
THEN  picker mở ở cửa sổ cha (không trong iframe), chọn xong ảnh trong preview cập nhật ngay
```

### Additional Criteria
- [ ] Alt chuẩn hoá: lấy alt của media, cho sửa tại chỗ khi field hỗ trợ; bỏ alt cố định "Block image".
- [ ] Logic input file/dropzone lặp ở ≥15 file được thay bằng component chung; mỗi file < 200 dòng.
- [ ] Mọi điểm dùng được trên 375px (editor mobile ở chế độ hiện có).
- [ ] **D73 (vùng payment):** QR chuyển khoản (điểm 12) chọn từ thư viện hoặc trùng ảnh có sẵn (dedupe) lưu được; server kiểm media `tenant === tenantId && !private && mimeType image/*` thay cho kiểm `alt === qr-{tenantId}` hiện tại (`payments/actions.ts`). Media tenant khác → 404 `MEDIA_NOT_FOUND`; media private (biên lai) hoặc không phải `image/*` → 400 `MEDIA_UNSUPPORTED_TYPE` (D80); cấu hình thanh toán không đổi (TC-F48-07-12).

### Market Notes
- Shop thời trang tái dùng một ảnh model cho nhiều SP/biến thể và banner → chọn từ thư viện là lợi ích chính.
- Ảnh Halal cert (`halalCertImage`) đi qua cùng picker, chấp nhận ảnh chụp chứng nhận JAKIM; chỉ nhận ảnh, không nhận PDF (D30).

### Definition of Done
- [ ] TC-F48-07-01..07 ↔ AC-1..7; TC-F48-07-12 (QR D73) pass; checklist 18 điểm có bằng chứng (screenshot hoặc test) trong PR.
- [ ] FR-20, FR-21 có Story Ref US-F48-07.
- [ ] Không còn import trực tiếp đường A/C ở component UI (grep trong PR).

---

## US-F48-08: Import ảnh từ URL an toàn
**Sprint S2** | **P1** | **S** | **Status:** Draft
### Story
```
As a   chủ shop
I want dán đường link ảnh để đưa ảnh vào thư viện
So that tôi lấy được ảnh từ website/nhà cung cấp mà không phải tải về máy rồi upload lại
```
### Acceptance Criteria
#### AC-1: Import thành công
```gherkin
GIVEN chủ shop ở tab "URL" của picker
WHEN  dán https://supplier.example/images/kain.jpg (ảnh JPEG 3 MB) và bấm "Nhập"
THEN  server tải ảnh về, đi qua pipeline US-F48-04 (magic, re-encode, strip EXIF, hash)
  AND tạo media createdVia = "import-url", sourceUrl lưu nội bộ, ảnh tự được chọn
```
#### AC-2: URL không hợp lệ
```gherkin
GIVEN URL là http://, file:, data:, ftp:, hoặc trả về HTML/PDF, > 10 MB, hoặc phản hồi > 10 giây
WHEN  nhập
THEN  báo lỗi cụ thể theo locale, mã theo từng ca (khớp TC-F48-08-02), không tạo media:
  | Ca                                  | Mã                               |
  | http://, file:, data:, ftp:         | 400 "MEDIA_URL_INVALID" ("Only HTTPS image links are supported") |
  | đích trả HTML/PDF (không phải ảnh)  | 415 "MEDIA_UNSUPPORTED_TYPE"     |
  | ảnh > 10 MB                         | 413 "MEDIA_TOO_LARGE"            |
  | phản hồi > 10 giây                  | 504 "MEDIA_URL_TIMEOUT"          |
  | tải lỗi (4xx/5xx, hotlink 403…)     | 422 "MEDIA_URL_FETCH_FAILED"     |
```
#### AC-3: Chặn SSRF
```gherkin
GIVEN URL có hostname phân giải ra IP private, loopback, link-local, metadata cloud, hoặc redirect sang host như vậy
WHEN  server xử lý
THEN  request bị chặn trước khi kết nối tới IP đó, trả 400 "MEDIA_URL_BLOCKED" với lỗi chung "This link cannot be imported"
  AND không trả về nội dung, header hay thời gian phản hồi của đích cho client
```
#### AC-4: Rate limit, quota và trùng ảnh
```gherkin
GIVEN chủ shop nhập URL liên tục vượt ngưỡng, hoặc tenant đã hết quota
WHEN  nhập thêm
THEN  nhận 429 "MEDIA_RATE_LIMITED" (10/user, 30/tenant mỗi phút, D32) hoặc 413 "MEDIA_QUOTA_EXCEEDED" (US-F48-13)
GIVEN ảnh tải về trùng hash media có sẵn trong tenant
THEN  trả media có sẵn (US-F48-04 AC-3)
```

### Additional Criteria
- [ ] Ô nhập URL có label, lỗi gắn `aria-describedby`; dùng được 375px (bàn phím ảo không che nút).
- [ ] Không follow quá 3 redirect; mỗi bước redirect đều kiểm lại IP.

### Market Notes
- Merchant hay copy link ảnh từ Shopee/Lazada/Instagram; các trang này thường chặn hotlink/bot → thông báo gợi ý "tải về rồi upload" thay vì lỗi kỹ thuật.

### Definition of Done
- [ ] TC-F48-08-01..04 ↔ AC-1..4; test SSRF bao gồm IPv4/IPv6 private, DNS rebinding (phân giải lại khi kết nối).
- [ ] FR-22 có Story Ref US-F48-08.

---

## US-F48-09: Thư mục lồng nhau — tạo/đổi tên/di chuyển/xoá
**Sprint S3** | **P1** | **M** | **Status:** Draft
### Story
```
As a   chủ shop có nhiều ảnh
I want sắp xếp media vào thư mục (vd "Raya 2026 / Baju")
So that tôi tìm ảnh nhanh theo mùa, dòng sản phẩm hoặc chiến dịch
```
### Acceptance Criteria
#### AC-1: Tạo, đổi tên, duyệt thư mục
```gherkin
GIVEN chủ shop ở /media
WHEN  tạo thư mục "Raya 2026", vào trong và tạo "Baju", đổi tên "Baju" thành "Baju Kurung"
THEN  cây thư mục và breadcrumb hiển thị "Media / Raya 2026 / Baju Kurung"
  AND picker (US-F48-06) duyệt được cùng cây thư mục
```
#### AC-2: Giới hạn độ sâu và số lượng
```gherkin
GIVEN đang ở thư mục cấp 5
WHEN  tạo thư mục con (cấp 6)
THEN  bị từ chối 422 "MEDIA_FOLDER_DEPTH_EXCEEDED" ("Folders can be nested up to 5 levels" / BM tương ứng)
GIVEN tenant đã có 200 thư mục
WHEN  tạo thêm
THEN  bị từ chối 422 "MEDIA_FOLDER_LIMIT_REACHED" với thông báo giới hạn 200
```
#### AC-3: Tên trùng
```gherkin
GIVEN trong cùng thư mục cha đã có "Promo"
WHEN  tạo hoặc đổi tên thành "promo" (khác hoa thường) hoặc tên rỗng / > 60 ký tự
THEN  bị từ chối với lỗi inline (409 "MEDIA_FOLDER_NAME_TAKEN" / 422 "MEDIA_FOLDER_NAME_INVALID")
  AND "Promo" ở thư mục cha khác vẫn được phép
```
#### AC-4: Di chuyển file và thư mục, chống vòng lặp
```gherkin
GIVEN chủ shop chọn 10 file và thư mục "Baju Kurung"
WHEN  kéo vào thư mục khác hoặc dùng "Di chuyển tới…"
THEN  file và thư mục chuyển đúng chỗ, URL media không đổi, nơi đang dùng ảnh không bị ảnh hưởng
WHEN  di chuyển thư mục vào chính nó hoặc thư mục con của nó, hoặc làm cây con vượt cấp 5
THEN  bị từ chối 422 "MEDIA_FOLDER_CYCLE" / "MEDIA_FOLDER_DEPTH_EXCEEDED", không thay đổi gì
```
#### AC-5: Xoá thư mục an toàn
```gherkin
GIVEN thư mục rỗng
WHEN  xoá
THEN  thư mục bị xoá
GIVEN thư mục có file hoặc thư mục con
WHEN  xoá
THEN  hộp thoại chỉ cho 2 lựa chọn: "Huỷ" hoặc "Chuyển nội dung lên thư mục cha rồi xoá"
  AND không file nào bị xoá theo thư mục (không xoá đệ quy)
  AND thư mục con trùng tên ở thư mục cha được đổi thành "Tên (2)", "Tên (3)"… (D51)
```
#### AC-6: Tenant isolation
```gherkin
GIVEN user tenant A
WHEN  gửi tạo/di chuyển với parent hoặc folder id thuộc tenant B
THEN  trả 404 "MEDIA_FOLDER_NOT_FOUND", không thay đổi gì ở cả A và B
```

### Additional Criteria
- [ ] Collection riêng `media-folders`, không dùng tính năng folders thử nghiệm của Payload (D54).
- [ ] Di chuyển bằng bàn phím: menu "Di chuyển tới…" thay cho kéo thả; cây thư mục dùng `role="tree"`.
- [ ] 375px: cây thư mục thu gọn thành breadcrumb + danh sách thư mục con.
- [ ] Xoá media (FK `folder_id` ON DELETE SET NULL) không lỗi; media không thư mục nằm ở gốc.

### Market Notes
- PW1 production: 130 store dùng thư mục, tối đa 20 thư mục/store; độ sâu cấp0 1.090, cấp1 2.127, cấp2 620, cấp3 39, ≥ cấp4 25 (max 8) → giới hạn 5 cấp và 200 thư mục phủ > 99% nhu cầu thực tế.
- PW1 xoá thư mục là xoá đệ quy file; PW2 cố ý không làm vậy (D20).

### Definition of Done
- [ ] TC-F48-09-01..06 ↔ AC-1..6.
- [ ] FR-23..FR-25 có Story Ref US-F48-09; bảng `media_folders` + cột `media.folder_id` có entry MIGRATIONS, unique (tenant_id, parent_id, lower(name)).

---

## US-F48-10: Quyền `media` cho staff + mục sidebar
**Sprint S3** | **P1** | **S** | **Status:** Draft
### Story
```
As a   chủ shop có nhân viên
I want cấp riêng quyền quản lý thư viện media cho staff, và có lối vào Media trên sidebar
So that người phụ trách nội dung dọn được thư viện mà staff khác vẫn chọn/upload ảnh trong việc của họ
```
### Acceptance Criteria
#### AC-1: Owner cấp quyền `media`
```gherkin
GIVEN owner mở StaffDrawer của staff S
WHEN  bật quyền "Media" và lưu
THEN  S vào được /media, sửa metadata, tạo/di chuyển thư mục, xoá media (trừ "Vẫn xoá" media đang dùng — chỉ owner, US-F48-11)
  AND quyền lưu qua ALLOWED_PERMISSIONS, giá trị lạ bị loại khi ghi
```
#### AC-2: Staff không có `media`
```gherkin
GIVEN staff S chỉ có quyền `products`
WHEN  truy cập /media bằng URL
THEN  thấy trang "Bạn không có quyền" (không lộ dữ liệu), không thấy mục Media trên sidebar
  AND vẫn dùng picker trong màn sản phẩm (US-F48-06 AC-5): chọn, upload; sửa alt được media do chính S upload tại gallery SP / `MediaFieldControl` (file người khác: disabled + tooltip)
```
#### AC-3: Chặn ở server, không chỉ ẩn UI
```gherkin
GIVEN staff không có `media`
WHEN  gọi trực tiếp API xoá, xoá nhiều, sửa metadata media của người khác, tạo/xoá thư mục
THEN  nhận 403 "MEDIA_FORBIDDEN", dữ liệu không đổi
```
#### AC-4: Mục sidebar "Media" (PO đồng ý, D88)
```gherkin
GIVEN PO đã đồng ý đảo quyết định 2026-06-11 (D88)
WHEN  owner hoặc staff có `media` mở dashboard
THEN  sidebar có mục "Media" trong nhóm **Online Store** (sau Blog), khai trong `src/config/sidebar-nav.ts` với label inline `{ en: 'Media', ms: 'Media' }`, icon `Images`, `permissionId: 'media'`, trạng thái active khi ở /media
  AND link "Manage library" ở footer picker vẫn mở /media (lối vào phụ)
```
#### AC-5: Staff hiện có không tự được cấp
```gherkin
GIVEN staff được tạo trước khi có quyền `media`
WHEN  deploy F48
THEN  staff đó chưa có `media` cho tới khi owner bật; owner luôn có đủ quyền
  AND chỉ owner được cấp `media` (D27); role `viewer` cũ chỉ xem, không có `media` (D52)
```

### Additional Criteria
- [ ] Toggle quyền trong StaffDrawer dùng được bằng bàn phím, có mô tả ngắn en/ms về phạm vi quyền.
- [ ] Sidebar 375px (menu drawer) hiển thị mục Media đúng thứ tự.

### Definition of Done
- [ ] TC-F48-10-01..05 ↔ AC-1..5; test 403 server cho từng API quản lý.
- [ ] FR-26, FR-27 có Story Ref US-F48-10; `permissions.ts` và StaffDrawer cập nhật cùng PR.
- [x] PO đồng ý D13 mục sidebar (2026-11-10, D88).
