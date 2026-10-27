# Copy deck: MIG-UX — V1 → V2 cutover (EN / BM)

> **Created:** 2026-10-23 | **Owner:** BA | **Status:** Draft — cần native reviewer BM duyệt trước 26/10/2026
> **PRD:** [MIG-UX-direct-cutover.md](./MIG-UX-direct-cutover.md) (đóng GAP-L1) · **Stories:** [MIG-UX-direct-cutover-stories.md](../stories/MIG-UX-direct-cutover-stories.md)
> **Nguồn tiếng Việt:** Figma *Migration Flow* section 01–08.

## Quy ước

- **Key** đề xuất cho `src/i18n/locales/en.json` / `ms.json`, namespace `migration.*`. Email đi qua `src/lib/email/template-registry.ts`.
- **Placeholder** — server điền, đã format theo ngôn ngữ, luôn kèm "MYT":

| Placeholder | EN | BM |
|---|---|---|
| `{cutoverAt}` / `{frozenAt}` | 00:00 MYT, 30 October 2026 | 00:00 MYT, 30 Oktober 2026 |
| `{archiveClosesAt}` | 11:59 PM MYT, 15 November 2026 | 11:59 malam MYT, 15 November 2026 |
| `{archiveCloseDate}` | 15 November 2026 | 15 November 2026 |
| `{storeName}`, `{requestCode}`, `{daysLeft}` | — | — |

- `{daysLeft}` dùng ICU plural ở EN (`{daysLeft, plural, one {# day} other {# days}}`); BM không chia số nhiều (`{daysLeft} hari`).
- Thuật ngữ BM bám theo `ms.json` hiện có: *kedai* (store), *papan pemuka* (dashboard), *log masuk*, *pesanan*, *troli*, *pembayaran*, *Cuba lagi*, *Batal*, *Tutup*, *Hantar*.
- Giữ nguyên tên sản phẩm: **Prime Web V1**, **Prime Web V2** (không dịch "V1/V2").
- "Chỉ đọc" → EN *read-only* / BM *baca sahaja*. "Báo cáo sai lệch dữ liệu" → EN *Report a data mismatch* / BM *Laporkan percanggahan data*.

---

## 1. V1 — trước cutover (Figma 01)

| Key | VI (Figma) | EN | BM |
|---|---|---|---|
| `migration.v1Notice.title` | Prime Web V2 sẽ trở thành trang quản trị chính từ 30/10/2026 | Prime Web V2 becomes your main admin from 30 October 2026 | Prime Web V2 akan menjadi admin utama anda mulai 30 Oktober 2026 |
| `migration.v1Notice.banner.body` | Trong lúc chuyển đổi, thao tác quản trị và checkout có thể tạm gián đoạn. V1 được giữ ở chế độ chỉ xem đến 15/11/2026. | Admin actions and checkout may be briefly paused during the move. V1 stays available in read-only mode until {archiveCloseDate}. | Tindakan admin dan pembayaran mungkin dihentikan seketika semasa pemindahan. V1 kekal tersedia dalam mod baca sahaja sehingga {archiveCloseDate}. |
| `migration.v1Notice.modal.eyebrow` | THÔNG BÁO | NOTICE | NOTIS |
| `migration.v1Notice.modal.body` | Trong thời gian chuyển đổi, thao tác quản trị và checkout có thể tạm gián đoạn. Sau khi hoàn tất, dữ liệu Prime Web V1 sẽ được giữ ở chế độ chỉ xem đến 15/11/2026. Mọi dữ liệu mới sẽ được ghi nhận và xử lý trên Prime Web V2. | Admin actions and checkout may be briefly paused during the move. Once it's done, your Prime Web V1 data stays available in read-only mode until {archiveCloseDate}. All new data will be recorded and managed in Prime Web V2. | Tindakan admin dan pembayaran mungkin dihentikan seketika semasa pemindahan. Selepas selesai, data Prime Web V1 anda kekal tersedia dalam mod baca sahaja sehingga {archiveCloseDate}. Semua data baharu akan direkod dan diurus dalam Prime Web V2. |
| `migration.v1Notice.cta.ack` | Đã hiểu | Got it | Faham |
| `migration.v1Notice.cta.video` | Video giới thiệu V2 | Watch the V2 intro video | Tonton video pengenalan V2 |

## 2. V1 — trong cutover (Figma 01, note T0 — GAP-U1)

| Key | VI | EN | BM |
|---|---|---|---|
| `migration.cutover.title` | Đang chuyển cửa hàng sang Prime Web V2 | We're moving your store to Prime Web V2 | Kedai anda sedang dipindahkan ke Prime Web V2 |
| `migration.cutover.body` | Thao tác chỉnh sửa đang tạm dừng để chốt và kiểm tra dữ liệu. | Editing is paused while we finalise and check your data. | Penyuntingan dihentikan seketika semasa kami memuktamadkan dan menyemak data anda. |
| `migration.cutover.cta.status` | Kiểm tra trạng thái | Check status | Semak status |
| `migration.cutover.cta.support` | Liên hệ hỗ trợ | Contact support | Hubungi sokongan |
| `migration.cutover.failed.title` | Chuyển đổi chưa hoàn tất | The move isn't finished yet | Pemindahan belum selesai |
| `migration.cutover.failed.body` | Cửa hàng chưa sẵn sàng quản trị trên V2. Vui lòng kiểm tra trạng thái hoặc liên hệ hỗ trợ với mã hỗ trợ. | Your store isn't ready to manage on V2 yet. Check the status or contact support with this support code: {supportCode} | Kedai anda belum sedia untuk diurus dalam V2. Semak status atau hubungi sokongan dengan kod sokongan ini: {supportCode} |
| `migration.cutover.writeLocked` *(toast / lỗi API 423)* | — | V1 is now read-only. Please make changes in Prime Web V2. | V1 kini dalam mod baca sahaja. Sila buat perubahan dalam Prime Web V2. |

## 3. V2 — first login (Figma 02)

| Key | VI | EN | BM |
|---|---|---|---|
| `migration.v2Welcome.eyebrow` | V2 SẴN SÀNG | V2 IS READY | V2 SUDAH SEDIA |
| `migration.v2Welcome.title` | Cửa hàng đã chuyển sang Prime Web V2 | Your store is now on Prime Web V2 | Kedai anda kini di Prime Web V2 |
| `migration.v2Welcome.body` | Prime Web V2 hiện là trang quản trị chính. Dữ liệu V1 được đóng băng lúc 00:00 ngày 30/10/2026 và có thể xem để đối chiếu đến 15/11/2026. Mọi thay đổi mới chỉ được ghi nhận trên V2. | Prime Web V2 is now your main admin. Your V1 data was frozen at {frozenAt} and you can view it for comparison until {archiveCloseDate}. New changes are saved in V2 only. | Prime Web V2 kini admin utama anda. Data V1 anda telah dibekukan pada {frozenAt} dan boleh dilihat untuk perbandingan sehingga {archiveCloseDate}. Perubahan baharu hanya disimpan dalam V2. |
| `migration.v2Welcome.cta.open` | Mở Prime Web V2 | Open Prime Web V2 | Buka Prime Web V2 |
| `migration.common.viewV1ReadOnly` | Xem V1 (chỉ đọc) | View V1 (read-only) | Lihat V1 (baca sahaja) |

## 4. V2 — Dashboard (Figma 03, 06)

| Key | VI | EN | BM |
|---|---|---|---|
| `migration.v2Banner.active.title` | Bạn đang quản lý cửa hàng trên Prime Web V2 | You're now managing your store on Prime Web V2 | Anda kini mengurus kedai anda di Prime Web V2 |
| `migration.v2Banner.active.body` | Dữ liệu mới chỉ được cập nhật tại đây. Có thể đối chiếu dữ liệu V1 chốt lúc [thời điểm chốt] đến [ngày đóng V1]. Hiện còn [số ngày] ngày trước khi V1 đóng. | New data is updated here only. You can compare with V1 data frozen at {frozenAt} until {archiveCloseDate}. {daysLeft, plural, one {# day} other {# days}} left before V1 closes. | Data baharu hanya dikemas kini di sini. Anda boleh membandingkan dengan data V1 yang dibekukan pada {frozenAt} sehingga {archiveCloseDate}. Tinggal {daysLeft} hari sebelum V1 ditutup. |
| `migration.common.reportMismatch` | Báo cáo sai lệch dữ liệu | Report a data mismatch | Laporkan percanggahan data |
| `migration.v2Banner.closing.eyebrow` | V1 · Chỉ đọc | V1 · Read-only | V1 · Baca sahaja |
| `migration.v2Banner.closing.title` | V1 sẽ đóng sau [số ngày còn lại] ngày | V1 closes in {daysLeft, plural, one {# day} other {# days}} | V1 akan ditutup dalam {daysLeft} hari |
| `migration.v2Banner.closing.subtitle` | Đóng V1: [ngày đóng V1] [múi giờ] · thời hạn đối soát sau T | V1 closes: {archiveClosesAt} · comparison period after the move | V1 ditutup: {archiveClosesAt} · tempoh perbandingan selepas pemindahan |
| `migration.v2Banner.closing.body` | V1 là snapshot chốt tại [thời điểm chốt] [múi giờ], chỉ dùng đối chiếu; không có dữ liệu mới. Mọi thay đổi chỉ thực hiện trên V2, không đồng bộ ngược và không quay lại ghi V1. | V1 is a snapshot taken at {frozenAt}, for comparison only — it has no new data. All changes are made in V2 only. They aren't copied back to V1, and V1 can't be edited again. | V1 ialah salinan data pada {frozenAt}, untuk perbandingan sahaja — tiada data baharu. Semua perubahan dibuat dalam V2 sahaja. Perubahan tidak disalin semula ke V1, dan V1 tidak boleh disunting lagi. |
| `migration.v2Banner.closing.cta.open` | Mở V2 | Open V2 | Buka V2 |
| `migration.v2Banner.closed.badge` | V1 đã đóng | V1 closed | V1 ditutup |
| `migration.v2Banner.closed.title` | V1 đã ngừng hoạt động từ [ngày đóng V1]. Tiếp tục quản lý cửa hàng và báo cáo sai lệch tại V2. | V1 closed on {archiveCloseDate}. Keep managing your store and report any data mismatch here in V2. | V1 telah ditutup pada {archiveCloseDate}. Teruskan mengurus kedai anda dan laporkan sebarang percanggahan data di sini dalam V2. |
| `migration.v2Banner.closed.body` | Mọi dữ liệu mới và thay đổi được quản lý duy nhất trên V2. Bạn vẫn có thể gửi báo cáo sai lệch dữ liệu tại đây. | All new data and changes are managed in V2 only. You can still send a data mismatch report here. | Semua data baharu dan perubahan diurus dalam V2 sahaja. Anda masih boleh menghantar laporan percanggahan data di sini. |
| `migration.analyticsNote` *(GAP-D3, đề xuất)* | — | Traffic stats start from {cutoverAt}. V1 history isn't included. | Statistik trafik bermula dari {cutoverAt}. Sejarah V1 tidak disertakan. |

### Checklist sau chuyển đổi (Figma 03)

Figma đang trộn EN/VI; bảng dưới chuẩn hóa cả hai ngôn ngữ.

| Key | EN | BM |
|---|---|---|
| `migration.checklist.title` | Check your setup after the move | Semak tetapan anda selepas pemindahan |
| `migration.checklist.subtitle` | Only V2 settings that need checking are shown, based on their real status. | Hanya tetapan V2 yang perlu disemak dipaparkan, berdasarkan status sebenar. |
| `migration.checklist.products.title` | Verify your products | Semak produk anda |
| `migration.checklist.products.body` | Check the stock, prices and variants moved from V1. | Semak stok, harga dan varian yang dipindahkan dari V1. |
| `migration.checklist.products.cta` | Review | Semak |
| `migration.checklist.design.title` | Customize your design | Sesuaikan reka bentuk anda |
| `migration.checklist.design.body` | Update images, text and colours to match your brand. | Kemas kini imej, teks dan warna mengikut jenama anda. |
| `migration.checklist.design.cta` | Edit | Sunting |
| `migration.checklist.shipping.title` | Set up shipping fees | Tetapkan caj penghantaran |
| `migration.checklist.shipping.body` | Update rates to avoid shipping losses. | Kemas kini kadar untuk mengelakkan kerugian penghantaran. |
| `migration.checklist.shipping.cta` | Set up | Tetapkan |
| `migration.checklist.website.title` | Check your website status | Semak status laman web anda |
| `migration.checklist.website.body` | Keep your current status. No need to create or publish again. | Kekalkan status semasa. Tidak perlu cipta atau terbitkan semula. |
| `migration.checklist.website.cta` | Check | Semak |

## 5. V1 archive — chỉ đọc (Figma 04)

| Key | VI | EN | BM |
|---|---|---|---|
| `migration.archive.banner.title` | V1 — Chế độ chỉ xem | V1 — Read-only mode | V1 — Mod baca sahaja |
| `migration.archive.banner.body` | Dữ liệu được chốt lúc [thời điểm chốt] ([múi giờ]). Đơn hàng, sản phẩm và mọi thay đổi sau đó chỉ được ghi nhận và xử lý trên V2. | Data was frozen at {frozenAt}. Orders, products and any changes after that are recorded and managed in V2 only. | Data dibekukan pada {frozenAt}. Pesanan, produk dan sebarang perubahan selepas itu direkod dan diurus dalam V2 sahaja. |
| `migration.archive.countdown.title` | V1 sẽ đóng sau [số ngày còn lại] ngày · [ngày đóng V1] ([múi giờ]) | V1 closes in {daysLeft, plural, one {# day} other {# days}} · {archiveClosesAt} | V1 ditutup dalam {daysLeft} hari · {archiveClosesAt} |
| `migration.archive.countdown.body` | Tất cả hành động ghi đã bị khóa. Bạn vẫn có thể xem, tìm kiếm và mở chi tiết dữ liệu nếu không cần thay đổi. | All editing is locked. You can still view, search and open records. | Semua penyuntingan dikunci. Anda masih boleh melihat, mencari dan membuka rekod. |
| `migration.archive.status.active` | Đang hoạt động | Available | Tersedia |
| `migration.archive.status.locked` | Đã khóa | Locked | Dikunci |
| `migration.archive.action.search` | Tìm kiếm — Tìm sản phẩm, đơn hàng và dữ liệu đã chốt. | Search — Find frozen products, orders and data. | Cari — Cari produk, pesanan dan data yang dibekukan. |
| `migration.archive.action.view` | Xem chi tiết — Mở đơn hàng, sản phẩm và thông tin đã chốt. | View details — Open frozen orders, products and details. | Lihat butiran — Buka pesanan, produk dan butiran yang dibekukan. |
| `migration.archive.action.export` | Xuất báo cáo — Xuất dữ liệu đã chốt để lưu trữ hoặc đối soát. | Export report — Export frozen data to keep or compare. | Eksport laporan — Eksport data yang dibekukan untuk simpanan atau perbandingan. |
| `migration.archive.action.createProduct` | Tạo sản phẩm — Không thể thêm sản phẩm mới trên V1. | Create product — You can't add new products in V1. | Cipta produk — Anda tidak boleh menambah produk baharu dalam V1. |
| `migration.archive.action.editOrder` | Sửa đơn hàng — Không thể cập nhật trạng thái đơn hàng trên V1. | Edit order — You can't update order status in V1. | Sunting pesanan — Anda tidak boleh mengemas kini status pesanan dalam V1. |
| `migration.archive.action.updateStock` | Cập nhật tồn kho — Không thể thay đổi tồn kho trên V1. | Update stock — You can't change stock in V1. | Kemas kini stok — Anda tidak boleh mengubah stok dalam V1. |
| `migration.archive.movedHint.title` | Tính năng chỉnh sửa đã chuyển sang V2 | Editing has moved to V2 | Penyuntingan telah berpindah ke V2 |
| `migration.archive.movedHint.body` | Mọi thay đổi sản phẩm, đơn hàng và tồn kho chỉ được thực hiện trên Prime Web V2. | All product, order and stock changes are made in Prime Web V2 only. | Semua perubahan produk, pesanan dan stok dibuat dalam Prime Web V2 sahaja. |
| `migration.archive.expired.title` | Phiên xem V1 đã hết hạn | Your V1 viewing session has expired | Sesi tontonan V1 anda telah tamat |
| `migration.archive.expired.body` | Phiên xác thực để xem V1 đã hết hạn. Bạn có thể xác thực lại để xem dữ liệu đã chốt đến [ngày đóng V1]. Việc này không khôi phục quyền chỉnh sửa trên V1. | Your session for viewing V1 has expired. Sign in again to view frozen data until {archiveCloseDate}. This doesn't restore editing in V1. | Sesi anda untuk melihat V1 telah tamat. Log masuk semula untuk melihat data yang dibekukan sehingga {archiveCloseDate}. Ini tidak memulihkan penyuntingan dalam V1. |
| `migration.archive.expired.cta` | Xác thực lại để xem V1 | Sign in again to view V1 | Log masuk semula untuk melihat V1 |

## 6. Phản hồi (Feedback)

> Chốt PO 2026-10-27 (bản cuối — MVP release 29/10): nút "Gửi phản hồi" trên header, hiện 30/10–15/11/2026 MYT; trả lời qua thông báo in-app; Lark Base; **không SLA** — không câu nào được hứa thời gian xử lý. Lịch sử phản hồi tạm hoãn. Spec UI: [PRD §10.4](./MIG-UX-direct-cutover.md#104-feedback-mvp--spec-màn-hình-release-29102026).
> Nút "Báo cáo sai lệch dữ liệu" trên banner Dashboard V2 giữ nguyên chữ (`migration.common.reportMismatch`) và mở form với Loại = Sai lệch dữ liệu.
> **i18n:** CMS V2 chỉ có 2 locale `en` / `ms` (`src/i18n/locales/en.json`, `ms.json`; chọn qua `prefer_lang`). Cột **VI chỉ để team đối chiếu**, không đưa vào code. Key bên dưới thêm vào cả 2 file JSON theo cấu trúc lồng (`t.feedback.form.title`).

### 6.1 Form

| Key | VI | EN | BM |
|---|---|---|---|
| `feedback.form.title` | Gửi phản hồi | Send feedback | Hantar maklum balas |
| `feedback.form.subtitle` | Thông tin cửa hàng và trang bạn đang xem được gửi kèm tự động. | Your store details and the page you're on are attached automatically. | Butiran kedai anda dan halaman yang sedang dilihat dilampirkan secara automatik. |
| `feedback.form.store` | Cửa hàng: {storeName} | Store: {storeName} | Kedai: {storeName} |
| `feedback.type.label` | Loại phản hồi | Feedback type | Jenis maklum balas |
| `feedback.type.bug` | Báo lỗi | Report a problem | Laporkan masalah |
| `feedback.type.mismatch` | Sai lệch dữ liệu | Data mismatch | Percanggahan data |
| `feedback.type.mismatchShort` *(mobile <768px, segmented hẹp)* | Sai lệch | Data mismatch | Percanggahan |
| `feedback.type.idea` | Góp ý | Suggestion | Cadangan |
| `feedback.area.label` | Khu vực | Area | Bahagian |
| `feedback.area.placeholder` | Chọn khu vực | Choose an area | Pilih bahagian |
| `feedback.area.products` | Sản phẩm & tồn kho | Products & stock | Produk & stok |
| `feedback.area.orders` | Đơn hàng | Orders | Pesanan |
| `feedback.area.customers` | Khách hàng | Customers | Pelanggan |
| `feedback.area.discounts` | Khuyến mãi | Discounts | Diskaun |
| `feedback.area.design` | Giao diện & trang | Design & pages | Reka bentuk & halaman |
| `feedback.area.payments` | Thanh toán | Payments | Pembayaran |
| `feedback.area.shipping` | Vận chuyển | Shipping | Penghantaran |
| `feedback.area.domains` | Tên miền | Domains | Domain |
| `feedback.area.account` | Tài khoản & nhân viên | Account & staff | Akaun & kakitangan |
| `feedback.area.other` | Khác | Other | Lain-lain |
| `feedback.mismatchHint` | V1 không hiển thị dữ liệu phát sinh sau thời điểm chốt. Hãy so sánh dữ liệu cùng thời điểm. | V1 doesn't show data created after the freeze. Compare data from the same point in time. | V1 tidak memaparkan data yang dicipta selepas pembekuan. Bandingkan data pada masa yang sama. |
| `feedback.description.label` | Mô tả chi tiết | Details | Butiran |
| `feedback.description.placeholder.bug` | Bạn đã làm gì, mong đợi điều gì, và điều gì đã xảy ra? | What did you do, what did you expect, and what happened instead? | Apa yang anda lakukan, apa yang anda jangkakan, dan apa yang berlaku? |
| `feedback.description.placeholder.mismatch` | Dữ liệu nào bị sai? VD: Đơn DH-1042 trên V1 là RM120, V2 là RM100 | What's different between V1 and V2? E.g. Order DH-1042 total is RM120 in V1 but RM100 in V2. | Apakah yang berbeza antara V1 dan V2? Cth: Jumlah pesanan DH-1042 ialah RM120 dalam V1 tetapi RM100 dalam V2. |
| `feedback.description.placeholder.idea` | Bạn muốn chúng tôi cải thiện điều gì? | What would you like us to improve? | Apakah yang anda mahu kami tambah baik? |
| `feedback.description.counter` | {count}/2000 | {count}/2000 | {count}/2000 |
| `feedback.description.privacy` | Không nhập mật khẩu, thông tin thanh toán hoặc dữ liệu cá nhân của khách hàng. | Don't enter passwords, payment details or your customers' personal data. | Jangan masukkan kata laluan, butiran pembayaran atau data peribadi pelanggan anda. |
| `feedback.attachments.label` | Ảnh chụp màn hình (tuỳ chọn) | Screenshots (optional) | Tangkapan skrin (pilihan) |
| `feedback.attachments.add` | Thêm ảnh | Add image | Tambah imej |
| `feedback.attachments.hint` | Tối đa 9 ảnh, PNG hoặc JPG, mỗi ảnh tối đa 5 MB. | Up to 9 images, PNG or JPG, max 5 MB each. | Sehingga 9 imej, PNG atau JPG, maksimum 5 MB setiap satu. |
| `feedback.cta.cancel` | Huỷ | Cancel | Batal |
| `feedback.cta.submit` | Gửi phản hồi | Send feedback | Hantar maklum balas |
| `feedback.sending` | Đang gửi… Vui lòng không gửi lại. | Sending… Please don't send it again. | Menghantar… Jangan hantar semula. |

### 6.2 Lỗi & xác nhận

| Key | VI | EN | BM |
|---|---|---|---|
| `feedback.error.type` | Vui lòng chọn loại phản hồi. | Please choose a feedback type. | Sila pilih jenis maklum balas. |
| `feedback.error.area` | Vui lòng chọn khu vực. | Please choose an area. | Sila pilih bahagian. |
| `feedback.error.descriptionRequired` | Vui lòng nhập mô tả. | Please add some details. | Sila masukkan butiran. |
| `feedback.error.descriptionShort` | Vui lòng mô tả ít nhất 10 ký tự. | Please write at least 10 characters. | Sila tulis sekurang-kurangnya 10 aksara. |
| `feedback.error.fileTooLarge` | Ảnh vượt quá 5 MB. | This image is larger than 5 MB. | Imej ini melebihi 5 MB. |
| `feedback.error.tooManyFiles` | Chỉ tải được tối đa 9 ảnh. | You can add up to 9 images. | Anda boleh menambah sehingga 9 imej. |
| `feedback.error.fileType` | Chỉ hỗ trợ ảnh PNG hoặc JPG. | Only PNG or JPG images are supported. | Hanya imej PNG atau JPG disokong. |
| `feedback.error.tooMany` | Bạn đã gửi nhiều phản hồi trong thời gian ngắn. Vui lòng thử lại sau ít phút. | You've sent a lot of feedback in a short time. Please try again in a few minutes. | Anda telah menghantar banyak maklum balas dalam masa yang singkat. Sila cuba lagi dalam beberapa minit. |
| `feedback.error.sendFailedTitle` | Chưa gửi được phản hồi | Your feedback wasn't sent | Maklum balas anda tidak dihantar |
| `feedback.error.sendFailedBody` | Nội dung của bạn vẫn được giữ. Vui lòng thử lại. | What you entered has been kept. Please try again. | Maklumat yang anda masukkan masih disimpan. Sila cuba lagi. |
| `feedback.cta.retry` | Thử lại | Try again | Cuba lagi |
| `feedback.discard.title` | Bỏ nội dung đã nhập? | Discard what you've entered? | Buang maklumat yang telah dimasukkan? |
| `feedback.discard.body` | Phản hồi của bạn chưa được gửi. | Your feedback hasn't been sent. | Maklum balas anda belum dihantar. |
| `feedback.discard.keep` | Tiếp tục nhập | Keep editing | Teruskan menyunting |
| `feedback.discard.confirm` | Bỏ | Discard | Buang |

### 6.3 Gửi thành công

| Key | VI | EN | BM |
|---|---|---|---|
| `feedback.success.title` | Đã gửi phản hồi | Feedback sent | Maklum balas dihantar |
| `feedback.success.body` | Chúng tôi sẽ thông báo cho bạn trong Prime Web (biểu tượng chuông) khi có cập nhật. | We'll notify you in Prime Web (the bell icon) when there's an update. | Kami akan memaklumkan anda dalam Prime Web (ikon loceng) apabila ada kemas kini. |
| `feedback.success.close` | Đóng | Close | Tutup |

### 6.4 Nút trên header

| Key | VI | EN | BM |
|---|---|---|---|
| `feedback.header.button` | Gửi phản hồi | Send feedback | Hantar maklum balas |
| `feedback.header.tooltip` *(mobile, chỉ icon)* | Gửi phản hồi | Send feedback | Hantar maklum balas |

### 6.5 Trạng thái

| Key | VI | EN | BM |
|---|---|---|---|
| `feedback.status.new` | Đã nhận | Received | Diterima |
| `feedback.status.in_progress` | Đang xử lý | In progress | Sedang diproses |
| `feedback.status.resolved` | Đã giải quyết | Resolved | Selesai |
| `feedback.status.closed` | Đã đóng | Closed | Ditutup |

### 6.6 Thông báo in-app (chuông, F16)

> Chuông F16 render chữ theo `notifications.types.<TYPE>.title/message` (xem `ORDER_NEW`, `SYSTEM_ALERT` trong `en.json`). Thêm 2 type: `FEEDBACK_UPDATE` (dùng 3 key `in_progress` / `resolved` / `closed` + `replyLine`) và `FEEDBACK_SUBMITTED` (key `staff`). Tiêu đề panel / "Mark all as read" / thời gian tương đối dùng key F16 sẵn có (`notifications.title`, `notifications.markAllRead`). `{area}` = nhãn khu vực theo ngôn ngữ user (`feedback.area.*`); `{date}` = ngày gửi dạng `dd/MM` theo giờ MYT. Không hiện mã phản hồi (chỉ dùng nội bộ).

| Key | VI | EN | BM |
|---|---|---|---|
| `notifications.feedback.in_progress` | Phản hồi về {area} ({date}) đang được xử lý. | Your feedback about {area} ({date}) is in progress. | Maklum balas anda tentang {area} ({date}) sedang diproses. |
| `notifications.feedback.resolved` | Phản hồi về {area} ({date}) đã được giải quyết. | Your feedback about {area} ({date}) has been resolved. | Maklum balas anda tentang {area} ({date}) telah diselesaikan. |
| `notifications.feedback.closed` | Phản hồi về {area} ({date}) đã đóng. | Your feedback about {area} ({date}) has been closed. | Maklum balas anda tentang {area} ({date}) telah ditutup. |
| `notifications.feedback.replyLine` *(dòng phụ, khi Support điền trả lời)* | Trả lời: {reply} | Reply: {reply} | Balasan: {reply} |
| `notifications.feedback.staff` *(gửi Owner khi Staff gửi)* | {name} vừa gửi phản hồi về {area}. | {name} sent feedback about {area}. | {name} telah menghantar maklum balas tentang {area}. |

## 7. Storefront — buyer (Figma 07)

Hiển thị theo locale storefront. Giá dùng tiền tệ của store (RM), không dùng "đ" như frame Figma.

| Key | VI | EN | BM |
|---|---|---|---|
| `migration.storefront.paused.title` | Cửa hàng đang nâng cấp hệ thống | This store is upgrading its system | Kedai ini sedang menaik taraf sistem |
| `migration.storefront.paused.body` | Thanh toán tạm thời chưa khả dụng. Giỏ hàng được giữ nếu hệ thống hỗ trợ. Nếu bạn vừa thanh toán, hãy kiểm tra trạng thái đơn trước khi thử lại để tránh thanh toán trùng. | Checkout is temporarily unavailable. If you've just paid, check your order status before trying again so you aren't charged twice. | Pembayaran tidak tersedia buat sementara waktu. Jika anda baru membuat pembayaran, semak status pesanan anda sebelum mencuba lagi supaya anda tidak dicaj dua kali. |
| `migration.storefront.cta.checkOrder` | Kiểm tra trạng thái đơn | Check order status | Semak status pesanan |
| `migration.storefront.cta.retry` | Thử lại | Try again | Cuba lagi |
| `migration.storefront.paused.panelTitle` | Thanh toán đang tạm khóa | Checkout is paused | Pembayaran dihentikan seketika |
| `migration.storefront.paused.panelBody` | Không thể tạo đơn hoặc thực hiện thanh toán mới trong lúc cửa hàng nâng cấp. | New orders and payments can't be made while the store is upgrading. | Pesanan dan pembayaran baharu tidak boleh dibuat semasa kedai sedang dinaik taraf. |
| `migration.storefront.paused.rowLocked` | Tạm khóa | Paused | Dihentikan |
| `migration.storefront.paused.button` | Thanh toán tạm khóa | Checkout paused | Pembayaran dihentikan |
| `migration.storefront.paused.badge` | Tạm dừng nhận đơn | Not taking orders right now | Tidak menerima pesanan buat masa ini |
| `migration.storefront.contactStore` | Liên hệ hỗ trợ cửa hàng | Contact the store | Hubungi kedai |
| `migration.storefront.ready.title` | Thanh toán đã sẵn sàng | Checkout is available again | Pembayaran kini tersedia semula |
| `migration.storefront.ready.body` | Bạn có thể tiếp tục đặt hàng. Nếu bạn vừa thanh toán trước khi nâng cấp, hãy kiểm tra trạng thái đơn trước khi đặt lại để tránh thanh toán trùng. | You can place your order now. If you paid just before the upgrade, check your order status before ordering again so you aren't charged twice. | Anda boleh membuat pesanan sekarang. Jika anda membayar sejurus sebelum naik taraf, semak status pesanan anda sebelum membuat pesanan semula supaya anda tidak dicaj dua kali. |
| `migration.storefront.ready.button` | Tiếp tục thanh toán | Continue to checkout | Teruskan ke pembayaran |
| `migration.storefront.ready.badge` | Đang nhận đơn | Taking orders | Menerima pesanan |

## 8. Login fallback (Figma 08)

| Key | VI | EN | BM |
|---|---|---|---|
| `migration.login.invalidToken` | Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại. | Your sign-in session has expired or isn't valid. Please log in again. | Sesi log masuk anda telah tamat atau tidak sah. Sila log masuk semula. |
| `migration.login.network` | Chưa thể kết nối. Vui lòng thử lại. | Can't connect right now. Please try again. | Tidak dapat bersambung sekarang. Sila cuba lagi. |

---

## 9. Email

Chung cho mọi email:

| Phần | EN | BM |
|---|---|---|
| Greeting | Hi {storeName} owner, | Hai pemilik {storeName}, |
| Help | Need help? Contact Prime Web support and share your store ID. Never send your password or payment details. | Perlukan bantuan? Hubungi sokongan Prime Web dan kongsikan ID kedai anda. Jangan sekali-kali hantar kata laluan atau butiran pembayaran anda. |
| Sign-off | Regards,<br>The Prime Web team | Yang ikhlas,<br>Pasukan Prime Web |
| Footer | System notice for the owner of {storeName}.<br>Prime Web · Manage your store | Notis sistem untuk pemilik {storeName}.<br>Prime Web · Urus kedai anda |

### E1 — Trước chuyển (gửi 26/10/2026) · Figma 07 ✅

**EN**
- **Subject:** Your store is moving to Prime Web V2 on 30 October
- **Preheader:** See when the move happens and how to check your V1 data afterwards.
- **Badge:** System update
- **Heading:** Your store is moving to Prime Web V2
- **Body:** Your store will move directly from Prime Web V1 to V2 at {cutoverAt}. You can keep using V1 until then. There's no preview or early switch.
- **Key dates:**
  - Move time: {cutoverAt}
  - V1 data frozen at: {frozenAt}
  - V1 read-only for comparison until: {archiveClosesAt}
- **Section — V1 is for comparison, not for going back:** At the move time, your V1 data is saved as a read-only snapshot. V1 won't show anything new after that, and changes in V2 aren't copied back to V1. V1 closes after the comparison period. When comparing, use data from the same point in time. Once the move is complete, V2 is where you manage and save all new data.
- **Section — What should I know?** Checkout may pause briefly during the move. We'll email you as soon as your store is ready on V2.

**BM**
- **Subject:** Kedai anda akan berpindah ke Prime Web V2 pada 30 Oktober
- **Preheader:** Lihat masa pemindahan dan cara menyemak data V1 anda selepas itu.
- **Badge:** Kemas kini sistem
- **Heading:** Kedai anda akan berpindah ke Prime Web V2
- **Body:** Kedai anda akan berpindah terus dari Prime Web V1 ke V2 pada {cutoverAt}. Anda boleh terus menggunakan V1 sehingga masa itu. Tiada pratonton atau pertukaran awal.
- **Tarikh penting:**
  - Masa pemindahan: {cutoverAt}
  - Data V1 dibekukan pada: {frozenAt}
  - V1 baca sahaja untuk perbandingan sehingga: {archiveClosesAt}
- **Bahagian — V1 untuk perbandingan, bukan untuk kembali:** Pada masa pemindahan, data V1 anda disimpan sebagai salinan baca sahaja. V1 tidak akan memaparkan sebarang data baharu selepas itu, dan perubahan dalam V2 tidak disalin semula ke V1. V1 ditutup selepas tempoh perbandingan. Semasa membandingkan, gunakan data pada masa yang sama. Selepas pemindahan selesai, V2 ialah tempat anda mengurus dan menyimpan semua data baharu.
- **Bahagian — Apa yang perlu saya tahu?** Pembayaran mungkin dihentikan seketika semasa pemindahan. Kami akan menghantar e-mel sebaik sahaja kedai anda sedia di V2.

### E2 — Nhắc T-1 (gửi 29/10/2026) · ❌ GAP-E1, copy đề xuất

**EN**
- **Subject:** Tomorrow: your store moves to Prime Web V2
- **Heading:** Your store moves to Prime Web V2 tomorrow
- **Body:** At {cutoverAt}, V1 becomes read-only and your data is frozen. Please finish any order updates, product edits and stock changes in V1 before then. Changes made after this time won't be saved. Checkout may pause briefly during the move. We'll email you when your store is ready on V2.

**BM**
- **Subject:** Esok: kedai anda berpindah ke Prime Web V2
- **Heading:** Kedai anda berpindah ke Prime Web V2 esok
- **Body:** Pada {cutoverAt}, V1 akan menjadi baca sahaja dan data anda akan dibekukan. Sila selesaikan sebarang kemas kini pesanan, suntingan produk dan perubahan stok dalam V1 sebelum masa itu. Perubahan selepas masa ini tidak akan disimpan. Pembayaran mungkin dihentikan seketika semasa pemindahan. Kami akan menghantar e-mel apabila kedai anda sedia di V2.

### E3 — Đã sẵn sàng trên V2 (gửi khi store `ready`) · Figma 07 ✅

**EN**
- **Subject:** Your store is now on Prime Web V2
- **Preheader:** V2 is now the only place to manage your store. V1 is read-only for comparison.
- **Badge:** Moved to V2
- **Heading:** Your store is ready on Prime Web V2
- **Body:** Your store finished moving at {cutoverAt}. From now on, please manage your store and make all changes in V2 only.
- **Key dates:**
  - Moved at: {cutoverAt}
  - V1 data frozen at: {frozenAt}
  - V1 read-only until: {archiveClosesAt}
- **Section — V1 is for comparison, not for going back:** (same as E1)
- **CTAs:** Open V2 · View V1 (read-only) · Report a data mismatch

**BM**
- **Subject:** Kedai anda kini di Prime Web V2
- **Preheader:** V2 kini satu-satunya tempat untuk mengurus kedai anda. V1 baca sahaja untuk perbandingan.
- **Badge:** Telah berpindah ke V2
- **Heading:** Kedai anda sudah sedia di Prime Web V2
- **Body:** Kedai anda selesai dipindahkan pada {cutoverAt}. Mulai sekarang, sila urus kedai anda dan buat semua perubahan dalam V2 sahaja.
- **Tarikh penting:**
  - Dipindahkan pada: {cutoverAt}
  - Data V1 dibekukan pada: {frozenAt}
  - V1 baca sahaja sehingga: {archiveClosesAt}
- **Bahagian — V1 untuk perbandingan, bukan untuk kembali:** (sama seperti E1)
- **CTA:** Buka V2 · Lihat V1 (baca sahaja) · Laporkan percanggahan data

### E4 — Chuyển chậm / lỗi (gửi khi chưa `ready` sau T + 6h) · ❌ GAP-E2, copy đề xuất

**EN**
- **Subject:** Your store needs a little more time to move
- **Heading:** We're still moving your store
- **Body:** Your store isn't ready on Prime Web V2 yet. We're working on it. Your data is safe, and checkout stays paused until the move is complete. We'll email you as soon as your store is ready. If you need help, contact support with this code: {supportCode}
- **CTA:** Check status

**BM**
- **Subject:** Kedai anda memerlukan sedikit masa lagi untuk berpindah
- **Heading:** Kami masih memindahkan kedai anda
- **Body:** Kedai anda belum sedia di Prime Web V2. Kami sedang menguruskannya. Data anda selamat, dan pembayaran kekal dihentikan sehingga pemindahan selesai. Kami akan menghantar e-mel sebaik sahaja kedai anda sedia. Jika anda perlukan bantuan, hubungi sokongan dengan kod ini: {supportCode}
- **CTA:** Semak status

### E5 — Còn 7 ngày trước khi đóng V1 (gửi 08/11/2026) · ❌ GAP-E3, copy đề xuất

**EN**
- **Subject:** 7 days left to view your V1 data
- **Heading:** V1 closes on {archiveCloseDate}
- **Body:** You can view your frozen V1 data until {archiveClosesAt}. If you need any V1 reports for your records, export them before then. After V1 closes, you can still report a data mismatch in V2.
- **CTA:** View V1 (read-only)

**BM**
- **Subject:** Tinggal 7 hari untuk melihat data V1 anda
- **Heading:** V1 ditutup pada {archiveCloseDate}
- **Body:** Anda boleh melihat data V1 yang dibekukan sehingga {archiveClosesAt}. Jika anda perlukan laporan V1 untuk simpanan, eksport laporan tersebut sebelum tarikh itu. Selepas V1 ditutup, anda masih boleh melaporkan percanggahan data dalam V2.
- **CTA:** Lihat V1 (baca sahaja)

### E6 — Ngày cuối (gửi 14/11/2026) · ❌ GAP-E3, copy đề xuất

**EN**
- **Subject:** V1 closes tomorrow
- **Heading:** Last day to view your V1 data
- **Body:** V1 closes at {archiveClosesAt}. Export any reports you need before then.
- **CTA:** View V1 (read-only)

**BM**
- **Subject:** V1 ditutup esok
- **Heading:** Hari terakhir untuk melihat data V1 anda
- **Body:** V1 ditutup pada {archiveClosesAt}. Eksport sebarang laporan yang anda perlukan sebelum masa itu.
- **CTA:** Lihat V1 (baca sahaja)

### E7 — V1 đã đóng (gửi 16/11/2026 00:00 MYT) · ❌ GAP-E3, copy đề xuất

**EN**
- **Subject:** V1 has closed — keep going on Prime Web V2
- **Heading:** V1 is now closed
- **Body:** Prime Web V1 closed on {archiveCloseDate}. Old V1 links now open your V2 dashboard. All your store data is managed in V2. If something doesn't look right, you can still report a data mismatch in V2.
- **CTA:** Open V2

**BM**
- **Subject:** V1 telah ditutup — teruskan di Prime Web V2
- **Heading:** V1 kini telah ditutup
- **Body:** Prime Web V1 telah ditutup pada {archiveCloseDate}. Pautan V1 lama kini membuka papan pemuka V2 anda. Semua data kedai anda diurus dalam V2. Jika ada yang kelihatan tidak betul, anda masih boleh melaporkan percanggahan data dalam V2.
- **CTA:** Buka V2

---

## 10. Việc cần làm với bản dịch

- [ ] Native reviewer BM duyệt toàn bộ cột BM (đặc biệt email E1, E3, storefront và §6 Phản hồi).
- [ ] Design cập nhật Figma: thay `[múi giờ]` → MYT, sửa "T-7" → "T-4", đổi "đ" → RM.
- [ ] Dev thêm key `migration.*`, `feedback.*`, `notifications.feedback.*` vào `en.json` / `ms.json`; email template đăng ký trong `template-registry.ts`.
- [ ] Xác nhận kênh hỗ trợ (GAP-S1) để điền vào dòng "Contact support" nếu cần link cụ thể.
