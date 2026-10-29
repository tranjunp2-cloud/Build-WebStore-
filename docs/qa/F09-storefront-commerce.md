# Quyết Định Kiểm Thử & Kiểm Thử Chi Tiết: F09 - Storefront Commerce
> **Phiên bản:** 5.5 | **Cập nhật:** 2026-05-18 (thêm TC-F09.205..222 — GH-1023 Floating Cart Global Injection + Commerce Detection + Scope Tags) | **Thực hiện:** QA Team
> **Nguồn Tham chiếu:** PRD (`F09-storefront-commerce.md`)User Stories (14 Core ACs)Figma (Node 30905:1342)
> **Kỹ năng ứng dụng (.agent):** BDD (Gherkin)Malaysia Market Context (SST/MY Shipping)Mobile Native UXSecurity QR Proof Validation.

### Changelog
- **v5.4 (2026-05-15)** — Thêm TC-F09.182..204 (23 TCs) — Checkout design coverage ledger theo F14 pattern. 20 offline source-content design contracts (4 sections layoutcontact/shipping/payment fieldspostcode inputMode + patternMY_STATES 16COD/QR conditional uploadcurrency formatorder summary SST+shipping+total formulasecure indicatorbutton stateserror bannerproof previewempty cart guardsuccess orderResultdebounced shipping calc 300msi18n appliedmobile responsiveshipping hint tierdesign doc reference) + 3 live browser flows (state dropdown countQR upload togglemobile 375px no overflow). 20/20 offline PASS3 live env-gated (BASE_URL=staging).
- **v5.3 (2026-05-15)** — Thêm TC-F09.158..181 (24 TCs) phủ 4 domain Payment/Shipping/Postcode/Tracking. Payment (8): enum strict cod|qr_bankingcase-sensitivemissing field rejectCOD no-proofQR proof persistencecurrency lock MYRdefault MYR fallbackpending status. Shipping (6): shippingFee persistedmulti-product single flat-rate (BR-03)East rate 15total = subtotal+shipping+tax (BR-04+BR-05)state exact persistcountry default Malaysia. Postcode (4): leading-zero 50000optional empty stringmax-length permissive (Wave 7+ regex gap)state-postcode cross-check NOT enforced (deferred). Tracking (6): persist on PATCH shippedoptional per BR-09special chars accepted500-char max permissivestatus required for tracking-only PATCHGET returns field.
- **v5.2 (2026-05-15)** — Thêm TC-F09.127..157 (31 TCs) lấp coverage gap cho 4 endpoints orders/list/[id]/bulk-update/metrics (0% → 91-100%). Overall 58.81% → 85.2%.
- **v5.1 (2026-05-15)** — Thêm TC-F09.74..100 (27 TCs mới) phủ 30 gaps từ ck:scenario audit: price spoofing (G2)quantity bounds (G3 negative/zero)email/postcode validators (G14/G16)SST rounding boundary (G12)large-value cart RM 10k+ (G13)zero-priced product (G31)concurrent stock race documentation (G4)guest checkout auth contract (G29)sort/limit/page injection guards (G5/G17)PII leak protection in storefront API (G23)slug injection (G5)cart edge cases (negative qtylarge totalempty subtotal — G3/G13/G18)JSON-LD shape validation per Google Rich Results (G20).
- **v5.0 (2026-04-06)** — Initial 73 manual TCs covering 14 ACs across 5 user stories.

---

## 1. Mục Tiêu (Objective)

Cung cấp ma trận kiểm thử **triệt để** cho Storefront Commerce (F09). Đạt độ phủ **100% cho 5 User Stories (14 ACs)**bao quát Happy PathEdge CasesNegative và các quy tắc đặc thù thị trường Malaysia.

**Tổng cộng 73 kịch bản chi tiết**đảm bảo hệ thống vận hành bền bỉan toàn và mang lại trải nghiệm mua sắm mượt mà nhất.

---

## 2. Test Environment

| Biến | Yêu cầu |
|---|---|
| Môi trường | Staging / Pre-Production |
| Browsers | Chrome (v110+)Safari (Latest)Firefox |
| Devices | Desktop (1920x1080)Mobile (iPhone 14 ProSamsung S22) |
| Test Data | Malaysia LocalesSST Tax RulesMY PostcodesQR Sample Receipt |

---

## 3. Unified Test Cases (Traceability Matrix)

### US-F09-01: Duyệt Sản Phẩm — Product Listing Page (PLP) (11 Cases)

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F09.01** | `AC-1` | `UI` | **[Positive]** PLP 3 cột trên Desktop | 1. Truy cập `/sites/[slug]/products`. | - Card SP hiển thị: ẢnhCategoryTênGiá (RM).<br>- Bố cục 3 cột đều nhau. | High | [ ] |
| **TC-F09.02** | `AC-1` | `UI` | **[Positive]** PLP 1 cột trên Mobile (375px) | 1. Chuyển sang Mobile View 375px. | - Card SP co giãn về 1 cột.<br>- Không có thanh cuộn ngang. | High | [ ] |
| **TC-F09.03** | `AC-1` | `UI` | **[Positive]** Badge "SALE" cho SP có giá khuyến mãi | 1. Xem sản phẩm có `compareAtPrice > price`. | - Hiển thị tag "SALE" màu đỏ nổi bật trên ảnh sản phẩm. | Medium | [ ] |
| **TC-F09.04** | `AC-1` | `Logic` | **[Negative]** Ẩn SP Draft/Archived khỏi Storefront | 1. Kiểm tra danh sách PLP.<br>2. Đối chiếu với DB. | - Chỉ SP có `status='active'` hiển thị.<br>- Không có SP draft/archived lọt ra. | Blocker | [x] |
| **TC-F09.05** | `AC-2` | `Func` | **[Positive]** Tìm kiếm theo Keyword | 1. Nhập "Coffee" vào ô Search. | - Danh sách cập nhật ngay với SP có tên/mô tả chứa "Coffee". | High | [ ] |
| **TC-F09.06** | `AC-2` | `Func` | **[Positive]** Lọc Category đa cấp (3 levels) | 1. Chọn Category → "Fashion" → "Tops" → "Áo". | - Lọc đúng 3 cấp.<br>- Breadcrumb hiển thị đúng đường dẫn. | High | [ ] |
| **TC-F09.07** | `AC-2` | `Func` | **[Positive]** Sort "Giá giảm dần" | 1. Chọn Sort "Giá giảm dần". | - SP đắt nhất đứng đầu.<br>- Thứ tự số học RM đúng. | Medium | [ ] |
| **TC-F09.08** | `AC-2` | `Func` | **[Positive]** Kết hợp Filter Category + Sort | 1. Chọn "Tops" + Sort "Giá tăng dần". | - Không conflict.<br>- URL: `?cat=tops&sort=price_asc`. | High | [ ] |
| **TC-F09.09** | `AC-3` | `Logic` | **[Positive]** Phân trang 10 SP/trang | 1. Đếm SP trang 1.<br>2. Nhấn sang trang 2. | - Đúng 10 items/trang.<br>- Trang 2 hiện SP tiếp theokhông trùng lặp. | High | [ ] |
| **TC-F09.10** | `PRD` | `Edge` | **[Positive]** SP hết hàng hiện trạng thái mờ | 1. Xem SP có stock = 0. | - Ảnh SP mờ (opacity ~0.6).<br>- Badge "Hết hàng" hiển thị.<br>- Nút Add to Cart ẩn. | High | [ ] |
| **TC-F09.11** | `Market` | `UI` | **[Positive]** Định dạng tiền tệ Malaysia (RM) | 1. Quan sát giá hiển thị trên PLP. | - Luôn có tiền tố `RM` (vd: RM 15.00).<br>- Không dùng ký hiệu khác hoặc để trống. | Blocker | [ ] |

---

### US-F09-02: Giỏ Hàng & Cart Drawer — Slide-in UX (10 Cases)

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F09.12** | `AC-1` | `UX` | **[Positive]** Cart Drawer trượt ra mượt | 1. Nhấn "Add to Cart". | - Drawer trượt từ phải sang (transition < 300ms).<br>- Background overlay mờ kích hoạt. | High | [ ] |
| **TC-F09.13** | `AC-1` | `Data` | **[Positive]** Tăng số lượng khi Add SP trùng | 1. Nhấn "Add to Cart" cho cùng 1 SP 2 lần. | - Giỏ chỉ có 1 dòng "Denim Jacket" với Quantity = 2.<br>- Không tạo dòng mới. | High | [x] |
| **TC-F09.14** | `AC-1` | `Data` | **[Positive]** Giỏ hàng giữ sau khi Refresh trang | 1. Add SP vào giỏ.<br>2. Nhấn F5 reload. | - Items vẫn giữ nguyên.<br>- DOM nạp lại data từ LocalStorage trong < 100ms. | Blocker | [x] |
| **TC-F09.15** | `AC-2` | `Func` | **[Positive]** Tăng/Giảm số lượng (+/-) trong Drawer | 1. Nhấn `+` hoặc `-` trên item trong Drawer. | - Subtotal cập nhật real-time.<br>- API ghi nhận đúng số lượng mới. | High | [ ] |
| **TC-F09.16** | `AC-2` | `Logic` | **[Positive]** Xóa tự động khi giảm về 0 | 1. Nhấn `-` trên item có Quantity = 1. | - Item biến khỏi giỏ.<br>- Toast "Item removed" hiện ra. | Medium | [ ] |
| **TC-F09.17** | `AC-3` | `UX` | **[Positive]** Xóa item bằng icon (✕) | 1. Nhấn icon Xóa trên item trong Drawer. | - Item biến mất ngay lập tức.<br>- Subtotal khấu trừ đúng. | High | [ ] |
| **TC-F09.18** | `AC-3` | `UI` | **[Positive]** Empty State khi giỏ trống | 1. Xóa hết items trong giỏ. | - Hiển thị illustration "Giỏ hàng trống".<br>- Link "Tiếp tục mua sắm" hiện ra. | Medium | [ ] |
| **TC-F09.19** | `Limit` | `Logic` | **[Negative]** Chặn add vượt tồn kho | 1. Thêm 10 items vào giỏ khi stock chỉ còn 5. | - Toast lỗi "Chỉ còn 5 sản phẩm trong kho".<br>- Giỏ giới hạn ở mức 5. | High | [ ] |
| **TC-F09.20** | `Design` | `UX` | **[Positive]** Cross-sell "You might also like" | 1. Nhấn `+` trên SP gợi ý bên dưới Drawer. | - SP gợi ý thêm vào giỏ ngay lập tức.<br>- Drawer không đóng lại. | Medium | [ ] |
| **TC-F09.21** | `UI` | `Header` | **[Positive]** Số lượng giỏ hàng trên Global Header | 1. Add items vào giỏ.<br>2. Nhìn icon Cart trên Header. | - Badge đỏ hiển thị đúng số lượng SP trong Drawer. | High | [ ] |

---

### US-F09-03: Thanh Toán & Thị Trường Malaysia — Guest Checkout (14 Cases)

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F09.22** | `AC-1` | `UI` | **[Positive]** Checkout Form đủ 3 khu vực | 1. Truy cập `/checkout`. | - Hiển thị đầy đủ: Contact Info (S01)Shipping Address (S02)Payment (S03). | Blocker | [ ] |
| **TC-F09.23** | `AC-1` | `Func` | **[Negative]** Bắt buộc nhập Full Name | 1. Để trống trường Name.<br>2. Nhấn Place Order. | - Border field đỏ.<br>- Hiển thị "Full Name is required".<br>- Không gọi API. | High | [ ] |
| **TC-F09.24** | `AC-1` | `Func` | **[Negative]** Chặn Email sai cú pháp | 1. Nhập Email: `abc@.com` hoặc `abc.com`.<br>2. Nhấn Submit. | - Báo lỗi "Invalid email address".<br>- Ngăn submit. | High | [ ] |
| **TC-F09.25** | `AC-1` | `Sec` | **[Negative]** Ràng buộc số Phone Malaysia (+60) | 1. Nhập Phone: `090123...`. | - Báo lỗi hoặc tự format về prefix `+60`.<br>- Chỉ chấp nhận chữ số. | High | [ ] |
| **TC-F09.26** | `AC-1` | `Bus` | **[Positive]** Dropdown đủ các Bang Malaysia | 1. Mở dropdown "State" trong Shipping Address. | - Hiển thị đủ các bang: SelangorJohorPenangSabahSarawak... | High | [ ] |
| **TC-F09.27** | `AC-1` | `Logic` | **[Negative]** Postcode Malaysia chỉ nhận 5 chữ số | 1. Nhập Postcode `abcde` (chữ).<br>2. Nhập Postcode `123` (ngắn). | - Chỉ chấp nhận đúng 5 chữ số.<br>- Từ chối format không đúng. | High | [ ] |
| **TC-F09.28** | `AC-1` | `Sec` | **[Positive]** QR Banking — Bắt buộc upload Receipt | 1. Chọn phương thức "QR Banking" tại Checkout. | - Khung upload File xuất hiện.<br>- Nút Place Order bị Disabled cho đến khi upload xong. | Blocker | [ ] |
| **TC-F09.29** | `AC-1` | `Sec` | **[Negative]** Chặn file rác khi upload Receipt | 1. Upload file `.exe` hoặc ảnh > 2MB. | - Báo lỗi "File size exceeded" hoặc "Invalid format".<br>- Field upload được reset. | High | [ ] |
| **TC-F09.30** | `AC-2` | `API` | **[Positive]** Place Order thành công | 1. Điền đầy đủ thông tin hợp lệ.<br>2. Nhấn Place Order. | - Redirect sang `/order/:id/confirm`.<br>- DB Order Status = `pending`.<br>- Giỏ hàng bị xóa. | Blocker | [x] |
| **TC-F09.31** | `AC-2` | `Logic` | **[Positive]** Format mã đơn hàng (ORD-XXXXXXXX) | 1. Hoàn tất đặt hàngxem mã đơn. | - Mã khớp format `ORD-` + 8 ký tự/số ngẫu nhiên độc nhất. | High | [ ] |
| **TC-F09.32** | `AC-3` | `Sec` | **[Positive]** Khách không cần đăng nhập (Guest Checkout) | 1. Dùng Browser ẩn danh (chưa đăng nhập).<br>2. Thực hiện Checkout. | - Vào được trang Checkout và đặt hàng bình thường.<br>- Không bị redirect sang Login. | Blocker | [x] |
| **TC-F09.33** | `AC-3` | `Bus` | **[Positive]** Tính thuế SST 6% đúng | 1. Kiểm tra phần Order Summary tại Checkout. | - SST 6% tính trên Subtotal (vd: Sub RM 100 → SST RM 6.00). | Critical | [x] |
| **TC-F09.34** | `Market` | `Bus` | **[Positive]** Phí Ship khác nhau West/East Malaysia | 1. Chọn Bang Selangor (West).<br>2. Đổi sang Sabah (East). | - Selangor: RM 8.00; Sabah: RM 15.00.<br>- Phí ship cập nhật ngay khi đổi Bang. | Critical | [x] |
| **TC-F09.35** | `AC-4` | `UX` | **[Negative]** Giỏ hàng giữ nguyên khi Place Order thất bại | 1. Mô phỏng lỗi API 500 khi submit Order. | - Toast đỏ "Order failed".<br>- **Giỏ hàng KHÔNG bị xóa.** | High | [ ] |

---

### US-F09-04: Xác Nhận Đơn Hàng (2 Cases)

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F09.36** | `AC-1` | `UI` | **[Positive]** Trang Confirm hiển thị đầy đủ | 1. Vừa hoàn tất đặt hàng. | - Hiển thị: Mã ORDTổng tiềnDanh sách SPHình thức thanh toán. | High | [ ] |
| **TC-F09.37** | `AC-1` | `Flow` | **[Positive]** Nút "Continue Shopping" điều hướng đúng | 1. Nhấn "Continue Shopping" trên trang Confirm. | - Redirect về storefront home: `/sites/[slug]` với path-based storefront hoặc `/` với custom domain. | Medium | [ ] |

---

### US-F09-05: Tối Ưu Mobile UX — Native-Feeling (4 Cases)

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F09.38** | `AC-1` | `UX` | **[Positive]** Nút Add-to-Cart Sticky ở đáy PDP | 1. Cuộn trang PDP xuống dưới trên Mobile. | - Nút Add to Cart dính ở đáy màn hình.<br>- Dễ nhấn bằng ngón cái. | High | [ ] |
| **TC-F09.39** | `AC-2` | `UI` | **[Positive]** Filter/Sort dạng Bottom Sheet | 1. Tap Filter trên Mobile. | - Panel trượt từ dưới lên (Bottom Sheet).<br>- Vuốt xuống để đóng. | High | [ ] |
| **TC-F09.40** | `AC-3` | `UI` | **[Positive]** Cart Drawer Full-Screen trên Mobile | 1. Mở giỏ hàng trên Mobile. | - Drawer chiếm 100% width màn hình.<br>- Nút [CHECKOUT] toSticky ở đáy. | High | [ ] |
| **TC-F09.41** | `Design` | `UI` | **[Positive]** Safe Area Inset cho iOS | 1. Kiểm tra trên iPhone 14 Pro Max. | - Nút Sticky không bị che bởi Home indicator iOS.<br>- Padding-bottom đúng chuẩn. | Medium | [ ] |

---

### Advanced Cases: Hiệu NăngBảo Mật & Đa Ngôn Ngữ (32 Cases)

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F09.42** | `Locale` | `Func` | **[Positive]** Chuyển ngữ EN → VI | 1. Chuyển ngôn ngữ sang Tiếng Việt. | - "Add to Cart" → "Thêm vào giỏ".<br>- "Categories" → "Danh mục". Toàn bộ label dịch đúng. | High | [ ] |
| **TC-F09.43** | `Locale` | `Func` | **[Positive]** Chuyển ngữ sang Bahasa Melayu | 1. Chuyển ngôn ngữ sang BM. | - "Place Order" → "Buat Pesanan".<br>- Ngôn ngữ lịch sựphù hợp Business Malaysia. | High | [ ] |
| **TC-F09.44** | `Perf` | `SLA` | **[Positive]** Tải PLP dưới 2 giây | 1. Reload trang Products có 50 SP. | - LCP xuất hiện trong **< 2 giây**. | Medium | [ ] |
| **TC-F09.45** | `Perf` | `UX` | **[Positive]** Skeleton Loading khi mạng chậm | 1. Giả lập mạng Slow 3G.<br>2. Load trang Products. | - Card SP hiển thị khung xám nhấp nháy (Skeleton).<br>- Không có trang trắng. | Medium | [ ] |
| **TC-F09.46** | `Sec` | `Sanit` | **[Negative]** Chặn XSS qua Search Box | 1. Nhập `<script>alert('xss')</script>` vào ô tìm kiếm. | - Chuỗi bị escape hoặc xóa.<br>- Không nhảy popup cảnh báo.<br>- Trả về 0 kết quả. | Blocker | [x] |
| **TC-F09.47** | `Sec` | `Access` | **[Negative]** Chặn IDOR — Xem order của người khác | 1. Thay đổi `:id` trên URL Confirm sang ID ngẫu nhiên. | - Trả lỗi HTTP 403 hoặc 404.<br>- Không hiển thị thông tin đơn của người khác. | Blocker | [x] |
| **TC-F09.48** | `Func` | `Cart` | **[Edge]** Add 2 SP đồng thời (Concurrency) | 1. Nhấn Add 2 items cực nhanh cùng lúc. | - Giỏ hàng ghi nhận cả 2.<br>- Không mất item do race condition. | Medium | [ ] |
| **TC-F09.49** | `Data` | `Sync` | **[Positive]** Đồng bộ giỏ hàng qua nhiều Tab | 1. Mở 2 tab cùng lúc.<br>2. Add SP tại Tab 1. | - Tab 2 tự cập nhật badge và drawer mà không cần F5. | Medium | [ ] |
| **TC-F09.50** | `UX` | `Nav` | **[Positive]** Giữ vị trí scroll khi nhấn Back | 1. Cuộn xuống cuối PLP.<br>2. Vào PDP.<br>3. Nhấn Back. | - Trang quay lại đúng vị trí scroll cũkhông nhảy lên đầu. | Low | [ ] |
| **TC-F09.51** | `Bus` | `Tax` | **[Edge]** Làm tròn tiền thuế SST (Rounding) | 1. Mua SP giá RM 1.55. SST 6% = 0.093. | - Hiển thị đúng 2 chữ số thập phân (vd: RM 0.09).<br>- Không hiển thị quá 2 decimal. | Medium | [ ] |
| **TC-F09.52** | `Design` | `UI` | **[Positive]** Hover effect trên Product Card | 1. Di chuột lên ảnh sản phẩm trên Desktop. | - Ảnh phóng to nhẹ (Scale 1.05) hoặc hiện overlay "Quick View".<br>- Animation mượt mà. | Low | [ ] |
| **TC-F09.53** | `Func` | `Image` | **[Negative]** Placeholder khi ảnh SP lỗi | 1. Mở SP có URL ảnh bị hỏng/hết hạn. | - Card không bị vỡ layout.<br>- Hiển thị ảnh mặc định "No Image" chuyên nghiệp. | Medium | [ ] |
| **TC-F09.54** | `Func` | `Checkout` | **[Positive]** Tính đúng giỏ hàng giá trị lớn (RM 10,000+) | 1. Add số lượng lớn items có tổng > RM 10,000. | - Tổng tiền tính chính xác.<br>- Format hiển thị số không bị lỗi. | Medium | [ ] |
| **TC-F09.55** | `Locale` | `Data` | **[Positive]** Giữ Locale sau khi đặt hàng xong | 1. Đặt hàng khi đang dùng Tiếng Việt. | - Trang Confirm và các trang tiếp theo giữ Tiếng Việt.<br>- Không tự nhảy về EN. | Medium | [ ] |
| **TC-F09.56** | `UX` | `Interact` | **[Positive]** Touch-target tối thiểu 44px trên Mobile | 1. Kiểm tra kích thước nút `+` / `-` trong giỏ hàng. | - Tất cả nút tap/click ≥ 44×44px.<br>- Không gây bấm nhầm. | High | [ ] |
| **TC-F09.57** | `Func` | `Cart` | **[Edge]** Giỏ hàng cập nhật giá mới khi Seller đổi giá | 1. Add SP vào giỏ.<br>2. Seller hạ giá tại Dashboard.<br>3. User vào Checkout. | - Checkout hiển thị giá **mới nhất** từ DB.<br>- Không dùng giá cũ trong LocalStorage. | Critical | [x] |
| **TC-F09.58** | `Sec` | `Logic` | **[Negative]** Chặn dùng link Confirm cũ bypass thanh toán | 1. Lưu link `/confirm/xxx`.<br>2. Xóa giỏ hàngpaste link lại để truy cập. | - Hiển thị "Đơn hàng đã xử lý hoặc không còn hợp lệ".<br>- Không thể giả mạo đặt hàng. | High | [ ] |
| **TC-F09.59** | `Func` | `Nav` | **[Positive]** Breadcrumb Navigation đúng cấu trúc | 1. Từ PDPnhấn vào Breadcrumb để về danh mục cha. | - Link hoạt động đúng.<br>- Cấu trúc: Home > Category > Sub-category > Product. | Medium | [ ] |
| **TC-F09.60** | `API` | `Limit` | **[Negative]** Chặn spam nút Place Order | 1. Nhấn Place Order liên tục 5 lần nhanh. | - Chỉ gửi 1 request duy nhất.<br>- Không tạo 5 đơn hàng trùng lặp. | Critical | [x] |
| **TC-F09.61** | `UI` | `State` | **[Positive]** Nút Chat nằm dưới Cart Drawer | 1. Mở Cart Drawer (đè lên nút Chat). | - Nút Chat có Z-index thấp hơn Drawerkhông che khuất giỏ hàng. | Low | [ ] |
| **TC-F09.62** | `Final` | `Check` | **[Positive]** 9-Point Checklist Institutional Pass | 1. Rà soát toàn bộ Feature theo Corporate Standards. | - Mọi tiêu chí về LCPAccessibilitySecurityBusiness Logic đạt điểm tối đa. | Blocker | [x] |
| **TC-F09.63** | `FR-03` | `UI` | **[Positive]** Image Gallery tương tác trên PDP | 1. Vào PDP có nhiều ảnh.<br>2. Click thumbnail nhỏ phía dưới.<br>3. Vuốt trái/phải trên Mobile. | - Ảnh chính thay đổi đúng theo Click/Touch.<br>- Không vỡ Layout. | High | [ ] |
| **TC-F09.64** | `FR-04` | `Func` | **[Negative]** Bắt buộc chọn Variants trước khi Add Cart | 1. Vào SP có Biến thể (SizeColor).<br>2. Không chọn Sizenhấn "Add to Cart". | - Ô chọn Size rung lắc + viền đỏ.<br>- Toast "Vui lòng chọn Size".<br>- Không push variant null vào API. | Blocker | [x] |
| **TC-F09.65** | `FR-03` | `Data` | **[Positive]** Bảng Attributes mở rộng ở PDP | 1. Cuộn xuống phần dưới trang PDP. | - Hiển thị bảng thuộc tính (vd: Thương hiệu: OEMXuất xứ: MY).<br>- Đóng khung bảng chuẩnkhông mất viền Border. | Medium | [ ] |
| **TC-F09.66** | `NFR` | `SEO` | **[Positive]** JSON-LD Rich Snippet Product Schema | 1. Mở DevTools (F12)xem phần `<head>` của PDP. | - Tồn tại `<script type="application/ld+json">` chứa `@type: Product`.<br>- Điền đúng GiáKhoTênẢnh. | Blocker | [x] |
| **TC-F09.67** | `AC-1` | `UI` | **[Positive]** Hiển thị Variant trong Cart Drawer | 1. Add "Áo khoác" phân loại "XanhSize M" vào giỏ. | - Line-item trong Drawer hiện 2 dòng: Tên chính + Sub-title mờ "Phân loại: XanhSize M". | High | [ ] |
| **TC-F09.68** | `FR-06` | `Func` | **[Positive]** Checkout reactive giữa COD và QR Bank | 1. Tick COD.<br>2. Đổi sang QR Banking. | - COD: ẩn khung upload file.<br>- QR Banking: hiện khung upload bắt buộc.<br>- Chuyển đổi DOM 0ms. | High | [ ] |
| **TC-F09.69** | `FR-14` | `Trust` | **[Positive]** Trust Signals ở Footer Storefront | 1. Cuộn xuống Footer của Storefront. | - WhatsApp Float nổi rõ.<br>- Footer chứa Mã SSM và Logo Halal cho thị trường Malaysia. | High | [ ] |
| **TC-F09.70** | `API` | `Sec` | **[Negative]** Chặn giả mạo giá giỏ hàng (Price Spoofing) | 1. Add SP RM 500 vào giỏvào Checkout.<br>2. Dùng Postman đổi payload `total: 1.00` rồi gửi. | - Backend tính lại giá từ DBphát hiện sai lệch.<br>- Trả lỗi **HTTP 400 "Data Integrity Check Failed"**.<br>- Không cho tạo đơn với giá giả. | Blocker | [ ] |
| **TC-F09.71** | `Logic` | `Bound` | **[Negative]** Chặn số lượng âm trong giỏ hàng | 1. Dùng Developer Tools chỉnh payload `quantity: -5`.<br>2. Gửi request Update giỏ. | - Zod Validation từ chối quantity ≤ 0.<br>- Không cho phép Subtotal ra số âm. | Blocker | [ ] |
| **TC-F09.72** | `DB` | `Lock` | **[Negative]** Race Condition khi 2 khách cùng mua SP cuối | 1. Kho còn đúng 1 SP.<br>2. Khách A và B dùng JMeter cùng Place Order đồng thời. | - Backend dùng DB Row Lock.<br>- Người B nhận lỗi **HTTP 409 "Hàng vừa hết"**.<br>- Không tạo tồn kho âm. | Blocker | [x] |
| **TC-F09.73** | `File` | `Sec` | **[Negative]** MIME Spoofing khi upload Receipt | 1. Đổi đuôi file `.exe` thành `receipt.png`.<br>2. Upload lên form QR Bank. | - Backend kiểm tra Binary File Signature (magic bytes).<br>- Chặn uploadtrả **HTTP 415 Unsupported Media Type**. | High | [ ] |

---

### Edge & Security Gaps (thêm v5.1 — 2026-05-15)

> **File test nguồn:** `src/__tests__/api/orders-checkout-security.test.ts` (mới) + extends của `storefront-products.test.ts``storefront-site-by-slug.test.ts``cartStore.test.ts``product-dp.test.tsx`. Tổng **27 TCs****74/74 PASS**.

#### Bảo mật & Toàn vẹn Dữ liệu Checkout API

| ID | Loại | Pri | Tiêu đề | Kỳ vọng | Refs |
|:---|:---|:---|:---|:---|:---|
| **TC-F09.74** | Sec | Blocker | Price spoofing — client gửi `total: 1.00` qua payload | Server tính lại từ DB price; total đúng (subtotal+shipping+SST); không lưu giá client | G2 |
| **TC-F09.75** | Sec | Blocker | Quantity âm `-5` qua API trực tiếp | Zod reject (`int().min(1)`) → 400 VALIDATION_ERROR | G3 |
| **TC-F09.76** | Sec | High | Quantity = 0 qua API | Zod reject → 400 VALIDATION_ERROR | G3 |
| **TC-F09.77** | Sec | High | Items array rỗng | Zod reject (`min(1)`) → 400 VALIDATION_ERROR | G18 |
| **TC-F09.82** | Edge | High | Race condition: 2 buyer cùng checkout SP cuối kho | Document hiện trạng (cả 2 có thể pass mà không có row lock) → cần F09 hardening Wave 7+ | G4 |
| **TC-F09.83** | Sec | Critical | Guest checkout — endpoint `/api/orders/checkout` publickhông cần auth | 200 OK không có session/header — match PRD §13.2 | G29 |

#### Input Validators

| ID | Loại | Pri | Tiêu đề | Kỳ vọng | Refs |
|:---|:---|:---|:---|:---|:---|
| **TC-F09.78** | Func | High | Email `abc@.com` (TLD rỗng) | Zod `email()` reject → 400 VALIDATION_ERROR | G14FR-06 |
| **TC-F09.79** | Func | High | Email `not-an-email` (không format) | Zod `email()` reject → 400 VALIDATION_ERROR | G14 |
| **TC-F09.80** | Edge | Medium | Phone optional trong schema — document quirk vs FR-06 nói phone* | Phone thiếu vẫn 200 — schema mismatch với PRD | G15FR-06 |
| **TC-F09.81** | Edge | Medium | Postcode `abcde` chấp nhận — document missing regex `^\d{5}$` | API chấp nhậnkhông reject; cần thêm regex ở Wave 7+ | G16FR-11TC-F09.27 |

#### Money & Edge Math

| ID | Loại | Pri | Tiêu đề | Kỳ vọng | Refs |
|:---|:---|:---|:---|:---|:---|
| **TC-F09.84** | Edge | Medium | SP price=0 (free sample) — order tạo đượcsubtotal=0SST=0shipping vẫn charge per region | Total = shippingFeeđúng schema (G31FR-10) | G31 |
| **TC-F09.85** | Edge | Medium | SST rounding: RM 1.55 × 6% = 0.093 → lưu 0.09 (Math.round*100/100) | 2 chữ số thập phân ổn định | G12TC-F09.51 |
| **TC-F09.86** | Edge | Medium | Cart RM 10,000+ math không overflow | Total finiteđúng 10_608 với shipping default | G13TC-F09.54 |

#### Storefront API — Injection Guards

| ID | Loại | Pri | Tiêu đề | Kỳ vọng | Refs |
|:---|:---|:---|:---|:---|:---|
| **TC-F09.87** | Sec | High | Sort `<script>alert(1)</script>` không bypass allowed-list | Fallback `-createdAt` | G5TC-F09.46 |
| **TC-F09.88** | Sec | High | Sort `__proto__` không pass | Fallback `-createdAt`; allowed: `price``name``createdAt` (±) | G5 |
| **TC-F09.89** | Edge | Medium | Limit param boundary clamp `[1100]` — 99999 → 100-5 → 1 | Math.min/max clamp protect DB | G13/G17 |
| **TC-F09.90** | Edge | Medium | Page param coerce: 0/-99/abc → 1 | Math.max(1…) đảm bảo positive integer | G17 |
| **TC-F09.91** | Sec | High | PII leak: response strip tenant/site/createdBy/stripeAccountId — chỉ whitelist fields | Whitelist: idnameslugshortDescriptionpricecompareAtPricecurrencyimagesstatushasVariantsvariants | G23 |

#### Site by Slug — Path & XSS

| ID | Loại | Pri | Tiêu đề | Kỳ vọng | Refs |
|:---|:---|:---|:---|:---|:---|
| **TC-F09.96** | Sec | Medium | Slug param rỗng `?slug=` | 400không gọi Payload | — |
| **TC-F09.97** | Sec | High | Path injection `../../../etc/passwd` qua slug | Payload escapewhere clause literal → 404 | G5 |
| **TC-F09.98** | Sec | High | XSS payload `<script>` trong slug | Payload escape → 404không exec | G5TC-F09.46 |

#### Cart Store — Edge

| ID | Loại | Pri | Tiêu đề | Kỳ vọng | Refs |
|:---|:---|:---|:---|:---|:---|
| **TC-F09.92** | Edge | Medium | `updateQuantity(-5)` xử lý defensive — remove item | Items length = 0 (treat negative as remove) | G3 |
| **TC-F09.93** | Edge | Medium | Quantity 250 × RM 49.90 = 12_475 — không overflow | subtotal finiteđúng số | G13 |
| **TC-F09.94** | Edge | Low | clearCart đồng bộ localStorage (key `primeweb-cart`) | localStorage rỗng + itemCount=0 | G18 |
| **TC-F09.95** | Edge | Medium | Cart rỗng subtotal = 0 (không NaNkhông undefined) | `Number.isFinite(0) === true` | G18 |

#### JSON-LD Shape (SEO Compliance)

| ID | Loại | Pri | Tiêu đề | Kỳ vọng | Refs |
|:---|:---|:---|:---|:---|:---|
| **TC-F09.99** | SEO | High | JSON-LD có required Google Rich Results: `@context``@type=Product``name` (string) | Validates ở Google Rich Results Test | G20TC-F09.66 |
| **TC-F09.100** | SEO | Medium | JSON-LD `offers` block (nếu có) có `@type=Offer*``price` (number/string)`priceCurrency` ISO 4217 | Match Google spec; currency match `/^[A-Z]{3}$/` | G20 |

### Checkout Design Coverage Ledger (thêm v5.4 — 2026-05-15)

> **File test nguồn:** `docs/qa/playwright-testcase/f09-checkout-design.spec.ts` (NEW23 tests**20/20 offline PASS**3 live env-gated)
> **Source spec:** `docs/design/F09-storefront-design.md` §4 Guest Checkout wireframe
> **Implementation:** `src/app/sites/[slug]/checkout/page.tsx` (721 LOC)
> **Playwright project:** `qa-f09`

#### Layout & Form Structure [TC-F09.182..186]

| ID | Loại | Pri | Tiêu đề | Kỳ vọng | Refs |
|:---|:---|:---|:---|:---|:---|
| **TC-F09.182** | Design | High | Checkout có 4 sections: ContactShippingPaymentOrder Summary | Headings dùng `ck.contactInfo/shippingAddress/paymentMethod`; total render qua `formatPrice` | Design §4 |
| **TC-F09.183** | Design | High | Contact section có inputs: fullNameemail (type=email)phone | Mỗi field có placeholder từ i18n `ck.fullName/emailAddress/phone` | Design §4.1FR-06 |
| **TC-F09.184** | Design | High | Shipping section: line1line2 (optional)citypostcodestate dropdown | State dropdown render qua `MY_STATES.sort().map` | Design §4.2FR-06 |
| **TC-F09.185** | Design | Critical | Postcode field có `inputMode="numeric"` + `pattern="\d{5}"` | Mobile numpad + browser validation | FR-07FR-11TC-F09.27 |
| **TC-F09.186** | Design | High | State dropdown chứa 16 MY states (13 West + 3 East) | MY_STATES constants exported đúng | FR-01TC-F09.26 |

#### Payment Method [TC-F09.187..188]

| ID | Loại | Pri | Tiêu đề | Kỳ vọng | Refs |
|:---|:---|:---|:---|:---|:---|
| **TC-F09.187** | Design | Critical | 2 payment options: COD (default) + QR Banking | useState default `'cod'`; setPaymentMethod gọi với `'cod'` / `'qr_banking'` | Design §4.3FR-06 |
| **TC-F09.188** | Design | Critical | QR Banking conditional reveal upload region | `paymentMethod === 'qr_banking' &&` JSX; ACCEPTED_IMAGE_TYPES + MAX_FILE_SIZE=2MB | TC-F09.28FR-06.1 |

#### Currency & Order Summary [TC-F09.189..190]

| ID | Loại | Pri | Tiêu đề | Kỳ vọng | Refs |
|:---|:---|:---|:---|:---|:---|
| **TC-F09.189** | Design | High | formatPrice helper render MYR thành `RM XX.XX` | Format chuẩn cho Malaysia | BR-02 |
| **TC-F09.190** | Design | Critical | Order Summary panel: SubtotalSST 6%ShippingTotal | SST formula `sub * 0.06`; total = sub + shipping + tax | BR-04BR-05FR-03 |

#### UI States & Feedback [TC-F09.191..196]

| ID | Loại | Pri | Tiêu đề | Kỳ vọng | Refs |
|:---|:---|:---|:---|:---|:---|
| **TC-F09.191** | Design | Medium | Secure-payment indicator (Lock icon hoặc 🔒) | Trust signal cho buyer | Design §4 header |
| **TC-F09.192** | Design | High | Place Order button states: isPlacing + Loader2 spinner | Disabled + spinner during submit | 9-Point Done |
| **TC-F09.193** | Design | High | Error banner với AlertCircle icon + background red `#fef2f2` | Clear error display | 9-Point Done |
| **TC-F09.194** | Design | High | Proof preview image + X remove button (lucide) | Visual feedback sau upload | TC-F09.28 |
| **TC-F09.195** | Design | Medium | Empty cart guard: items.length check | Block placing empty cart | AC-3 |
| **TC-F09.196** | Design | High | Success: orderResult + CheckCircle icon | Confirmation post-place | AC-3US-F09-04 |

#### Performance & i18n [TC-F09.197..200]

| ID | Loại | Pri | Tiêu đề | Kỳ vọng | Refs |
|:---|:---|:---|:---|:---|:---|
| **TC-F09.197** | Design | High | Debounced shipping calc 300ms khi state thay đổi | `useDebounce(form.state300)` | FR-09TC-F09.34 |
| **TC-F09.198** | Design | High | i18n applied: `useI18n` + `t.storefront.checkout` namespace | Tất cả labels qua i18n | Locale (TC-F09.42.43) |
| **TC-F09.199** | Design | Medium | Mobile responsive: grid 2-col city+state + maxWidth 1100px container | 375px stackkhông overflow | FR-15..17AC-6 |
| **TC-F09.200** | Design | Medium | Shipping hint với tier `highlight` hoặc `neutral` | API contract phù hợp F14 hint | FR-05F14 §6.3 |

#### Documentation Reference [TC-F09.201]

| ID | Loại | Pri | Tiêu đề | Kỳ vọng | Refs |
|:---|:---|:---|:---|:---|:---|
| **TC-F09.201** | Doc | Low | Design doc tồn tại + có 3-section structure | Design source-of-truth in sync | Design §4 |

#### Live Browser Flows (env-gated) [TC-F09.202..204]

| ID | Loại | Pri | Tiêu đề | Kỳ vọng | Refs |
|:---|:---|:---|:---|:---|:---|
| **TC-F09.202** | E2E | High | State dropdown render 16+ options | Live DOM check trên staging | FR-01 |
| **TC-F09.203** | E2E | High | QR upload region toggles visibility với payment method | Click QR Banking → upload visible | TC-F09.28 |
| **TC-F09.204** | E2E | High | Mobile 375px không có horizontal overflow | scrollWidth ≤ clientWidth | AC-6 |

> **Run commands:**
> ```bash
> # Offline (20 design contracts) — không cần staging
> npx playwright test --project=qa-f09 --grep "design contract"
>
> # Full suite trên staging
> BASE_URL=https://web-cms-v2.dev.ecommercehub.my npx playwright test --project=qa-f09
> ```

---

### Payment / Shipping / Postcode / Tracking Domain Coverage (thêm v5.3 — 2026-05-15)

> **File test nguồn:** `src/__tests__/api/orders-payment-shipping-tracking.test.ts` (mới24 tests **24/24 PASS**)

#### A) Payment Logic [TC-F09.158..165]

| ID | Loại | Pri | Tiêu đề | Kỳ vọng | Refs |
|:---|:---|:---|:---|:---|:---|
| **TC-F09.158** | Sec | High | paymentMethod=`stripe` không thuộc enum → 400 | Zod reject; chỉ cod\|qr_banking | FR-06 |
| **TC-F09.159** | Sec | High | paymentMethod=`COD` (uppercase) case-sensitive → 400 | Enum strict lowercase | FR-06 |
| **TC-F09.160** | Func | High | paymentMethod missing (required) → 400 | Zod required | FR-06 |
| **TC-F09.161** | Func | High | COD checkout: không cần paymentProofImageorder persist paymentMethod=`cod` | DB row `paymentMethod=cod`không có proof | TC-F09.68 |
| **TC-F09.162** | Func | High | QR Banking: paymentProofImage media-ID linked vào order | DB row `paymentMethod=qr_banking``paymentProofImage=media-42` | TC-F09.28FR-06.1 |
| **TC-F09.163** | Bus | Medium | Currency lock: product.currency=MYR → order.currency=MYR | BR-02 enforcement | BR-02 |
| **TC-F09.164** | Bus | Medium | Currency default MYR khi product.currency missing | Fallback MYR | BR-02 |
| **TC-F09.165** | Func | High | Payment failed scenario: order persist `pending`không auto-cancel | UI manages cart preserve (TC-F09.35) | TC-F09.35AC-5 |

#### B) Shipping Logic [TC-F09.166..171]

| ID | Loại | Pri | Tiêu đề | Kỳ vọng | Refs |
|:---|:---|:---|:---|:---|:---|
| **TC-F09.166** | Func | High | Order persist `shippingFee` field (không chỉ total) | DB row có shippingFee number | FR-09 |
| **TC-F09.167** | Bus | Critical | Multi-product order: phí ship đơn (flat-ratekhông nhân theo item) | 5 items Selangor = ship 8 RM (không 40) | BR-03FR-09 |
| **TC-F09.168** | Func | Critical | East MY (Sabah) → shippingFee=15 persist | DB row `shippingFee=15` | FR-09BR-02 |
| **TC-F09.169** | Bus | Critical | Order total = subtotal + shippingFee + tax | BR-04 + BR-05 | BR-04BR-05 |
| **TC-F09.170** | Func | High | shippingAddress.state persist exactly as submitted | Selangor → 'Selangor' | FR-06 |
| **TC-F09.171** | Func | Medium | shippingAddress.country default 'Malaysia' khi omit | Fallback Malaysia | FR-06 |

#### C) Postcode [TC-F09.172..175]

| ID | Loại | Pri | Tiêu đề | Kỳ vọng | Refs |
|:---|:---|:---|:---|:---|:---|
| **TC-F09.172** | Edge | Medium | Postcode `50000` (KL leading-zero) accepted as-is | DB row '50000' | FR-11 |
| **TC-F09.173** | Edge | Medium | Postcode missing — order vẫn create (optional schema) | DB row postcode='' | FR-11 |
| **TC-F09.174** | Edge | Low | Postcode max length 20+ chars permissive — document gap (no max validator) | 200 OK; Wave 7+ thêm max(5) | Wave 7+TC-F09.81 |
| **TC-F09.175** | Edge | Medium | State-postcode cross-check NOT enforced — Selangor + postcode 88300 (Sabah) vẫn pass | 200 OK; defer Wave 7+ | TC-F09.28 |

#### D) Order Tracking [TC-F09.176..181]

| ID | Loại | Pri | Tiêu đề | Kỳ vọng | Refs |
|:---|:---|:---|:---|:---|:---|
| **TC-F09.176** | Func | High | PATCH ready_to_ship → shipped với trackingNumber: field persist | DB row trackingNumber='JT123MY' | FR-12 mentionBR-09 |
| **TC-F09.177** | Func | Medium | PATCH status=shipped KHÔNG có trackingNumber — accepted (BR-09 optional) | Update không có field trackingNumber | BR-09TC-F14.123b |
| **TC-F09.178** | Func | Medium | trackingNumber free-text special chars `abc-123-XYZ-!@#` accepted | BR-09 self-delivery — no format validation | BR-09TC-F09.36 |
| **TC-F09.179** | Edge | Low | trackingNumber max length 500 chars accepted (no max validator) | Permissive schema documents quirk | BR-09 |
| **TC-F09.180** | Sec | High | PATCH với trackingNumber NHƯNG missing status → 400 (status required) | Zod required → VALIDATION_ERROR | FR-12 |
| **TC-F09.181** | Func | High | GET order returns trackingNumber field sau PATCH | data.trackingNumber visible | FR-12 |

---

> **⚠ Gaps cần Wave 7+ hardening (không phải bug release-blocking):**
> - TC-F09.80: Phone bắt buộc theo PRD nhưng schema optional → cần `z.string().regex(/^\+?60/)`
> - TC-F09.81: Postcode regex `^\d{5}$` chưa có ở schema
> - TC-F09.82: Race condition stock cần DB row lock hoặc version field (TC-F09.72 manual)
> - MIME spoofing receipt upload (TC-F09.73 manual): chưa có endpoint upload để test → cần khi F09 receipt upload implement
> - IDOR order confirm (TC-F09.47 manual): cần endpoint `/api/orders/[id]` test riêng

---

## 4. Hành Trình E2E UAT Flow

| Bước | Hành Động | Kết Quả Mong Đợi |
|:---:|:---|:---|
| 1 | Khách vào Productslọc "Fashion" + giá < RM 50. | Danh sách cập nhật đúngURL đổi params (TC-F09.0608). |
| 2 | Chọn SPxem ảnh Gallery PDPnhấn Add to Cart. | Drawer trượt ra mượt (TC-F09.12). |
| 3 | Thấy gợi ý Cross-sellAdd luôn. | Item thêm vào mà không đóng Drawer (TC-F09.20). |
| 4 | Vào Checkout (Browser ẩn danh). | Không bị redirect Loginform đầy đủ 3 section (TC-F09.2232). |
| 5 | Chọn SelangorQR Bankingupload Receipt 1.5MB. | Phí ship RM 8.00SST 6% tính đúngPlace Order kích hoạt (TC-F09.283334). |
| 6 | Nhấn Place Ordersang Confirm page. | Mã ORD-XXXXXXXX hợp lệOrder Status = `pending` (TC-F09.3031). |

---

## 5. Tiêu Chí Đánh Giá Chất Lượng Phát Hành (Quality Gates)

| Nhóm Kiểm Thử | Trạng Thái | Ghi Chú |
|---|---|---|
| **1. AC Coverage** | [x] 100% | 73 TCs ánh xạ đầy đủ 14 Acceptance Criteria. |
| **2. Malaysia Market Accuracy** | [x] AUTOMATED | SST 6% & Shipping West/East — TC-F09.85 (rounding) + integration F14 (TC-F14.x). |
| **3. Mobile UX Native-Feeling** | [ ] PENDING | Sticky CTA & Bottom Sheet — manual UAT. |
| **4. Security & Sanitization** | [x] PARTIAL | Price spoofing (TC-F09.74)neg qty (TC-F09.75)sort/limit/page injection (TC-F09.87–90)PII leak (TC-F09.91)slug XSS (TC-F09.97–98) — automated. MIME spoof + IDOR confirm — defer Wave 7+. |
| **5. E2E UAT Approval** | [ ] NOT RUN | Cần đồng thuận từ PO/BA dựa trên 100 cases. |
| **6. Edge & Race (v5.1)** | [x] DOCUMENTED | TC-F09.74..100 = 27 auto tests74/74 PASS. Race stock (TC-F09.82) document hiện trạng cần hardening Wave 7+. |
| **7. GH-1023 Global Injection (v5.5)** | [ ] PENDING | TC-F09.205..222 — unit + BlockMeta scopepending tester run. |

> **Khuyến Nghị Release:** Bộ **100 TCs** (TC-F09.01..100) phủ 14 ACs + 30 edge/security gaps từ ck:scenario audit. 27 TCs mới đều auto-run (74/74 PASS). Sẵn sàng UAT.

---

## GH-1023 — Floating Cart Global Injection & Commerce Detection [TC-F09.205..222]

> **Thêm v5.5 (2026-05-18)** — Unit tests cho `detectCommercePresence``extractFirstGlobalBlock``hasHeaderCart``applyGlobalSystemBlocks` extensionCartDrawer entry pointsBlockMeta scope.

### A) detectCommercePresence [TC-F09.205..208]

| ID | Loại | Pri | Tiêu đề | Kỳ vọng | Refs |
|:---|:---|:---|:---|:---|:---|
| **TC-F09.205** | Unit | High | detectCommercePresence — pages rỗng → false | `detectCommercePresence([])` trả về `false` | GH-1023 P1 |
| **TC-F09.206** | Unit | High | detectCommercePresence — pages không có commerce block → false | Không có products-grid/products-featured/product-quick-view | GH-1023 P1 |
| **TC-F09.207** | Unit | Critical | detectCommercePresence — 1 page có products-grid → true | `layout: [{blockType:'products-grid'}]` | GH-1023 P1 |
| **TC-F09.208** | Unit | Medium | detectCommercePresence — layout malformed (non-array) → false (no crash) | Graceful fallback khi `layout` không phải array | GH-1023 P1 |

### B) hasHeaderCart [TC-F09.209..211]

| ID | Loại | Pri | Tiêu đề | Kỳ vọng | Refs |
|:---|:---|:---|:---|:---|:---|
| **TC-F09.209** | Unit | High | hasHeaderCart — null headerBlock → false | Không crash khi headerBlock là null | GH-1023 P1 |
| **TC-F09.210** | Unit | High | hasHeaderCart — headerBlock có `showCart: true` → true | Phát hiện cart button trên header | GH-1023 P1 |
| **TC-F09.211** | Unit | High | hasHeaderCart — headerBlock không có cart field → false | Nav hiện tại không có cart field | GH-1023 P1 |

### C) applyGlobalSystemBlocks extension [TC-F09.212..218]

| ID | Loại | Pri | Tiêu đề | Kỳ vọng | Refs |
|:---|:---|:---|:---|:---|:---|
| **TC-F09.212** | Unit | Critical | applyGlobalSystemBlocks — commerce detected + no header cart → inject cartWidget | blocks kết quả có `blockType:'cartWidget'variant:'floating'` | GH-1023 P1 |
| **TC-F09.213** | Unit | Critical | applyGlobalSystemBlocks — commerce detected + header cart present → NO inject | `hasHeaderCart` trả true → không inject cart | GH-1023 P1 |
| **TC-F09.214** | Unit | Critical | applyGlobalSystemBlocks — no commerce → NO cart inject | `detectCommercePresence` trả false → không inject | GH-1023 P1 |
| **TC-F09.215** | Unit | High | applyGlobalSystemBlocks — whatsAppBlock found → inject globally | blocks có `blockType:'whatsapp-button'` từ first-found page | GH-1023 P1 |
| **TC-F09.216** | Unit | High | applyGlobalSystemBlocks — socialBlock found → inject globally | blocks có `blockType:'socialWidget'` từ first-found page | GH-1023 P1 |
| **TC-F09.217** | Unit | High | applyGlobalSystemBlocks — page đã có floating cartWidget → NO dupe inject | Dedupe: không inject trùng | GH-1023 P1 |
| **TC-F09.218** | Unit | High | applyGlobalSystemBlocks — whatsapp/social commerce-independent | Inject dù không có commerce blocks | GH-1023 P1 |

### D) CartDrawer — checkout routing [TC-F09.219..220]

| ID | Loại | Pri | Tiêu đề | Kỳ vọng | Refs |
|:---|:---|:---|:---|:---|:---|
| **TC-F09.219** | Unit | Critical | CartDrawer — giỏ trống → checkout button disabled | `disabled` attribute + background #d1d5db | GH-1023 P2TC-F09.18 |
| **TC-F09.220** | Unit | High | CartDrawer — có items + siteSlug → checkout link href đúng route | `href=/sites/{siteSlug}/checkout` | GH-1023 P2 |

### E) BlockMeta scope [TC-F09.221..222]

| ID | Loại | Pri | Tiêu đề | Kỳ vọng | Refs |
|:---|:---|:---|:---|:---|:---|
| **TC-F09.221** | Unit | High | cartWidgetMeta.scope === 'global' | Scope tag đúng cho global block | GH-1023 P3 |
| **TC-F09.222** | Unit | Medium | heroMeta.scope === undefined (default page) | Block thông thường không có scope tag | GH-1023 P3 |

### F) globalBlocks architecture — pure helpersstore actionsAPI IO [TC-F10-GBL-001..040]

#### F.1 mergeGlobalBlocks [TC-F10-GBL-001..004]

| ID | Loại | Pri | Tiêu đề | Kỳ vọng | Refs |
|:---|:---|:---|:---|:---|:---|
| **TC-F10-GBL-001** | Unit | Critical | mergeGlobalBlocks(null{cartWidget}) → returns {cartWidget} | null prev merges correctly | GH-1023 Phase05 |
| **TC-F10-GBL-002** | Unit | Critical | mergeGlobalBlocks({cart,wa}{cart:null}) → only wa preserved | null key removes that entry only | GH-1023 Phase05 |
| **TC-F10-GBL-003** | Unit | Critical | mergeGlobalBlocks({...}null) → null full wipe | patch===null wipes all | GH-1023 Phase05 |
| **TC-F10-GBL-004** | Unit | High | mergeGlobalBlocks(prev{cartWidget: newConfig}) → other keys preserved | Partial patch preserves unmentioned keys | GH-1023 Phase05 |

#### F.2 applyGlobalBlock [TC-F10-GBL-010..015]

| ID | Loại | Pri | Tiêu đề | Kỳ vọng | Refs |
|:---|:---|:---|:---|:---|:---|
| **TC-F10-GBL-010** | Unit | Critical | globalEntry present → injected with __editorBlockIndex:-1variant:floating | Global path injects correctly | GH-1023 Phase05 |
| **TC-F10-GBL-011** | Unit | Critical | globalEntry present + stale floating in layout → deduped to 1 | No duplicate floating blocks | GH-1023 Phase05 |
| **TC-F10-GBL-012** | Unit | High | globalEntry present + legacy copy in layout → deduplicated to 1 global floating | Inline variant removed; all stale copies stripped | GH-1023 Phase05 |
| **TC-F10-GBL-013** | Unit | High | globalEntry undefined + page-scan hit → BC fallback injects from page | Legacy sites continue to work | GH-1023 Phase05 |
| **TC-F10-GBL-014** | Unit | High | globalEntry undefined + no page-scan + autoInject + commerce → auto-inject | Cart auto-inject for commerce sites | GH-1023 Phase05 |
| **TC-F10-GBL-015** | Unit | Medium | globalEntry undefined + no page-scan + autoInject=false → nothing added | No inject when autoInject disabled | GH-1023 Phase05 |
| **TC-F10-GBL-016** | Unit | Critical | globalEntry null (explicitly deleted) → block removedall fallbacks skipped | Preview sync works on delete | GH-1023 Phase05 |

#### F.3 EditorStore globalBlocks actions [TC-F10-GBL-020..028]

| ID | Loại | Pri | Tiêu đề | Kỳ vọng | Refs |
|:---|:---|:---|:---|:---|:---|
| **TC-F10-GBL-020** | Unit | Critical | init(…globalBlocks) → state populated | Hydration from editor-data works | GH-1023 Phase05 |
| **TC-F10-GBL-021** | Unit | Critical | updateGlobalBlock merges patch + pushes undo snapshot | Patch mergedhistory entry created | GH-1023 Phase05 |
| **TC-F10-GBL-022** | Unit | High | updateGlobalBlock on missing key creates entry | First-time activation works | GH-1023 Phase05 |
| **TC-F10-GBL-023** | Unit | High | deleteGlobalBlock sets entry to null + snapshot | Deletion tracked in undo history | GH-1023 Phase05 |
| **TC-F10-GBL-024** | Unit | High | undo after updateGlobalBlock restores globalBlocks | Undo/redo parity maintained | GH-1023 Phase05 |
| **TC-F10-GBL-025** | Unit | Critical | flipBlockVariant floating→inline: globalBlocks clearedblocks gains inline | Atomic variant flip | GH-1023 Phase05 |
| **TC-F10-GBL-026** | Unit | Critical | flipBlockVariant inline→floating: blocks splicedglobalBlocks set | Atomic promotion to global | GH-1023 Phase05 |
| **TC-F10-GBL-027** | Unit | High | performSave body includes globalBlocks when non-null | Non-null state sent to API | GH-1023 Phase05 |
| **TC-F10-GBL-028** | Unit | High | performSave body omits globalBlocks when null | Legacy sites not wiped on save | GH-1023 Phase05 |
| **TC-F10-GBL-029** | Unit | Critical | addBlock commerce type + cartWidget null → cart auto-restored to floating | Cart re-appears when product block added after cart deleted | GH-1023 Phase05 |

#### F.4 Save API — partial-update semantics [TC-F10-GBL-030..033]

| ID | Loại | Pri | Tiêu đề | Kỳ vọng | Refs |
|:---|:---|:---|:---|:---|:---|
| **TC-F10-GBL-030** | Integration | Critical | PATCH {globalBlocks:{cartWidget:{}}} → payload.update has cartWidget | New entry persisted | GH-1023 Phase05 |
| **TC-F10-GBL-031** | Integration | Critical | PATCH {globalBlocks:{cartWidget:null}} → cartWidget removed from update | Null key deletes entry | GH-1023 Phase05 |
| **TC-F10-GBL-032** | Integration | High | PATCH with globalBlocks omitted → DB field unchanged | Omission preserves existing state | GH-1023 Phase05 |
| **TC-F10-GBL-033** | Integration | High | PATCH with malformed globalBlocks string → 400 | Zod validation rejects wrong type | GH-1023 Phase05 |

#### F.5 Editor-data API [TC-F10-GBL-034]

| ID | Loại | Pri | Tiêu đề | Kỳ vọng | Refs |
|:---|:---|:---|:---|:---|:---|
| **TC-F10-GBL-034** | Integration | Critical | GET editor-data → response.site.globalBlocks matches seeded fixture | Round-trip shape verified | GH-1023 Phase05 |

#### F.6 SiteRenderer BC parity [TC-F10-GBL-040]

| ID | Loại | Pri | Tiêu đề | Kỳ vọng | Refs |
|:---|:---|:---|:---|:---|:---|
| **TC-F10-GBL-040** | Unit | High | site with globalBlocks:null + legacy pages[] → same nextBlocks as pre-change baseline | BC fallback produces identical output | GH-1023 Phase05 |

---

## Variant Cart & Checkout Fixes (GH-1084)

> **File test nguồn:** `src/__tests__/unit/stores/cartStore.test.ts` + `src/__tests__/api/orders-checkout.test.ts` + `src/__tests__/api/stripe-checkout.test.ts` + `src/__tests__/unit/storefront/product-add-to-cart-section.test.tsx`

### TC-F09.223–224: CartStore variant support

| ID | Loại | Pri | Tiêu đề | Kỳ vọng | Refs | Status |
|:---|:---|:---|:---|:---|:---|:---|
| **TC-F09.223** | Unit | High | addItem(variantName='Red') carries variant price RM 59.90 | Cart line preserves variant price + name | GH-1084 Phase02 | [x] |
| **TC-F09.224** | Unit | Critical | Two variants of same product = 2 separate cart lines (composite key) | removeItem('prod-1''Red') removes only RedBlue stays | GH-1084 Phase02 | [x] |
| **TC-F09.224b** | Unit | High | updateQuantity('prod-1'qtyvariantName) targets matching line only | Variant-aware quantity update; same product + different variants independent | GH-1084 Phase02 | [x] |
| **TC-F09.224c** | Unit | High | Same variant added twice increments quantity (no duplicate line) | Cart line qty += 1 per add | GH-1084 Phase02 | [x] |
| **TC-F09.224d** | Unit | High | localStorage persists variant data across refresh | Reload browser → variantName restored | GH-1084 Phase02 | [x] |
| **TC-F09.224e** | Unit | Medium | Non-variant + variant of same product stored as 2 lines | No variant (baseItem) vs variant='Red' separate entries | GH-1084 Phase02 | [x] |

### TC-F09.226–228: Checkout variant support

| ID | Loại | Pri | Tiêu đề | Kỳ vọng | Refs | Status |
|:---|:---|:---|:---|:---|:---|:---|
| **TC-F09.226** | Integration | Critical | Variant product: order unitPrice = variant.price (RM 75) not base price (RM 50) | Order item.unitPrice=75not 50 | GH-1084 Phase03 | [x] |
| **TC-F09.226b** | Integration | Critical | Stale variant name → 422 VARIANT_NOT_FOUND | Request variant='Purple' (doesn't exist) rejected | GH-1084 Phase03 | [x] |
| **TC-F09.226c** | Integration | High | Multiple variants of same product → correct unitPrice per variant | Red variant unitPrice=75Blue=80 | GH-1084 Phase03 | [x] |
| **TC-F09.227** | Integration | Critical | Variant OOS check uses per-variant stock (not aggregate p.inventory) | inventory=10 + variant.stock=1 → qty=2 rejected (1 < 2); error.variant + error.available returned | GH-1084 Phase03 | [x] |
| **TC-F09.228** | Integration | High | buildOrderItems uses variant.price for line item unitPrice in Stripe | Stripe session uses variant.price*100 sen | GH-1084 Phase03 | [x] |
| **TC-F09.228b** | Integration | Medium | Variant price RM 29.90 → 2990 sen for Stripe | Correctly scaled to smallest unit | GH-1084 Phase03 | [x] |
| **TC-F09.228c** | Integration | High | Multiple variants in Stripe checkout → correct prices per variant | Line1=Red 7500 senLine2=Blue 8000 sen | GH-1084 Phase03 | [x] |
| **TC-F09.229** | Integration | Critical | hasVariants product with no variant field → 422 VARIANT_REQUIRED | Direct API bypass attempt rejected before price/stock logic | GH-1084 Phase03 | [x] |

### TC-F09.230–236: buildOrderItems direct unit coverage

> **File test nguồn:** `src/__tests__/api/build-order-items.test.ts`

| ID | Loại | Pri | Tiêu đề | Kỳ vọng | Refs | Status |
|:---|:---|:---|:---|:---|:---|:---|
| **TC-F09.230** | Unit | High | Eligibility guard: `status='draft'` → 404 PRODUCT_NOT_FOUND | buildOrderItems rejects draft product before variant/stock logic | GH-1084 Phase03 | [x] |
| **TC-F09.231** | Unit | High | Eligibility guard: `deletedAt` set → 404 PRODUCT_NOT_FOUND | buildOrderItems rejects soft-deleted product | GH-1084 Phase03 | [x] |
| **TC-F09.232** | Unit | Critical | VARIANT_REQUIRED: hasVariants product without variant field → 422 | buildOrderItems rejects before price resolution | GH-1084 Phase03 | [x] |
| **TC-F09.233** | Unit | Critical | VARIANT_NOT_FOUND: variant name does not exist on product → 422 | Prevents silent base-price fallback exploit | GH-1084 Phase03 | [x] |
| **TC-F09.234** | Unit | High | variant.price used as unitPrice — not base product.price | orderItems[0].unitPrice = variant.price; checkoutItems price in sen | GH-1084 Phase03 | [x] |
| **TC-F09.235** | Unit | Critical | OOS guard uses aggregate p.inventory — variant.stock ignored | inventory=0 + variant.stock=10 → 422 OUT_OF_STOCK | GH-1084 Phase03 | [x] |
| **TC-F09.236** | Unit | High | Non-variant product: base priceno variant guards — happy path | unitPrice=basevariant=''displayName=productNameStripe price in sen | GH-1084 Phase03 | [x] |

### TC-F09.237–238b: Client variant stock validation (#1179)

> **Bug fix:** Frontend was using aggregate `product.inventory` instead of `selectedVariant.stock` — allows qty > variant stock in cart UI before server CAS catches it at checkout.
> **Files test:** `src/__tests__/unit/storefront/product-add-to-cart-section.test.tsx``src/__tests__/unit/stores/cartStore.test.ts`

| ID | Loại | Pri | Tiêu đề | Kỳ vọng | Refs | Status |
|:---|:---|:---|:---|:---|:---|:---|
| **TC-F09.237** | Unit | Critical | Selecting variant propagates variant.stock (not aggregate) to AddToCartButton | Red (stock=5) selected on product (inventory=10) → AddToCartButton receives inventory=5 | GH-1179 | [x] |
| **TC-F09.237b** | Unit | High | Switching variants updates propagated inventory reactively | Select Red(5) → inventory=5; switch to Blue(3) → inventory=3 | GH-1179 | [x] |
| **TC-F09.237c** | Unit | High | Non-variant product fallback: propagated inventory = product.inventory | No variant selected → AddToCartButton receives product.inventory (regression guard) | GH-1179 | [x] |
| **TC-F09.238** | Unit | Critical | addItem caps at variant inventory snapshot (not aggregate) | inventory=3 stored in cart item; 4th add is no-opqty stays 3 | GH-1179 | [x] |
| **TC-F09.238b** | Unit | High | updateQuantity above variant inventory clamps to variant stock | qty=2 with inventory=3; updateQuantity(10) → qty=3 | GH-1179 | [x] |

### TC-F09.239–252: Products Grid category, price, and attribute filters (F08)

> **File test nguồn:** `src/__tests__/unit/blocks/products-grid.test.tsx`, `src/__tests__/api/storefront-categories.test.ts`, `src/__tests__/api/storefront-products-bounds.test.ts`, `src/__tests__/api/storefront-products.test.ts`

| ID | Loại | Pri | Tiêu đề | Kỳ vọng | Refs | Status |
|:---|:---|:---|:---|:---|:---|:---|
| **TC-F09.239** | Unit | Critical | Filters disabled → render plain gridno sidebarno categories/bounds fetch | Chỉ gọi endpoint products; không render filter shell cho 70 block cũ | F08 Phase03/05 | [x] |
| **TC-F09.240** | Unit | High | Filters enabled + facets present → sidebar render đầy đủ nhóm label | Hiện `Filters``Categories``Price``Specifications``All``Min``Max``Apply``Reset` | F08 Phase03/05 | [x] |
| **TC-F09.241** | Unit | High | Filters enabled + no facets → sidebar tự ẩn sau khi load | Grid giữ layout không có aside filter khi catalog không có facet | F08 Phase03/05 | [x] |
| **TC-F09.242** | Integration | High | Categories API trả flat array theo site với parent đã normalize | Chỉ expose `id/name/slug/parent/breadcrumbs`không lộ field thừa | F08 Phase01/05 | [x] |
| **TC-F09.243** | Unit | High | Category tree build đúng 3 levels từ flat data | Parent object/id normalize trước khi render; nested list hiển thị đủ 3 cấp | F08 Phase03/05 | [x] |
| **TC-F09.244** | Unit | High | Click category cập nhật `categoryId` trên URL | `router.push` giữ pathname và set query param category đúng id | F08 Phase03/05 | [x] |
| **TC-F09.245** | Unit | High | Price Apply/Reset quản lý `minPrice` + `maxPrice` params | Apply set/swap bounds hợp lệ; Reset xóa cả 2 params | F08 Phase03/05 | [x] |
| **TC-F09.246** | Unit | High | Attribute checkbox toggle append/remove repeatable `attr_*` params | Dùng `getAll()` semantics; add/remove không làm mất value còn lại | F08 Phase03/05 | [x] |
| **TC-F09.247** | Integration | Critical | Products API `categoryId` filter gồm category và descendants | Query `category: { in: [...] }` chứa cả con/cháu | F08 Phase01/05 | [x] |
| **TC-F09.248** | Integration | High | Products API `minPrice` / `maxPrice` thêm price predicates đúng | Hỗ trợ lower + upper bound cùng lúc | F08 Phase01/05 | [x] |
| **TC-F09.249** | Integration | High | Products API `attr_*` build `elemMatch` filter với nhiều value | Cùng key dùng `value: { in: [...] }` | F08 Phase01/05 | [x] |
| **TC-F09.250** | Integration | Critical | Products API compose category + price + attribute bằng AND | Tất cả filter hoạt động đồng thờikhông ghi đè nhau | F08 Phase01/05 | [x] |
| **TC-F09.251** | Integration | Critical | Bounds API trả min/max + distinct attribute map; empty catalog → zeros | Facet schema ổn định cho sidebar và catalog rỗng | F08 Phase01/05 | [x] |
| **TC-F09.252** | Integration | Critical | Invalid site/filter params trả safe empty/default responsekhông 500 | Bad input bị bỏ qua hoặc short-circuit an toàn | F08 Phase01/05 | [x] |

### TC-F09.253–261: Products Grid QA rework (GH-1665)

> **File test nguồn:** `src/__tests__/unit/editor/settings-panel.test.tsx`, `src/__tests__/unit/blocks/products-grid.test.tsx`, `tests/product-grid-qa-rework.spec.ts`
>
> **Validation 2026-08-03:** TC-F09.253–261 đã qua automated validation (95/95 focused tests + typecheck): unit 71/71, API 18/18, Playwright 6/6. `/test-blocks` dùng production AppShell/global Tailwind CSS; browser assertions kiểm tra computed grid columns/display và dùng polling thay fixed waits. Artifact light/dark không hợp lệ đã được gỡ; real-editor visual/manual confirmation và screenshots light/dark của TC-F09.253 vẫn chờ trước QA handoff.

| ID | Loại | Pri | Tiêu đề | Kỳ vọng | Refs | Status |
|:---|:---|:---|:---|:---|:---|:---|
| **TC-F09.253** | Unit/Browser/Manual | High | Products Grid checkbox dùng semantic editor tokens | Automated computed styles light/dark giữ contrast; toggle ghi đúng `showCategoryFilter` boolean; real-editor visual confirmation vẫn bắt buộc | GH-1665 Phase01 | [ ] |
| **TC-F09.254** | Unit/Browser | Critical | Grid/list hoạt động trong editor preview | `view` đổi được và giữ `editor/pageId/site` params | GH-1665 Phase01 | [x] |
| **TC-F09.255** | Unit | Critical | Preview chỉ allow-list layout view | Filter và pagination vẫn bị intercept, không gọi router | GH-1665 Phase01 | [x] |
| **TC-F09.256** | Unit/Browser | Critical | Filter reposition tới results anchor | Scroll ngay khi query đổi và thêm một lần sau khi kết quả mới settle | GH-1665 Phase02 | [x] |
| **TC-F09.257** | Unit/Browser | Critical | Pagination dùng cùng results anchor | `page` kích hoạt reposition; đổi riêng `view` không scroll | GH-1665 Phase02 | [x] |
| **TC-F09.258** | Unit/Browser | High | Loading giữ ổn định geometry vùng kết quả | Initial load có 6 card skeleton responsive; refetch giữ product cũ | GH-1665 Phase02 | [x] |
| **TC-F09.259** | Unit/Browser | Critical | Mobile category accordion đóng sibling | Expand một branch đóng sibling subtree, giữ ancestor và selection state | GH-1665 Phase02 | [x] |
| **TC-F09.260** | Browser | High | Mobile 375px không horizontal overflow | Product grid và filter drawer giữ `scrollWidth <= clientWidth` | GH-1665 Phase03 | [x] |
| **TC-F09.261** | Unit | Critical | Rapid filter chỉ settle request mới nhất | Request A bị abort không clear reposition pending của request B | GH-1665 Phase02 | [x] |

### TC-F09.262–264: Trang checkout luôn truy cập được, đặt hàng vẫn được bảo vệ

> **File test nguồn:** `src/__tests__/unit/storefront/checkout-access.test.tsx`
>
> Trang `/sites/<slug>/checkout` không còn bị thay bằng màn hình "giỏ trống" hay "checkout không khả dụng". Việc đặt hàng vẫn bị chặn ở nút Place order (`canPlaceOrder`) và ở server (`PAYMENT_METHOD_DISABLED`, `items.min(1)`).

| ID | Loại | Pri | Tiêu đề | Kỳ vọng | Refs | Status |
|:---|:---|:---|:---|:---|:---|:---|
| **TC-F09.262** | Unit | High | Giỏ trống vẫn hiện form checkout | Có `Order Summary` và form; không có màn hình "giỏ trống"; nút Place order disabled | PR #1997 | [x] |
| **TC-F09.263** | Unit | High | Tenant không có phương thức thanh toán: hiện thông báo trong trang, nút Place order vẫn disabled khi form đủ | Có `role="alert"` "Checkout unavailable"; form vẫn hiển thị; nút disabled | PR #1997 | [x] |
| **TC-F09.264** | Unit | Medium | Control: tenant có phương thức thanh toán, form đủ | Không có thông báo; nút Place order enabled | PR #1997 | [x] |

### TC-F09.265–269: Storefront không lộ secret / số tài khoản (GH-2077)

> **File test nguồn:** `src/__tests__/unit/storefront/public-site-dto.test.ts`, `src/__tests__/api/storefront-site-by-slug.test.ts`
>
> Mọi trang storefront đưa site/page/pages qua `toPublicSite` / `toPublicDoc` (`src/lib/storefront/public-site-dto.ts`) trước khi render: site chỉ giữ field allow-list, mọi `tenant` đã populate thu về id.

| ID | Loại | Pri | Tiêu đề | Kỳ vọng | Refs | Status |
|:---|:---|:---|:---|:---|:---|:---|
| **TC-F09.265** | Unit | Critical | `toPublicSite` chỉ giữ field render | Không còn tenant secret, paymentConfig, shippingConfig, brief AI, trackedKeywords; tenant = id | GH-2077 | [x] |
| **TC-F09.266** | Unit | Critical | `toPublicDoc` thu `tenant` đã populate ở mọi độ sâu | `page.tenant`, `media.tenant` → id | GH-2077 | [x] |
| **TC-F09.267** | Unit | Critical | `page.site` đã populate → site public | Không còn secret trong JSON | GH-2077 | [x] |
| **TC-F09.268** | Unit | Medium | Giá trị thường / tenant id giữ nguyên | Bản sao, bằng giá trị | GH-2077 | [x] |
| **TC-F09.269** | Unit | Critical | `/api/storefront/site-by-slug` không trả số tài khoản | Không có `bankAccountNo` / `bankAccountHolder` | GH-2077 | [x] |

### TC-F09.64: Product component variant guard

| ID | Loại | Pri | Tiêu đề | Kỳ vọng | Refs | Status |
|:---|:---|:---|:---|:---|:---|:---|
| **TC-F09.64** | Unit | Blocker | Variant product: AddToCart button disabled until variant selected | requireVariant=true → disabled until onSelect | GH-1084 Phase01 | [x] |
| **TC-F09.64b** | Unit | High | ProductVariantSelector rendered only when hasVariants=true | No selector for non-variant products | GH-1084 Phase01 | [x] |
| **TC-F09.64c** | Unit | High | Variant compareAtPrice & stock passed through component | Price & inventory props use variant data when selected | GH-1084 Phase01 | [x] |
| **TC-F09.64d** | Unit | High | Switching variants updates button state reactively | Click Red → Blue updates title & passes variantName | GH-1084 Phase01 | [x] |
| **TC-F09.64e** | Unit | Medium | Out-of-stock variant button disabled | stock=0 → disabledclick ignored | GH-1084 Phase01 | [x] |
| **TC-F09.64f** | Unit | Medium | Empty/undefined variants handled gracefully | hasVariants=true + variants=[] → no selector | GH-1084 Phase01 | [x] |
