# TEST PLAN — CHUYỂN ĐỔI DỮ LIỆU PW1 SANG PW2
## Standard Test Plan Document (Theo chuẩn IEEE 829 & ECH QA Convention)

---

### THÔNG TIN KIỂM SOÁT TÀI LIỆU (DOCUMENT CONTROL)

| Mục | Nội dung chi tiết |
| :--- | :--- |
| **Mã tài liệu (Doc ID)** | `TP-MIG-PW1-PW2-2026` |
| **Tên dự án (Project)** | ECH Prime Web v2 (`ech-prime-web-v2`) |
| **Hạng mục (Feature)** | Data & Layout Migration Reconciliation (PW1 Laravel/MySQL → PW2 Next.js/PostgreSQL) |
| **Phiên bản (Version)** | `1.0.0` (Chính thức) |
| **Ngày tạo (Created Date)** | 2026-09-07 |
| **Người lập (Author)** | QA Team / QC Lead |
| **Người duyệt (Approver)** | Tech Lead / Project Manager (PM) |
| **Trạng thái (Status)** | 🟡 **Chờ Leader Phê Duyệt (Pending Approval)** |
| **Tài liệu tham chiếu** | - PRD: [`F40-qa-control-center.md`](file:///home/primer69/source/ech-prime-web-v2/docs/prd/F40-qa-control-center.md)<br/>- Stories: [`F-sso-migration-all-stories.md`](file:///home/primer69/source/ech-prime-web-v2/docs/stories/F-sso-migration-all-stories.md), [`F40-qa-control-center-stories.md`](file:///home/primer69/source/ech-prime-web-v2/docs/stories/F40-qa-control-center-stories.md)<br/>- Matrix: [`pw1-vs-pw2-feature-matrix.md`](file:///home/primer69/source/ech-prime-web-v2/docs/migration/pw1-vs-pw2-feature-matrix.md)<br/>- QC Tool Code: [`MigrationDiffClient.tsx`](file:///home/primer69/source/ech-prime-web-v2/src/app/studio/qa/migration-diff/MigrationDiffClient.tsx), [`pw1-mysql-connector.ts`](file:///home/primer69/source/ech-prime-web-v2/src/lib/admin/qa/pw1-mysql-connector.ts) |

---

## 1. TỔNG QUAN & MỤC TIÊU KIỂM THỬ (INTRODUCTION & OBJECTIVES)

### 1.1 Bối Cảnh (Context)
Hệ thống Prime Web v1 (Laravel + MySQL) đang được thay thế toàn diện bằng Prime Web v2 (Next.js 15 + Payload CMS 3 + PostgreSQL). Đợt chuyển đổi này liên quan đến **2.000 website merchants** đang vận hành. Để đảm bảo quá trình chuyển đổi tên miền (Cutover) diễn ra trơn tru không gián đoạn kinh doanh, kế hoạch kiểm thử này xác định phương pháp, phạm vi, lịch trình và tiêu chí chất lượng bắt buộc.

### 1.2 Mục Tiêu Chất Lượng (Quality Objectives)
1. **Toàn vẹn dữ liệu (Data Integrity):** Tỷ lệ đối soát trường CSDL đạt $\ge 99.0\%$. Không thất thoát dữ liệu sản phẩm, biến thể SKU, giá bán, danh mục, bài viết và cấu hình cửa hàng.
2. **Đồng nhất giao diện (Layout Parity):** Bảo toàn cấu trúc giao diện theo 9 bộ theme chuẩn ([`CANONICAL_TEMPLATES`](file:///home/primer69/source/ech-prime-web-v2/src/lib/admin/qa/migration-diff-engine.ts#L286-L377)); không vỡ layout trên Desktop và Mobile (iPhone 375px).
3. **Bảo vệ tài sản truyền thông (Media & Content Preservation):** Tỷ lệ liên kết ảnh sống đạt 100% (HTTP 200); 100% không lỗi font rác tiếng Việt UTF-8; 100% bảng biểu rich text (`<table>`) được giữ nguyên sau khi chuyển sang Lexical AST.
4. **Không tồn đọng lỗi nghiêm trọng:** **0 lỗi P0 Blocker** tại thời điểm phát lệnh Cutover.

---

## 2. PHẠM VI KIỂM THỬ (TEST SCOPE)

### 2.1 Trong Phạm Vi (In-Scope)
* **Quy mô:** 2.000 website merchants được xây dựng trên nền tảng 9 Theme Canonical (`FB101`, `PA101`, `F102`, `FN104`, `FN103`, `C102`, `C101`, `FN102`, `FN101`).
* **Các nhóm thực thể CSDL (7 nhóm lõi):**
  1. Sản phẩm & Biến thể SKU (`products`, `product_skus`, `brands`).
  2. Banners & CTA Links (`banners`, `product_images`).
  3. RichText & Cấu trúc Bảng (`pages.content`, `posts.content` chuyển sang Lexical AST).
  4. Danh mục & Menu điều hướng (`categories`, `menus`, `menu_items`).
  5. Bài viết Blog (`blog_posts`).
  6. Cài đặt Cửa hàng & Footer (`stores`, `model_settings`, `store_domains`).
  7. Khách hàng & Sổ địa chỉ (`customers`, `customer_addresses`).
* **Hành trình End-to-End người dùng:**
  - Luồng đăng nhập Single Sign-On (SSO) của Merchant sau cutover ([`US-MIG-01`](file:///home/primer69/source/ech-prime-web-v2/docs/stories/F-sso-migration-all-stories.md#L29-L73)).
  - Chuyển hướng SEO 301 Redirects cho các đường dẫn cũ sang mới ([`US-MIGA-11`](file:///home/primer69/source/ech-prime-web-v2/docs/stories/F-sso-migration-all-stories.md#L1401-L1437)).
* **Công cụ phục vụ kiểm thử:** Module đối soát tự động tại [`/studio/qa/migration-diff`](file:///home/primer69/source/ech-prime-web-v2/src/app/studio/qa/migration-diff/MigrationDiffClient.tsx).

### 2.2 Ngoài Phạm Vi (Out-of-Scope)
* Các tính năng mới chỉ phát triển trên PW2 (không có trên PW1): AI Chat Builder (`F01`), Auto-Save Draft (`F12`), Undo/Redo (`F11`), Unsplash Provider.
* Các module đã thống nhất hoãn chuyển đổi (Defer): WordPress Custom Pages ([`US-MIGA-10`](file:///home/primer69/source/ech-prime-web-v2/docs/stories/F-sso-migration-all-stories.md#L1374)).
* Can thiệp ghi đè hoặc chỉnh sửa trực tiếp trên CSDL PW1 MySQL (CSDL PW1 được khóa cứng quyền **Read-Only**).

---

## 3. CHIẾN LƯỢC & PHƯƠNG PHÁP KIỂM THỬ (TEST STRATEGY)

### 3.1 Mô Hình Phân Bổ Nguồn Lực 90 / 10 Cho Team 1 QC

Do nhân sự QC chỉ có **1 người**, việc kiểm thử thủ công 2.000 website là bất khả thi. Kế hoạch áp dụng mô hình **Tự Động Hóa Dựa Trên Tool Kết Hợp Lấy Mẫu Trọng Điểm**:

```
                                 [ 2.000 WEBSITES ]
                                         │
                 ┌───────────────────────┴───────────────────────┐
                 ▼                                               ▼
      🤖 TOOL TỰ ĐỘNG (90%)                           🖐️ QC TEST TAY (10%)
  ┌───────────────────────────────┐               ┌───────────────────────────────┐
  │ - Quét batch 2.000 store      │               │ - 9 Store mẫu (9 Theme gốc)   │
  │ - So khớp trường CSDL 1-to-1  │               │ - Top 50 Store VIP/Doanh thu  │
  │ - Quét HTTP ảnh chết 404      │               │ - Các store bị Tool cắm cờ ĐỎ │
  │ - Bắt lỗi font rác & rớt table│               │ - Kéo trượt Swipe Slider      │
  │ - Phân loại Xanh/Vàng/Đỏ      │               │ - Thử nghiệm Mobile 375px     │
  └───────────────────────────────┘               └───────────────────────────────┘
```

### 3.2 Chiến Lược Lấy Mẫu 3 Tầng (3-Tier Sampling Strategy)

| Tầng Kiểm Tra | Đối Tượng Áp Dụng | Quy Mô | Phương Pháp Thực Hiện |
| :--- | :--- | :---: | :--- |
| **Tier 1 (Golden Samples)** | 9 Theme Gốc (`FB101` đến `FN101`) | **9 stores** | **Kiểm tra thủ công toàn diện:** Kéo thanh trượt Swipe Slider (0-100%), khung Mobile iPhone 375px, click đặt hàng trên Live Iframe. |
| **Tier 2 (High-Risk Sample)** | Top Merchants có doanh thu/traffic lớn + Store bị lỗi Đỏ | **30 - 50 stores** | **Kiểm tra bán tự động:** Mở tab `field_diff`, `media_audit`, `text_audit` để thẩm định chi tiết các trường rủi ro cao. |
| **Tier 3 (Batch Automated Sweep)** | Toàn bộ các store còn lại | **~1.940 stores** | **Ủy quyền 100% cho Tool:** Bấm `[ Quét Lại CSDL ]`, các store đạt Parity Score $\ge 99.0\%$ và 0 lỗi P0 được tự động nghiệm thu. |

---

## 4. MÔI TRƯỜNG & CÔNG CỤ KIỂM THỬ (TEST ENVIRONMENT & TOOLS)

### 4.1 Môi Trường Kiểm Thử (Environment Setup)
* **CSDL Nguồn (PW1):** MySQL 8.0 Staging/Production Read-Only, cấu hình qua biến môi trường `PW1_DATABASE_URL`.
* **CSDL Đích (PW2):** Neon PostgreSQL, Payload CMS 3 Staging.
* **Ứng dụng kiểm thử:** Web App chạy tại `https://ech-prime-web-v2-staging.vercel.app` hoặc môi trường Local QC.
* **Trình duyệt & Thiết bị:**
  - Desktop: Google Chrome (v120+) độ phân giải 1920x1080.
  - Mobile: Giả lập chuẩn iPhone 14 Pro (375x812px) tích hợp sẵn trên giao diện Tool.

### 4.2 Bộ Công Cụ QC Tooling Phục Vụ Kiểm Thử
* **Dashboard Tổng Quan 2.000 Store:** [`MigrationDiffClient.tsx`](file:///home/primer69/source/ech-prime-web-v2/src/app/studio/qa/migration-diff/MigrationDiffClient.tsx)
* **Cơ Chế Bảo Mật & Kết Nối CSDL Live:** [`pw1-mysql-connector.ts`](file:///home/primer69/source/ech-prime-web-v2/src/lib/admin/qa/pw1-mysql-connector.ts) (Tự động chặn 100% lệnh ghi CSDL bằng [`assertReadOnlyQuery()`](file:///home/primer69/source/ech-prime-web-v2/src/lib/admin/qa/pw1-mysql-connector.ts#L64)).
* **Engine Đối Soát & Sinh Mã Sửa Lỗi:** [`migration-diff-engine.ts`](file:///home/primer69/source/ech-prime-web-v2/src/lib/admin/qa/migration-diff-engine.ts)
* **Thanh Trượt Kéo Ngang So Sánh Bố Cục:** Split Swipe Slider GPU `clip-path` 60 FPS.
* **Dual Live Iframe Storefront:** `/api/qa/template-preview/[code]`.

---

## 5. LỊCH TRÌNH THỰC HIỆN & TIẾN ĐỘ (SCHEDULE & WBS — 5 DAYS)

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│     NGÀY 1      │    │     NGÀY 2      │    │     NGÀY 3      │    │     NGÀY 4      │    │     NGÀY 5      │
│ Setup & Quét L1 │───>│ Soi CSDL 1-to-1 │───>│ Soi Media 404 & │───>│ Test Visual UI  │───>│ Re-scan Tổng &  │
│  Lọc Store Đỏ   │    │  Bàn Giao Dev   │    │  Font Tiếng V   │    │ 9 Theme Mẫu     │    │ Ký Nghiệm Thu   │
│  Tiến độ: 20%   │    │  Tiến độ: 40%   │    │  Tiến độ: 60%   │    │  Tiến độ: 80%   │    │  Tiến độ: 100%  │
└─────────────────┘    └─────────────────┘    └─────────────────┘    └─────────────────┘    └─────────────────┘
```

| Ngày | Ca Làm Việc | Nội Dung Công Việc Chi Tiết | Cách Thức (Tool/Tay) | Kết Quả Đầu Ra (Deliverables) | Tiến Độ Lũy Kế |
| :---: | :---: | :--- | :---: | :--- | :---: |
| **Ngày 1** | **Sáng** | - Cấu hình `PW1_DATABASE_URL` trong `.env.local`.<br/>- Kiểm tra kết nối Live MySQL qua modal CSDL (Health Ping `< 200ms`, tìm thấy 15+ bảng). | 🤖 Tool + 🖐️ Tay | Kết nối CSDL an toàn, thông suốt. | **10%** |
| | **Chiều** | - Bấm nút `[ Quét Lại CSDL ]` quét toàn bộ 2.000 store.<br/>- Đọc Dashboard tổng quan: ghi nhận % Pass, Warning, Fail.<br/>- Lọc danh sách các store bị cờ Đỏ (P0 Blocker). | 🤖 Tool (90%) | Báo cáo tỷ lệ Pass ban đầu; danh sách store lỗi P0. | **20%** |
| **Ngày 2** | **Sáng** | - Mở tab `field_diff` trên các store lỗi Đỏ đại diện (`SITE-0001`, `SITE-0025`...).<br/>- Soi chi tiết 7 nhóm thực thể: bắt lỗi mất biến thể SKU, rớt Brand ID, lệch giá. | 🖐️ Tay (70%) | Bảng bóc tách nguyên nhân lỗi dữ liệu CSDL. | **30%** |
| | **Chiều** | - Mở rộng dòng lỗi, trích xuất đoạn code trong khung `Dev Remediation Script`.<br/>- Gửi danh sách bug P0 kèm script fix cho Dev team. | 🖐️ Tay (80%) | Ticket bug gửi Dev kèm sẵn mã script sửa lỗi. | **40%** |
| **Ngày 3** | **Sáng** | - Chuyển sang tab `media_audit`: Tool quét danh sách ảnh PW1 vs PW2.<br/>- Lọc toàn bộ URL ảnh bị lỗi `404 Not Found` hoặc lệch kích thước. | 🤖 Tool (80%) | Danh sách ảnh chết 404 bàn giao Dev sửa link CDN. | **50%** |
| | **Chiều** | - Chuyển sang tab `text_audit`: Quét mã UTF-8 tiếng Việt (chống font rác).<br/>- Bắt lỗi rớt thẻ bảng `<table>` trong các bài viết/mô tả có bảng VietGAP. | 🤖 Tool + 🖐️ Tay | Danh sách nội dung bị mất bảng và lỗi ký tự. | **60%** |
| **Ngày 4** | **Sáng** | - Lọc lần lượt 9 Theme Canonical (`FB101` đến `FN101`).<br/>- Mở tab `visual_stream`, bật `Swipe Slider` (kéo từ 0% → 100%) đối chiếu giao diện.<br/>- Bật chế độ `Mobile 375px` kiểm tra hiển thị trên khung iPhone. | 🖐️ Tay (90%) | 9/9 Theme chuẩn được xác nhận độ tương thích UI/UX. | **70%** |
| | **Chiều** | - Mở tab `live_webview` thử nghiệm cuộn trang, click xem sản phẩm, mở giỏ hàng.<br/>- Bấm `[ Quét Lại CSDL ]` kiểm tra các bản vá Dev đã push. | 🖐️ Tay + 🤖 Tool | Báo cáo re-test các bản fix của Dev. | **80%** |
| **Ngày 5** | **Sáng** | - Bấm `[ Quét Lại CSDL ]` lần cuối trên toàn bộ 2.000 store.<br/>- Kiểm tra Parity Score toàn hệ thống đạt $\ge 99.0\%$, P0 = 0. | 🤖 Tool (90%) | Bảng chỉ số đối soát tổng thể đạt chuẩn. | **90%** |
| | **Chiều** | - Bấm nút `[ Duyệt QC Pass ]` cho các store đạt chuẩn.<br/>- Thử nghiệm 1 luồng Single Sign-On (SSO) login thực tế.<br/>- Lập Biên Bản Nghiệm Thu Chuyển Đổi (Final Sign-off). | 🖐️ Tay (100%) | **Biên bản nghiệm thu chuyển đổi bàn giao Leader & PM.** | **100%** |

---

## 6. MA TRẬN KỊCH BẢN KIỂM THỬ CHI TIẾT (TRACEABILITY MATRIX)

| Mã TC | Tham Chiếu | Phân Loại | Kịch Bản Kiểm Thử | Các Bước Thực Hiện & Dữ Liệu | Kết Quả Kỳ Vọng (Gherkin & DB Validation) | Mức Độ | Phương Thức |
| :--- | :--- | :---: | :--- | :--- | :--- | :---: | :---: |
| **TC-MIG.01** | `US-F40-PW1` | `Security` | Kiểm tra cơ chế Read-Only CSDL PW1 | **1.** Kết nối tới MySQL.<br/>**2.** Gửi lệnh có chứa `INSERT`, `UPDATE`, `DELETE`, `DROP`. | **GIVEN** kết nối CSDL MySQL **WHEN** thực thi lệnh ghi **THEN** hệ thống chặn ngay lập tức với lỗi `[SECURITY ERROR]`. | **P0** | 🤖 Tool Auto |
| **TC-MIG.02** | `US-F40-09` | `Func` | Quét Batch & Lập Chỉ Số 2.000 Store | **1.** Truy cập `/studio/migration`.<br/>**2.** Bấm `[ Quét Lại CSDL ]`. | **GIVEN** Dashboard tổng quan **WHEN** kích hoạt batch scan **THEN** trả về đúng 2.000 stores, phân loại đủ Pass/Warning/Fail. | **P1** | 🤖 Tool Auto |
| **TC-MIG.03** | `US-F40-11`<br/>`US-MIGA-03` | `Data/DB` | Đối soát Sản phẩm & Biến thể SKU | **1.** Mở tab `field_diff`.<br/>**2.** Chọn nhóm `Products` & `Variants`. | **GIVEN** sản phẩm PW1 **WHEN** so sánh với PW2 **THEN** tên sản phẩm, slug, giá bán, SKU và tồn kho khớp 100%, không mất size/màu. | **P0** | 🖐️ Tay + 🤖 Tool |
| **TC-MIG.04** | `US-F40-10`<br/>`US-MIGA-07` | `Content` | Bảo toàn Bảng RichText (Table Tag) | **1.** Mở tab `text_audit`.<br/>**2.** Kiểm tra sản phẩm có bảng VietGAP. | **GIVEN** nội dung HTML chứa thẻ `<table>` **WHEN** chuyển sang Lexical AST **THEN** cấu trúc 3 cột của bảng được bảo toàn nguyên vẹn. | **P0** | 🤖 Tool + 🖐️ Tay |
| **TC-MIG.05** | `US-F40-10`<br/>`US-MIGA-09` | `Media` | Kiểm tra Liên kết Ảnh (HTTP 200) | **1.** Mở tab `media_audit`.<br/>**2.** Xem cột trạng thái HTTP. | **GIVEN** danh sách ảnh banner & sản phẩm **WHEN** gửi request kiểm tra **THEN** 100% trả về `HTTP 200`, không có link `404 Not Found`. | **P1** | 🤖 Tool Auto |
| **TC-MIG.06** | `US-F40-10` | `Content` | Kiểm tra Mã Hóa Tiếng Việt UTF-8 | **1.** Mở tab `text_audit`.<br/>**2.** Kiểm tra tiêu đề và mô tả có dấu. | **GIVEN** văn bản tiếng Việt **WHEN** kiểm tra bảng mã **THEN** không xuất hiện ký tự rác (mojibake), hiển thị mượt mà. | **P0** | 🤖 Tool Auto |
| **TC-MIG.07** | `US-F40-12` | `UI/UX` | So sánh Bố cục Bằng Split Swipe Slider | **1.** Mở tab `visual_stream`.<br/>**2.** Kéo thanh trượt từ 0% → 100%. | **GIVEN** lớp phủ PW2 trên PW1 **WHEN** kéo trượt thanh phân cách **THEN** bố cục đè khít, phần cứng GPU mượt mà 60 FPS, không lệch vị trí. | **P1** | 🖐️ Test Tay |
| **TC-MIG.08** | `US-F40-12` | `UI/UX` | Hiển thị Khung Giả Lập Mobile 375px | **1.** Chọn nút `Mobile (375px)`.<br/>**2.** Kiểm tra khung iPhone. | **GIVEN** màn hình Mobile **WHEN** render giao diện **THEN** bố cục thu gọn chuẩn 375px, menu hamburger và nút mua hàng không bị tràn. | **P1** | 🖐️ Test Tay |
| **TC-MIG.09** | `US-MIG-01` | `E2E/Auth` | Merchant SSO Login Sau Cutover | **1.** Đăng nhập qua TM SSO Portal.<br/>**2.** Quan sát redirect vào PW2. | **GIVEN** tài khoản Owner đã chuyển đổi **WHEN** đăng nhập SSO **THEN** chuyển hướng vào `/dashboard` trong `< 3s`, dữ liệu hiển thị đầy đủ. | **P0** | 🖐️ Test Tay |
| **TC-MIG.10** | `US-F40-09` | `Gate` | Khóa Chặn Phê Duyệt Khi Còn Lỗi P0 | **1.** Mở store có cờ đỏ P0.<br/>**2.** Thử bấm `[ Duyệt QC Pass ]`. | **GIVEN** store còn lỗi P0 **WHEN** bấm duyệt **THEN** hệ thống từ chối phê duyệt, hiển thị cảnh báo yêu cầu fix lỗi P0 trước. | **P0** | 🤖 Tool + 🖐️ Tay |

---

## 7. QUY TRÌNH QUẢN LÝ LỖI & TIÊU CHUẨN PHÂN LOẠI (DEFECT MANAGEMENT)

### 7.1 Ma Trận Phân Loại Mức Độ Nghiêm Trọng (Severity Matrix)

```
┌──────────────┬─────────────────────────────────────────────────┬──────────────────────┐
│  MỨC ĐỘ LỖI  │  DẤU HIỆU NHẬN BIẾT                             │  HÀNH ĐỘNG XỬ LÝ     │
├──────────────┼─────────────────────────────────────────────────┼──────────────────────┤
│ 🔴 P0 Blocker│ - Mất biến thể SKU, sai lệch đơn giá            │ - CHẶN CUTOVER       │
│              │ - Rớt thẻ <table> thành text thường              │ - Dev fix trong 24h  │
│              │ - Lỗi font rác tiếng Việt có dấu                │ - Báo động trực tiếp │
│              │ - Lỗi SSO không đăng nhập được                  │   cho Lead/PM        │
├──────────────┼─────────────────────────────────────────────────┼──────────────────────┤
│ 🟡 P1 Warning│ - Ảnh banner/sản phẩm bị HTTP 404               │ - Dev sửa link CDN   │
│              │ - Thiếu iframe Google Maps ở chân trang         │ - Cho phép cutover   │
│              │ - Méo nhẹ tỷ lệ ảnh trên mobile                 │   nếu có cam kết fix │
├──────────────┼─────────────────────────────────────────────────┼──────────────────────┤
│ 🔵 P2 Minor  │ - Thiếu alt text ảnh phụ                        │ - Đưa vào backlog    │
│              │ - Lệch padding/khoảng cách nhỏ (< 8px)          │   sửa sau cutover    │
└──────────────┴─────────────────────────────────────────────────┴──────────────────────┘
```

### 7.2 Mẫu Báo Cáo Tiến Độ Hằng Ngày Gửi Leader (Daily Report Format)

> Gửi trên nhóm chat dự án (Lark / Slack) mỗi ngày vào lúc **17h30**:

```text
📢 [QC DAILY REPORT] — MIGRATION PW1 → PW2 (NGÀY X/5)
🗓️ Ngày: DD/MM/2026 | Người thực hiện: [Tên QC]

1. TIẾN ĐỘ THỰC HIỆN:
- Tiến độ kế hoạch: ...% / 100% (Đúng tiến độ / Chậm trễ)
- Tổng store đã quét: 2.000 store
- Tỷ lệ Đạt (Pass): ...% (... store)
- Cần xem lại (Warning): ... store
- Lỗi P0 Blocker: ... store (Mục tiêu nghiệm thu: 0)

2. KẾT QUẢ ĐÃ LÀM HÔM NAY:
- Đã hoàn thành: [Mô tả ngắn các hạng mục đã test]
- Đã trích xuất Remediation Script gửi Dev: [Lỗi biến thể, lỗi bảng...]

3. DANH SÁCH LỖI P0 CẦN DEV FIX GẤP TRONG 24H:
- Bug 1: Store SITE-0001 mất biến thể Can 1L (Issue #...)
- Bug 2: Store SITE-0025 rớt thẻ table VietGAP (Issue #...)

4. BLOCKERS & ĐỀ XUẤT HỖ TRỢ:
- [Không có / hoặc: Cần Dev nạp lại CSDL trước 10h sáng mai]

5. KẾ HOẠCH NGÀY MAI:
- [Kế hoạch kiểm thử cụ thể của ngày tiếp theo]
```

---

## 8. TIÊU CHÍ VÀO/RA & CỔNG CHẤT LƯỢNG (QUALITY GATES)

### 8.1 Điều Kiện Bắt Đầu Kiểm Thử (Entry Criteria)
- [x] Môi trường Staging PW2 đã deploy bản build mới nhất ổn định.
- [x] Cấu hình chuỗi kết nối `PW1_DATABASE_URL` thành công và được xác thực quyền Read-Only.
- [x] Script di trú ban đầu (ETL) đã chạy thử nghiệm và nạp dữ liệu vào Staging.

### 8.2 Điều Kiện Tạm Dừng & Chạy Lại (Suspension & Resumption Criteria)
- **Tạm dừng khi:** Kết nối tới MySQL PW1 bị timeout diện rộng, hoặc tỷ lệ Pass ngày 1 dưới 50% (lỗi kiến trúc script migration).
- **Chạy lại khi:** DevOps khôi phục đường truyền CSDL, hoặc Dev cập nhật bản vá script ETL và nạp lại dữ liệu sạch.

### 8.3 Cổng Nghiệm Thu Bàn Giao Cutover (Exit Quality Gate — Go/No-Go)
> [!IMPORTANT]
> Toàn bộ hệ thống chỉ được phép bấm nút chuyển đổi DNS sang môi trường sản xuất khi đáp ứng đồng thời **4 tiêu chuẩn bắt buộc**:
> 1. **Parity Score toàn hệ thống đạt $\ge 99.0\%$** (Hiển thị nhãn xanh trên Tool).
> 2. **Số lượng lỗi P0 Blocker = 0** (100% lỗi rớt biến thể, lệch giá, font rác, mất bảng đã được sửa).
> 3. **Tỷ lệ ảnh sống đạt 100%** (0 lỗi HTTP 404).
> 4. **100% trong 9 Bộ Theme Gốc** được ký xác nhận đạt chuẩn giao diện mắt thường.

---

## 9. QUẢN LÝ RỦI RO & KẾ HOẠCH DỰ PHÒNG (RISK & MITIGATION)

| Rủi Ro (Risk) | Khả Năng & Mức Độ | Biện Pháp Phòng Ngừa & Xử Lý |
| :--- | :---: | :--- |
| **Dev fix lỗi CSDL chậm hơn 24 giờ** | Trung bình / Cao | Gửi kèm đoạn code fix có sẵn từ khung `Dev Remediation Script` trên Tool; báo động PM ưu tiên nguồn lực Dev xử lý trong Ngày 3. |
| **QC bị quá tải do thao tác bấm duyệt 2.000 lần** | Cao / Trung bình | Yêu cầu Dev mở nút **"Duyệt Hàng Loạt (Batch Approve)"** cho toàn bộ store đã đạt điểm xanh $\ge 99.0\%$. |
| **Phát sinh lỗi dữ liệu lớn sát giờ Cutover** | Thấp / Rất cao | Giữ nguyên tên miền trỏ về PW1; không ký biên bản nghiệm thu; dời lịch Cutover sang cửa sổ bảo trì kế tiếp (Zero Risk Policy). |

---

## 10. PHÊ DUYỆT & KÝ DUYỆT BÀN GIAO (SIGN-OFF & APPROVALS)

*Bằng việc ký dưới đây, các bên xác nhận đã đọc, hiểu và thống nhất toàn bộ phạm vi, kế hoạch, nguồn lực và tiêu chuẩn nghiệm thu của đợt chuyển đổi dữ liệu PW1 sang PW2.*

| Đại diện bên liên quan | Họ và tên | Chữ ký | Ngày ký |
| :--- | :--- | :--- | :--- |
| **Người lập kế hoạch (QC Lead)** | | | |
| **Trưởng nhóm phát triển (Tech Lead)** | | | |
| **Quản lý dự án (Project Manager)** | | | |
