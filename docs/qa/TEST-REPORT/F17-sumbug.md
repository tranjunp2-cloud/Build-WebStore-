# Bug Report Summary — F17 Blog Management

> **Project:** ECH Prime Web v2
> **Environment:** Staging
> **Date:** 2026-04-10
> **Reported by:** QA Team (Extracted from Test Reports)
> **Status:** 🔴 OPEN — Pending Dev Fix

---

## Tổng quan

| Feature | Tổng Bug | P0 Critical | P1 High | P2 Medium | P3 Low | Trạng thái |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| F17 — Blog Management | 37 | 3 | 12 | 14 | 8 | 🔴 BLOCKED |

> **⚠️ Release Decision: BLOCKED**
> Có 3 lỗi P0 Critical nghiêm trọng về bảo mật (truy cập CMS không cần Auth) và 12 lỗi P1 cản trở luồng tính năng cần được fix ngay lập tức.

---

## Danh sách Bug

### 🔴 P0 — CRITICAL (MUST FIX)

---

#### BUG-F17.26 · Lỗi Bảo Mật: Truy cập CMS `/blog` KHÔNG cần Authentication

| | |
| :--- | :--- |
| **TC-ID** | TC-F17-09-01 |
| **Severity** | 🔴 P0 Critical |
| **Module** | RBAC & Bao Mat He Thong |

**Mô tả:**
User ẩn danh (chưa đăng nhập) khi truy cập thẳng vào CMS qua URL `/blog` có thể thấy toàn bộ giao diện CMS: từ sidebar quản lý, danh sách blog (kể cả bài viết Draft), nút gọi Create Post. Hệ thống **không** redirect user về trang `/login`. Lỗ hổng nghiêm trọng P0.

---

#### BUG-F17.30 · Lỗi Bảo Mật: Magic Byte Validation Missing

| | |
| :--- | :--- |
| **TC-ID** | TC-F17-02-13 |
| **Severity** | 🔴 P0 Critical |
| **Module** | Security / Upload |
| **Nguồn** | Issue #127 |

**Mô tả:**
Chưa kiểm tra file signature (Magic Byte) server-side cho Thumbnail. Trình duyệt chỉ có attribute `accept` (client-side) nhưng server không validate, có thể đổi đuôi file độc hại (vd: `.exe` thành `.jpg`) để upload và bypass security.

---

#### BUG-F17.33 · Lỗi Dữ Liệu: Xóa Category KHÔNG có fallback Uncategorized

| | |
| :--- | :--- |
| **TC-ID** | TC-F17-05-06 |
| **Severity** | 🔴 P0 Critical |
| **Module** | Category / Data Integrity |
| **Nguồn** | Issue #129 |

**Mô tả:**
Khi xóa Category, API chỉ thực hiện soft delete (status: 'deleted') nhưng KHÔNG update (cascade) các bài viết đang được gắn category này. Kết quả là các post bị orphan reference thay vì chuyển sang Uncategorized. Vi phạm AC-3 nghiêm trọng.

---

### 🟠 P1 — HIGH (MUST FIX)

---

#### BUG-F17.06 · Title maxLength bị giới hạn 60 ký tự (Spec yêu cầu 255)

| | |
| :--- | :--- |
| **TC-ID** | TC-F17-02-03 |
| **Severity** | 🟠 P1 High |
| **Module** | Create & Edit Blog Post |

**Mô tả:** 
Khi user nhập title trên màn tạo blog, trường dữ liệu bị tự động cắt bớt ở 60 ký tự (`maxLength=60`). Spec document yêu cầu `maxLength=255`. Gây ảnh hưởng trực tiếp đến người viết blog.

---

#### BUG-F17.08 · Trường thông tin Slug (URL) không hiển thị trên giao diện tạo bài viết

| | |
| :--- | :--- |
| **TC-ID** | TC-F17-02-04/06/07 |
| **Severity** | 🟠 P1 High |
| **Module** | Create & Edit Blog Post |

**Mô tả:** 
Không tìm thấy ô Input hiển thị và cho phép chỉnh sửa SEO URL Slug trên giao diện tạo mới `/blog/new`. User không thể xem trước hay chủ động đổi Slug trước khi lưu bài. 

---

#### BUG-F17.11 · Nút Save không bị vô hiệu hoá sau khi ấn (Nguy cơ Double-Submit)

| | |
| :--- | :--- |
| **TC-ID** | TC-F17-02-18 |
| **Severity** | 🟠 P1 High |
| **Module** | Create & Edit Blog Post |

**Mô tả:** 
Nút "Save" vẫn có thể click liên tục (isDisabled=false) sau lần ấn đầu tiên, dễ dẫn đến hiện tượng submit nhiều lần (Double Submit) gây lỗi data hoặc spam API. Cần disable ngay sau khi click.

---

#### BUG-F17.22 · Chuyên mục (Category): Thiếu toàn bộ luồng giao diện CRUD 

| | |
| :--- | :--- |
| **TC-ID** | TC-F17-05-01~05 |
| **Severity** | 🟠 P1 High |
| **Module** | Category Management |

**Mô tả:** 
Trang `/blog/categories` có tồn tại nhưng trống trơn, không hiển thị Form Create, nút Create hay chức năng Edit tên Categories. Feature chưa được Code Front-End, block 8 Test Cases.

---

#### BUG-F17.24 · Bể layout thanh cuộn ngang (Horizontal Scroll) tại Mobile 320px

| | |
| :--- | :--- |
| **TC-ID** | TC-F17-06-03 |
| **Severity** | 🟠 P1 High |
| **Module** | Mobile Web UX |

**Mô tả:** 
Giao diện editor và List bị bung khung, nội dung chiều ngang rộng hơn màn hình thiết bị (Chiều rộng 693px đặt trên 314px viewport) bắt buộc user phải cuộn ngang. Nguyên nhân do lớp vỏ `main` lưu padding sidebar `md:pl-[260px]` nhưng không triệt tiêu trên mobile.

---

#### BUG-F17.26a · Không truy cập được trang Storefront `/blogs`

| | |
| :--- | :--- |
| **TC-ID** | TC-F17-07-01~06 |
| **Severity** | 🟠 P1 High |
| **Module** | Storefront Blog List/Detail |

**Mô tả:** 
URL Public (unauthenticated) dành cho Khách truy cập web (`/blogs`) hiện không thể render bình thường (Not Reachable). List/Detail Blog cho độc giả chưa hoạt động.

#### BUG-033 · Trang Blog chưa có thiết kế responsive mobile

| | |
| :--- | :--- |
| **TC-ID** | *Không có* |
| **Severity** | 🟠 P1 High |
| **Module** | Blog / Mobile |

**Mô tả:** 
Trang Blog chưa có thiết kế responsive cho mobile. Hiển thị bị vỡ hoặc thiếu layout trên các thiết bị màn hình nhỏ.

---

#### BUG-034 · Ấn icon Edit mở ra trang 404

| | |
| :--- | :--- |
| **TC-ID** | *Không có* |
| **Severity** | 🟠 P1 High |
| **Module** | Blog / Edit |

**Mô tả:** 
Trong danh sách bài viết, khi user nhấn icon Edit của một bài, trang chuyển sang 404. Link của icon Edit bị sai hoặc chưa được gắn. Mặc dù hàng (Row) trước đó có báo lỗi không bấm được ở BUG-F17.12, việc icon nhấn bị 404 làm tê liệt flow edit riêng rẽ.

---

#### BUG-035 · Publish Date sai logic: chọn ngày tương lai nhưng post publish ngay

| | |
| :--- | :--- |
| **TC-ID** | *Không có* |
| **Severity** | 🟠 P1 High |
| **Module** | Blog / Publish Logic |

**Mô tả:** 
Khi user đặt "Publish Date" là ngày trong tương lai rồi nhấn Publish, bài viết được publish ngay lập tức thay vì chờ đến ngày đã hẹn. Logic scheduled publish bị thiếu dẫn đến bài bị đẩy luôn.

---

#### BUG-F17.28 · Bulk Publish có function tồn tại nhưng KHÔNG có UI Button

| | |
| :--- | :--- |
| **TC-ID** | TC-F17-01-17 |
| **Severity** | 🟠 P1 High |
| **Module** | Bulk Action |
| **Nguồn** | Issue #126 |

**Mô tả:**
Tính năng Publish hàng loạt (Bulk Publish) được định nghĩa code trong `handleBulkPublish` nhưng máy con trên màn hình Bulk Actions Bar chỉ render mỗi nút Delete, không có nút Publish. AC yêu cầu có tính năng bulk publish rõ ràng.

---

#### BUG-F17.31 · Network Error Content Loss (localStorage cache missing)

| | |
| :--- | :--- |
| **TC-ID** | TC-F17-02-17 |
| **Severity** | 🟠 P1 High |
| **Module** | Editor / State |
| **Nguồn** | Issue #127 |

**Mô tả:**
Khi rớt mạng lúc lưu bài, nội dung bài viết bị mất, không được lưu cache ở localStorage như AC yêu cầu. Chỉ có mỗi Toast error báo "Lưu thất bại".

---

#### BUG-F17.32 · Rate limiting NOT applied to `/api/ai/generate-blog`

| | |
| :--- | :--- |
| **TC-ID** | TC-F17-03-04 |
| **Severity** | 🟠 P1 High |
| **Module** | Security / AI |
| **Nguồn** | Issue #128 |

**Mô tả:**
Endpoint AI Generate Blog KHÔNG gọi hàm checkRateLimit (mặc dù các route khác có gọi). User có thể spam liên tục vào OpenAI (vd 15 request liên tục) gây tốn chi phí và rủi ro DDoS.

---

### 🟡 P2 — MEDIUM (SHOULD FIX)

---

#### BUG-F17.01 · Lỗi hiển thị thẻ Card trên List Mobile (Viewport 375px)

| | |
| :--- | :--- |
| **TC-ID** | TC-F17-01-05 |
| **Severity** | 🟡 P2 Medium |
| **Module** | Blog List Display |

**Mô tả:**
Trên mobile, thay vì ẩn Table biến thành các khối Cardsọc, hệ thống ẩn Table nhưng thẻ Card không xuất hiện thay thế. Hệ quả: Bị trắng màn khu vực Blog List trên web mobile.

---

#### BUG-F17.03 · Search bị lỗi Empty khi input dấu Khoảng trắng

| | |
| :--- | :--- |
| **TC-ID** | TC-F17-01-11 |
| **Severity** | 🟡 P2 Medium |
| **Module** | Blog List / Search |

**Mô tả:**
Khi tìm kiếm với ký tự khoảng trắng liền nhau, hệ thống tự động ẩn toàn bộ dữ liệu trả về mảng rỗng `after=0, hasPosts=false`. Spec yêu cầu hệ thống phải tự filter hoặc giữ nguyên danh sách (Trim whitespace).

---

#### BUG-F17.04 · Tính năng Bulk Select (Checkbox) không tồn tại

| | |
| :--- | :--- |
| **TC-ID** | TC-F17-01-12/13 |
| **Severity** | 🟡 P2 Medium |
| **Module** | Blog List / Bulk Action |

**Mô tả:**
Danh sách bài đăng (Blog List) bị thiếu Checkbox các cột đầu của mỗi dòng (row). Không có công cụ Multi Select để user có thể Xóa Hàng Loạt hoặc Publish Hàng Loạt.

---

#### BUG-F17.09 · Tính năng Auto-AI SEO không tự động điền Meta (Title/Desc) 

| | |
| :--- | :--- |
| **TC-ID** | TC-F17-02-14 |
| **Severity** | 🟡 P2 Medium |
| **Module** | AI Writing Assistant |

**Mô tả:**
Khi click AI SEO Button, tín hiệu API trả về có vẻ thành công, nhưng kết quả Text sinh ra không được đẩy (Populate) tự động vào 2 ô nhập liệu Meta Title và Meta Description trên form Editor.

---

#### BUG-F17.12 · Không click được vào Row bài viết trên Blog List

| | |
| :--- | :--- |
| **TC-ID** | TC-F17-02-22/26 |
| **Severity** | 🟡 P2 Medium |
| **Module** | Blog List Display |

**Mô tả:**
Hành vi của Web Administrator thông thường có thể bấm trực tiếp vào Hàng (Rows) bài viết để Navigate sang trang Edit Page. Nhưng hiện layout Row không click-to-edit được, UI không có standard navigation pattern. 

---

#### BUG-F17.13 · Thông báo lỗi rớt mạng Toast Save bị Rỗng

| | |
| :--- | :--- |
| **TC-ID** | TC-F17-02-17 |
| **Severity** | 🟡 P2 Medium |
| **Module** | Create & Edit Blog Post |

**Mô tả:**
Ngắt kết nối Network test nút Save Offline: Toast có nháy sáng hiện ra nhưng phần Text bên trong bị rỗng, không thông báo nội dung lỗi cụ thể như "Lưu thất bại, vui lòng thử lại" theo mô tả Expected Result.

---

#### BUG-F17.15 · AI Generate (Viết bài AI) sinh content nhưng luồng chèn vào Editor hỏng

| | |
| :--- | :--- |
| **TC-ID** | TC-F17-03-01 |
| **Severity** | 🟡 P2 Medium |
| **Module** | AI Writing Assistant |

**Mô tả:**
User click 'Generate Blog Idea AI' thì text Editor chỉ load hụt dài 1 ký tự (`length = 1 char`). Hệ thống render AI ổn nhưng luồng chèn vào rich-text frame (Editor Injection) lại câm điếc không làm việc.

---

#### BUG-F17.16 · Khuyết tính năng Improve Text / Make Professional

| | |
| :--- | :--- |
| **TC-ID** | TC-F17-03-03 |
| **Severity** | 🟡 P2 Medium |
| **Module** | AI Writing Assistant |

**Mô tả:**
Spec yêu cầu Trợ lý AI có chức năng Rewrite/Make Professional content theo vùng chọn highlight Text. Nhưng User không tìm thấy nút lệnh này trong Toolbar cũng như Context Panel tại Editor.

---

#### BUG-F17.23 · Thiếu Nút Xóa (Delete) trong Danh Mục Category 

| | |
| :--- | :--- |
| **TC-ID** | TC-F17-05-06/07 |
| **Severity** | 🟡 P2 Medium |
| **Module** | Category Management |

**Mô tả:**
Trong luồng Setting /categories, các Danh Mục đang hiển thị không có nút (hoặc Icon Thùng rác) tương ứng để Delete/Xoá bỏ. Chức năng Xoá categories không hoạt động.

---

#### BUG-F17.25 · Mobile: Toolbar Formatting bị trôi mất - Position Static, không Sticky

| | |
| :--- | :--- |
| **TC-ID** | TC-F17-06-01 |
| **Severity** | 🟡 P2 Medium |
| **Module** | Mobile Web UX |

**Mô tả:**
Position của Toolbar trên màn nhỏ đang định vị dạng CSS `static`. Theo chuẩn, nó cần dùng CSS `sticky` cố định đè lên trên bàn phím ảo thiết bị để user tiện định dạng Content. Thực tế đang trôi tuột lên `y=0` khiến khó xài.

---

#### BUG-F17.27 · Tê liệt hệ thống Test Storefront - Tính năng Blog Details

| | |
| :--- | :--- |
| **TC-ID** | TC-F17-08-01~08 |
| **Severity** | 🟡 P2 Medium |
| **Module** | Storefront Blog Detail |

**Mô tả:**
Liên đới chặt chẽ cùng nguyên nhân BUG-F17.26a, việc `/blogs` không truy cập được ảnh hưởng dây chuyền chết luôn toàn bộ luồng Test /blogs/{id} Details. Không check được SEO Metadata, hay thẻ Canonical Storefront.

#### BUG-036 · Tính năng Delete multi không hiện popup xác nhận, xóa luôn

| | |
| :--- | :--- |
| **TC-ID** | *Không có* |
| **Severity** | 🟡 P2 Medium |
| **Module** | Blog / Delete |

**Mô tả:** 
Khi user chọn nhiều bài viết (Delete Multi) và nhấn Delete, hệ thống xử lý xóa luôn mà không hiện popup hộp thoại popup như 'Bạn có chắc chắn muốn xóa không?'. User dễ vô tình nhấn nhầm làm mất dữ liệu.

---

#### BUG-F17.29 · Filter Empty State – Missing "Reset Filter" Button

| | |
| :--- | :--- |
| **TC-ID** | TC-F17-01-09 |
| **Severity** | 🟡 P2 Medium |
| **Module** | Filter |
| **Nguồn** | Issue #126 |

**Mô tả:**
Khi filter mảng bài viết trả về 0 kết quả (Empty State), chỉ có icon báo không tìm thấy nhưng thiếu nút "Reset Filter" (Xoá bộ lọc) trên UI. User phải tự đi đóng bằng tay các combobox.

---

#### BUG-F17.34 · Xóa bài viết là Soft Delete mâu thuẫn trực tiếp với AC

| | |
| :--- | :--- |
| **TC-ID** | TC-F17-04-06 |
| **Severity** | 🟡 P2 Medium |
| **Module** | Blog / Delete |
| **Nguồn** | Issue #130 |

**Mô tả:**
Theo AC yêu cầu bài viết khi xoá phải "permanently removed" (Hard delete). Nhưng trong source API `/blogs/[id]` đang xử lý cập nhật `status: 'deleted'` (Soft delete) giữ lại trong DB. Hành vi này mâu thuẫn yêu cầu và test thiết kế.

---

### 🟢 P3 — LOW (NICE TO FIX)

---

#### BUG-F17.02 · Màn Blog list thiếu công cụ Phân trang (Pagination) 

| | |
| :--- | :--- |
| **TC-ID** | TC-F17-01-21 |
| **Severity** | 🟢 P3 Low |
| **Module** | Blog List Display |

**Mô tả:**
Blog list đang chứa 18 posts và chưa xuất hiện control phân trang, vì quy định Spec là lớn hơn 20 Items sẽ phân. Tuy nhiên giao diện ẩn hoàn toàn hoặc chưa dựng tính năng Pagination Scroll, nguy cơ khi data lớn hơn 20 rows đều kẹt ở trang 1.

---

#### BUG-F17.05 · Bộ lọc (Filter) không báo Empty State khi = 0

| | |
| :--- | :--- |
| **TC-ID** | TC-F17-01-09 |
| **Severity** | 🟢 P3 Low |
| **Module** | Blog List / Filter |

**Mô tả:**
Khi search mớ tên hỗn độn, filter tìm được 0 kết quả nhưng hệ thống không hiển thị màn Zero-state như (Cái box "Không tìm thấy dữ liệu"). User chỉ thấy thanh Table Data trắng bóc.

---

#### BUG-F17.07 · Hiển thị đếm Ký Tự (`0/100`) liên kết lệch Input

| | |
| :--- | :--- |
| **TC-ID** | TC-F17-02-05 |
| **Severity** | 🟢 P3 Low |
| **Module** | Create & Edit Blog Post |

**Mô tả:**
Title báo giới hạn text, phần UI đếm ký tự (`0/100`) chết cứng k nhảy. Tìm hiểu kĩ thì Counter đang bind lộn biến dành cho Input Meta Title/Desc chứ không phải là đếm độ dài cho Main Title.

---

#### BUG-F17.10 · Thông báo Toast lưu báo lỗi nội dung rỗng (Chỉ Icon báo Thành công)

| | |
| :--- | :--- |
| **TC-ID** | TC-F17-02-01 |
| **Severity** | 🟢 P3 Low |
| **Module** | Create & Edit Blog Post |

**Mô tả:**
Sau khi ấn save (Tạo/Cập nhật), Hệ thống nảy ra Toast màu xanh. Nhưng Textcontent bên trong ô Toast là khoảng trắng Rỗng, không ghi chữ theo tiêu chuẩn (e.g. "Cập nhật thành công"). 

---

#### BUG-F17.14 · Màn Edit Post thiếu ô Input nhập Slug

| | |
| :--- | :--- |
| **TC-ID** | TC-F17-02-23 |
| **Severity** | 🟢 P3 Low |
| **Module** | Create & Edit Blog Post |

**Mô tả:**
Màn hình **Sửa bài viết (Edit)** cũng mắc lỗi hệt như trang form Create là bị khuyết / mất tích hoàn toàn Field Edit nhập cấu hình URL SEO Slug.  

---

#### BUG-F17.17 · Khung AI Modal trên Mobile quá cụt / không đủ Responsive

| | |
| :--- | :--- |
| **TC-ID** | TC-F17-03-07 |
| **Severity** | 🟢 P3 Low |
| **Module** | AI Writing Assistant |

**Mô tả:**
Kích cỡ Khung chat (Panel width) AI kích hoạt trên Màn hình điện thoại nhỏ (Viewport 375px) chỉ render vẹn vẹn được `[158px x 50px]`. Không tràn full chiều ngang máy (Spec yêu cầu >= 300px) làm cản trở quá trình người dùng chat.

---

#### BUG-F17.20 · Endpoint API `fetch()` báo status 0 (Lỗi CORS Fetch / Client)

| | |
| :--- | :--- |
| **TC-ID** | TC-F17-04-08/09/12 |
| **Severity** | 🟢 P3 Low |
| **Module** | API & Protection |

**Mô tả:**
Khi thực thi Direct Endpoint để PATCH dữ liệu Data qua `api/blogs/{id}`, Network block và ném ra kết quả `status=0`. Đây đáng ra là rule bảo vệ Security CORS Fetch của Client (Điều đúng). Nhưng lại cản trở cho bộ Check/Diagnose API Error của Dev và Auto Test. 

---

#### BUG-F17.21 · Khuyết tính năng Bulk Select (Checkbox) - Tương đồng P2 

| | |
| :--- | :--- |
| **TC-ID** | TC-F17-04-11 |
| **Severity** | 🟢 P3 Low |
| **Module** | Bulk Action |

**Mô tả:**
Lỗi này là bản mô phỏng lại cho sự kiện Bulk Delete trên Blog List. Do Checkbox thiếu triệt để như BUG 04, toàn bộ quá trình Bulk thao tác gộp cũng bị Freeze. (Nói lại lỗi của F17.04 ở khía cạnh US04).
