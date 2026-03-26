# User Stories - F22: Tracking & Analytics Integration

## Thông tin chung
- **Feature Code:** F22
- **Epic:** Store Setup & Configuration (Thuộc module cha F19: Store Configuration)
- **Mô tả:** Quản lý User Stories cho tính năng Cấu hình Tracking Marketing (Google Analytics 4, Facebook Pixel, TikTok Pixel).

---

## 1. Cấu hình Admin

### US-F22-01: Store Owner thiết lập Tracking IDs
**Là một** Store Owner (Sellers) hoặc Staff có quyền Cài đặt,  
**Tôi muốn** có một giao diện để cấu hình dễ dàng các mã Facebook Pixel, Google Analytics 4 và TikTok Pixel cho cửa hàng của mình,  
**Để** tôi không cần nhờ đến team code/thiết kế mỗi khi muốn theo dõi và đo lường chuyển đổi của quảng cáo.

- **Acceptance Criteria (AC):**
  - Trong CMS Settings có một khu vực nhận diện riêng có tên "Tracking & Analytics".
  - Hiển thị 3 khối form field độc lập: Google Analytics 4, Facebook Pixel, TikTok Pixel.
  - Phải có 1 nút Switch/Toggle để Bật/Tắt riêng cho từng loại tracking.
  - Trường hợp Input:
    - **GA4 ID:** Phải nhập bắt đầu bằng `G-` và theo sau là chuỗi text/number.
    - **Facebook Pixel ID:** Chỉ bao gồm dạng ký tự số (Numbers).
    - **TikTok Pixel ID:** Prefix chuẩn của TikTok. (Tối giản validation các chữ/số không chứa ký tự đặc biệt).
  - Bấm `Save`, nếu format sai, báo lỗi đỏ (`Invalid Format`) ở dưới mỗi input. Nếu đúng, lưu vào Global Settings của Store và hiện Toast Success.

---

## 2. Trải nghiệm người dùng cuối (Storefront Rendering)

### US-F22-02: Storefront tự động load JS Pixel scripts
**Là một** Shopper (Người mua) truy cập vào gian hàng trên trình duyệt web,  
**Khi tôi** lướt mua sắm tại bất kỳ đường link / trang nào của Store,  
**Tôi muốn** các tracking ID của Store Owner (đã gán thuộc tính Enable) được tự động thực thi dưới nền,  
**Để** Owner có số liệu theo dõi PageView vào các ads platform.

- **Acceptance Criteria (AC):**
  - Mọi page view của Storefront (bao gồm Homepage, Collection, Product, Cart) sẽ fetch Store Settings.
  - Tùy thuộc vào loại ID nào đang được bật (`isEnabled: true`):
    - **GA4:** inject block JS `<script async src="https://www.googletagmanager.com/gtag/js?id={ID}">` và execute config base vào thẻ `<head>`. 
    - **Facebook Pixel:** inject JS base script của `fbq` có cài init là chuỗi ID vào thẻ `<head>`.
    - **TikTok Pixel:** inject base script của `ttq` có load chuỗi ID vào thẻ `<head>`.
  - Scripts không nên block Document / LCP rendering chính của trang. (Ví dụ sử dụng chiến lược `afterInteractive` trong next/script).
  - Nếu ID rỗng hoặc Toggle đang Tắt, Scripts của loại tracking đó hoàn toàn không xuất hiện trên DOM source.

---

## 3. Trợ giúp thao tác (UX Help)

### US-F22-03: Hướng dẫn lấy Tracking ID
**Là một** Store Owner (Sellers) ít kinh nghiệm kỹ thuật,  
**Tôi muốn** có đường dẫn hướng dẫn hoặc text giải thích trực quan ngay tại form nhập mã Tracking,  
**Để** tôi biết chính xác phải vào mục nào trên Meta/Google Web để copy đúng dãy số ID dán vào hệ thống.

- **Acceptance Criteria (AC):**
  - **GA4 Helper:** Dưới ô Input của Google Analytics 4 có hiển thị dòng chữ mờ hoặc tooltip "Cách tìm Measurement ID (G-...) của bạn" -> Gắn hyperlink dẫn ra trang Help Center Article.
  - **Facebook Pixel Helper:** Hiển thị text mờ "Cách lấy ID Pixel Meta (15 số)" -> Link điều hướng ra bài viết Support.
  - **TikTok Pixel Helper:** Hiển thị text mờ "Hướng dẫn khởi tạo và lấy ID Pixel TikTok" -> Link điều hướng ra Support.
  - Hành động Click vào các Links trợ giúp này LUÔN kích hoạt cửa sổ Tab Trình Duyệt Mới (`target="_blank"`) để Sellers không bị mất Data form Setup họ đang nhập dở.
