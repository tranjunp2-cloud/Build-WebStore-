# F19 Store Configuration — Design & Wireframe Report

> **Epic:** Store Setup & Configuration
> **Feature Code:** F19
> **Links:** 
> - [Prototype](https://www.figma.com/make/Y48xuOh2gMCid2UmqOAFys/F01-ai-chat-builder-demo?fullscreen=1&t=TooWbqYJWABdfznd-1&preview-route=%2Fsettings%2Fdomains)
> - [Figma Design](https://www.figma.com/design/oFACZVA1oplxslloJWEkLp/TM_Prime-Web-V2.0?node-id=30877-2416&t=Q1NlQt72Nc8vZn0f-4)

Tài liệu này tổng hợp lại các luồng tính năng và bổ sung các bản vẽ Wireframe minh họa rõ ràng hơn để team có thể nắm bắt và triển khai UI components hoàn chỉnh, tuân thủ hoàn toàn **F18 CMS Global Layout** (Sidebar trái + Topbar giữ nguyên, mọi thứ render trong Main Content).

---

## 1. Feature Summary (Tóm tắt Tính năng)

Tính năng quản lý cài đặt Cửa hàng xoay quanh 3 mục chính:

*   **Domain Management (Quản lý tên miền):** Cho phép Merchant thêm domain riêng, hiển thị hướng dẫn cấu hình DNS (IP Address, CNAME), xác nhận verify DNS, tự dộng cấp SSL, cài đặt Primary Domain (Tên miền chính) và tính năng 301 Redirect cho SEO.
*   **Payment Configuration (Thanh toán thủ công):** Cung cấp các công tắc bật tắt tùy chọn thanh toán **COD** và **Bank / DuitNow QR**. Điểm mấu chốt là phải upload QR Code (ảnh < 2MB, định dạng JPG/PNG) thì mới có thể bật phương thức QR Banking.
*   **Staff Management (Quản lý nhân viên):** Cho phép Seller/Owner mời nhân viên tham gia quản trị bằng Email, gán quyền truy cập hệ thống (Full Access hoặc Custom Features), quản lý danh sách và kiểm soát quyền hạn.
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
│              │ │ [OFF] Bank Transfer                  │ │ ◄── renamed v1.1
│              │ │                                      │ │
│              │ │ Error: Complete details below first! │ │ ◄── Toggles OFF if missing
│              │ │                                      │ │
│              │ │ Upload DuitNow QR Code:              │ │
│              │ │ ┌──────────────────────────────────┐ │ │
│              │ │ │  [📤 Upload QR Image (JPG/PNG)]  │ │ │
│              │ │ │  Max size: 2MB                   │ │ │
│              │ │ └──────────────────────────────────┘ │ │
│              │ │                                      │ │
│              │ │ [v1.1] Bank Details (all required):  │ │
│              │ │  Bank Name:    [_______________]     │ │
│              │ │  Account No:   [_______________]     │ │
│              │ │  Account Name: [_______________]     │ │
│              │ │                                      │ │
│              │ │ Reference Prefix (optional, 2-4 char)│ │
│              │ │  [BT___]  Preview: BT-A3K9P2         │ │
│              │ │                                      │ │
│              │ │ Toggle ON only when:                 │ │
│              │ │  ✓ QR uploaded  ✓ Bank Name          │ │
│              │ │  ✓ Account No   ✓ Account Name       │ │
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

### 2.5. Staff Management (Desktop View)

*Bảng danh sách nhân viên hiện tại, bao gồm thông tin Role và Trạng thái.*

```text
┌─────────────────────────────────────────────────────────┐
│ [≡ Logo]  Search...                           [👤 Admin]│
├──────────────┬──────────────────────────────────────────┤
│ 🏠 Dashboard │ Store Settings > Staff Management        │
│ 📦 Products  │                                          │
│ 🛒 Orders    │ ┌──────────────────────────────────────┐ │
│ ⚙️ Settings  │ │ Manage who has access to your store. │ │
│  ↳ Domains   │ │ [ + Invite Staff ]                   │ │
│  ↳ Payments  │ └──────────────────────────────────────┘ │
│  ↳ Staff     │                                          │
│              │ 👥 Staff Directory                       │
│              │ ┌──────────────────────────────────────┐ │
│              │ │ NAME / EMAIL        ROLE      STATUS │ │
│              │ │ ──────────────────────────────────── │ │
│              │ │ 👤 Owner Name       Owner     Active │ │
│              │ │    owner@email.com                   │ │
│              │ │                                      │ │
│              │ │ 👤 Staff One        Full      Pending│ │
│              │ │    nv1@email.com    Access    [Rem]  │ │
│              │ │                                      │ │
│              │ │ 👤 Staff Two        Custom    Active │ │
│              │ │    nv2@email.com              [Rem]  │ │
│              │ └──────────────────────────────────────┘ │
└──────────────┴──────────────────────────────────────────┘
```

---

### 2.6. Modal: Invite Staff & Role Picker

*Màn hình Popup khi click [+ Invite Staff]. User phải nhập Email và chọn 1 trong 2 loại quyền.*

```text
       ┌── Invite Staff ──────────────────────[X]┐
       │                                         │
       │ Send an invitation to join your store.  │
       │                                         │
       │ Email Address                           │
       │ ┌─────────────────────────────────────┐ │
       │ │ e.g. staff@domain.com               │ │
       │ └─────────────────────────────────────┘ │
       │                                         │
       │ Select Role                             │
       │ ┌─────────────────────────────────────┐ │
       │ │ ( ) Full Access                     │ │
       │ │     Can manage everything except    │ │
       │ │     delete the store.               │ │
       │ │                                     │ │
       │ │ (•) Custom Features                 │ │
       │ │     Limit access to specific areas. │ │
       │ │                                     │ │
       │ │     [☑] Products & Inventory        │ │
       │ │     [☑] Orders & Fulfillment        │ │
       │ │     [ ] Blog Management             │ │
       │ │     [ ] Store Design (Builder)      │ │
       │ │     [ ] Settings & Domain           │ │
       │ └─────────────────────────────────────┘ │
       │                                         │
       │                [ Cancel ] [ Send Invite ]│
       └─────────────────────────────────────────┘
```

---

## 3. UI States (Các trạng thái phụ)
- **Loading:** Nút `Verify Connection` hiển thị Spinner xoay khi click, kéo dài 1-2s gọi API.
- **Success:** Dòng `Status: [🕒 Pending Verification]` được thay thế bởi Huy hiệu xanh lá mạ `[✓ Connected]`. Đồng thời có cờ nhỏ màu tím ở custom domain ghi `[Primary Domain]` nếu User chọn làm mặc định.
- **Error (Upload):** Khi chọn file >2MB ở phần QR Code, khung bao quanh upload chuyển màu Đỏ + Cảnh báo Toast: `Image exceeds 2MB limit. Please upload a smaller file.`. Mọi nút bật/tắt QR sẽ bị khóa.
- **Error (DNS):** Khi check Verify thất bại, chữ cảnh báo đỏ xuất hiện dưới nút check: `Verification failed. DNS records not found. Note: Propagation may take up to 48 hours.`
- **Empty State (Staff):** Nếu store chưa mời bất kỳ staff nào, phần `Staff Directory` sẽ hiển thị placeholder báo hiệu trống và nút điều hướng `+ Invite Staff`.
- **Warning (Remove Staff):** Khi bấm nút [Rem] (Remove) của 1 staff, hiển thị prompt xác nhận: `Are you sure you want to remove access for this user?` trước khi thực sự xoá.
