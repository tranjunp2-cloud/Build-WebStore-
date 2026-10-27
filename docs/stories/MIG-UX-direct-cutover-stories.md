# User Stories: MIG-UX — Trải nghiệm chuyển đổi Prime Web V1 → V2 (Direct Cutover + V1 Archive)

> **Created:** 2026-10-23 | **Owner:** BA | **Status:** Draft — chờ PM/PO duyệt
> **PRD:** [MIG-UX-direct-cutover.md](../prd/MIG-UX-direct-cutover.md)
> **Figma:** [TM_Prime-Web-V2.0 › Migration Flow](https://www.figma.com/design/oFACZVA1oplxslloJWEkLp/TM_Prime-Web-V2.0?node-id=34811-27299) (section 00–09; bỏ qua các frame `ARCHIVE ·`)
> **Master:** [SSO_REDIRECT_MIGRATION_MASTER.md](../prd/SSO_REDIRECT_MIGRATION_MASTER.md) — component C-15, task T-PM-03

Mốc thời gian dùng trong story (**đã duyệt 2026-10-23**, múi giờ **MYT / UTC+8** — xem PRD §8 BR-01):

| Ký hiệu | Ý nghĩa | Giá trị |
|---|---|---|
| `N` | Ngày thông báo (gửi email + bật popup/banner V1) | 26/10/2026 |
| `T` / `frozenAt` | Thời điểm khóa ghi V1, chốt dữ liệu | 30/10/2026 00:00 MYT |
| `archiveExpiresAt` | Hết hạn xem V1 chỉ đọc, đóng V1 | 15/11/2026 23:59:59 MYT |

Persona: **Owner** (chủ cửa hàng, nhận email), **Staff** (tài khoản Team & Account), **Buyer** (khách mua trên storefront), **Support/Ops** (nội bộ).

---

## Nhóm A — Trước cutover (V1)

### US-MIGX-01: Owner nhận email thông báo lịch chuyển đổi
**As an** Owner đang dùng V1, **I want** nhận email báo trước ngày chuyển, thời điểm chốt dữ liệu và hạn xem V1, **so that** tôi chủ động sắp xếp vận hành và không bị bất ngờ.
**Figma:** 07 › "Email · Thông báo trước chuyển"
**AC:**
- [ ] Gửi vào ngày `N` cho mọi Owner có ≥1 store đủ điều kiện migrate (store `migrationStatus` ≠ `excluded`).
- [ ] Mỗi store 1 email; Owner nhiều store nhận email liệt kê đủ store (xem BR-07).
- [ ] Nội dung có: `[store]`, `[thời điểm chuyển] [múi giờ]`, `[thời điểm chốt]`, `[ngày đóng V1]`; tất cả lấy từ cấu hình cutover, không hardcode.
- [ ] Không có CTA preview/kích hoạt sớm.
- [ ] Ngôn ngữ theo `users.prefer_lang` (EN/MS); fallback EN.
- [ ] Gửi idempotent: chạy lại job không gửi trùng (khóa `owner_id + template + store_id`).
- [ ] Ghi log gửi/bounce để Support tra cứu.

### US-MIGX-02: Owner thấy popup + banner thông báo trên V1
**As an** Owner đăng nhập V1 trong khoảng `N` → `T`, **I want** thấy thông báo rõ ràng ngay khi vào dashboard, **so that** tôi biết hệ thống sắp chuyển kể cả khi bỏ lỡ email.
**Figma:** 01 › "PW1 / Dashboard / Thông báo trước cutover" (banner) + modal "Prime Web V2 sẽ trở thành trang quản trị chính từ 30/10/2026"
**AC:**
- [ ] Banner cố định đầu dashboard V1 trên mọi trang admin, không đóng được.
- [ ] Modal hiện lần đầu mỗi phiên đăng nhập (xem BR-05); "Đã hiểu" đóng modal; "Video giới thiệu V2" mở video ở tab mới.
- [ ] Ngày giờ hiển thị theo MYT kèm nhãn múi giờ.
- [ ] Hiện cho cả Owner và Staff.

### US-MIGX-03: Owner nhận email nhắc T-1
**As an** Owner, **I want** được nhắc 1 ngày trước khi khóa ghi, **so that** tôi hoàn tất xử lý đơn/sản phẩm trên V1 trước giờ chốt.
**Figma:** ❌ chưa có — GAP-E1
**AC:**
- [ ] Gửi `T - 24h`, cùng điều kiện người nhận như US-MIGX-01.
- [ ] Nêu rõ: sau `T` V1 không ghi được; checkout có thể tạm dừng trong lúc chuyển.

---

## Nhóm B — Trong cutover

### US-MIGX-04: V1 bị khóa ghi tại T, hiển thị trạng thái "Đang chuyển"
**As an** Owner đăng nhập trong lúc đang cutover, **I want** thấy trạng thái chuyển đổi và lối liên hệ hỗ trợ, **so that** tôi không thao tác vô ích hoặc lo mất dữ liệu.
**Figma:** 01 › "PW1 / Dashboard / Đang cutover" + note T0. ⚠️ Frame hiện dùng lại nội dung modal trước cutover — GAP-U1
**AC:**
- [ ] Từ `T`, server từ chối mọi request ghi nghiệp vụ trên V1 (POST/PUT/PATCH/DELETE) với mã lỗi thống nhất; UI không chỉ disable nút.
- [ ] Màn hình: "Đang chuyển cửa hàng sang Prime Web V2 / Thao tác chỉnh sửa đang tạm dừng để chốt và kiểm tra dữ liệu". CTA: "Kiểm tra trạng thái" + "Liên hệ hỗ trợ". Không hiển thị ETA.
- [ ] Trạng thái lỗi/chậm: "Chuyển đổi chưa hoàn tất / Cửa hàng chưa sẵn sàng quản trị trên V2. Vui lòng kiểm tra trạng thái hoặc liên hệ hỗ trợ với mã hỗ trợ."

### US-MIGX-05: Buyer thấy thông báo tạm dừng thanh toán trên storefront
**As a** Buyer đang mua hàng trong lúc cutover, **I want** biết giỏ hàng/thanh toán tạm dừng và cách kiểm tra đơn đã đặt, **so that** tôi không thanh toán trùng.
**Figma:** 07 › "Buyer storefront · Cart / checkout tạm dừng"
**AC:**
- [ ] Storefront vẫn duyệt sản phẩm được; chỉ khóa thêm vào giỏ (nếu cần) / thanh toán.
- [ ] Nút "Thanh toán tạm khóa" disabled; nhãn "Tạm dừng nhận đơn".
- [ ] "Thử lại" chỉ kiểm tra lại trạng thái khả dụng, không gửi lại thanh toán.
- [ ] "Kiểm tra trạng thái đơn" dẫn tới tra cứu đơn theo mã đơn + email/SĐT.
- [ ] Không cam kết giữ giỏ hàng.
- [ ] Tiền tệ theo cài đặt store (RM), ngôn ngữ theo storefront locale — GAP-L2.

### US-MIGX-06: Storefront mở lại checkout trên V2 khi sẵn sàng
**Figma:** 07 › "Buyer storefront · Checkout sẵn sàng"
**AC:**
- [ ] Chỉ mở khi store đạt `completed + ready` (BR-03). Đơn mới chỉ ghi vào V2.
- [ ] Banner "Thanh toán đã sẵn sàng" hiển thị tối đa 24h sau khi mở (BR-10).

---

## Nhóm C — Sau cutover (V2)

### US-MIGX-07: Owner nhận email "Cửa hàng đã sẵn sàng trên V2"
**Figma:** 07 › "Email · Chuyển sang V2 thành công"
**AC:**
- [ ] Chỉ gửi sau khi store đạt `completed + ready` (không gửi theo lịch cố định).
- [ ] CTA: "Mở V2" (primary), "Xem V1 (chỉ đọc)", "Báo cáo sai lệch dữ liệu". Link đi qua TM SSO, không chứa token.
- [ ] Store failed/chậm không nhận email này mà nhận US-MIGX-15.

### US-MIGX-08: Owner thấy modal "Cửa hàng đã chuyển sang Prime Web V2" ở lần đăng nhập đầu
**Figma:** 02 › "PW2 / First login / Migration success" (Light + Dark)
**AC:**
- [ ] Hiện 1 lần cho mỗi user × store sau khi store `ready` (lưu cờ server-side, không chỉ localStorage).
- [ ] "Mở Prime Web V2" đóng modal, ở lại Dashboard V2. "Xem V1 (chỉ đọc)" mở V1 archive ở tab mới.
- [ ] Không hiện nếu `now ≥ archiveExpiresAt` (khi đó dùng banner US-MIGX-12).

### US-MIGX-09: Dashboard V2 có banner đối chiếu + checklist sau chuyển đổi
**Figma:** 03 › "Prime Web V2 — Dashboard với dữ liệu hiện có"
**AC:**
- [ ] Banner "Bạn đang quản lý cửa hàng trên Prime Web V2" + số ngày còn lại tới `archiveExpiresAt` (tính theo server time, BR-02). CTA "Xem V1 (chỉ đọc)", "Báo cáo sai lệch dữ liệu".
- [ ] Checklist "Kiểm tra cấu hình sau chuyển đổi" chỉ hiện cho store migrate từ V1; trạng thái từng mục tính từ dữ liệu thật (BR-11).
- [ ] Không hiện màn hình chào mừng tạo store mới / onboarding cho user đã migrate.
- [ ] Đi từ SSO bằng intent `generic` → luôn vào Dashboard nếu store `ready`.

### US-MIGX-10: Owner xem V1 ở chế độ chỉ đọc đến hạn
**Figma:** 04 › "V1 / Legacy Archive / Read-only state"
**AC:**
- [ ] Truy cập qua domain/path archive riêng, token có scope `read_only_archive_mode=true + tenant + expiry`, kiểm tra server-side.
- [ ] Cho phép: tìm kiếm, xem chi tiết, xuất báo cáo. Khóa: tạo/sửa/xóa (server chặn, UI chỉ hướng dẫn).
- [ ] Banner cố định "V1 — Chế độ chỉ xem / Dữ liệu được chốt lúc [frozenAt]" + "V1 sẽ đóng sau [X] ngày · [ngày đóng] ([múi giờ])". CTA "Mở Prime Web V2", "Báo cáo sai lệch dữ liệu".
- [ ] Archive không bị redirect mặc định sang V2 (ngoại lệ có kiểm quyền).

### US-MIGX-11: User gửi phản hồi từ nút trên header (MVP — release 29/10/2026)
> **Chốt PO 2026-10-27 (bản cuối):** chỉ build luồng cơ bản: tạo + gửi phản hồi → Lark Base → cập nhật trạng thái → thông báo in-app. Không SLA.
> **Tạm hoãn (không build cho 29/10):** trang lịch sử "Phản hồi của tôi", trang chi tiết, trạng thái "Cần thêm thông tin", lối vào từ V1 archive, mục trong sidebar.

**As an** Owner hoặc Staff đang dùng CMS V2 trong giai đoạn chuyển đổi, **I want** gửi báo lỗi, báo sai lệch dữ liệu hoặc góp ý ngay trên header, **so that** vấn đề của tôi đến đúng đội xử lý mà không phải mô tả lại cửa hàng.
**Figma:** file Untitled › "05 · Phản hồi / Feedback — MVP" (frame 01–12)
**AC:**
- [ ] Nút **"Gửi phản hồi"** trên header ở mọi trang CMS V2, cho mọi user (Owner + Staff), chỉ hiện trong `[30/10/2026 00:00, 15/11/2026 23:59:59]` MYT, kiểm tra theo giờ server. Ngoài khoảng này nút ẩn và API trả 403. (frame 01)
- [ ] Dưới 768px nút chỉ còn icon, có tooltip.
- [ ] Nút "Báo cáo sai lệch dữ liệu" trên banner Dashboard V2 mở cùng modal, loại chọn sẵn = Sai lệch dữ liệu, user vẫn đổi được. (frame 03)
- [ ] Trường: **Loại phản hồi*** · **Khu vực*** · **Mô tả chi tiết*** (10–2000 ký tự, có bộ đếm) · Ảnh chụp màn hình (tuỳ chọn, **≤9 ảnh** PNG/JPG, ≤5 MB/ảnh — PO chốt 27/10). Đủ 9 ảnh thì ẩn ô thêm ảnh; chọn quá 9 thì chỉ nhận 9 ảnh đầu và báo lỗi.
- [ ] Loại: **Báo lỗi** · **Sai lệch dữ liệu** · **Góp ý**. "Sai lệch dữ liệu" chỉ hiện với cửa hàng chuyển từ V1; cửa hàng mới chỉ thấy 2 loại.
- [ ] Khu vực (10): Sản phẩm & tồn kho · Đơn hàng · Khách hàng · Khuyến mãi · Giao diện & trang · Thanh toán · Vận chuyển · Tên miền · Tài khoản & nhân viên · Khác.
- [ ] Hộp xanh "V1 không hiển thị dữ liệu phát sinh sau thời điểm chốt…" chỉ hiện khi loại = Sai lệch dữ liệu.
- [ ] Placeholder mô tả đổi theo loại (copy deck §6). Không có trường "Mã tham chiếu" (PO chốt 27/10) — user ghi mã đơn/sản phẩm ngay trong mô tả nếu cần.
- [ ] Tự đính kèm (không hiện trên UI ngoài tên cửa hàng): `tenant`, `store`, `user`, `role`, `isMigratedStore`, URL trang đang xem, app version, ngôn ngữ, user agent.
- [ ] Thiếu thông tin: lỗi cạnh từng trường bắt buộc, focus trường lỗi đầu tiên, giữ dữ liệu. (frame 04)
- [ ] Ảnh lỗi (sai định dạng / >5 MB): viền đỏ + thông báo, không chặn ảnh hợp lệ. (frame 05)
- [ ] Đang gửi: khoá trường + nút; Idempotency-Key; chặn submit trùng. (frame 06)
- [ ] Gửi lỗi: giữ nội dung + ảnh, banner đỏ, cho thử lại. (frame 07)
- [ ] Rate limit **5 phản hồi / 15 phút / user** (PO chốt 27/10; cửa sổ trượt, kiểm tra ở server) → API 429, banner vàng, giữ nội dung, không khoá form. (frame 08)
- [ ] Đóng form khi đã nhập dở → xác nhận "Bỏ nội dung đã nhập?". (frame 09)
- [ ] Thành công: thông báo "Đã gửi phản hồi"; **không hiện mã phản hồi** (PO chốt 27/10 — mã chỉ dùng nội bộ cho Lark/Support); câu "Chúng tôi sẽ thông báo cho bạn trong Prime Web (biểu tượng chuông) khi có cập nhật."; nút "Đóng". Không có câu cam kết thời gian xử lý. (frame 10)
- [ ] Dòng nhắc quyền riêng tư luôn hiện dưới ô mô tả.

### US-MIGX-19: User nhận thông báo in-app khi phản hồi được cập nhật (MVP)
**As an** Owner hoặc Staff, **I want** được báo trong chuông thông báo khi phản hồi của tôi đổi trạng thái, **so that** tôi không phải hỏi Support.
**Figma:** frame 11
**AC:**
- [ ] Tạo bản ghi `Notifications` (F16) khi trạng thái trên Lark Base đổi sang **Đang xử lý** / **Đã giải quyết** / **Đã đóng**.
- [ ] Nếu Support điền "Trả lời cho user" trên Lark Base: nội dung thông báo có thêm dòng "Trả lời: …" (tối đa 2 dòng, cắt bằng "…").
- [ ] Người nhận: người gửi; thêm Owner nếu người gửi là Staff (Owner cũng nhận thông báo "{name} vừa gửi phản hồi {mã}" khi Staff gửi).
- [ ] MVP: bấm thông báo chỉ đánh dấu đã đọc (chưa có trang chi tiết).
- [ ] Không gửi email. Không tạo thông báo trùng khi Lark gửi lại cùng sự kiện.

### US-MIGX-20: Đồng bộ phản hồi 2 chiều với Lark Base (nội bộ, MVP)
**As** Support, **I want** mọi phản hồi vào Lark Base kèm đủ ngữ cảnh, và đổi trạng thái trên Lark Base tự báo về Prime Web, **so that** tôi xử lý ở một nơi duy nhất.
**AC:**
- [ ] V2 lưu phản hồi vào DB trước, rồi đẩy sang Lark Base bất đồng bộ có retry; Lark Base lỗi không làm user thấy lỗi.
- [ ] Bản ghi Lark Base có đủ trường ở PRD §13.4; ảnh là attachment.
- [ ] Đổi trạng thái / điền "Trả lời cho user" trên Lark Base → webhook về V2 (xác thực chữ ký) → cập nhật DB + tạo thông báo (US-MIGX-19).
- [ ] Ghi chú nội bộ trên Lark Base không bao giờ gửi về V2.
- [ ] Bản ghi lỗi đồng bộ hiển thị cho Ops (log + trạng thái `lark_sync_status`), có cách đẩy lại thủ công.
- [ ] Thiết lập Lark và 6 biến `LARK_FEEDBACK_*` theo PRD §13.5 (2 app + 2 bảng: Staging / Production); 6 bước kiểm thử chấp nhận ở §13.5 pass trên staging.

### US-MIGX-18: Lịch sử "Phản hồi của tôi" — ⏸ TẠM HOÃN (sau 29/10)
Không build cho bản 29/10. Giữ để làm sau nếu PO mở lại (danh sách, lọc, chi tiết, dòng thời gian).

### US-MIGX-12: Nhắc hạn đóng V1 và trạng thái sau khi đóng
**Figma:** 06 › "Nhắc đóng V1 · Archive thời hạn đối soát" + "V1 đã đóng · Tiếp tục trên V2"
**AC:**
- [ ] Trước hạn (từ `archiveExpiresAt - 7 ngày`, BR-09): banner cam trên Dashboard V2 "V1 sẽ đóng sau [X] ngày", CTA "Mở V2", "Xem V1 (chỉ đọc)", "Báo cáo sai lệch dữ liệu". Banner này thay banner xanh của US-MIGX-09.
- [ ] Sau hạn: banner "V1 đã ngừng hoạt động từ [ngày đóng V1]…", chỉ còn CTA "Báo cáo sai lệch dữ liệu". Không còn nút mở V1.
- [ ] Sau hạn: không cấp lại token archive; link V1 cũ trả 301 tại edge/gateway về Dashboard V2 (giữ store/path phù hợp, tránh loop/open redirect).

### US-MIGX-13: Phiên xem V1 hết hạn trong thời gian archive
**Figma:** 04 › "V1 / Legacy Archive / Phiên xác thực hết hạn"
**AC:**
- [ ] Khi token archive hết hạn mà `now < archiveExpiresAt`: modal "Phiên xem V1 đã hết hạn", CTA "Xác thực lại để xem V1" (qua SSO) + "Mở Prime Web V2".
- [ ] Re-auth chỉ cấp token khi server xác nhận `now < archiveExpiresAt` và user còn quyền với store.

### US-MIGX-14: Login fallback khi token SSO lỗi
**Figma:** 08 › "PW2 / Login / Desktop / Invalid token" (Light + Dark)
**AC:**
- [ ] Thiếu/sai token từ `/sso/authorization` → redirect `/login?error=invalid_token`, toast "Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại."
- [ ] Lỗi network → toast riêng "Chưa thể kết nối. Vui lòng thử lại."
- [ ] Không retry migration/rollback ở login. Sau login, route server-side theo migration state / tenant / role (BR-04).

---

## Nhóm D — Gap (Figma chưa có — cần Design/PM bổ sung trước khi dev lấy)

### US-MIGX-15: Owner được báo khi store chuyển chậm hoặc lỗi — GAP-U2, GAP-E2
**AC (đề xuất):**
- [ ] Màn hình V2 cho store `running` / `failed`: không vào Dashboard; hiện trạng thái + mã hỗ trợ + kênh hỗ trợ.
- [ ] Email "Cửa hàng của bạn cần thêm thời gian để chuyển đổi" gửi khi store chưa `ready` sau `T + SLA nội bộ` (đề xuất 6h).
- [ ] Khi store chuyển sang `ready` → gửi US-MIGX-07 như bình thường.

### US-MIGX-16: Email nhắc đóng V1 và email "V1 đã đóng" — GAP-E3
**AC (đề xuất):**
- [ ] `archiveExpiresAt - 7 ngày`: email nhắc xuất dữ liệu cần lưu trữ.
- [ ] `archiveExpiresAt - 1 ngày`: email nhắc cuối.
- [ ] `archiveExpiresAt`: email xác nhận V1 đã đóng và cách báo cáo sai lệch.

### US-MIGX-17: Staff nhận thông báo và vào đúng store trên V2 — GAP-R1
**AC (đề xuất):**
- [ ] Staff thấy popup/banner V1 như Owner; nhận email riêng (không có CTA báo cáo sai lệch nếu không có quyền); gửi được phản hồi từ nút header (US-MIGX-11).
- [ ] Sau cutover, staff đăng nhập vào đúng store với role đã map từ V1 (US-MIGA-17).
