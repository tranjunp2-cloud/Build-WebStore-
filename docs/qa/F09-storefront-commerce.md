# Quyết Định Kiểm Thử & Kiểm Thử Chi Tiết: F09 - Storefront Commerce
> **Phiên bản:** 5.0 (Exhaustive Matrix - 62 Cases) | **Cập nhật:** 2026-03-25 | **Thực hiện:** QA Team
> **Nguồn Tham chiếu:** PRD (`F09-storefront-commerce.md`), User Stories (14 Core ACs), Figma Design (Node 30905:1342)
> **Kỹ năng ứng dụng (.agent):** BDD (Gherkin), Malaysia Market Context (SST/MY Shipping), Mobile Native UX Auditing, Security QR Proof Validation.

---

## 1. Mục Tiêu (Objective)
Tài liệu này cung cấp ma trận kiểm thử **triệt để (Exhaustive Matrix)** cho tính năng Storefront Commerce (F09). Mục tiêu là đạt độ phủ **100% cho 5 User Stories (14 ACs)**, bao quát mọi kịch bản từ luồng chính (Happy Path) đến các trường hợp biên (Edge cases), lỗi hệ thống (Negative) và các quy tắc đặc thù của thị trường Malaysia.

Bộ kiểm thử bao gồm **62 kịch bản chi tiết**, đảm bảo hệ thống vận hành bền bỉ, an toàn và mang lại trải nghiệm mua sắm mượt mà nhất cho người mua hàng.

---

## 2. Test Environment (Môi trường Kiểm thử)
| Biến (Variable) | Yêu cầu (Requirements) |
|---|---|
| Môi trường (Env) | Staging / Pre-Production |
| Browsers | Chrome (v110+), Safari (Latest), Firefox |
| Devices (Responsive) | Desktop (1920x1080), Mobile (iPhone 14 Pro, Samsung S22) |
| Test Data | Malaysia Locales, SST Tax Rules, MY Postcodes, QR Sample Receipt |

---

## 3. Unified Test Cases (Traceability Matrix)

| ID | Tham chiếu | LOẠI | TIÊU ĐỀ (Scenario) | CÁC BƯỚC THỰC HIỆN & DỮ LIỆU (Steps & Test Data) | KẾT QUẢ MONG ĐỢI GHERKIN & DB CHECKS (Expected) | MỨC ĐỘ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **[US-F09-01] Duyệt Sản Phẩm (Product Listing Page - PLP)** |
| **TC-F09.01** | `AC-1` | `UI` | **[Positive]** Giao diện PLP chuẩn Responsive (3-col Desktop) | **1.** Truy cập `/sites/[slug]/products`. | Card SP hiển thị: Image, Category, Name, Price (RM). Bố cục 3 cột đều nhau. | High | [ ] |
| **TC-F09.02** | `AC-1` | `UI` | **[Positive]** Giao diện PLP chuẩn Mobile (1-col 375px) | **1.** Chuyển sang Mobile View 375px. | Card SP co giãn về 1 cột. Tránh lỗi tràn ngang (No horizontal scroll). | High | [ ] |
| **TC-F09.03** | `AC-1` | `UI` | **[Positive]** Badge "SALE" cho sản phẩm có Compare Price | **1.** Xem sản phẩm có `compareAtPrice > price`. | Hiển thị tag "SALE" màu đỏ nổi bật trên ảnh sản phẩm. | Medium | [ ] |
| **TC-F09.04** | `AC-1` | `Logic` | **[Negative]** Ẩn sản phẩm có trạng thái 'draft' hoặc 'archived' | **1.** Kiểm tra danh sách PLP. | Chỉ các sản phẩm `status='active'` mới được hiển thị. DB check: Không có ID rác. | Blocker | [x] |
| **TC-F09.05** | `AC-2` | `Func` | **[Positive]** Tìm kiếm sản phẩm theo Keyword | **1.** Nhập "Coffee" vào ô Search. | Danh sách filter ngay lập tức hiển thị các SP có tiêu đề/mô tả chứa "Coffee". | High | [ ] |
| **TC-F09.06** | `AC-2` | `Func` | **[Positive]** Bộ lọc Category đa cấp (3 levels) | **1.** Chọn Category 'Fashion' -> 'Tops' -> 'Aa'. | Filter lọc sâu đúng 3 cấp. Breadcrumb hiển thị đúng đường dẫn thư mục. | High | [ ] |
| **TC-F09.07** | `AC-2` | `Func` | **[Positive]** Sắp xếp "Giá giảm dần" (Price High to Low) | **1.** Chọn Sort "Giá giảm dần". | Sản phẩm đắt nhất đứng đầu. RM check đúng thứ tự số học. | Medium | [ ] |
| **TC-F09.08** | `AC-2` | `Func` | **[Positive]** Kết hợp Filter Category + Sort Giá | **1.** Chọn 'Tops' + Sort 'Giá tăng dần'. | Không conflict. URL query: `?cat=tops&sort=price_asc`. | High | [ ] |
| **TC-F09.09** | `AC-3` | `Logic` | **[Positive]** Phân trang (Pagination) chuẩn 10 SP/trang | **1.** Đếm số sản phẩm trang 1. <br>**2.** Nhấn trang 2. | Đúng 10 items/trang. Trang 2 hiện các sản phẩm tiếp theo (không trùng lặp). | High | [ ] |
| **TC-F09.10** | `PRD` | `Edge` | **[Positive]** Trạng thái "Out of Stock" (Hiển thị mờ) | **1.** Xem sản phẩm stock=0. | Ảnh sản phẩm bị làm mờ (Opacity ~0.6). Hiện badge "Hết hàng". Nút Add to Cart ẩn. | High | [ ] |
| **TC-F09.11** | `Market`| `UI` | **[Positive]** Định dạng tiền tệ Malaysia (RM XX.XX) | **1.** Quan sát giá hiển thị. | Luôn có tiền tố `RM` (VD: RM 15.00). Không dùng symbol khác hoặc bỏ trống. | Blocker | [ ] |
| **[US-F09-02] Giỏ Hàng & Cart Drawer (Slide-in UX)** |
| **TC-F09.12** | `AC-1` | `UX` | **[Positive]** Hiệu ứng Slide-in Cart Drawer mượt mà | **1.** Click 'Add to Cart'. | Drawer trượt từ phải sang (Transition < 300ms). Background overlay (Dim) kích hoạt. | High | [ ] |
| **TC-F09.13** | `AC-1` | `Data` | **[Positive]** Tăng số lượng khi add trùng sản phẩm | **1.** Add 'Denim Jacket' 2 lần. | Giỏ hàng chỉ có 1 row 'Denim Jacket' nhưng Quantity = 2. Không tạo dòng mới. | High | [x] |
| **TC-F09.14** | `AC-1` | `Data` | **[Positive]** Giỏ hàng Persist sau khi Refresh (LocalStorage) | **1.** Thêm đồ -> F5 trang. | Items vẫn giữ nguyên. DOM nạp lại data từ LocalStorage kịp thời (<100ms). | Blocker | [x] |
| **TC-F09.15** | `AC-2` | `Func` | **[Positive]** Tăng/Giảm số lượng trong Drawer (+/-) | **1.** Nhấn `+` hoặc `-`. | Subtotal nhảy real-time. API update session/local ghi nhận đúng số mới. | High | [ ] |
| **TC-F09.16** | `AC-2` | `Logic` | **[Positive]** Tự động xóa item khi giảm số lượng về 0 | **1.** Nhấn `-` tại item có Quantity=1. | Item biến mất khỏi giỏ. Hiện thông báo "Item removed". | Medium | [ ] |
| **TC-F09.17** | `AC-3` | `UX` | **[Positive]** Xóa item bằng icon (✕) chuyên dụng | **1.** Nhấn icon Xóa tại card item. | Item biến mất ngay lập tức. Subtotal khấu trừ đúng số tiền. | High | [ ] |
| **TC-F09.18** | `AC-3` | `UI` | **[Positive]** Trạng thái Giỏ hàng trống (Empty State) | **1.** Xóa hết items trong giỏ. | Hiện illustration "Giỏ hàng trống" + Link "Tiếp tục mua sắm". | Medium | [ ] |
| **TC-F09.19** | `Limit` | `Logic` | **[Negative]** Chặn add quá số lượng tồn kho (Stock Limit) | **1.** Cố tình add 10 items khi stock chỉ có 5. | Báo lỗi toast: "Chỉ còn 5 sản phẩm trong kho". Giỏ hàng giới hạn ở mức 5. | High | [ ] |
| **TC-F09.20** | `Design`| `UX` | **[Positive]** Cross-sell "You might also like" trong Drawer | **1.** Nhấn `+` tại mục gợi ý phía dưới Drawer. | Item gợi ý được thêm vào giỏ chính cực nhanh mà không đóng drawer. | Medium | [ ] |
| **TC-F09.21** | `UI` | `Header`| **[Positive]** Cart Badge Count trên Global Header | **1.** Add items. <br>**2.** Nhìn icon Cart ở Header. | Badge đỏ hiện số lượng khớp 100% với items trong Drawer. | High | [ ] |
| **[US-F09-03] Thanh Toán & Thị Trường Malaysia (Guest Checkout)** |
| **TC-F09.22** | `AC-1` | `UI` | **[Positive]** Checkout Form hiển thị đủ các khu vực thiết yếu | **1.** Truy cập `/checkout`. | Hiện đủ: Contact Info (S01), Shipping Address (S02), Payment (S03). | Blocker | [ ] |
| **TC-F09.23** | `AC-1` | `Func` | **[Negative]** Chặn bỏ trống trường bắt buộc (Full Name) | **1.** Để trống Name -> Bấm Place Order. | Border field đỏ. Hiện text "Full Name is required". API không bắn. | High | [ ] |
| **TC-F09.24** | `AC-1` | `Func` | **[Negative]** Chặn định dạng Email sai quy chuẩn | **1.** Nhập Email: `abc@.com` hoặc `abc.com`. | Báo lỗi "Invalid email address". Ngăn chặn submit. | High | [ ] |
| **TC-F09.25** | `AC-1` | `Sec` | **[Negative]** Ràng buộc Phone Malaysia (Prefix +60) | **1.** Nhập Phone: `090123...`. | Báo lỗi hoặc tự động format về prefix `+60`. Chỉ chấp nhận số. | High | [ ] |
| **TC-F09.26** | `AC-1` | `Bus` | **[Positive]** Dropdown Bang Malaysia (Select State) | **1.** Mở State dropdown. | Hiển thị đủ các bang: Selangor, Johor, Penang, Sabah, Sarawak... (theo Market Context). | High | [ ] |
| **TC-F09.27** | `AC-1` | `Logic` | **[Negative]** Ràng buộc Postcode Malaysia (Số, 5 ký tự) | **1.** Nhập `abcde`. <br>**2.** Nhập `123`. | Chỉ chấp nhận 5 chữ số. Không cho phép nhập chữ hay dư/thiếu ký tự. | High | [ ] |
| **TC-F09.28** | `AC-1` | `Sec` | **[Positive]** QR Banking - Bắt buộc Upload Receipt | **1.** Chọn QR Banking. | Phải xuất hiện khung upload File. Nếu chưa upload, nút Place Order bị disabled. | Blocker | [ ] |
| **TC-F09.29** | `AC-1` | `Sec` | **[Negative]** QR Banking - Chặn file rác/quá dung lượng (>2MB) | **1.** Upload file `.exe` hoặc ảnh 5MB. | Báo lỗi "File size exceeded" hoặc "Invalid format". Reset field upload. | High | [ ] |
| **TC-F09.30** | `AC-2` | `API` | **[Positive]** Tạo đơn hàng thành công (Success Flow) | **1.** Điền đủ -> Place Order. | Điều hướng `/order/:id/confirm`. DB Order Status = 'pending'. Cart cleared. | Blocker | [x] |
| **TC-F09.31** | `AC-2` | `Logic` | **[Positive]** Order Number Format (ORD-XXXXXXXX) | **1.** Kiểm tra mã đơn sau khi thanh toán. | Mã phải khớp format: `ORD-` kèm 8 ký tự/số ngẫu nhiên độc nhất. | High | [ ] |
| **TC-F09.32** | `AC-3` | `Sec` | **[Positive]** Guest Checkout (No Login Required) | **1.** Dùng Browser ẩn danh (đã logout). | Vào được trang Checkout và đặt hàng bình thường. Không bị đá ra trang Login. | Blocker | [x] |
| **TC-F09.33** | `AC-3` | `Bus` | **[Positive]** Tính thuế SST 6% (Tax Calculation) | **1.** Kiểm tra Order Summary. | SST 6% phải tính trên Subtotal. Ví dụ: Sub RM 100 -> SST RM 6.00. | Critical| [x] |
| **TC-F09.34** | `Market`| `Bus` | **[Positive]** Phí Ship theo vùng (West vs East MY) | **1.** Chọn Selangor (West). <br>**2.** Chọn Sabah (East). | Selangor: RM 8.00. Sabah: RM 15.00. Phí ship cập nhật ngay khi đổi Bang. | Critical| [x] |
| **TC-F09.35** | `AC-4` | `UX` | **[Negative]** Xử lý khi Place Order thất bại (Bank Error) | **1.** Mô phỏng lỗi API 500 khi submit. | Hiện Toast đỏ "Order failed". **CRITICAL**: Giỏ hàng KHÔNG được xóa. | High | [ ] |
| **[US-F09-04] Xác Nhận Đơn Hàng (Order Confirmation)** |
| **TC-F09.36** | `AC-1` | `UI` | **[Positive]** Hiển thị màn hình Confirm đầy đủ | **1.** Vừa đặt hàng xong. | Hiện: Mã ORD, Tổng tiền, Danh sách sản phẩm mua, Hình thức thanh toán. | High | [ ] |
| **TC-F09.37** | `AC-1` | `Flow` | **[Positive]** Nút "Continue Shopping" (PLP Link) | **1.** Nhấn "Continue Shopping". | Điều hướng chính xác về trang `/sites/[slug]/products`. | Medium | [ ] |
| **[US-F09-05] Tối Ưu Mobile UX (Native-Feeling)** |
| **TC-F09.38** | `AC-1` | `UX` | **[Positive]** Sticky Add-to-Cart (Thumb Zone) trên PDP | **1.** Mobile cuộn trang PDP xuống dưới. | Nút Add to Cart dính chặt ở đáy màn hình. Dễ nhấn bằng ngón cái. | High | [ ] |
| **TC-F09.39** | `AC-2` | `UI` | **[Positive]** Filter/Sort Bottom Sheet (Swipe down to close) | **1.** Mobile tap Filter. | Modal trượt từ dưới lên (Bottom Sheet). Có thể vuốt xuống để đóng. | High | [ ] |
| **TC-F09.40** | `AC-3` | `UI` | **[Positive]** Full-Screen Cart Drawer trên Mobile | **1.** Mobile mở giỏ hàng. | Drawer chiếm 100% width màn hình. Nút [CHECKOUT] to, dính ở đáy. | High | [ ] |
| **TC-F09.41** | `Design`| `UI` | **[Positive]** Safe Area Inset (iOS Home Indicator) | **1.** Kiểm tra trên iPhone 14 Pro Max. | Nút Sticky không bị che bởi thanh điều hướng hệ thống (Home indicator). Padding-bottom chuẩn. | Medium | [ ] |
| **[QUẢNG BÁ CHUYÊN SÂU] Hiệu Năng, Bảo Mật & Đa Ngôn Ngữ (Advanced Cases)** |
| **TC-F09.42** | `Locale` | `Func` | **[Positive]** Chuyển ngữ EN -> VI (Label Sync) | **1.** Switch Lang. | "Add to Cart" -> "Thêm vào giỏ", "Categories" -> "Danh mục". 100% Labels dịch đúng. | High | [ ] |
| **TC-F09.43** | `Locale` | `Func` | **[Positive]** Chuyển ngữ sang Bahasa Melayu (MY Focus) | **1.** Switch Lang sang BM. | "Place Order" -> "Buat Pesanan". Ngôn ngữ lịch sự, phù hợp Business Malaysia. | High | [ ] |
| **TC-F09.44** | `Perf` | `SLA` | **[Positive]** Thời gian tải PLP dưới 2 giây | **1.** Reload trang Products với 50 sản phẩm. | Content (LCP) phải hiện trong < 2s. Không để người dùng chờ lâu. | Medium | [ ] |
| **TC-F09.45** | `Perf` | `UX` | **[Positive]** Skeleton Loading khi danh sách đang tải | **1.** Giả lập mạng chậm 3G. | Các card sản phẩm hiện khung xám nhấp nháy (Skeleton) thay vì trang trắng. | Medium | [ ] |
| **TC-F09.46** | `Sec` | `Sanit` | **[Negative]** Chống injection XSS tại Search Box | **1.** Nhập `<script>alert('xss')</script>`. | Chuỗi bị escape hoặc xóa. Không nhảy popup cảnh báo. Trả về 0 kết quả hợp lệ. | Blocker | [x] |
| **TC-F09.47** | `Sec` | `Access`| **[Negative]** Chặn truy cập order của người khác (IDOR) | **1.** Thay đổi :id trên URL confirm sang ID ngẫu nhiên. | Trả lỗi 403 Forbidden hoặc 404. Chỉ khách vừa đặt mới xem được (Session lock). | Blocker | [x] |
| **TC-F09.48** | `Func` | `Cart` | **[Edge]** Thêm sản phẩm đồng thời (Concurrency) | **1.** Nhấn add 2 items cực nhanh cùng lúc. | Giỏ hàng ghi nhận cả 2. Không bị mất nốt do race condition. | Medium | [ ] |
| **TC-F09.49** | `Data` | `Sync` | **[Positive]** Đồng bộ giỏ hàng qua các Tabs TabSync | **1.** Mở 2 Tab web cùng lúc. <br>**2.** Add SP tại Tab 1. | Tab 2 tự động cập nhật số lượng badge và drawer mà không cần F5. | Medium | [ ] |
| **TC-F09.50** | `UX` | `Nav` | **[Positive]** Duy trì vị trí cuộn khi nhấn Back | **1.** Cuộn xuống cuối PLP -> Vào PDP -> Nhấn Back. | Trình duyệt quay lại đúng vị trí scroll cũ, không nhảy lên đầu trang. | Low | [ ] |
| **TC-F09.51** | `Bus` | `Tax` | **[Edge]** Làm tròn tiền thuế SST (Rounding rules) | **1.** Mua món RM 1.55. SST 6% = 0.093. | Giá hiển thị phải làm tròn chuẩn (VD: RM 0.09). Không hiện quá 2 số thập phân. | Medium | [ ] |
| **TC-F09.52** | `Design`| `UI` | **[Positive]** Hover effects trên Product Card (Desktop) | **1.** Rê chuột vào ảnh sản phẩm. | Ảnh phóng to nhẹ (Scale 1.05) hoặc hiện overlay "Quick View/Add". Mượt mà. | Low | [ ] |
| **TC-F09.53** | `Func` | `Image` | **[Negative]** Hiển thị Placeholder khi sản phẩm mất ảnh | **1.** Một sản phẩm có URL ảnh lỗi/hết hạn. | Card SP không bị vỡ. Hiện ảnh mặc định 'No Image' chuyên nghiệp. | Medium | [ ] |
| **TC-F09.54** | `Func` | `Checkout`| **[Positive]** Checkout với giá trị giỏ hàng cực lớn (RM 10,000+) | **1.** Add số lượng lớn items. | Tổng tiền tính chính xác hàng chục triệu. Không lỗi format hiển thị số. | Medium | [ ] |
| **TC-F09.55** | `Locale` | `Data` | **[Positive]** Lưu giữ Locale đã chọn sau khi đặt hàng | **1.** Đang dùng tiếng Việt -> Đặt hàng xong. | Confirm page và các trang sau vẫn giữ tiếng Việt. Không tự nhảy về mặc định EN. | Medium | [ ] |
| **TC-F09.56** | `UX` | `Interact`| **[Positive]** Touch-target size trên Mobile (44px Rule) | **1.** Kiểm tra kích thước nút + / - trong giỏ hàng. | Các mục click/tap tối thiểu 44x44px. Không gây bấm nhầm trên màn hình nhỏ. | High | [ ] |
| **TC-F09.57** | `Func` | `Cart` | **[Edge]** Tự động update giá giỏ hàng nếu Seller đổi giá | **1.** Add items -> Seller hạ giá sp ở Dashboard -> User vào Checkout. | Checkout phải hiện giá MỚI nhất. Không được dùng giá cũ lưu trong LocalStorage. | Critical| [x] |
| **TC-F09.58** | `Sec` | `Logic` | **[Negative]** Chặn sử dụng link Confirm cũ để bypass thanh toán | **1.** Lưu link /confirm. <br>**2.** Xóa giỏ hàng rồi paste link vào xem. | Thông báo đơn hàng đã cũ hoặc đã xử lý. Không được dùng để giả mạo đặt hàng. | High | [ ] |
| **TC-F09.59** | `Func` | `Nav` | **[Positive]** Breadcrumb Navigation (Cây thư mục) | **1.** Từ PDP quay lại danh mục cha qua Breadcrumb. | Link hoạt động đúng. Cấu trúc: Home > Category > Sub-category > Product. | Medium | [ ] |
| **TC-F09.60** | `API` | `Limit` | **[Negative]** Chặn spam nút Place Order (Double Click) | **1.** Nhấn liên tiếp 5 lần vào nút Place Order cực nhanh. | Hệ thống chỉ gửi 1 request duy nhất. Tránh tạo 5 đơn hàng trùng lặp. | Critical| [x] |
| **TC-F09.61** | `UI` | `State` | **[Positive]** Trạng thái nút "Chat with shop now" (Z-Index) | **1.** Mở Cart Drawer đè lên nút Chat. | Nút Chat phải nằm dưới Drawer (Z-index thấp hơn) để không che khuất giỏ hàng. | Low | [ ] |
| **TC-F09.62** | `Final` | `Check` | **[Positive]** 9-Point Checklist Institutional Pass | **1.** Rà soát toàn bộ Feature dựa trên Corporate Standards. | Mọi tiêu chí về LCP, Accessibility, Security, và Business Logic đạt điểm tối đa. | Blocker | [x] |
| **[BỔ SUNG CHUYÊN SÂU: Gaps Coverage Đợt 2 (PDP, Cart Variant, Trust Signals)]** |
| **TC-F09.63** | `FR-03` | `UI` | **[Positive]** Tương tác Image Gallery trên PDP | **1.** Vào PDP. Click chọn ảnh Thumbnail nhỏ ở dưới.<br>**2.** Vuốt sang trái/phải trên màn hình Mobile. | Ảnh chính Active thay đổi mượt mà tương ứng với Touch/Thumb click. Không lỗi vỡ Layout. | High | [ ] |
| **TC-F09.64** | `FR-04` | `Func` | **[Negative]** Ràng buộc Chọn Variants trước khi Add Cart | **1.** Vào bài SP có Biến thể (Size, Color).<br>**2.** Không chọn Size (để trống). Bấm Nút "Add to Cart". | Trình Front-end Rung Lắc/Viền Đỏ ô chọn Size báo "Vui lòng chọn Size". Ngăn cản Push data Rác (Null variant) vào API Cart Drawer. | Blocker | [ ] |
| **TC-F09.65** | `FR-03` | `Data` | **[Positive]** Bảng Attributes Rendering trên nửa dưới PDP | **1.** Cuộn qua nút Add to Cart tại PDP. | Hiển thị Bảng thuộc tính mở rộng (Vd: Thương hiệu: OEM, Xuất xứ: MY) đóng khung Table chuẩn UX ko bị mất viền Border. | Medium | [ ] |
| **TC-F09.66** | `NFR`   | `SEO`  | **[Positive]** Inject JSON-LD Rich Snippet Product Schema | **1.** Inspect Code (F12) kiểm tra gốc thẻ `<head>` của PDP. | Tồn tại đoạn `<script type="application/ld+json">` chứa `@type: Product`, điền sẵn Giá, Kho, Tên, Hình 100% Khớp Dữ Liệu Thực Tế. | Blocker | [x] |
| **TC-F09.67** | `AC-1`  | `UI`   | **[Positive]** Mapping Chi Tiết Text Variants Trong Giỏ | **1.** Add "Áo khoác Bò" phân loại "Xanh, Size M" vào giỏ. | Line-item trong Cart Drawer in chi tiết 2 dòng Text: Tên Chính + Sub-Title Mờ "Phân loại: Xanh, Size M". Dev hay lười merge chung. | High | [ ] |
| **TC-F09.68** | `FR-06` | `Func` | **[Positive]** Checkout Reactive Toggle (COD vs QR Bank) | **1.** Ở Checkout, tick COD.<br>**2.** Tick QR Banking. | COD -> Layout Gọn gàng ẩn Nút File. QR Banking -> Uncollapse Lộ diện Upload File Bắt Buộc. DOM Form Reactive 0ms. | High | [ ] |
| **TC-F09.69** | `FR-14` | `Trust`| **[Positive]** Trust Signals Tín Nhiệm (Footer & WhatsApp) | **1.** Lướt tới Footer Storefront. | Hiện Rõ WhatsApp Float Nổi. Footer chứa chuẩn các tín hiệu Local như Mã Số Nhóm Doanh Nghiệp SSM và Logo Cấp Phép Halal Hỗ Trợ Market. | High | [ ] |
| **[ĐẶC NHIỆM: KỊCH BẢN BẮT THÓP "DEV ẨU" CHẾT NGƯỜI (E-commerce Exploits & Hacks)]** |
| **TC-F09.70** | `API` | `Sec` | **[Negative]** Giả Mạo Tiền Giỏ Hàng Qua API (Price Spoofing/Client Trust Bypass) | **1.** Add hàng 500 RM vào giỏ. Ra trang Checkout.<br>**2.** Bật F12 / Postman chặn API `/api/orders/create`.<br>**3.** Sửa Cứng Khối Payload: Đổi giá trị `total: 1.00` hoặc sửa `price` item thành 1 RM rồi nhả Request. | Backend Dev ẩm ương thường lấy nguyên Tổng Tiền từ Client để tạo Đơn! Bắt buộc: Backend PHẢI QUÉT LẠI giá gốc từ DB. Phát hiện sai lệch -> Văng lỗi HTTP 400 "Data Integrity Check Failed". Cấm Bypass! | Blocker | [ ] |
| **TC-F09.71** | `Logic` | `Bound`| **[Negative]** Thuật Toán Số Lượng Âm (Negative Quantity Math Exploit) | **1.** Kẹp Request Update Giỏ Hàng trên Tab Network.<br>**2.** Tráo Request Payload `quantity: -5` gài gửi lên. | Zod Validation từ chối nhận lượng <= 0. Ngăn ngừa lỗi cấn trừ tổng Subtotal của giỏ hàng dẫn đến Checkout ra số tiền Tổng Âm (Lỗi kinh điển Shopee thời đầu). | Blocker | [ ] |
| **TC-F09.72** | `DB` | `Lock` | **[Negative]** Xung đột tranh mua Cùng Lúc (Race Condition DB Lock) | **1.** Kho chỉ còn đúng 1 cái Áo.<br>**2.** Khách A và Khách B dùng Tool Auto cùng ấn Place Order ĐỒNG THỜI CÙNG TÍCH TẮC (JMeter). | Backend Không khoá dòng Row Lock trong CSDL -> Sinh ra 2 Đơn nhưng kho Âm (-1). Yêu cầu Test ép Backend xài Lock. Người B bị dội lại HTTP 409 Conflict: "Hàng vừa hết trong chớp mắt". | Blocker | [x] |
| **TC-F09.73** | `File` | `Sec`  | **[Negative]** Qua Mặt Định Dạng File Biên Lai (Fake MIME Type) | **1.** Dùng file rác mã độc `.exe` hoặc Script Text Rỗng 0 byte đổi thành tên đuôi `receipt.png`.<br>**2.** Tải lên Form QR Bank. | Dev Lười chỉ cản đuôi File ở Frontend HTML `accept=".png"`. Test API chọc thẳng Payload lên Backend bắt BE check `MIME File Signature` Thực tế. Sai File Signature -> Kick HTTP 415. | High | [ ] |

---

## 4. Hành trình Trải nghiệm End-to-End (E2E UAT Flow)
_Mô tả kịch bản kiểm thử dựa trên hành vi thực tế của Khách hàng Malaysia._

1. **[Giai đoạn Tìm kiếm]**: Khách vào `/products`, dùng Sidebar lọc `Fashion` vả giá `< RM 50`. Cuộn trang mượt mà (TC-F09.01, 06, 08).
2. **[Giai đoạn Chọn hàng]**: Chọn SP 'Denim Jacket', xem ảnh gallery PDP sắc nét. Add to Cart -> Drawer trượt ra (TC-F09.12). Thấy gợi ý 'Tee', add luôn (TC-F09.20).
3. **[Giai đoạn Thanh toán]**: Vào Checkout (No Login). Điền info, chọn Bang `Selangor` thấy Ship RM 8.00 và SST 6%. Chọn QR Banking, upload ảnh receipt 1.5MB (TC-F09.28, 33, 34).
4. **[Giai đoạn Hoàn tất]**: Bấm Place Order (TC-F09.30). Sang Confirm page, lưu mã ORD-1234. Cảm thấy an tâm vì giao diện chuyên nghiệp và tin cậy.

---

## 5. Tiêu chí Đánh giá Chất lượng Phát hành (Quality Gates)

| Nhóm Kiểm thử (Criteria) | Trạng Thái (Status) | Ghi chú (Notes & Rules Chuyên Gia) |
|---|---|---|
| **1. AC Coverage** | [x] 100% | Đã ánh xạ toàn bộ 14 Acceptance Criteria vào 62 TCs chi tiết. |
| **2. Malaysia Market Accuracy** | [ ] PENDING | Cần verify SST (6%) và Ship Rates (8/15) chính xác tới từng cent. |
| **3. Mobile UX Native-Feeling** | [ ] PENDING | Sticky CTA và Bottom Sheet phải có cảm giác như App thật, không bị giật lag. |
| **4. Security & Sanitization** | [ ] PENDING | Upload QR Proof và Search Box phải được hardening tuyệt đối. |
| **5. E2E UAT Approval** | [ ] NOT RUN | Cần sự đồng thuận cuối cùng từ PO/BA dựa trên ma trận 62 cases này. |

---
> **Khuyến Nghị Release:** Với việc nâng cấp lên bộ 62 kịch bản chi tiết, đội ngũ BA/QC hoàn toàn có thể tự tin bàn giao tính năng F09 sang giai đoạn Kiểm thử Chấp nhận (UAT) và Release chính thức.
