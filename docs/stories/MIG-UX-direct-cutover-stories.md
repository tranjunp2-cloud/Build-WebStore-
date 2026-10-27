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

### US-MIGX-11: User gửi phản hồi (báo lỗi / sai lệch dữ liệu / góp ý) trên CMS
> **Đã chốt 2026-10-27 (PO):** form phản hồi chung, "Sai lệch dữ liệu sau chuyển đổi" là một loại; trả lời qua thông báo in-app; có lịch sử phản hồi; Lark Base nhận phản hồi; không cam kết SLA.
> Tính năng tồn tại lâu dài sau 15/11 — PM cân nhắc tách thành feature ID riêng.

**As an** Owner hoặc Staff, **I want** gửi phản hồi từ bất kỳ đâu trong CMS V2 (và từ V1 archive), **so that** lỗi, sai lệch dữ liệu và góp ý của tôi đến đúng đội xử lý mà không phải mô tả lại cửa hàng của mình.
**Figma:** 05 — cần vẽ lại theo [PRD §10.4](../prd/MIG-UX-direct-cutover.md#104-spec-chỉnh-figma--form-phản-hồi--lịch-sử)
**AC:**
- [ ] Mở form từ: menu Support › "Gửi phản hồi", trang "Phản hồi của tôi", nút "Báo cáo sai lệch dữ liệu" trên banner V2/V1 archive (mở sẵn loại Sai lệch dữ liệu).
- [ ] Trường: **Loại phản hồi*** (Báo lỗi / Sai lệch dữ liệu sau chuyển đổi / Góp ý) · **Khu vực*** · **Mô tả chi tiết*** (10–2000 ký tự, có bộ đếm) · Mã tham chiếu (tuỳ chọn) · Ảnh chụp màn hình (tuỳ chọn, ≤3 ảnh PNG/JPG, ≤5 MB/ảnh).
- [ ] Khu vực: Sản phẩm & tồn kho · Đơn hàng · Khách hàng · Khuyến mãi · Giao diện & trang · Thanh toán · Vận chuyển · Tên miền · Tài khoản & nhân viên · Khác.
- [ ] Loại "Sai lệch dữ liệu sau chuyển đổi" chỉ hiện với store migrate từ V1 và khi `now ≤ archiveExpiresAt + 30 ngày` (BR-08); khi mở từ V1 archive thì chọn sẵn và khóa loại.
- [ ] Placeholder mô tả + mã tham chiếu đổi theo Loại / Khu vực (copy deck §6).
- [ ] Tự đính kèm (không hiện trên UI ngoài tên cửa hàng): `tenant`, `store`, `user`, `role`, `source (V1_ARCHIVE|V2)`, URL trang đang xem, `frozenAt` (nếu có), app version, ngôn ngữ, user agent.
- [ ] Lỗi validation cạnh từng trường bắt buộc; focus trường thiếu đầu tiên; giữ dữ liệu đã nhập.
- [ ] Đang gửi: khóa trường + nút; idempotency key; chặn submit trùng.
- [ ] Thành công: mã phản hồi + nút "Sao chép mã"; câu "Chúng tôi sẽ thông báo cho bạn trong Prime Web khi có cập nhật."; nút "Xem phản hồi của tôi" và "Đóng".
- [ ] Lỗi gửi: giữ nội dung + ảnh đã tải, cho "Thử lại".
- [ ] Đóng form khi đã nhập dở → xác nhận "Bỏ nội dung đã nhập?".
- [ ] Rate limit 5 phản hồi / giờ / user → thông báo thân thiện, không mất nội dung.
- [ ] Không có câu cam kết thời gian xử lý ở bất kỳ đâu (BR-08).
- [ ] Dòng nhắc quyền riêng tư luôn hiện dưới ô mô tả.

### US-MIGX-18: User xem lịch sử phản hồi đã gửi
**As an** Owner hoặc Staff, **I want** xem lại các phản hồi tôi đã gửi và trạng thái của chúng, **so that** tôi biết phản hồi nào đã được xử lý mà không cần hỏi Support.
**Figma:** ❌ chưa có — cần vẽ mới (PRD §10.4)
**AC:**
- [ ] Trang "Phản hồi của tôi" trong menu Support; danh sách sắp xếp mới nhất trước, phân trang 20 dòng.
- [ ] Cột: Mã · Loại · Khu vực · Tóm tắt (60 ký tự đầu của mô tả) · Trạng thái · Cập nhật lần cuối.
- [ ] Lọc theo Trạng thái và Loại; tìm theo mã.
- [ ] Trạng thái hiển thị: **Đã nhận** · **Đang xử lý** · **Cần thêm thông tin** · **Đã giải quyết** · **Đã đóng**.
- [ ] Chi tiết: toàn bộ nội dung đã gửi, ảnh, dòng thời gian trạng thái, phản hồi của đội hỗ trợ (chỉ trường public từ Lark Base).
- [ ] Trạng thái "Cần thêm thông tin": user trả lời ngay trong chi tiết (text + ảnh) → trạng thái về "Đã nhận".
- [ ] Phạm vi xem: Staff thấy phản hồi mình gửi; Owner thấy mọi phản hồi của store (BR-13).
- [ ] Empty state: "Bạn chưa gửi phản hồi nào." + nút "Gửi phản hồi".

### US-MIGX-19: User nhận thông báo in-app khi phản hồi được cập nhật
**As an** Owner hoặc Staff, **I want** được báo trong Prime Web khi phản hồi của tôi đổi trạng thái hoặc có trả lời, **so that** tôi không phải tự kiểm tra.
**Figma:** ❌ chưa có — item trong Notification center (chuông)
**AC:**
- [ ] Tạo bản ghi `Notifications` (F16) khi trạng thái đổi sang Đang xử lý / Cần thêm thông tin / Đã giải quyết / Đã đóng, hoặc có trả lời public mới.
- [ ] Người nhận: người gửi phản hồi (và Owner nếu người gửi là Staff — BR-13).
- [ ] Nội dung: "Phản hồi {mã} — {trạng thái mới}". Bấm vào → mở chi tiết phản hồi.
- [ ] Không gửi email cho các cập nhật này.
- [ ] Không tạo thông báo trùng khi Lark Base gửi lại cùng một sự kiện.

### US-MIGX-20: Phản hồi được đồng bộ sang Lark Base để đội hỗ trợ xử lý (nội bộ)
**As** Support, **I want** mọi phản hồi vào Lark Base kèm đủ ngữ cảnh, và cập nhật trạng thái trên Lark Base tự về lại Prime Web, **so that** tôi xử lý ở một nơi duy nhất.
**AC:**
- [ ] V2 lưu phản hồi vào DB trước (nguồn gốc), sau đó đẩy sang Lark Base bất đồng bộ, có retry; Lark Base lỗi không làm user thấy lỗi.
- [ ] Bản ghi Lark Base có đủ trường ở PRD §13.4, ảnh là attachment.
- [ ] Đổi trạng thái / thêm trả lời public trên Lark Base → gửi về V2 (webhook/automation, có xác thực chữ ký) → cập nhật lịch sử + tạo thông báo (US-MIGX-19).
- [ ] Trả lời của user (trạng thái "Cần thêm thông tin") được ghi thêm vào bản ghi Lark Base.
- [ ] Ghi chú nội bộ trên Lark Base không bao giờ hiện cho user.

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
- [ ] Staff thấy popup/banner V1 như Owner; nhận email riêng (không có CTA báo cáo sai lệch nếu không có quyền); gửi được phản hồi (US-MIGX-11).
- [ ] Sau cutover, staff đăng nhập vào đúng store với role đã map từ V1 (US-MIGA-17).
