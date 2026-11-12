# User Stories: Media Management (F48)

<!-- Rules & ID Convention: docs/stories/user-stories-p0.md | SPEC.md §2.4 -->

> **Feature:** F48 — Media Management (pipeline upload an toàn, thư viện, picker, thư mục, vòng đời, quota, media sản phẩm)
> **Sprint:** S0–S5 | **Priority:** P0/P1/P2 | **PRD:** [F48-media-management-overview.md](../prd/F48-media-management-overview.md) | **Architecture:** [F48-media-management.md](../architecture/F48-media-management.md) | **Design:** [F48-media-management-design.md](../design/F48-media-management-design.md) | **QA:** [F48-media-management.md](../qa/F48-media-management.md)
> **Nguồn quyết định:** brainstorm F48 (2026-11-09, staging `1248713`) — D1–D67 đã CHỐT (quyết định sau thay quyết định trước), trừ mục ghi **Chờ PO**; review lượt 3 thêm D68–D78 (ghi ở [PRD tổng](../prd/F48-media-management-overview.md)), D74 Chờ PO.

---

> [!IMPORTANT]
> **Ngoài phạm vi:** chỉnh ảnh nâng cao (filter, AI edit, xoá nền), transcode/poster video, quét virus ClamAV, collection Brand, review sản phẩm, chuyển dữ liệu block cũ (URL string) sang id, migrate/backfill dữ liệu PW1 (migration PW1→PW2 đã xong; PW1 chỉ là tham chiếu tính năng).
>
> **Bucket DO Spaces dùng chung với PW1.** Mọi thao tác xoá/dọn của PW2 chỉ được đụng object dưới prefix `pw2/`. Đây là ràng buộc xuyên suốt cho US-F48-01, -03, -04, -11, -12 (NFR-05).

### Persona
| Persona | Mô tả |
|---|---|
| Chủ shop (owner) | Merchant SME Malaysia, toàn quyền tenant, dùng dashboard en/ms, thường thao tác trên điện thoại |
| Staff có quyền `media` | Được owner cấp `media` trong StaffDrawer: vào `/media`, quản lý thư viện |
| Staff không có quyền `media` | Có `products`/`blog`/`builder`/`settings`; dùng picker trong màn hình được phép, không vào `/media` |
| Người mua | Khách storefront, upload biên lai chuyển khoản (payment proof, private) |
| Super-admin | Vận hành nền tảng: key S3, CDN, cron GC, PlanFeatures |
| Hệ thống (cron) | Job dọn rác định kỳ, lifecycle rule bucket |

### Mục lục 16 story
| Story ID | Tiêu đề | Sprint | Ưu tiên | Size | File |
|---|---|---|---|---|---|
| US-F48-01 | Khoá field hệ thống của media + chỉ ghi qua API an toàn (SEC-1, SEC-8) | S0 | P0 | M | [F48-media-management-stories.md](./F48-media-management-stories.md) |
| US-F48-02 | Cứng hoá upload: whitelist định dạng, magic check mọi đường, rate limit, header, remotePatterns hẹp, nâng sharp | S0 | P0 | M | [F48-media-management-stories.md](./F48-media-management-stories.md) |
| US-F48-03 | Vận hành: xoay key S3, key riêng PW2, kiểm listing bucket, CDN + cache header | S0 | P0 | S | [F48-media-management-stories.md](./F48-media-management-stories.md) |
| US-F48-04 | Pipeline upload hợp nhất: client nén → tmp → register xử lý server, quota per-file | S1 | P0 | L | [F48-media-management-stories.md](./F48-media-management-stories.md) |
| US-F48-05 | Thư viện /media: phân trang server, tìm/lọc/sắp xếp, chi tiết, sửa metadata, xoá nhiều, kéo thả, i18n | S1 | P0 | L | [F48-media-management-stories.md](./F48-media-management-stories.md) |
| US-F48-06 | MediaPicker dùng chung (Upload / Thư viện / URL) + chọn 1 hoặc nhiều | S2 | P0 | M | [F48-media-management-stories-2.md](./F48-media-management-stories-2.md) |
| US-F48-07 | Gắn picker vào 18 điểm upload; block mới lưu `{mediaId,url}` | S2 | P0 | L | [F48-media-management-stories-2.md](./F48-media-management-stories-2.md) |
| US-F48-08 | Import ảnh từ URL an toàn | S2 | P1 | S | [F48-media-management-stories-2.md](./F48-media-management-stories-2.md) |
| US-F48-09 | Thư mục lồng nhau: tạo/đổi tên/di chuyển/xoá | S3 | P1 | M | [F48-media-management-stories-2.md](./F48-media-management-stories-2.md) |
| US-F48-10 | Quyền `media` cho staff + mục sidebar | S3 | P1 | S | [F48-media-management-stories-2.md](./F48-media-management-stories-2.md) |
| US-F48-11 | "Đang dùng ở đâu" + chặn/cảnh báo khi xoá + bộ lọc "Chưa dùng" | S4 | P0 | M | [F48-media-management-stories-3.md](./F48-media-management-stories-3.md) |
| US-F48-12 | Dọn rác tự động có dry-run + dọn khi regenerate | S4 | P1 | M | [F48-media-management-stories-3.md](./F48-media-management-stories-3.md) |
| US-F48-13 | Quota dung lượng theo gói + đồng hồ dung lượng | S4 | P1 | M | [F48-media-management-stories-3.md](./F48-media-management-stories-3.md) |
| US-F48-14 | Gallery SP 10 ảnh, kéo sắp xếp, ảnh chính | S5 | P1 | S | [F48-media-management-stories-4.md](./F48-media-management-stories-4.md) |
| US-F48-15 | Ảnh cho biến thể chọn từ gallery + storefront đổi ảnh theo biến thể | S5 | P1 | M | [F48-media-management-stories-4.md](./F48-media-management-stories-4.md) |
| US-F48-16 | Ảnh danh mục (⏸ hoãn, D88) | S5 | P2 | S | [F48-media-management-stories-4.md](./F48-media-management-stories-4.md) |

**Quy ước TC-ID:** `TC-F48-<story>-<nn>` trong `docs/qa/F48-media-management.md`; mỗi AC có ≥1 TC. QA tham chiếu dạng "AC-n US-F48-xx".

---

## US-F48-01: Khoá field hệ thống của media + chỉ ghi qua API an toàn (SEC-1, SEC-8)
**Sprint S0** | **P0** | **M** | **Status:** Draft
### Story
```
As a   chủ shop (và nền tảng vận hành bucket dùng chung với PW1)
I want các field hệ thống của media chỉ do server ghi, và dữ liệu nội bộ không lộ qua API public
So that không user nào có thể đổi key lưu trữ để xoá object không thuộc mình hoặc đọc prompt/nguồn ảnh của shop khác
```
### Acceptance Criteria
#### AC-1: Sửa metadata được phép
```gherkin
GIVEN chủ shop A đăng nhập, có media M thuộc tenant A
WHEN  gửi cập nhật M chỉ với alt, caption, displayName, folder (folder thuộc tenant A)
THEN  4 field được lưu
  AND filename, prefix, _objectKey, mimeType, filesize, url, width, height, contentHash, tenant, private, createdVia giữ nguyên
```
#### AC-2: Từ chối ghi field hệ thống (mọi đường ghi)
```gherkin
GIVEN chủ shop A có media M
WHEN  gửi cập nhật M đặt giá trị KHÁC bản gốc cho bất kỳ field nào trong: filename, prefix, _objectKey, mimeType, filesize, url, width, height, contentHash, tenant, private, createdVia
  (qua Payload REST /api/media/:id, GraphQL hoặc route media riêng; Local API không qua guard — D70, nhưng field access `update` vẫn giữ nguyên giá trị khi `overrideAccess: false`)
THEN  request bị từ chối 400 với mã lỗi "MEDIA_FIELD_READONLY", không field nào của M thay đổi
  AND sự kiện được ghi log kèm userId, tenantId, mediaId, danh sách field bị từ chối
```
#### AC-3: Xoá row chỉ xoá đúng object của chính row đó
```gherkin
GIVEN media M thuộc tenant A, key lưu trữ do server sinh khi tạo
WHEN  chủ shop A xoá M
THEN  chỉ xoá object khi key bắt đầu bằng `pw2/`, HOẶC key phẳng (không có `/`) và đúng bằng `filename` khác null của chính row M (D21)
  AND mọi trường hợp khác (vd row PW1, filename null) → chỉ xoá row, bỏ qua object, ghi log "skip-foreign-key"; UI gắn nhãn "Legacy"
  AND key bị audit chặn phải có exclusion exact key ghi/đọc xác nhận durable trước khi row mất; giữ object tới explicit Ops clearance (D87 §8.7)
  AND metadata registry thiếu/lỗi/incomplete ⇒ rollback giữ row/quota và không xoá object mọi prefix; row/intent mất không bỏ qua kiểm exact key
```
#### AC-4: Tenant isolation khi sửa/xoá
```gherkin
GIVEN user thuộc tenant A
WHEN  gửi sửa hoặc xoá media thuộc tenant B, hoặc media global (tenant null: stock, carton placeholder)
THEN  route media F48 trả 404 (không tiết lộ media có tồn tại), Payload REST/GraphQL trả 403 (M9); không thay đổi gì
  AND không object S3 nào bị xoá
```
#### AC-5: Đọc public không lộ dữ liệu nội bộ (SEC-8)
```gherkin
GIVEN media non-private N có aiPrompt và sourceUrl
WHEN  khách chưa đăng nhập gọi GET /api/media/:id hoặc list /api/media (kể cả duyệt id tuần tự)
THEN  response không chứa aiPrompt, sourceUrl
  AND media private (payment proof) trả 403/404 qua /api/media; chỉ đọc được qua /api/media/private/[id]
  AND /api/media/private/[id] (D79): owner, super-admin hoặc staff cùng tenant có quyền `orders` → 200; staff cùng tenant không có `orders` → 403 "MEDIA_FORBIDDEN"; user tenant khác hoặc id không phải private → 404 "MEDIA_NOT_FOUND"; chưa đăng nhập → 401 "MEDIA_UNAUTHORIZED"
  AND owner tenant của N vẫn xem đủ aiPrompt/sourceUrl trong dashboard
```
#### AC-6: Tạo mới không nhận giá trị field hệ thống từ client
```gherkin
GIVEN client gửi tạo media kèm tenant của shop khác, private=false cho file proof, hoặc createdVia="seed"
WHEN  server xử lý
THEN  request bị từ chối 400 "MEDIA_FIELD_READONLY", không tạo row (D22) — qua route F48 (register, upload proof); Payload REST `POST /api/media` của merchant bị 403 trước vì collection access chỉ super-admin (INV-3, D69)
  AND tenant lấy theo session, private/createdVia do luồng server quyết định
```

### Additional Criteria
- [ ] Khoá ở 2 lớp: field-level `access.update = false` (`_objectKey`/`prefix` khoá trong plugin chạy sau `s3Storage`, D55) + guard `beforeOperation` từ chối khi field hệ thống khác `originalDoc` (FR-01, D58; Local API hệ thống không user đi qua). `originalDoc` đọc bằng `findByID` `overrideAccess` cùng `req` khi update theo id; update bulk theo `where` có field hệ thống → 400 `MEDIA_FIELD_READONLY` (D65). Payload REST write cho `media` chỉ super-admin (D15).
- [ ] Super-admin trong Payload admin không sửa được `filename`/`prefix`/`_objectKey`/`url` (tránh lệch key) nhưng sửa alt thành công (D58, TC-F48-01-14).
- [ ] **D68:** sau khi S0 đổi collection access `media` chỉ super-admin, route `DELETE /api/media/library/[id]` kiểm quyền bằng `assertCanManageMedia` rồi gọi Local API `overrideAccess: true` → owner xoá được media của tenant mình; staff không quyền 403; id tenant khác 404 (TC-F48-01-17). **D69:** field hệ thống chỉ khoá `update`, `create` không khoá → super-admin upload trong `/admin` vẫn có `filename`/`mimeType`/`filesize` (TC-F48-01-18). **D70:** guard `beforeOperation` chỉ áp REST/GraphQL; Local API (carton placeholder, AI, seed, route F48) miễn → lưu SP không ảnh vẫn tạo carton placeholder (TC-F48-01-19).
- [ ] Không làm hỏng luồng nội bộ: AI generate, seeder, PW1 row cũ, `stripOrphanMediaRefs` vẫn chạy (Local API với `overrideAccess` có kiểm soát).

### Definition of Done
- [ ] Test tái hiện SEC-1 viết **đỏ trước** trên code staging hiện tại (đổi filename qua update rồi xoá row ⇒ hook xoá object ngoài key gốc), sau sửa → xanh. Không chạy thử trên bucket thật; dùng S3 mock/MinIO.
- [ ] TC-F48-01-01..06 ↔ AC-1..6 trong `docs/qa/F48-media-management.md`, pass CI; quyền route private biên lai (AC-5) có TC-F48-01-16; quyết định D68–D70 (xoá qua route sau S0, chỉ khoá update, guard chỉ REST/GraphQL) có TC-F48-01-17..19.
- [ ] FR-01, FR-02 có Story Ref US-F48-01 trong PRD; `code-reviewer` xác nhận không còn đường ghi nào (REST, GraphQL, server action, route) set được field hệ thống.

---

## US-F48-02: Cứng hoá upload — whitelist, magic check, rate limit, header, remotePatterns, sharp
**Sprint S0** | **P0** | **M** | **Status:** Draft
### Story
```
As a   chủ shop và nền tảng
I want mọi đường upload chỉ nhận đúng định dạng đã cho phép, kiểm nội dung thật, có giới hạn tần suất và header an toàn
So that không ai lưu được file giả mạo, lạm dụng upload, hay dùng image optimizer của nền tảng như proxy mở
```
### Acceptance Criteria
#### AC-1: Whitelist MIME tường minh
```gherkin
GIVEN chủ shop upload qua bất kỳ đường A/B/C/D hoặc Payload REST POST /api/media
WHEN  file là jpeg, png, webp (ảnh) hoặc mp4, webm (video) và nội dung khớp định dạng; ico chỉ với purpose `favicon` (D37)
THEN  upload được chấp nhận
WHEN  file là svg, gif, avif, heic, tiff, txt, html, video khác mp4/webm, hoặc pdf ngoài luồng payment proof (D23)
THEN  bị từ chối 415 "MEDIA_UNSUPPORTED_TYPE" với thông báo en/ms liệt kê định dạng hợp lệ
```
#### AC-2: File giả mạo đuôi bị chặn ở mọi đường
```gherkin
GIVEN file tên "banner.jpg", Content-Type image/jpeg nhưng byte đầu là HTML, PDF, SVG hoặc ZIP
WHEN  upload qua A, B (presign + register), C (server action), D (avatar, QR, proof) hoặc REST
THEN  bị từ chối 415 "MEDIA_CONTENT_MISMATCH" ("File content does not match its type" / "Kandungan fail tidak sepadan dengan jenisnya")
  AND không row media nào được tạo, object tạm (nếu có) bị xoá
```
#### AC-3: Rate limit
```gherkin
GIVEN một user (hoặc một tenant) gửi upload/register/proof/avatar/QR vượt ngưỡng cấu hình trong cửa sổ thời gian
WHEN  request vượt ngưỡng đến
THEN  nhận 429 "MEDIA_RATE_LIMITED" kèm header Retry-After và thông báo i18n "Too many uploads, try again in N seconds"
  AND request trong ngưỡng của tenant khác không bị ảnh hưởng
  AND người mua upload proof bị giới hạn theo IP + order, không theo tenant
```
#### AC-4: Image optimizer không là proxy mở
```gherkin
GIVEN remotePatterns chỉ gồm host CDN/S3 của PW2, host PW1 cũ, Pixabay, Wikimedia
WHEN  có request /_next/image?url= tới host ngoài danh sách
THEN  trả 400, không tải ảnh ngoài
  AND ảnh từ host trong danh sách vẫn hiển thị bình thường trên storefront
  AND image optimizer không bật AVIF/SVG, có minimumCacheTTL
```
#### AC-5: Header bảo mật trên file media
```gherkin
GIVEN một media đã upload (object S3 hoặc handler local)
WHEN  trình duyệt tải file
THEN  response có X-Content-Type-Options: nosniff, Content-Type đúng định dạng đã kiểm
  AND Content-Disposition: inline cho ảnh/video, attachment cho mọi loại khác
  AND Cache-Control theo FR-06
```
#### AC-6: Presign chặt
```gherkin
GIVEN chủ shop xin presign upload
WHEN  dùng presign ảnh sau 60 giây / video sau 600 giây (D35), gửi file 0 byte, hoặc gọi register với key không khớp key tmp đã cấp cho chính user đó
THEN  S3 từ chối (hết hạn / content-length-range min 1) hoặc register trả 400 "MEDIA_KEY_INVALID"
  AND không row nào được tạo
```
#### AC-7: Sharp an toàn và cổng audit
```gherkin
GIVEN pipeline CI chạy trên PR
WHEN  sharp thấp hơn bản 0.35.x mới nhất đã vá advisory libvips/libheif, hoặc npm audit có lỗ hổng high/critical ở sharp
THEN  CI báo đỏ
```

### Additional Criteria
- [ ] Nguồn giới hạn duy nhất `src/lib/media/upload-limits.ts` (FR-14); không còn hằng số 2/5/10 MB rải rác. Ngưỡng rate limit (D32, mỗi phút, user/tenant): presign 60/120, register 60/120, import-url 10/30, bulk delete 10/20; proof 5/đơn/giờ + 20/IP/giờ; avatar/QR 10/user/giờ.
- [ ] CSRF (D43): route ghi media kiểm `Origin`/`Sec-Fetch-Site` same-origin + cookie SameSite; khác origin → 403 "MEDIA_FORBIDDEN".
- [ ] Thông báo lỗi upload hiển thị đủ trên màn 375px, đọc được bởi screen reader (`role="alert"`).

### Market Notes
- PW1 production có svg 3, txt 2, gif 5 file trong thư viện: chặn svg/txt không ảnh hưởng thực tế; gif hiếm (5/3.413) → thông báo gợi ý đổi sang PNG/WebP.

### Definition of Done
- [ ] TC-F48-02-01..07 ↔ AC-1..7; test magic check đỏ trước cho đường REST POST /api/media và register video (SEC-5).
- [ ] FR-03..FR-08 có Story Ref US-F48-02.
- [ ] Ảnh PW1 cũ trên storefront vẫn hiển thị sau khi thu hẹp remotePatterns (kiểm 1 site đã migrate trên staging).

---

## US-F48-03: Vận hành — xoay key S3, key riêng PW2, kiểm listing bucket, CDN + cache header
**Sprint S0** | **P0** | **S** | **Status:** Draft
### Story
```
As a   super-admin vận hành nền tảng
I want key S3 bị lộ được thay, PW2 dùng key riêng với quyền tối thiểu, bucket không lộ danh sách và media đi qua CDN
So that giảm thiệt hại nếu key lộ lần nữa và giảm chi phí băng thông cho merchant
```
### Acceptance Criteria
#### AC-1: Xoay key bị lộ
```gherkin
GIVEN key DO Spaces bị lộ ngày 2026-04-15 vẫn còn hiệu lực
WHEN  super-admin tạo key mới, cập nhật Vercel Dashboard (staging, production) rồi thu hồi key cũ
THEN  upload, đọc private, xoá media trên staging và production chạy bình thường với key mới
  AND gọi S3 bằng key cũ nhận AccessDenied
```
#### AC-2: Key riêng cho PW2
```gherkin
GIVEN PW1 và PW2 dùng chung bucket
WHEN  cấu hình PW2
THEN  PW2 dùng key riêng (không dùng chung key với PW1), với phạm vi tối thiểu DO Spaces hỗ trợ
  AND nếu DO không giới hạn được theo prefix, rủi ro được ghi trong PRD và bảo vệ bằng guard prefix `pw2/` ở code (NFR-05)
```
#### AC-3: Bucket không cho liệt kê công khai
```gherkin
GIVEN một client không có chữ ký
WHEN  gửi GET tới gốc bucket (list objects)
THEN  nhận AccessDenied, không trả danh sách key
  AND object public-read vẫn đọc được bằng URL trực tiếp
```
#### AC-4: CDN + cache header cho object mới
```gherkin
GIVEN CDN DO Spaces được bật với domain cookieless (tuỳ chọn, D16; chưa bật thì giữ URL path-style hiện tại)
WHEN  media mới upload theo key hash (US-F48-04)
THEN  URL lưu trong row dùng host CDN
  AND object có Cache-Control: public, max-age=31536000, immutable và nosniff
  AND request tới domain CDN không mang cookie của dashboard/storefront
```

### Additional Criteria
- [ ] Biến môi trường mới thêm vào Vercel Dashboard + `.env.staging.example` + `.env.production.example`; không commit secret.
- [ ] Media cũ (key không theo hash) giữ URL cũ; không viết lại URL hàng loạt.

### Definition of Done
- [ ] TC-F48-03-01..04 ↔ AC-1..4 (kiểm thủ công có bằng chứng: ảnh chụp/CLI output, không lộ key).
- [ ] FR-09 có Story Ref US-F48-03; SEC-9 trong `docs/tracking/OPEN_BLOCKERS.md` cập nhật trạng thái; runbook trong `docs/runbooks/`.
- [ ] Chờ ops: quyền tạo key Spaces riêng. Domain CDN tuỳ chọn, không chặn (D16).

---

## US-F48-04: Pipeline upload hợp nhất — client nén → tmp → register xử lý server
**Sprint S1** | **P0** | **L** | **Status:** Draft
### Story
```
As a   chủ shop
I want mọi ảnh/video tôi upload đi qua một đường duy nhất, được nén, xoá metadata và chuẩn hoá trên server
So that upload file lớn không lỗi, ảnh nhẹ hơn, vị trí GPS trong ảnh không bị lộ và cùng một ảnh không bị lưu hai lần
```
### Acceptance Criteria
#### AC-1: Upload ảnh lớn thành công
```gherkin
GIVEN chủ shop chọn ảnh PNG 8 MB, 4000×3000 px
WHEN  upload
THEN  client nén rồi PUT thẳng lên S3 vào `pw2/tmp/{uuid}`, không đi qua body function Vercel
  AND register trên server: kiểm magic, xoay theo EXIF orientation, resize cạnh dài ≤ 2560, encode WebP q80
  AND object cuối ở `pw2/t/{tenantId}/t{tenantId}-{sha256[0..31]}-{uuid32}.webp`, object tmp bị xoá
  AND row media có contentHash, width, height, filesize (sau xử lý), createdVia = "upload"
```
#### AC-2: Xoá EXIF/GPS
```gherkin
GIVEN ảnh JPEG chụp điện thoại có GPS, model máy, ngày chụp trong EXIF
WHEN  upload xong
THEN  file lưu trên S3 không còn EXIF/XMP/IPTC (kể cả GPS)
  AND ảnh hiển thị đúng chiều như khi chụp
```
#### AC-3: Trùng nội dung trong cùng tenant
```gherkin
GIVEN tenant A đã có media còn object có cùng nội dung sau xử lý (cùng contentHash)
WHEN  chủ shop A upload lại cùng ảnh
THEN  register trả về row cũ (hash tính trên byte sau xử lý, D36; chỉ dedupe row không private — D57), không tạo object/row mới, dung lượng đã dùng không tăng
  AND giữ nguyên id/key cũ sau Head dưới hash lock; object mất → 404 MEDIA_UPLOAD_MISSING, không ghi lại key (D87)
  AND UI báo "Ảnh này đã có trong thư viện" / "Imej ini sudah ada dalam pustaka"
GIVEN tenant B upload đúng ảnh đó
THEN  tạo row + object riêng của B (không dedupe chéo tenant)
```
#### AC-4: Giới hạn per-file
```gherkin
GIVEN giới hạn từ upload-limits.ts: ảnh 10 MB trước nén, video 100 MB, PDF proof 5 MB
WHEN  chọn file vượt giới hạn
THEN  client chặn trước khi upload với thông báo nêu giới hạn
  AND nếu client bị bỏ qua, register/presign vẫn từ chối 413 "MEDIA_TOO_LARGE", xoá tmp
```
#### AC-5: Ảnh bom giải nén / hỏng
```gherkin
GIVEN ảnh có magic hợp lệ nhưng > 50 megapixel, hoặc dữ liệu hỏng sharp không giải mã được
WHEN  register xử lý
THEN  trả 422 "MEDIA_TOO_MANY_PIXELS" (quá pixel) hoặc "MEDIA_INVALID_FILE" (hỏng) với thông báo i18n, không tạo row, xoá tmp
  AND function không treo quá timeout (limitInputPixels 50MP)
```
#### AC-6: Video không re-encode
```gherkin
GIVEN chủ shop upload video MP4 60 MB đúng magic
WHEN  register
THEN  chỉ kiểm magic + size, không re-encode, object ở `pw2/t/{tenantId}/t{tenantId}-{hash32}-{uuid32}.mp4`
  AND file .mp4 có nội dung WebM/MKV giả mạo bị từ chối 415 "MEDIA_CONTENT_MISMATCH"
```
#### AC-7: Mất mạng giữa chừng
```gherkin
GIVEN đang upload 3 file, mạng mất khi file 2 ở 60%
WHEN  mạng trở lại hoặc user bấm "Thử lại"
THEN  file 1 đã xong giữ nguyên, file 2 hiện lỗi + nút thử lại, file 3 tiếp tục/chờ
  AND không tạo row cho file dở; object tmp còn sót bị lifecycle xoá sau ≤ 1 ngày
```
#### AC-8: Không register được key tmp của người khác
```gherkin
GIVEN user tenant A biết key tmp do presign cấp cho user tenant B
WHEN  gọi register với key đó
THEN  trả 400 "MEDIA_KEY_INVALID" (uploadToken HMAC không khớp user, D36), không tạo row, object của B không bị đọc/xoá
```

### Additional Criteria
- [ ] NFR-01: register ảnh 5 MB p95 < 3 s trên Vercel staging. NFR-04: byte lưu ảnh mới giảm ≥ 50% so với hiện tại (benchmark bộ PNG mẫu local, trung bình ~600 KB/file).
- [ ] Một hook/component duy nhất `useMediaUpload` / `MediaUploadButton` (FR-10). WebP/PNG động → lấy frame đầu + cảnh báo UI (D38). D87/B1: SAVEPOINT sau hash lock trước quota/INSERT; SQL exception ROLLBACK TO trước SELECT; allocation intent trước Put key UUID mới, cleanup không row sau rollback/mất connection, không xoá key dedupe. **D72:** `ingestMediaBuffer` trả `{ media, deduped }`; caller (QR, avatar, proof, AI…) **không** xoá bù row/object khi `deduped = true` dù bước sau lỗi (TC-F48-04-32). **D71:** row tenant NULL (avatar, media global) không dedupe, `filename` dùng uuid32 → upload cùng ảnh nhiều lần không vi phạm `media_filename_idx` (TC-F48-04-31). Row mới chỉ ghi `prefix` (`pw2/t/{tenantId}`), `_objectKey` để NULL; URL đọc lại và xoá dùng đúng key đã `PutObject` = join phần khác rỗng của `[prefix, _objectKey, filename]`, không lặp prefix (D64, TC-F48-04-29, TC-F48-04-30).
- [ ] Tiến trình % từng file, thông báo đọc được bởi screen reader (`aria-live`); dùng được ở 375px. Ảnh AI/stock/seed tạo nội bộ đi qua `ingestMediaBuffer` và ghi `createdVia` (bảng caller FR-10a, D59); generate site p95 không tăng > 10% (NFR-08).

### Market Notes
- Merchant MY chủ yếu chụp ảnh SP bằng điện thoại (JPEG có GPS nhà/kho): xoá EXIF là yêu cầu riêng tư, không chỉ tối ưu. Mạng di động không ổn định ngoài Klang Valley → retry từng file quan trọng hơn upload song song nhiều file.

### Definition of Done
- [ ] TC-F48-04-01..08 ↔ AC-1..8 (unit cho register + integration S3 mock/MinIO); TC-F48-04-31 (D71), TC-F48-04-32 (D72), 04-13 và 04-34..36 (D87/B1) pass; test gọi service thật với Postgres + MinIO.
- [ ] FR-10..FR-14 (kèm FR-10a) có Story Ref US-F48-04; schema `content_hash`, `created_via` có entry trong `scripts/db-setup.js` MIGRATIONS; số đo NFR-01/NFR-04 ghi vào PR.

---

## US-F48-05: Thư viện /media — phân trang, tìm/lọc, chi tiết, sửa metadata, xoá nhiều, kéo thả
**Sprint S1** | **P0** | **L** | **Status:** Draft
### Story
```
As a   chủ shop
I want một thư viện media xem được toàn bộ file, tìm nhanh, sửa alt/chú thích và xoá nhiều file cùng lúc
So that tôi tái sử dụng ảnh thay vì upload lại và giữ thư viện gọn gàng
```
### Acceptance Criteria
#### AC-1: Phân trang server, bỏ giới hạn 200
```gherkin
GIVEN tenant có 350 media
WHEN  mở /media
THEN  trang đầu tải 50 item (sắp xếp mới nhất), cuộn/bấm "Tải thêm" lấy trang tiếp theo bằng cursor
  AND xem được đủ 350 item (không còn cap MEDIA_LIBRARY_LIMIT = 200)
```
#### AC-2: Tìm, lọc, sắp xếp phía server
```gherkin
GIVEN thư viện có ảnh và video
WHEN  gõ "kuih" vào ô tìm kiếm, lọc "Ảnh", sắp xếp "Dung lượng lớn nhất"
THEN  kết quả lọc theo displayName/alt/filename gốc trên server, chỉ ảnh, sắp xếp đúng
  AND không kết quả → trạng thái rỗng dùng key có sẵn `mediaLibrary.noMatch` "No files match your search" / "Tiada fail sepadan dengan carian anda" + nút xoá bộ lọc
```
#### AC-3: Xem chi tiết và sửa metadata
```gherkin
GIVEN chủ shop mở chi tiết một ảnh
WHEN  xem panel chi tiết
THEN  thấy preview, kích thước px, dung lượng, ngày tạo, nguồn (createdVia), URL sao chép được
WHEN  sửa alt (≤ 250 ký tự), caption (≤ 500), displayName (≤ 120) rồi lưu
THEN  lưu qua API metadata an toàn (FR-16), hiển thị ngay trong lưới
  AND vượt độ dài → lỗi inline, không lưu
```
#### AC-4: Chọn nhiều + xoá nhiều
```gherkin
GIVEN chủ shop chọn 30 media (checkbox hoặc Shift+click)
WHEN  bấm "Xoá" và xác nhận
THEN  xoá trong 1 request (≤ 100/lần); media đang dùng đi theo luật US-F48-11 (bị giữ lại + liệt kê lý do)
  AND trước S4, xoá nhiều ẩn sau `MEDIA_BULK_DELETE_ENABLED` (mặc định tắt); chỉ bật khi đã có usage scan (D34)
  AND kết quả báo "Đã xoá 27, giữ lại 3" và lưới cập nhật không cần tải lại trang
GIVEN chọn 101 media
THEN  nút xoá bị vô hiệu với thông báo "Tối đa 100 file mỗi lần"
```
#### AC-5: Kéo thả nhiều file + tiến trình
```gherkin
GIVEN chủ shop kéo 5 file vào /media, 1 file là .svg
WHEN  thả
THEN  4 file hợp lệ upload qua pipeline US-F48-04 với tiến trình từng file
  AND file .svg hiện lỗi riêng, không chặn 4 file còn lại
```
#### AC-6: Tenant isolation và media private
```gherkin
GIVEN user tenant A
WHEN  gọi API list/search/metadata với tham số tenant hoặc id thuộc tenant B
THEN  chỉ thấy media của A; id của B trả 404
  AND media private (biên lai người mua) không xuất hiện trong thư viện
```
#### AC-7: i18n ms
```gherkin
GIVEN dashboard đặt ngôn ngữ Bahasa Melayu
WHEN  mở /media, panel chi tiết, hộp xác nhận xoá, thông báo lỗi upload
THEN  toàn bộ chuỗi hiển thị bằng BM, không còn chuỗi tiếng Anh/Việt cứng
```

### Additional Criteria
- [ ] NFR-02: API list 50 item p95 < 500 ms (index theo tenant + created_at). 375px (theo design S1/S2): lưới 3 cột, ô ≥ 104 px, panel chi tiết là Sheet full-screen, chế độ chọn nhiều bằng nhấn giữ 500 ms hoặc "Select" trong menu `⋯`, bulk bar cố định đáy.
- [ ] NFR-07: điều hướng lưới bằng phím mũi tên, Space chọn, Enter mở chi tiết, focus thấy rõ, `aria-label` cho từng ô.
- [ ] Trang tách component, mỗi file < 200 dòng (trang hiện tại 372 dòng).

### Market Notes
- PW1: 245 store dùng thư viện, median 7 file/store, p90 31, max 298 → 50 item/trang đủ cho phần lớn shop; tìm kiếm cần cho nhóm p90+. Tên file merchant thường trộn BM/EN ("kuih-raya-2026.jpg") → tìm không phân biệt hoa thường (`ILIKE`, không dùng `unaccent` — D62).

### Definition of Done
- [ ] TC-F48-05-01..07 ↔ AC-1..7; screenshot 375px + desktop en/ms.
- [ ] FR-15..FR-18 có Story Ref US-F48-05; cột `display_name`, `uploaded_by_id` có entry MIGRATIONS. Không chuỗi i18n thiếu khoá ms (NFR-06).
