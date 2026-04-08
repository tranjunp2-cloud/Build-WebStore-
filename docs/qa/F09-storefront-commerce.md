# Quyết Định Kiểm Thử & Kiểm Thử Chi Tiết: F09 - Storefront Commerce
> **Phiên bản:** 5.0 | **Cập nhật:** 2026-04-06 | **Thực hiện:** QA Team
> **Nguồn Tham chiếu:** PRD (`F09-storefront-commerce.md`), User Stories (14 Core ACs), Figma (Node 30905:1342)
> **Kỹ năng ứng dụng (.agent):** BDD (Gherkin), Malaysia Market Context (SST/MY Shipping), Mobile Native UX, Security QR Proof Validation.

---

## 1. Mục Tiêu (Objective)

Cung cấp ma trận kiểm thử **triệt để** cho Storefront Commerce (F09). Đạt độ phủ **100% cho 5 User Stories (14 ACs)**, bao quát Happy Path, Edge Cases, Negative và các quy tắc đặc thù thị trường Malaysia.

**Tổng cộng 73 kịch bản chi tiết**, đảm bảo hệ thống vận hành bền bỉ, an toàn và mang lại trải nghiệm mua sắm mượt mà nhất.

---

## 2. Test Environment

| Biến | Yêu cầu |
|---|---|
| Môi trường | Staging / Pre-Production |
| Browsers | Chrome (v110+), Safari (Latest), Firefox |
| Devices | Desktop (1920x1080), Mobile (iPhone 14 Pro, Samsung S22) |
| Test Data | Malaysia Locales, SST Tax Rules, MY Postcodes, QR Sample Receipt |

---

## 3. Unified Test Cases (Traceability Matrix)

### US-F09-01: Duyệt Sản Phẩm — Product Listing Page (PLP) (11 Cases)

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F09.01** | `AC-1` | `UI` | **[Positive]** PLP 3 cột trên Desktop | 1. Truy cập `/sites/[slug]/products`. | - Card SP hiển thị: Ảnh, Category, Tên, Giá (RM).<br>- Bố cục 3 cột đều nhau. | High | [ ] |
| **TC-F09.02** | `AC-1` | `UI` | **[Positive]** PLP 1 cột trên Mobile (375px) | 1. Chuyển sang Mobile View 375px. | - Card SP co giãn về 1 cột.<br>- Không có thanh cuộn ngang. | High | [ ] |
| **TC-F09.03** | `AC-1` | `UI` | **[Positive]** Badge "SALE" cho SP có giá khuyến mãi | 1. Xem sản phẩm có `compareAtPrice > price`. | - Hiển thị tag "SALE" màu đỏ nổi bật trên ảnh sản phẩm. | Medium | [ ] |
| **TC-F09.04** | `AC-1` | `Logic` | **[Negative]** Ẩn SP Draft/Archived khỏi Storefront | 1. Kiểm tra danh sách PLP.<br>2. Đối chiếu với DB. | - Chỉ SP có `status='active'` hiển thị.<br>- Không có SP draft/archived lọt ra. | Blocker | [x] |
| **TC-F09.05** | `AC-2` | `Func` | **[Positive]** Tìm kiếm theo Keyword | 1. Nhập "Coffee" vào ô Search. | - Danh sách cập nhật ngay với SP có tên/mô tả chứa "Coffee". | High | [ ] |
| **TC-F09.06** | `AC-2` | `Func` | **[Positive]** Lọc Category đa cấp (3 levels) | 1. Chọn Category → "Fashion" → "Tops" → "Áo". | - Lọc đúng 3 cấp.<br>- Breadcrumb hiển thị đúng đường dẫn. | High | [ ] |
| **TC-F09.07** | `AC-2` | `Func` | **[Positive]** Sort "Giá giảm dần" | 1. Chọn Sort "Giá giảm dần". | - SP đắt nhất đứng đầu.<br>- Thứ tự số học RM đúng. | Medium | [ ] |
| **TC-F09.08** | `AC-2` | `Func` | **[Positive]** Kết hợp Filter Category + Sort | 1. Chọn "Tops" + Sort "Giá tăng dần". | - Không conflict.<br>- URL: `?cat=tops&sort=price_asc`. | High | [ ] |
| **TC-F09.09** | `AC-3` | `Logic` | **[Positive]** Phân trang 10 SP/trang | 1. Đếm SP trang 1.<br>2. Nhấn sang trang 2. | - Đúng 10 items/trang.<br>- Trang 2 hiện SP tiếp theo, không trùng lặp. | High | [ ] |
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
| **TC-F09.22** | `AC-1` | `UI` | **[Positive]** Checkout Form đủ 3 khu vực | 1. Truy cập `/checkout`. | - Hiển thị đầy đủ: Contact Info (S01), Shipping Address (S02), Payment (S03). | Blocker | [ ] |
| **TC-F09.23** | `AC-1` | `Func` | **[Negative]** Bắt buộc nhập Full Name | 1. Để trống trường Name.<br>2. Nhấn Place Order. | - Border field đỏ.<br>- Hiển thị "Full Name is required".<br>- Không gọi API. | High | [ ] |
| **TC-F09.24** | `AC-1` | `Func` | **[Negative]** Chặn Email sai cú pháp | 1. Nhập Email: `abc@.com` hoặc `abc.com`.<br>2. Nhấn Submit. | - Báo lỗi "Invalid email address".<br>- Ngăn submit. | High | [ ] |
| **TC-F09.25** | `AC-1` | `Sec` | **[Negative]** Ràng buộc số Phone Malaysia (+60) | 1. Nhập Phone: `090123...`. | - Báo lỗi hoặc tự format về prefix `+60`.<br>- Chỉ chấp nhận chữ số. | High | [ ] |
| **TC-F09.26** | `AC-1` | `Bus` | **[Positive]** Dropdown đủ các Bang Malaysia | 1. Mở dropdown "State" trong Shipping Address. | - Hiển thị đủ các bang: Selangor, Johor, Penang, Sabah, Sarawak... | High | [ ] |
| **TC-F09.27** | `AC-1` | `Logic` | **[Negative]** Postcode Malaysia chỉ nhận 5 chữ số | 1. Nhập Postcode `abcde` (chữ).<br>2. Nhập Postcode `123` (ngắn). | - Chỉ chấp nhận đúng 5 chữ số.<br>- Từ chối format không đúng. | High | [ ] |
| **TC-F09.28** | `AC-1` | `Sec` | **[Positive]** QR Banking — Bắt buộc upload Receipt | 1. Chọn phương thức "QR Banking" tại Checkout. | - Khung upload File xuất hiện.<br>- Nút Place Order bị Disabled cho đến khi upload xong. | Blocker | [ ] |
| **TC-F09.29** | `AC-1` | `Sec` | **[Negative]** Chặn file rác khi upload Receipt | 1. Upload file `.exe` hoặc ảnh > 2MB. | - Báo lỗi "File size exceeded" hoặc "Invalid format".<br>- Field upload được reset. | High | [ ] |
| **TC-F09.30** | `AC-2` | `API` | **[Positive]** Place Order thành công | 1. Điền đầy đủ thông tin hợp lệ.<br>2. Nhấn Place Order. | - Redirect sang `/order/:id/confirm`.<br>- DB Order Status = `pending`.<br>- Giỏ hàng bị xóa. | Blocker | [x] |
| **TC-F09.31** | `AC-2` | `Logic` | **[Positive]** Format mã đơn hàng (ORD-XXXXXXXX) | 1. Hoàn tất đặt hàng, xem mã đơn. | - Mã khớp format `ORD-` + 8 ký tự/số ngẫu nhiên độc nhất. | High | [ ] |
| **TC-F09.32** | `AC-3` | `Sec` | **[Positive]** Khách không cần đăng nhập (Guest Checkout) | 1. Dùng Browser ẩn danh (chưa đăng nhập).<br>2. Thực hiện Checkout. | - Vào được trang Checkout và đặt hàng bình thường.<br>- Không bị redirect sang Login. | Blocker | [x] |
| **TC-F09.33** | `AC-3` | `Bus` | **[Positive]** Tính thuế SST 6% đúng | 1. Kiểm tra phần Order Summary tại Checkout. | - SST 6% tính trên Subtotal (vd: Sub RM 100 → SST RM 6.00). | Critical | [x] |
| **TC-F09.34** | `Market` | `Bus` | **[Positive]** Phí Ship khác nhau West/East Malaysia | 1. Chọn Bang Selangor (West).<br>2. Đổi sang Sabah (East). | - Selangor: RM 8.00; Sabah: RM 15.00.<br>- Phí ship cập nhật ngay khi đổi Bang. | Critical | [x] |
| **TC-F09.35** | `AC-4` | `UX` | **[Negative]** Giỏ hàng giữ nguyên khi Place Order thất bại | 1. Mô phỏng lỗi API 500 khi submit Order. | - Toast đỏ "Order failed".<br>- **Giỏ hàng KHÔNG bị xóa.** | High | [ ] |

---

### US-F09-04: Xác Nhận Đơn Hàng (2 Cases)

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F09.36** | `AC-1` | `UI` | **[Positive]** Trang Confirm hiển thị đầy đủ | 1. Vừa hoàn tất đặt hàng. | - Hiển thị: Mã ORD, Tổng tiền, Danh sách SP, Hình thức thanh toán. | High | [ ] |
| **TC-F09.37** | `AC-1` | `Flow` | **[Positive]** Nút "Continue Shopping" điều hướng đúng | 1. Nhấn "Continue Shopping" trên trang Confirm. | - Redirect về `/sites/[slug]/products`. | Medium | [ ] |

---

### US-F09-05: Tối Ưu Mobile UX — Native-Feeling (4 Cases)

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F09.38** | `AC-1` | `UX` | **[Positive]** Nút Add-to-Cart Sticky ở đáy PDP | 1. Cuộn trang PDP xuống dưới trên Mobile. | - Nút Add to Cart dính ở đáy màn hình.<br>- Dễ nhấn bằng ngón cái. | High | [ ] |
| **TC-F09.39** | `AC-2` | `UI` | **[Positive]** Filter/Sort dạng Bottom Sheet | 1. Tap Filter trên Mobile. | - Panel trượt từ dưới lên (Bottom Sheet).<br>- Vuốt xuống để đóng. | High | [ ] |
| **TC-F09.40** | `AC-3` | `UI` | **[Positive]** Cart Drawer Full-Screen trên Mobile | 1. Mở giỏ hàng trên Mobile. | - Drawer chiếm 100% width màn hình.<br>- Nút [CHECKOUT] to, Sticky ở đáy. | High | [ ] |
| **TC-F09.41** | `Design` | `UI` | **[Positive]** Safe Area Inset cho iOS | 1. Kiểm tra trên iPhone 14 Pro Max. | - Nút Sticky không bị che bởi Home indicator iOS.<br>- Padding-bottom đúng chuẩn. | Medium | [ ] |

---

### Advanced Cases: Hiệu Năng, Bảo Mật & Đa Ngôn Ngữ (32 Cases)

| ID | Ref | Loại | Tiêu Đề | Các Bước Thực Hiện | Kết Quả Mong Đợi | Mức Độ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **TC-F09.42** | `Locale` | `Func` | **[Positive]** Chuyển ngữ EN → VI | 1. Chuyển ngôn ngữ sang Tiếng Việt. | - "Add to Cart" → "Thêm vào giỏ".<br>- "Categories" → "Danh mục". Toàn bộ label dịch đúng. | High | [ ] |
| **TC-F09.43** | `Locale` | `Func` | **[Positive]** Chuyển ngữ sang Bahasa Melayu | 1. Chuyển ngôn ngữ sang BM. | - "Place Order" → "Buat Pesanan".<br>- Ngôn ngữ lịch sự, phù hợp Business Malaysia. | High | [ ] |
| **TC-F09.44** | `Perf` | `SLA` | **[Positive]** Tải PLP dưới 2 giây | 1. Reload trang Products có 50 SP. | - LCP xuất hiện trong **< 2 giây**. | Medium | [ ] |
| **TC-F09.45** | `Perf` | `UX` | **[Positive]** Skeleton Loading khi mạng chậm | 1. Giả lập mạng Slow 3G.<br>2. Load trang Products. | - Card SP hiển thị khung xám nhấp nháy (Skeleton).<br>- Không có trang trắng. | Medium | [ ] |
| **TC-F09.46** | `Sec` | `Sanit` | **[Negative]** Chặn XSS qua Search Box | 1. Nhập `<script>alert('xss')</script>` vào ô tìm kiếm. | - Chuỗi bị escape hoặc xóa.<br>- Không nhảy popup cảnh báo.<br>- Trả về 0 kết quả. | Blocker | [x] |
| **TC-F09.47** | `Sec` | `Access` | **[Negative]** Chặn IDOR — Xem order của người khác | 1. Thay đổi `:id` trên URL Confirm sang ID ngẫu nhiên. | - Trả lỗi HTTP 403 hoặc 404.<br>- Không hiển thị thông tin đơn của người khác. | Blocker | [x] |
| **TC-F09.48** | `Func` | `Cart` | **[Edge]** Add 2 SP đồng thời (Concurrency) | 1. Nhấn Add 2 items cực nhanh cùng lúc. | - Giỏ hàng ghi nhận cả 2.<br>- Không mất item do race condition. | Medium | [ ] |
| **TC-F09.49** | `Data` | `Sync` | **[Positive]** Đồng bộ giỏ hàng qua nhiều Tab | 1. Mở 2 tab cùng lúc.<br>2. Add SP tại Tab 1. | - Tab 2 tự cập nhật badge và drawer mà không cần F5. | Medium | [ ] |
| **TC-F09.50** | `UX` | `Nav` | **[Positive]** Giữ vị trí scroll khi nhấn Back | 1. Cuộn xuống cuối PLP.<br>2. Vào PDP.<br>3. Nhấn Back. | - Trang quay lại đúng vị trí scroll cũ, không nhảy lên đầu. | Low | [ ] |
| **TC-F09.51** | `Bus` | `Tax` | **[Edge]** Làm tròn tiền thuế SST (Rounding) | 1. Mua SP giá RM 1.55. SST 6% = 0.093. | - Hiển thị đúng 2 chữ số thập phân (vd: RM 0.09).<br>- Không hiển thị quá 2 decimal. | Medium | [ ] |
| **TC-F09.52** | `Design` | `UI` | **[Positive]** Hover effect trên Product Card | 1. Di chuột lên ảnh sản phẩm trên Desktop. | - Ảnh phóng to nhẹ (Scale 1.05) hoặc hiện overlay "Quick View".<br>- Animation mượt mà. | Low | [ ] |
| **TC-F09.53** | `Func` | `Image` | **[Negative]** Placeholder khi ảnh SP lỗi | 1. Mở SP có URL ảnh bị hỏng/hết hạn. | - Card không bị vỡ layout.<br>- Hiển thị ảnh mặc định "No Image" chuyên nghiệp. | Medium | [ ] |
| **TC-F09.54** | `Func` | `Checkout` | **[Positive]** Tính đúng giỏ hàng giá trị lớn (RM 10,000+) | 1. Add số lượng lớn items có tổng > RM 10,000. | - Tổng tiền tính chính xác.<br>- Format hiển thị số không bị lỗi. | Medium | [ ] |
| **TC-F09.55** | `Locale` | `Data` | **[Positive]** Giữ Locale sau khi đặt hàng xong | 1. Đặt hàng khi đang dùng Tiếng Việt. | - Trang Confirm và các trang tiếp theo giữ Tiếng Việt.<br>- Không tự nhảy về EN. | Medium | [ ] |
| **TC-F09.56** | `UX` | `Interact` | **[Positive]** Touch-target tối thiểu 44px trên Mobile | 1. Kiểm tra kích thước nút `+` / `-` trong giỏ hàng. | - Tất cả nút tap/click ≥ 44×44px.<br>- Không gây bấm nhầm. | High | [ ] |
| **TC-F09.57** | `Func` | `Cart` | **[Edge]** Giỏ hàng cập nhật giá mới khi Seller đổi giá | 1. Add SP vào giỏ.<br>2. Seller hạ giá tại Dashboard.<br>3. User vào Checkout. | - Checkout hiển thị giá **mới nhất** từ DB.<br>- Không dùng giá cũ trong LocalStorage. | Critical | [x] |
| **TC-F09.58** | `Sec` | `Logic` | **[Negative]** Chặn dùng link Confirm cũ bypass thanh toán | 1. Lưu link `/confirm/xxx`.<br>2. Xóa giỏ hàng, paste link lại để truy cập. | - Hiển thị "Đơn hàng đã xử lý hoặc không còn hợp lệ".<br>- Không thể giả mạo đặt hàng. | High | [ ] |
| **TC-F09.59** | `Func` | `Nav` | **[Positive]** Breadcrumb Navigation đúng cấu trúc | 1. Từ PDP, nhấn vào Breadcrumb để về danh mục cha. | - Link hoạt động đúng.<br>- Cấu trúc: Home > Category > Sub-category > Product. | Medium | [ ] |
| **TC-F09.60** | `API` | `Limit` | **[Negative]** Chặn spam nút Place Order | 1. Nhấn Place Order liên tục 5 lần nhanh. | - Chỉ gửi 1 request duy nhất.<br>- Không tạo 5 đơn hàng trùng lặp. | Critical | [x] |
| **TC-F09.61** | `UI` | `State` | **[Positive]** Nút Chat nằm dưới Cart Drawer | 1. Mở Cart Drawer (đè lên nút Chat). | - Nút Chat có Z-index thấp hơn Drawer, không che khuất giỏ hàng. | Low | [ ] |
| **TC-F09.62** | `Final` | `Check` | **[Positive]** 9-Point Checklist Institutional Pass | 1. Rà soát toàn bộ Feature theo Corporate Standards. | - Mọi tiêu chí về LCP, Accessibility, Security, Business Logic đạt điểm tối đa. | Blocker | [x] |
| **TC-F09.63** | `FR-03` | `UI` | **[Positive]** Image Gallery tương tác trên PDP | 1. Vào PDP có nhiều ảnh.<br>2. Click thumbnail nhỏ phía dưới.<br>3. Vuốt trái/phải trên Mobile. | - Ảnh chính thay đổi đúng theo Click/Touch.<br>- Không vỡ Layout. | High | [ ] |
| **TC-F09.64** | `FR-04` | `Func` | **[Negative]** Bắt buộc chọn Variants trước khi Add Cart | 1. Vào SP có Biến thể (Size, Color).<br>2. Không chọn Size, nhấn "Add to Cart". | - Ô chọn Size rung lắc + viền đỏ.<br>- Toast "Vui lòng chọn Size".<br>- Không push variant null vào API. | Blocker | [ ] |
| **TC-F09.65** | `FR-03` | `Data` | **[Positive]** Bảng Attributes mở rộng ở PDP | 1. Cuộn xuống phần dưới trang PDP. | - Hiển thị bảng thuộc tính (vd: Thương hiệu: OEM, Xuất xứ: MY).<br>- Đóng khung bảng chuẩn, không mất viền Border. | Medium | [ ] |
| **TC-F09.66** | `NFR` | `SEO` | **[Positive]** JSON-LD Rich Snippet Product Schema | 1. Mở DevTools (F12), xem phần `<head>` của PDP. | - Tồn tại `<script type="application/ld+json">` chứa `@type: Product`.<br>- Điền đúng Giá, Kho, Tên, Ảnh. | Blocker | [x] |
| **TC-F09.67** | `AC-1` | `UI` | **[Positive]** Hiển thị Variant trong Cart Drawer | 1. Add "Áo khoác" phân loại "Xanh, Size M" vào giỏ. | - Line-item trong Drawer hiện 2 dòng: Tên chính + Sub-title mờ "Phân loại: Xanh, Size M". | High | [ ] |
| **TC-F09.68** | `FR-06` | `Func` | **[Positive]** Checkout reactive giữa COD và QR Bank | 1. Tick COD.<br>2. Đổi sang QR Banking. | - COD: ẩn khung upload file.<br>- QR Banking: hiện khung upload bắt buộc.<br>- Chuyển đổi DOM 0ms. | High | [ ] |
| **TC-F09.69** | `FR-14` | `Trust` | **[Positive]** Trust Signals ở Footer Storefront | 1. Cuộn xuống Footer của Storefront. | - WhatsApp Float nổi rõ.<br>- Footer chứa Mã SSM và Logo Halal cho thị trường Malaysia. | High | [ ] |
| **TC-F09.70** | `API` | `Sec` | **[Negative]** Chặn giả mạo giá giỏ hàng (Price Spoofing) | 1. Add SP RM 500 vào giỏ, vào Checkout.<br>2. Dùng Postman đổi payload `total: 1.00` rồi gửi. | - Backend tính lại giá từ DB, phát hiện sai lệch.<br>- Trả lỗi **HTTP 400 "Data Integrity Check Failed"**.<br>- Không cho tạo đơn với giá giả. | Blocker | [ ] |
| **TC-F09.71** | `Logic` | `Bound` | **[Negative]** Chặn số lượng âm trong giỏ hàng | 1. Dùng Developer Tools chỉnh payload `quantity: -5`.<br>2. Gửi request Update giỏ. | - Zod Validation từ chối quantity ≤ 0.<br>- Không cho phép Subtotal ra số âm. | Blocker | [ ] |
| **TC-F09.72** | `DB` | `Lock` | **[Negative]** Race Condition khi 2 khách cùng mua SP cuối | 1. Kho còn đúng 1 SP.<br>2. Khách A và B dùng JMeter cùng Place Order đồng thời. | - Backend dùng DB Row Lock.<br>- Người B nhận lỗi **HTTP 409 "Hàng vừa hết"**.<br>- Không tạo tồn kho âm. | Blocker | [x] |
| **TC-F09.73** | `File` | `Sec` | **[Negative]** MIME Spoofing khi upload Receipt | 1. Đổi đuôi file `.exe` thành `receipt.png`.<br>2. Upload lên form QR Bank. | - Backend kiểm tra Binary File Signature (magic bytes).<br>- Chặn upload, trả **HTTP 415 Unsupported Media Type**. | High | [ ] |

---

## 4. Hành Trình E2E UAT Flow

| Bước | Hành Động | Kết Quả Mong Đợi |
|:---:|:---|:---|
| 1 | Khách vào Products, lọc "Fashion" + giá < RM 50. | Danh sách cập nhật đúng, URL đổi params (TC-F09.06, 08). |
| 2 | Chọn SP, xem ảnh Gallery PDP, nhấn Add to Cart. | Drawer trượt ra mượt (TC-F09.12). |
| 3 | Thấy gợi ý Cross-sell, Add luôn. | Item thêm vào mà không đóng Drawer (TC-F09.20). |
| 4 | Vào Checkout (Browser ẩn danh). | Không bị redirect Login, form đầy đủ 3 section (TC-F09.22, 32). |
| 5 | Chọn Selangor, QR Banking, upload Receipt 1.5MB. | Phí ship RM 8.00, SST 6% tính đúng, Place Order kích hoạt (TC-F09.28, 33, 34). |
| 6 | Nhấn Place Order, sang Confirm page. | Mã ORD-XXXXXXXX hợp lệ, Order Status = `pending` (TC-F09.30, 31). |

---

## 5. Tiêu Chí Đánh Giá Chất Lượng Phát Hành (Quality Gates)

| Nhóm Kiểm Thử | Trạng Thái | Ghi Chú |
|---|---|---|
| **1. AC Coverage** | [x] 100% | 73 TCs ánh xạ đầy đủ 14 Acceptance Criteria. |
| **2. Malaysia Market Accuracy** | [ ] PENDING | Verify SST 6% và Ship Rates (RM 8/RM 15) chính xác tới từng cent. |
| **3. Mobile UX Native-Feeling** | [ ] PENDING | Sticky CTA và Bottom Sheet cảm giác như App thật, không giật. |
| **4. Security & Sanitization** | [ ] PENDING | Upload QR, Search Box, Price Spoofing, MIME Spoof phải hardened. |
| **5. E2E UAT Approval** | [ ] NOT RUN | Cần đồng thuận từ PO/BA dựa trên 73 cases đã được phủ. |

> **Khuyến Nghị Release:** Bộ 73 kịch bản cho phép BA/QC tự tin bàn giao F09 sang giai đoạn UAT và Release chính thức.
