# User Stories: CMS Core Layout & Navigation (F18)

<!-- Rules & ID Convention: docs/stories/user-stories-p0.md | SPEC.md §2.4 -->

> **Feature:** F18 — CMS Core Layout & Navigation
> **Wave:** 1 | **Priority:** P0 | **Ref PRD:** (Pending)

---

## Phân Tích CMS Layout cho Malaysia Market

Theo bối cảnh thị trường Malaysia (`malaysia-market-context.md`), đối tượng người dùng chính là các SME Owners (thường dùng mobile nhiều, kỹ năng công nghệ ở mức basic) và Dropshippers. Do đó, giao diện CMS cần đáp ứng các yếu tố:
1. **Rõ ràng và trực quan (Clear & Straightforward):** Tránh sử dụng icon quá trừu tượng. Phải có text đi kèm icon ở Side Menu.
2. **Hỗ trợ đa ngôn ngữ (Multi-language):** Dễ dàng chuyển đổi giữa Bahasa Melayu (BM) và English (EN) ngay tại top header (Avatar dropdown).
3. **Mobile-Responsive:** Dropshippers thường xuyên kiểm tra đơn hàng (Orders) qua điện thoại. Sidebar cần có dạn hamburger menu chuẩn chỉ trên màn hình nhỏ.
4. **Hỗ trợ qua kênh quen thuộc:** Nút Support/Help nên dẫn thẳng ra WhatsApp, kênh ưa thích số 1 tại Malaysia.

---

## US-F18-01: CMS Global Sidebar Navigation

**Wave 1** | **P0** | **M** | **Status:** Ready

### Story

```
As a   SME Owner / Dropshipper
I want một Side Menu cố định với các danh mục quản lý rõ ràng (Kèm cả icon và text)
So that tôi có thể dễ dàng điều hướng giữa các tính năng quản lý (Dashboard, Products, Orders, v.v.) mà không bị lạc
```

### Acceptance Criteria

#### AC-1: Desktop View — Expanded Sidebar

```gherkin
GIVEN user đang login vào CMS trên thiết bị Desktop
WHEN  giao diện load thành công
THEN  Side Menu hiển thị ở bên trái, mở rộng (expanded) mặc định
  AND mỗi menu item hiển thị icon rõ ràng kèm text (VD: 📦 Products, 🛒 Orders)
  AND thư mục đang được chọn (Active) được highlight với background color/font styling nổi bật theo Design System
```

#### AC-2: Mobile/Tablet View — Collapsible Hamburger

```gherkin
GIVEN user đang dùng CMS trên điện thoại hoặc Tablet
WHEN  giao diện load
THEN  Side Menu mặc định bị ẩn đi để tiết kiệm không gian
  AND chỉ hiển thị Hamburger Icon (☰) ở góc trái Top Header
WHEN  user click vào Hamburger Icon
THEN  Side Menu trượt từ trái sang (Slide-in drawer)
  AND có overlay mờ che phần nội dung chính
```

#### AC-3: WhatsApp Support Link

```gherkin
GIVEN user nhìn vào cuối Side Menu
WHEN  click vào nút "Help / Support"
THEN  hệ thống mở tab mới dẫn đến link WhatsApp Business của PrimeWeb Support
```

### Market Notes *(nếu có)*

- Chữ trên menu cần ngắn gọn, tối ưu hiển thị cho cả BM và EN. User MY không thích UI phức tạp của enterprise, cần style Friendly & Clean.

### Definition of Done

- [ ] 9-Point Checklist pass (ref: `SPEC.md §13`)
- [ ] Responsive hoạt động mượt mà trên chuẩn breakpoint của hệ thống.

---

## US-F18-02: CMS Global Top Header

**Wave 1** | **P0** | **M** | **Status:** Ready

### Story

```
As a   SME Owner
I want một thanh Header cố định ở trên cùng chứa Logo, Chuông Thông báo và Avatar
So that tôi biết mình đang ở hệ thống nào, nhận được cảnh báo kịp thời và quản lý tài khoản của mình
```

### Acceptance Criteria

#### AC-1: Product Logo Navigation

```gherkin
GIVEN user đang ở bất kỳ trang nào trong CMS
WHEN  nhìn vào thanh Top Header (góc trái)
THEN  Product Logo (PrimeWeb) được hiển thị
WHEN  click vào Logo
THEN  luôn route user quay về trang /dashboard (F18)
```

#### AC-2: Interacting with Notification Bell

```gherkin
GIVEN user có thông báo mới (đơn hàng, hệ thống)
WHEN  nhìn vào góc phải Top Header
THEN  icon Chuông (Bell) hiển thị kèm Red dot badge (kèm số nếu có)
WHEN  click vào icon Chuông
THEN  mở ra Dropdown Notification List (tích hợp từ màn F16)
```

#### AC-3: Profile & Language Dropdown (Avatar)

```gherkin
GIVEN user đang ở Header
WHEN  click vào User Avatar ở góc cùng bên phải
THEN  hiển thị Dropdown menu gồm các action:
      - Profile Settings
      - Language Switch (BM / EN)
      - Switch Workspace (nếu có nhiều site)
      - Logout
```

### Market Notes *(nếu có)*

- Avatar dropdown là nơi thích hợp nhất để người dùng MY đổi giao diện sang Bahasa Melayu nhanh nhất.

### Definition of Done

- [ ] Top Header z-index phải cao hơn Main Content và Sidebar (nếu ở bản mobile).
- [ ] Bell icon tích hợp đúng với API F16 Badge.

---

## US-F18-03: Main Content Area Display

**Wave 1** | **P0** | **S** | **Status:** Ready

### Story

```
As a   Store Owner
I want không gian hiển thị nội dung chính sạch sẽ, độc lập với Sidebar/Header
So that tôi tập trung làm việc (thêm sản phẩm, xem đơn hàng) mà không bị che khuất
```

### Acceptance Criteria

#### AC-1: Independent Scrolling

```gherkin
GIVEN user đang ở một danh sách rất dài (VD: danh sách Products)
WHEN  user cuộn chuột (scroll down)
THEN  chỉ phần Main Content di chuyển lên xuống
  AND Top Header và Side Menu vẫn cố định (fixed) tại chỗ
```

#### AC-2: Breadcrumbs Navigation

```gherkin
GIVEN user truy cập vào một trang cấp 2 (VD: Product Details)
WHEN  page load tại khu vực Main Content
THEN  hiển thị Breadcrumbs ở vị trí trên cùng của nội dung (VD: Home > Products > Baju Kurung)
  AND có thể click vào các cấp trước đó để quay lại
```

### Market Notes *(nếu có)*

- Khoảng cách (padding/margin) nên thoáng để dễ chạm trên mobile (fat-finger friendly).

### Definition of Done

- [ ] Tuân thủ Spacing và Grid system của Design System.
