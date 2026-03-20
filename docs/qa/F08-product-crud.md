# Quyết Định Kiểm Thử & Kiểm Thử Chi Tiết: F08 - Products CRUD
> **Phiên bản:** 5.0 (Bộ 35-Case Exhaustive Matrix AC-Mapped) | **Cập nhật:** 2026-03-20 | **Thực hiện:** QA Team
> **Nguồn Tham chiếu:** PRD (`F08-products-crud.md`), User Stories (6 US chính)
> **Kỹ năng ứng dụng (.agent):** BDD (Gherkin Expectations), Security Contexting (IDOR, XSS), Boundary UI/UX Check, Performance Edge.

---

## 1. Mục Tiêu (Objective)
Tài liệu Test Case này được xây dựng nhằm đảm bảo chất lượng toàn diện cho tính năng Quản lý Sản Phẩm (Products CRUD - F08) trên Dashboard. Mục tiêu cốt lõi là đạt độ phủ 100% cho 6 User Stories từ Basic CRUD, Matrix Phân loại (Variants), Bulk Generated AI, SEO Optimization cho đến Cây Danh mục (Categories) và Dynamic Attributes.

Bộ kiểm thử tập trung khai thác các case Mất mát (Out of stock), Lỗi hệ thống khi tải nặng (Bulk Create limit), và Quyền truy cập IDOR.

---

## 2. Test Environment (Môi trường Kiểm thử)
| Biến (Variable) | Yêu cầu (Requirements) |
|---|---|
| Môi trường (Env) | Staging / Pre-Production (`staging.primeweb.app`) |
| Browsers | Chrome (v110+), Firefox (v105+), Safari iOS |
| Devices (Responsive) | Desktop (1920x1080), Tablet iPad, Mobile (iPhone 14 Pro 375px) |
| Test Data & SLA | File ảnh >5MB, Payload AI Prompt 10,000 ký tự, Inject XSS `<script>` |

---

## 3. Unified Test Cases (Traceability Matrix)

| ID | Tham chiếu | LOẠI | TIÊU ĐỀ (Scenario) | CÁC BƯỚC THỰC HIỆN & DỮ LIỆU (Steps & Test Data) | KẾT QUẢ MONG ĐỢI GHERKIN & DB CHECKS (Expected) | MỨC ĐỘ | AUTO |
|:---|:---|:---|:---|:---|:---|:---:|:---:|
| **[US-F08-01: Products CRUD + Trạng thái Sản phẩm (Active/Draft) & Empty State]** |
| **TC-F08.01** | `AC-1` | `UI` | **[Positive]** Giao diện Tạo Sản phẩm Cơ bản | **1.** Tới `/dashboard/products`. Click `Thêm sản phẩm`. | Hiển thị đủ Input: Tên (Name), Giá thực (Price), Giá k/mãi (Compare), Box ảnh. Khung Category, Stock, SKU. Giống Figma Design. | High | [ ] |
| **TC-F08.02** | `AC-1.1` | `UI` | **[Positive]** View Product List Empty State | **1.** Reset CSDL sạch bóng Sản phẩm Tenant hiện tại.<br>**2.** Tải lại `/dashboard/products`. | **THEN** Hiển thị component "No Data" Empty State.<br>Có hình Illustration, text "Chưa có sản phẩm nào" và Nút tạo SP. | Medium | [x] |
| **TC-F08.03** | `AC-1.5` | `Edge` | **[Negative]** Validation Form Tạo Bắt Buộc | **1.** Bỏ trống Tên, Giá bán, Stock.<br>**2.** Bấm `Save`. | **WHEN** Nhấn Submit **THEN** Chặn Luồng API. UI highlight Box Đỏ, Text Error Cảnh báo `Vui lòng nhập thông tin`. | Blocker | [ ] |
| **TC-F08.03b**| `FR-07`  | `Logic`| **[Negative]** Validation Tên Sản Phẩm Tối Thiểu (< 3 Ký tự) | **1.** Điền tên ngắn quá mức: `Áo`. | Trình Zod Parser bắt chặn Field Tên báo lỗi "Tên SP cần dài hơn 3 ký tự". Hành vi Submit bị Disabled. | High | [ ] |
| **TC-F08.03c**| `FR-07`  | `Logic`| **[Negative]** Validation Số Âm (Giá bán & Tồn Kho) | **1.** Nhập Giá = `-15`.<br>**2.** Stock = `-1`. | React Hook Form báo lỗi tại Inline Field Đỏ Rực: "Giá trị không được nhỏ hơn 0". Quét sạch rác âm Number. | Blocker | [ ] |
| **TC-F08.03d**| `FR-07`  | `Logic`| **[Negative]** Validation Cân Nặng (Weight <= 0) | **1.** Cố ý nhập `0kg` hoặc `-1.5kg`. | System báo lỗi "Cân nặng phải lớn hơn 0 để làm mốc tính cước phí Vận Chuyển F14". Khóa luồng tạo SP. | High | [ ] |
| **TC-F08.03e**| `FR-07`  | `Logic`| **[Negative]** Validation Bỏ Chọn Component Ngành Cấp | **1.** Cố tình không Tick chọn bất kỳ Group Danh Mục (Category) nào. | Trả lỗi Validation "Sản phẩm phải thuộc tối thiểu 1 Danh Mục phân loại". Chặn Lưu Bất Kể Sức Lực. | High | [ ] |
| **TC-F08.03f**| `FR-09`  | `Limit`| **[Negative]** Validation Upload File Sai Dạng / Nặng Quá Tải (> 5MB) | **1.** Đi thả Object File Lớn `15MB.jpg`.<br>**2.** Upload Kém Dạng File `Invoice.PDF`. | Dropzone từ chối khéo Data Ảnh vào RAM Bộ Nhớ Cloud. Trả Alert Toast Góc Cam: "Chỉ Nạp Dạng JPG/WEBP/PNG Nhỏ Hơn 5MB." | Blocker | [ ] |
| **TC-F08.03g**| `FR-09`  | `Limit`| **[Negative]** Validation Limit Bóp Đẩy > 5 Hình Cùng Chuỗi | **1.** Chọn 1 Lúc Kéo Chuột Select 7 Cổ Phiếu Ảnh. Nhả Nút Drop Lên Màn Tải. | Khung Upload Giựt Lại Ảnh Thứ 6 & Thứ 7. Phả Khói Phản Hệ "Giới Hạn Tối Đa Tải Được 5 Ảnh Hàng". Bóp Chết Lỗi. | High | [ ] |
| **TC-F08.04** | `AC-1.6` | `Func` | **[Positive]** Trạng Thái Draft Mặc Định (Draft Default) | **1.** Điền đầy Form hợp lệ. Bấm Save. | **EXPECTED** Cờ Database gán `Status: 'Draft'`. SP Không xuất hiện ngoài Storefront. Có Toast "Đã lưu nháp". | Blocker | [x] |
| **TC-F08.05** | `AC-2` | `AI` | **[Positive]** AI Description Generation | **1.** Điền "Tên sản phẩm".<br>**2.** Click `✨ AI Viết Description`. | AI Generate Body Text sinh nhịp Stream chèn chuẩn vào Khung RichText. Không lỗi Format HTML. | High | [ ] |
| **TC-F08.06** | `AC-3` | `Logic` | **[Positive]** Delete Product - Soft Delete & Undo | **1.** Click Thùng Rác của 1 SP có sẵn.<br>**2.** Nhanh tay Click Undo Trực tiếp trên Bảng Toast báo. | Database Ghi Nhận cờ `deletedAt: Timestamp`, sau đó Undo thì Rút cờ ra. API Get Mất Tạm Thời Rồi Phục Hồi Lại. | High | [x] |
| **TC-F08.07** | `AC-4` | `UX` | **[Positive]** Cảnh Báo Low/Out of Stock Đỏ | **1.** Cố ép Data SP Tồn kho `Stock = 0`. Nhìn Danh sách. | Cột Stock đổi Badge Đỏ `🔴 Hết hàng` báo gắt gao. Chức năng Filter "Lọc Hết Hàng" Trả Trúng Object Này. | High | [ ] |
| **TC-F08.08** | `AC-5` | `SEO` | **[Edge]** Hành vi Bảo Tồn Link SEO Của SP Stock=0 | **1.** Ở ngoài Mặt tiền Storefront F09 đi Load cái SP Hết kho trên. | Màn Hình Storefront VẪN HIỂN THỊ SP ĐÓ chứ không báo rỗng 404 (Giữ chân Traffic Google). Nút "Thêm Vào Giỏ" Mờ Tịt + Label "Hết Hàng". | Blocker | [x] |
| **TC-F08.08b**| `BR-05`| `Logic` | **[Positive]** Giấy phép Halal (Malaysia Market) | **1.** Bật Toggle "Halal".<br>**2.** Upload file chụp chứng nhận. | Ảnh Cert được đẩy lên AWS/S3. Data ghi nhận cờ Halal = True. Hiển thị tem xanh Halal Certified ngoài Storefront. | Blocker | [ ] |
| **TC-F08.08c**| `FR-07`| `Logic` | **[Negative]** Giá Khuyến Mãi Nhỏ Hơn Giá Áp Dụng | **1.** Điền Giá Gốc (Price) = `RM 50`.<br>**2.** Điền Giá Khuyến mãi (Compare at) = `RM 30`. | UI báo Error Đỏ: "Giá Khuyến mãi (Compare At) phải LỚN HƠN Giá Thực Bán". Nút Save bị Vô hiệu hóa. | High | [ ] |
| **TC-F08.08d**| `FR-07`| `Data` | **[Positive]** Bắt Buộc Nhập Dimensions Nặng Nhẹ & Kích Thước | **1.** Nhập Cân Nặng (kg): `1.5`. Kích thước `D x R x C`: `20x30x10`. | Ghi nhận Data Schema hoàn hảo. Trường dữ liệu sống phục vụ Core Tính Cước Phí Vận Chuyển F14 (Shipping Provider). | High | [ ] |
| **TC-F08.08e**| `BR-03`| `Data` | **[Positive]** Xử lý Trùng Tên SP (Duplicate Name) | **1.** Cố ý tạo SP lấy tên "Cỏ Lúa Mì" (Tên đã có 1 SP y hệt trong Shop). | Backend không Crash văng lỗi Unique Mongoose. Hàm Auto-Slug tự xử lý nối chuỗi đúc thành URL `co-lua-mi-1`. | High | [ ] |
| **TC-F08.08f**| `BR-04`| `Edge` | **[Positive]** Hình Thức Tặng Kèm 0 Đồng (Zero Price) | **1.** Điền Price = `0`. Validate Form. | Zod Validation chấp nhận (>=0). Payload CMS lưu SP giá 0 đồng, Phục vụ Khuyến Mãi Quà Tặng Tương ngộ. | Medium | [ ] |
| **[US-F08-02: Quản lý Biến thể (Variants) & SKU Tồn kho]** |
| **TC-F08.09** | `AC-1` | `UI` | **[Positive]** Bật Cờ Cấu hình Phân Loại Variant | **1.** Bật "Sản phẩm có tuỳ chọn (Phân loại)" | Khối Single Price & Stock Ngay Giữa Màn Hình Tạm Thời Giấu đi. Form nhập "Màu sắc", "Kích cỡ" Level 1 Hiển Lộ Ra Mượt Mà. | High | [ ] |
| **TC-F08.10** | `AC-2` | `Logic` | **[Positive]** Gen Bảng Khung Hai Tầng (2-Tier Matrix) | **1.** Thêm Nhóm Tầng 1: Đỏ, Xanh.<br>**2.** Nhóm Tầng 2: S, M. | DOM Căn sinh Bảng Tọa Độ Chéo Đủ 4 Tổ Hợp Dòng Ngay Lập Tức: Đỏ-S, Đỏ-M, Xanh-S, Xanh-M. Format Mỗi Dòng Đủ TextBox Bắt Nhập: SKU, Giá, Kho (Bố Cục Chặt). | Blocker | [x] |
| **TC-F08.11** | `Limit` | `Boundary`| **[Negative]** Tường Lửa Giới Hạn Tầng Phân Loại Đệ 3 | **1.** Định Click Bấm Thêm Tầng Level 3 Kế Cận. | System Biến Mất Cụm Nút `+ Thêm option mới` Bắt Lính 2 Level Tối Đa. Code Khóa Hook Logic Quá Quy Củ Phân Định Tầm Hài Hòa Giới Hạn Khối Array. | High | [x] |
| **TC-F08.12** | `AC-3` | `Logic` | **[Positive]** Cô Lập Kho Bãi Tách Chỉ Số Option (Partial OOS) | **1.** Báo Số Lượng Cho Mã Kho "Đỏ-M" Dưới Mức 0. Còn "Xanh-M" Là 5 | **THEN** Mặt Phố Storefront Chỉ Che Sẫm Màu Click Nút "Đỏ-M". Khách Ngoại Vẫn Tươi Thấm Chọn Mua Được Cột Khác Bình Thường Ảo Kịch Bản Giao Suông Cấp Đơn. | Blocker | [x] |
| **[US-F08-03: Tự động Tối ưu Tìm kiếm (AI SEO Generation)]** |
| **TC-F08.13** | `AC-1` | `AI` | **[Positive]** Sinh Dữ Liệu Róc Rách Thấu Cảm | **1.** Gõ Tên: "Trà Đào Cam Sả". Cuộn Bấm "✨ Tối ưu Tìm Kiếm Tự Động". | Trả Trúng Bộ Payload: [Meta Title]: `Trà Đào Cam Sả - Thanh Mát`, [Desc] <= 150 Chars, và Chuyển Đổi [URL Slug] `tra-dao-cam-sa` Lược Cắt Dấu Tuyệt Vời Không Rách Font Chữ Unicode Á Châu. | High | [ ] |
| **TC-F08.14** | `AC-2` | `Data` | **[Positive]** Thủ Bám Khối Giá Trị Do Ngón Tay Người Nhập Đoạt Quyền | **1.** Chữ Của AI Sinh Xong Rồi.<br>**2.** User Trõ Tay Gõ Xóa Chêm Nghĩa Từ Khác Lên.<br>**3.** Save Lại SP. | Máy Phận Lưu Hoàn Toàn Nhịp Của User Không Cứng Cựa Đắp Nhầm Trả Lại Của AI Override. Data Nằm Trong JSON Database Tuyệt Trí Khớp Thắng Người. | Medium | [ ] |
| **[US-F08-04: Tạo sản phẩm Hàng Loạt (Bulk Create) bằng AI Context]** |
| **TC-F08.15** | `AC-1` | `AI` | **[Positive]** Chat Gen Grid Bulk Khối Lượng Tiêu Chuẩn | **1.** Copy Drop 2 Văn Đoạn Nhu Cầu Gồm: Tên Món Và Giá Tiền Gắn Theo Cặp ("Dép 20k, Quần 50k Màu Trắng Đen"). | Máy LLM Đoán Context Cắt Parse 2 Option JSON Đúng Dáng Ngồi Rập Grid. Biểu Bảng Xổ Trượt Show Gồm 2 Mặt Hàng. Khối Variant Nấu Phẳng Text (Trắng, Đen) Ra Dòng Cho Quần Đích Đáng. | Blocker | [x] |
| **TC-F08.16** | `AC-2` | `Func` | **[Positive]** Confirm Đi Lệnh Xổ Database Sinh Gốc Draft | **1.** Liếc Mắt Duyệt 2 Hàng Bảng Trên UI Xong Ấn Cục Đóng Chốt "Lưu". | Lệ Ráp Mảng 2 Sản Phẩm Trắng Tinh Draft Vào Bụng DB Báo Bảng Ngọt Ngoạc Toast `Đã tạo 2 sản phẩm nháp`. Hình Ảnh Block Mồi Phải Rỗng (0 Ảnh). | High | [ ] |
| **TC-F08.17** | `AC-3` | `UI` | **[Positive]** Render Bùa Ảnh Fallback Thùng Carton Đang Không Nguồn Gốc | **1.** F5 Lại Lịch Sử Xem Giao Diện Danh Sách SP Ở Trên (Bulk Tạo). | Không Ra Lỗi Bắt HTML Image Đứt Gãy. Tái Hiện Component Default Ảnh Minh Họa Cục Hình Vuông Chữ "📦 Carton Box". Rất Chỉn Chu Layout Thắng Thế Gọn Lẽ Khúc Xử Lý Edge Của Browser Missing Src Link Khác Biệt. | Medium | [x] |
| **TC-F08.18** | `Limit` | `Sec` | **[Negative]** Đâm Tức Token Khớp Size API Báo Dump (Stress AI Bulk) | **1.** Điền Rõ Danh Sách Chat Khung Ngót Hơn 100 Sp Text Nhồi Nhét Khổng Lồ Dòng | Rào JS App Trận Cự Lập Tức Kick Toast: "Xin Điền Giới Hạn Tần Cấp Ít Hơn Nhằm Bảo Trì Size Bộ Lọc Chat Chuẩn AI Mượt, Quá Số 20 SP Chống Server Nhấp Nghẽn". Payload Kéo Chưa Bắn DB. | Blocker | [x] |
| **[US-F08-05: Quản lý Danh mục Phân cấp (Category 3-Level)]** |
| **TC-F08.19** | `AC-1` | `Boundary`| **[Negative]** Chân Tường Số Limit Nhánh Level 3 Categories Thư Viện Chặn Bóp Băng Hệ 4+ | **1.** Setup Root>A>B Xong Bấm Thêm Cực Child Tạo Ra Thằng Cha Nữa. | Thả Đọc DB Node Model Mongoose Đả Kích Tự Khóa Nút Thêm Vào Node Cuối L3 Khai Khống Rào `Lớp Chặn Cây Phả Chỉ Nhận Thấm Tầng L3 MAX`. Không Phụ Phình Dài List Menu Sidebar Vực Gọng Khách UX Web Khó Theo Dõi Tìm Kím. | High | [x] |
| **[US-F08-06: Thuộc tính Mở rộng (Attributes) & Giao diện Storefront]** |
| **TC-F08.20** | `AC-1`| `Func` | **[Positive]** Array Thuộc Tính Đa Biến Value Lạc Kính Chịu Sàng Tình Thương Schema | **1.** Bơm Chêm Key: `Vật Lý`, Val: `Nóng Mỏng Cứng`. Cho Cả Thêm Key Tự Mở List Thứ 2. | Input Gen State React Ăn Kíp Đủ Rắn Data JSON Array Đỗ Đong Vào DB Tốt Lên Bắn Thành LD-JSON Thẻ Cho SEO Nhặt Kẽ Rich Khóa Schema Hoạt Ngọt Hoạch Data Table Bồi Thêm Bên Dưới F09 Lẫn Mặt Web Người Dùng Hoạch Data Table Chữ Vững. | High | [ ] |
| **[Bảo Mật Security Cốt Lõi Đặc Trị Quản Công API Hỗn Thế IDOR Của Khung App Lõi]** |
| **TC-F08.21** | `BR-01`| `Sec` | **[Negative]** Phanh Vây Phóng Nối Thép Cấp Authentication User Token Gửi Kẹt ID Đối Lập Chủ Mạng IDOR | **1.** Đổi Proxy Hack Payload Sửa Tham Biến ID Chắn Sang Hàng Chữ Của Tenant Hát Chéo Đi Của Quán Đối Thủ. Bấm Ráp FETCH Tĩnh Nhanh.| Tường Role Auth Admin Block Request Error Code Sụp Http `403 Forbidden` API Thọc Sai Trật Identity Token Quản Mục Cấm Nhúng Xóa Xoay Hư Hại Tài Sản Mối Link Sang Khay. Backend CMS Sạch Điểm Tĩnh Giáp Chắn Siêu Mật Payload Tự Định Dọc. | Blocker | [x] |
| **TC-F08.22** | `Sec` | `Sec` | **[Negative]** Lọc Dom Tiêm Mã Cú Bựa Đặt DOM Cross-site Scripting XSS Vào Tag Lỗ Mô Tả Html Tự Lành Vết Nhanh Gọt Cạnh| **1.** Đống Mô Tả Mớ Rich Content Cho Tráo Chuỗi Script Nặng Load `<script>fetch(url_cookie...)</script>`.| Rào Cấp Sanitize HTML Code Lọc Báo Quét Quãng Kẹp Tóm Dập Node Lạ Bỏ Trùng Filter Dóng Mạch Đoản Mất Text Thường Khung Mất Mùi Diệt Sâu Tiêm Payload Quá Trình Load Ra Storefront Bảo Tức Nóc XSS Khương Nổ Tốt Trí Trị Quản Lý Chắc Tường Web Mỏng Nhằm Triệt Ẩn Chì. | Blocker | [x] |

---

## 4. Hành trình Trải nghiệm End-to-End Thực Tế (E2E UAT / Persona Scenarios)
_Đánh giá hệ thống dựa trên kịch bản kinh doanh và hành vi của người dùng thực tế (Merchants)._

| Mã UAT | Bài toán Kinh tế (User Persona) | Hành trình thao tác (E2E Steps) | Nút thắt cần Verify (Critical Checkpoints) |
|---|---|---|---|
| **UAT-01** | **Chủ Shop Mỹ Phẩm (Nhiều Biến thể)**<br>Bán 1 dòng Son Môi nhưng có 20 mã màu khác nhau. Lúc nhập kho chỉ có 1 màu Đỏ Ruby (Stock=100), 19 màu còn lại đều Hết hàng. | 1. Bật Variants, nhập Mùi/Màu (20 options).<br>2. Sửa thủ công Stock Của Option màu khác thành 0.<br>3. Mở Storefront (F09) coi Thỏi Son. | Hệ thống phải xử lý mượt Bảng 20 dòng Variant không bị đơ/lag UI. Ra Storefront, 19 ô màu Mờ/Gạch chéo không cho Click mua, bảng đổi màu nhanh nhẹn. |
| **UAT-02** | **Dropshipper Hàng Order (Tốc độ & Cào Data AI)**<br>Chuyên Copy nguyên một list nguồn hàng order Quảng Châu từ Zalo để paste Tạo sản phẩm hàng loạt (Bulk). | 1. Coppy Log chat Zalo (có Tên + Giá + Tiếng lóng).<br>2. Ném vào khung Prompt: `✨ AI Gen Bulk`.<br>3. Chọn Publish tất cả. | Kiểm tra sức chịu tải của Payload AI Prompt (Văn phong lộn xộn, icon). Xem AI có "bóc" được đúng Tên Áo & Giá Tiền ráp thành 20 Sản phẩm Draft ngay trong 10s không. Ảnh Fallback phải lên đều. |
| **UAT-03** | **Quán Trà Sữa F&B / Dịch vụ Vô hình**<br>Bán Topping hoặc Sản phẩm Tặng kèm. Không cần Cân kiện, không cần Quản kho, Giá Tặng = 0đ. | 1. Thêm SP "Trân châu trắng (Tặng 0đ)".<br>2. Tắt Toggle `Theo dõi Tồn Kho`.<br>3. Bỏ qua Cân nặng Shipping. Price = 0. | Lưu thành công vào Database. Giỏ hàng cho phép Checkout giá 0đ không bị báo lỗi. Đẩy đơn Vận Chuyển không bị kẹt vì cân nặng. |
| **UAT-04** | **Content Creator / KOC (Lười Gõ SEO)**<br>Sản phẩm đã có sẵn, chuẩn bị Livestream cạy SEO đón Traffic từ TikTok vứt Link Affiliate vào nhưng lười nghĩ Meta Title. | 1. Tới sản phẩm đã có.<br>2. Gõ keyword sơ sài. Bấm "Tự động SEO".<br>3. Lưu và Gửi Link Zalo check Meta. | Check OpenGraph tags. Copy Link SP dán qua Facebook/Zalo phải hiện đủ Ảnh Thumbnail cực bén, Tên Title thu hút và Slug sạch (friendly-url). |

---

## 5. Tiêu chí Đánh giá Chất lượng Phát hành (Quality Gates)

| Nhóm Kiểm thử (Criteria) | Trạng Thái (Status) | Ghi chú (Notes & Rules .Agent Trích Chọn) |
|---|---|---|
| **1. UI/UX Coverage** | [ ] Đã chạy 0/8 TC | Form Nhập Check Trống Dòng Lấn Variant Matrix Lỗi Validation Không Sinh Bug UI Tạp Nợ |
| **2. AI Logic & Functions** | [ ] Đã chạy 0/4 TC | Bot Phả Text Tiếng Việt Hợp Nội Địa + Prompt XSS Không Hỏng Kí Tự Chéo Phanh Dịch Trục Cắn Nát Text Mảnh JSON Dòng. |
| **3. Security & DB Validation** | [ ] Đã chạy 0/4 TC | Đóng Lõi IDOR, Ngăn Size Token Tồn Matrix DB Bóp Load Trang Quẹt Nhanh 2 Cú Click Duplicated Trùng Data Block Save Trễ API. |
| **4. Performance SLA** | [ ] Not Run | API LLM Chat Xong Xuất Phản Bảng Tĩnh Response Kịp 1 Cục Ngắn Ngót 20s. |
| **5. E2E UAT Approval** | [ ] Not Run | Matrix SKU Test Bắt Chọn Hụt Size Ném Mặt Tiền Pass P0 Tròn 1 Lượt Không Flaky Lủng Mã Test Runner Code Lệnh Máy Chạy Quét Auto. |

> **Khuyến Nghị Release:** Các Nhóm Phân Test Đã Bấm Đinh Vô Story Từng Chỉ Tiêu Traceability Cực Mịn 1:1, Matrix Size 22+ Case Tuyến Cốt Chặt. P0, P1 Phải Bọc Auto Run Gõ Test Tự Động Vào Core Mới Gọi Mác Ký Tên Dập Dấu Thả Dựng Đi Live.
