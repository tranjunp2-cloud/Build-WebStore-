# PW1 → PW2 — Tracking các vấn đề Store

Cập nhật: 2026-09-17. Phạm vi: identity, lifecycle, subscription, owner, domain/slug và quyết định hoãn cả Store. Không gộp gap Product/Blog/Order vào số Store bị chặn.

## Baseline và quy tắc sử dụng

- Artifact: `pw1-prod-20260917-followup-001`; 2.918 Store nguồn = 2.799 đã xuất + 118 bị chặn + 1 chủ động hoãn (323).
- 118/118 mã chặn đã tái hiện; 93 file nguồn và config khớp hash artifact. Kết quả nghiên cứu chưa được áp vào exporter/config và chưa export lại.
- Contract đối chiếu: [master mapping f08-935](/home/liam/data/worktrees/ech-prime-web-v2-f08-935/docs/migration/pw1-pw2-master-field-mapping.md), SHA-256 `27fbef7ec0fc73e58029295c8fbbe7d276c4d6095e358fe57e3058e1eb4f4567`. Artifact cũ pin `8aacb2610d7ceacbe067da4c0e5b8717e0804601715e8d0158b6a619c6bfeae9`.
- Các nhóm ST-01…ST-10 chia theo nguyên nhân chính, không trùng ID, tổng 118. Một Store có thể còn lỗi phía sau. ST-11 là Store hoãn riêng, không cộng vào 118.
- “Đã xác minh nguyên nhân” không có nghĩa đã duyệt thay policy hoặc import-ready. Đề xuất trong report recheck không thay quy tắc contract hiện tại.
- Người phụ trách từng mục: **chưa phân công**. Cột bên dưới chỉ ghi nhóm công việc cần tham gia, không phải giao việc cho cá nhân.

## Danh sách công việc

| Mã | Store / số lượng | Vấn đề và bằng chứng | Quy tắc hiện tại / trạng thái | Việc tiếp theo và điều kiện đóng | Nhóm công việc |
|---|---|---|---|---|---|
| ST-01 | 94 Store; đủ ID ở phụ lục | Store status=2, owner=1; không ban, hạn owner/main còn hiệu lực. PW1 có nhánh unban tạo tổ hợp này do isExpired so sánh ngược; chưa chứng minh từng Store đã chạy nhánh đó. | **Chờ quyết định policy**. §3.1 vẫn yêu cầu cách ly trạng thái lệch; exporter đang làm đúng rule này. | Chốt disposition có evidence cho nhóm này; nếu đổi policy, cập nhật contract và regression ban/expiry trước export mới. Không sửa status nguồn hoặc bỏ equality guard đại trà. Đóng khi có quyết định và kết quả export/đối soát theo quyết định. | Nghiệp vụ + mapping |
| ST-02 | 28, 29, 30, 99, 1240, 1322, 1337, 1683 (8) | Store/owner active, không ban; expired_at và main đã hết hạn. PW1 tách account khỏi hiệu lực gói. | **Chờ làm rõ contract**. §3.1 tách tài khoản/gói; §3.4 vẫn chặn bằng chứng hết hạn mâu thuẫn. membership hiện chặn active + expired_at đã qua. | Chốt khi nào expiry là xung đột, khi nào chỉ là hết quyền gói; giữ ngày và subscription ended, không gia hạn. Test cả owner/staff và quyền gói; export/đối soát lại. | Nghiệp vụ + mapping + quyền truy cập |
| ST-03 | 575, 948, 982, 986, 1186, 1190 (6) | starts_at sau asOf 2026-09-16T00:00:00Z, cùng ngày. Mốc đầu ngày được chọn, chưa phải giờ snapshot đã xác nhận. | **Chờ bằng chứng snapshot/timezone**. §9 vẫn cách ly gói tương lai. | Xác minh cutoff/timezone thực; pin config mới nếu có thay đổi và tính lại toàn snapshot. Không chọn starts_at+1 giây chỉ để vượt guard. Đóng khi có bằng chứng mốc và export mới. | Dữ liệu nguồn + mapping |
| ST-04 | 55 (1) | Slug nguồn mk dài 2, hợp lệ DNS nhưng PW2 yêu cầu 3–63 ký tự. | **Chờ quyết định slug/tương thích PW2**. TENANT_SLUG_INVALID. | Chọn giữ slug qua thay đổi rule đích hoặc mapping slug mới được duyệt; kiểm tra collision, routing và URL cũ. Không tự thêm ký tự. | Nghiệp vụ + PW2 |
| ST-05 | 1165, 1265 (2) | Store soft-deleted; không còn User/domain/catalog trực tiếp trong bảng đã kiểm tra. Có dấu vết gợi ý chuyển dữ liệu, không có audit xác nhận. | **Chờ chốt phạm vi lịch sử**. Hiện vẫn blocked, chưa policy-excluded. | Chốt disposition Store đã xóa và lưu evidence. deferredStoreIds hiện chỉ nhận Store live, không nhét 2 ID này vào config đó; nếu cần thay classification phải có rule riêng. Không tự merge sang 1329/1327. | Nghiệp vụ + mapping |
| ST-06 | 54, 161 (2) | Owner tương ứng User 118/343 đã soft-delete; không có backend owner live thay thế; Store status=3, main ended. | **Chờ xác minh owner/phạm vi**. OWNER_IDENTITY_CONFLICT. | Xác nhận Store có migrate vận hành không; nếu có, xác minh owner hợp lệ và disposition ban/gói. Không khôi phục owner đã xóa hoặc cấp quyền tự động. | Nghiệp vụ + identity |
| ST-07 | 1327, 1329 (2) | Mỗi Store có 2 owner và 2 default/main domains. 1329 còn Store=2/owner=1; 1327 owners bị ban. | **Chờ lựa chọn owner/domain**. Lỗi đầu tiên che các lỗi tiếp theo. | Chốt owner chính, membership còn lại và domain chuẩn bằng evidence; giữ trạng thái ban/gói đúng. Kiểm lại toàn identity pipeline sau mỗi sửa, không chọn dòng đầu. | Nghiệp vụ + identity/domain |
| ST-08 | 796 (1) | Owner 1628 có email domain không có dấu chấm; còn active + expired_at=2025-11-26. | **Chờ xác nhận email và lifecycle**. USER_EMAIL_INVALID che expiry guard. | Xác minh email/identity đích, kiểm uniqueness/crosswalk; sau đó xử lý expiry như ST-02. Hoãn migrate email template không miễn validation email tài khoản. | Identity + mapping |
| ST-09 | 2330 (1) | Label đầu của domain dài 64 ký tự, vượt giới hạn 63. | **Chờ domain/slug hợp lệ**. | Chốt hostname đích, kiểm DNS format/slug/collision/routing và lưu old→new nếu đổi. Không cắt chuỗi tự động. | Nghiệp vụ + domain |
| ST-10 | 479 (1) | Store=3, owner992/frontend993 active không dấu ban; main ended 2026-06-01. Expiry lỗi trước che mismatch Store/owner. | **Chờ xác minh ban**. Không gộp vào ST-02 để tự active. | Xác minh ý nghĩa cờ ban và chọn disposition; bảo toàn gói ended. Đóng khi có evidence/quyết định và kiểm thử không mở lại quyền ngoài ý muốn. | Nghiệp vụ + identity |
| ST-11 | 323 (1, ngoài 118) | Store currency VND; đợt này không đổi tỷ giá hoặc áp shipping MYR. | **Đã duyệt hoãn, đã áp dụng** qua deferredStoreIds; vẫn hoãn trong followup-001. | Giữ nguyên cho đợt này. Chỉ mở lại khi có quyết định currency/shipping tương thích và kiểm chứng mapping. Không tính là Store mapping lỗi. | Nghiệp vụ + commerce |

## Checklist cho từng mục được xử lý

- [ ] Ghi quyết định, người xác nhận, ngày và bằng chứng theo đúng Store ID/source snapshot.
- [ ] Nếu đổi policy: cập nhật master mapping, config/hash và exporter; không sửa CSV nguồn để vượt validator.
- [ ] Kiểm tra các lỗi phía sau, không dừng ở việc mã chặn đầu tiên biến mất.
- [ ] Chạy test phù hợp; xuất artifact mới và đối soát ID/count/status/owner/domain/subscription.
- [ ] Ghi kết quả: đã xuất / vẫn cách ly / chủ động hoãn. Store đã xuất vẫn cần kiểm dữ liệu con và readiness đích.
- [ ] Chỉ ghi hoàn tất vận hành sau khi importer/DB đích và quyền truy cập đã được kiểm chứng; không dùng mô phỏng RAM làm bằng chứng import.

## Phụ lục: đủ 118 Store ID theo nhóm

- **ST-01 — 94 Store:** 401, 485, 510, 530, 570, 653, 657, 659, 722, 742, 765, 787, 840, 850, 867, 875, 888, 921, 1218, 1233, 1239, 1277, 1344, 1363, 1403, 1410, 1420, 1430, 1432, 1454, 1487, 1496, 1508, 1516, 1528, 1543, 1547, 1550, 1567, 1573, 1590, 1593, 1617, 1620, 1639, 1654, 1665, 1668, 1677, 1689, 1697, 1725, 1752, 1758, 1760, 1768, 1770, 1778, 1789, 1792, 1802, 1810, 1820, 1836, 1843, 1846, 1880, 1908, 1912, 1919, 1924, 1967, 1968, 2000, 2099, 2111, 2147, 2152, 2159, 2177, 2183, 2219, 2233, 2236, 2237, 2240, 2293, 2315, 2317, 2324, 2355, 2593, 2740, 2861.

- **ST-02 — 8 Store:** 28, 29, 30, 99, 1240, 1322, 1337, 1683.

- **ST-03 — 6 Store:** 575, 948, 982, 986, 1186, 1190.

- **ST-04 — 1 Store:** 55.

- **ST-05 — 2 Store:** 1165, 1265.

- **ST-06 — 2 Store:** 54, 161.

- **ST-07 — 2 Store:** 1327, 1329.

- **ST-08 — 1 Store:** 796.

- **ST-09 — 1 Store:** 2330.

- **ST-10 — 1 Store:** 479.

## Bằng chứng liên quan

- [Tổng hợp recheck 118 Stores](../../plans/reports/260917-stores-118-recheck-summary.md).
- [Nghiên cứu lifecycle](../../plans/reports/260917-store-lifecycle-recheck.md), [identity/domain](../../plans/reports/260917-store-identity-recheck.md).
- [Chi tiết từng Store — Markdown](../../.migration/reviews/260917-store-recheck/stores-118-reclassified.md), [CSV](../../.migration/reviews/260917-store-recheck/stores-118-reclassified.csv).
- [Replay mapper](../../.migration/reviews/260917-store-recheck/identity-replay.json), [hash nguồn](../../.migration/reviews/260917-store-recheck/source-integrity.json).
- [Kết quả artifact followup-001](../../plans/reports/260917-pw1-followup-results.md).

Các file .migration là evidence local bị ignore, không tự có trên PR/checkout khác. File tracking này chứa đủ nhóm và ID để team theo dõi; email/domain chi tiết nằm trong evidence riêng.

## Nhật ký cập nhật

| Ngày | Thay đổi | Code / artifact |
|---|---|---|
| 2026-09-17 | Tạo tracking ST-01…ST-11; đối chiếu master f08-935, giữ rõ ranh giới nghiên cứu và quyết định policy. | Chỉ tạo tài liệu; chưa sửa mapper/config/DB, chưa export lại. |

### Cập nhật exporter 1.1.0 — 2026-09-17

Đã sửa SKU validation và bổ sung Customer/Product reconciliation receipts; xem [note cập nhật master](pw1-exporter-alignment-tracking.md). **Không thay trạng thái ST-01…ST-11**, không sửa lifecycle/asOf/owner/domain và chưa export lại production. Số 118 blocked ở baseline vẫn giữ; không coi thay đổi exporter này đã khôi phục Store.

## Kiểm chứng sau exporter 1.2.0 (2026-09-17)

Artifact `pw1-prod-20260917-classification-001` vẫn có **118 Store bị chặn và Store 323 hoãn theo policy**. Sửa classification không thay quyết định lifecycle/domain/owner của các nhóm trên.

Store 205 đã có tenant/user/site/subscription trong master; không còn field unresolved riêng Store sau khi phân loại metadata và resolve ownership của bảng con. Blocker riêng là `TARGET_USER_CREATOR_BINDING_REQUIRED` cho User 432.created_by. Hash actor registry không đổi; binding cần importer xác minh với DB đích.

Vẫn có blocker global do source parent thiếu (1 role→User, 26 settings→PageComponent, 4.749 shortlist→PageComponent). Không tự gán các dòng này vào Store 205 hoặc bỏ qua chúng. Xem EXP-05…08 và kết quả production trong [tracking exporter](pw1-exporter-alignment-tracking.md). Importer hiện tại còn từ chối manifest phiên bản mới; chưa apply dữ liệu.
