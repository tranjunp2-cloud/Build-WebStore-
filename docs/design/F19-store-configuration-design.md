# F19 Store Configuration — Design & Wireframe Report

> **Epic:** Store Setup & Configuration
> **Feature Code:** F19
> **Links:** 
> - [Prototype](https://www.figma.com/make/Y48xuOh2gMCid2UmqOAFys/F01-ai-chat-builder-demo?fullscreen=1&t=TooWbqYJWABdfznd-1&preview-route=%2Fsettings%2Fdomains)
> - [Figma Design](https://www.figma.com/design/oFACZVA1oplxslloJWEkLp/TM_Prime-Web-V2.0?node-id=30877-2416&t=Q1NlQt72Nc8vZn0f-4)

Tài liệu này tổng hợp lại các luồng tính năng và bổ sung các bản vẽ Wireframe minh họa rõ ràng hơn để team có thể nắm bắt và triển khai UI components hoàn chỉnh, tuân thủ hoàn toàn **F18 CMS Global Layout** (Sidebar trái + Topbar giữ nguyên, mọi thứ render trong Main Content).

---

## 1. Feature Summary (Tóm tắt Tính năng)

Tính năng quản lý cài đặt Cửa hàng xoay quanh 2 mục chính:

*   **Domain Management (Quản lý tên miền):** Cho phép Merchant thêm domain riêng, hiển thị hướng dẫn cấu hình DNS (IP Address, CNAME), xác nhận verify DNS, tự dộng cấp SSL, cài đặt Primary Domain (Tên miền chính) và tính năng 301 Redirect cho SEO.
*   **Payment Configuration (Thanh toán thủ công):** Cung cấp các công tắc bật tắt tùy chọn thanh toán **COD** và **Bank / DuitNow QR**. Điểm mấu chốt là phải upload QR Code (ảnh < 2MB, định dạng JPG/PNG) thì mới có thể bật phương thức QR Banking.
*   **Mobile Optimizations:** Tối ưu hóa việc sao chép địa chỉ IP / CNAME với 1 chạm (Tap-to-copy Toast), và gọi Camera roll Native để đăng ảnh mã QR nhạy bén.

---

## 2. Wireframes & UI Layouts

Các wireframe dưới đây được thiết kế sát nhất với thực tế giao diện:

### 2.1. Domain Management (Desktop View)

*Trạng thái: Đang có 1 Default Domain mang tính chất Primary, và 1 Custom Domain pending thao tác trỏ bản ghi DNS.*

```text
┌─────────────────────────────────────────────────────────┐
│ [≡ Logo]  Search...                           [👤 Admin]│ ◄── Global Header
├──────────────┬──────────────────────────────────────────┤
│ 🏠 Dashboard │ Store Settings > Domain Management       │
│ 📦 Products  │                                          │
│ 🛒 Orders    │ ┌──────────────────────────────────────┐ │
│ ⚙️ Settings  │ │ Add a Domain to your store         │ │
│  ↳ Domains   │ │ Create a branded experience.       │ │
│  ↳ Payments  │ │ [ Add Custom Domain ]              │ │
│              │ └──────────────────────────────────────┘ │
│              │                                          │
│              │ 🌐 All Domains                           │
│              │                                          │
│              │ ┌──────────────────────────────────────┐ │
│              │ │ ✨ my-awesome-store.echprime.com     │ │
│              │ │    Status: [✓ Connected]             │ │
│              │ │    (Current Primary Domain)          │ │
│              │ └──────────────────────────────────────┘ │
│              │ ┌──────────────────────────────────────┐ │
│              │ │ ⚠️ custom-domain.com                  │ │
│              │ │    Status: [🕒 Pending Verification] │ │
│              │ │                                      │ │
│              │ │    Need to configure DNS settings:   │ │
│              │ │    • A Record     : 192.168.1.1 [📋] │ │
│              │ │    • CNAME Record : echprime.com[📋] │ │
│              │ │                                      │ │
│              │ │    [ Verify Connection ]  [ Remove ] │ │
│              │ └──────────────────────────────────────┘ │
└──────────────┴──────────────────────────────────────────┘
```

---

### 2.2. Modal: Add Custom Domain

*Trải nghiệm Pop-up đơn giản báo trước việc phải tự vào trình cài đặt DNS (GoDaddy...)*

```text
       ┌── Add Custom Domain ─────────────────[X]┐
       │                                         │
       │ Enter the domain name you own.          │
       │                                         │
       │ Domain Name                             │
       │ ┌─────────────────────────────────────┐ │
       │ │ www.myawesomestore.com.my           │ │
       │ └─────────────────────────────────────┘ │
       │                                         │
       │ 💡 Note: Make sure you have access to   │
       │    your registrar to update DNS records.│
       │                                         │
       │                [ Cancel ] [ Add Domain ]│
       └─────────────────────────────────────────┘
```

---

### 2.3. Payment Methods (Desktop View)

*Cấu trúc dạng Card-layout để bật/tắt dễ dàng. Trạng thái error xuất hiện nếu upload file không hợp lệ.*

```text
┌─────────────────────────────────────────────────────────┐
│ [≡ Logo]  Search...                           [👤 Admin]│
├──────────────┬──────────────────────────────────────────┤
│ 🏠 Dashboard │ Store Settings > Payment Methods         │
│ 📦 Products  │                                          │
│ 🛒 Orders    │ 💳 Stripe / Card Integration             │
│ ⚙️ Settings  │ ┌──────────────────────────────────────┐ │
│  ↳ Domains   │ │ Credit/Debit Gateway    Status: [✓]  │ │
│  ↳ Payments  │ └──────────────────────────────────────┘ │
│              │                                          │
│              │ 💵 Manual Payment Methods                │
│              │ ┌──────────────────────────────────────┐ │
│              │ │ [ON] Cash on Delivery (COD)          │ │
│              │ │      Allow manual cash collection.   │ │
│              │ └──────────────────────────────────────┘ │
│              │ ┌──────────────────────────────────────┐ │
│              │ │ [OFF] Bank Transfer / DuitNow QR     │ │
│              │ │                                      │ │
│              │ │ Error: Upload a QR Code first!       │ │ ◄── Toggles OFF if no QR
│              │ │                                      │ │
│              │ │ Upload QR Code:                      │ │
│              │ │ ┌──────────────────────────────────┐ │ │
│              │ │ │  [📤 Upload QR Image (JPG/PNG)]  │ │ │
│              │ │ │  Max size: 2MB                   │ │ │
│              │ │ └──────────────────────────────────┘ │ │
│              │ └──────────────────────────────────────┘ │
└──────────────┴──────────────────────────────────────────┘
```

---

### 2.4. Mobile Optimized Layout (App-feel View)

*Khu vực Sidebar được thu gọn. Action "Copy" nổi bật, Upload ảnh tích hợp thẳng thư viện điện thoại.*

```text
📱 Mobile View
┌─────────────────────────────┐
│ ☰  Settings               👤│
├─────────────────────────────┤
│ < Domain Management         │
│                             │
│ ┌─────────────────────────┐ │
│ │ ⚠️ custom-domain.com     │ │
│ │                         │ │
│ │ Set A Record:           │ │
│ │ 192.168.1.1 [Copy] 👈    │ │
│ │  (Toast: "Copied! ✅")   │ │
│ │                         │ │
│ │ Set CNAME:              │ │
│ │ echprime.com  [Copy]    │ │
│ │                         │ │
│ │ [ Verify Connection ]   │ │
│ └─────────────────────────┘ │
│                             │
├─────────────────────────────┤
│ < Payment Methods           │
│                             │
│ ┌─────────────────────────┐ │
│ │ Bank Transfer / QR      │ │
│ │ [ON] 🟢                  │ │
│ │                         │ │
│ │ ┌─────────────────────┐ │ │
│ │ │ 📷  Open Camera     │ │ │ ◄── Gọi Native Camera Roll
│ │ │    or Photo Library │ │ │
│ │ └─────────────────────┘ │ │
│ └─────────────────────────┘ │
└─────────────────────────────┘
```

---

## 3. UI States (Các trạng thái phụ)
- **Loading:** Nút `Verify Connection` hiển thị Spinner xoay khi click, kéo dài 1-2s gọi API.
- **Success:** Dòng `Status: [🕒 Pending Verification]` được thay thế bởi Huy hiệu xanh lá mạ `[✓ Connected]`. Đồng thời có cờ nhỏ màu tím ở custom domain ghi `[Primary Domain]` nếu User chọn làm mặc định.
- **Error (Upload):** Khi chọn file >2MB ở phần QR Code, khung bao quanh upload chuyển màu Đỏ + Cảnh báo Toast: `Image exceeds 2MB limit. Please upload a smaller file.`. Mọi nút bật/tắt QR sẽ bị khóa.
- **Error (DNS):** Khi check Verify thất bại, chữ cảnh báo đỏ xuất hiện dưới nút check: `Verification failed. DNS records not found. Note: Propagation may take up to 48 hours.`
