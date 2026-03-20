# User Stories: CMS Core Layout & Navigation (F18)

<!-- Rules & ID Convention: docs/stories/user-stories-p0.md | SPEC.md §2.4 -->

> **Feature:** F18 — CMS Core Layout & Navigation
> **Wave:** 1 | **Priority:** P0 | **Ref PRD:** [F18-cms-layout.md](../prd/F18-cms-layout.md)

---

## Phân Tích CMS Layout cho Malaysia Market

Theo bối cảnh thị trường Malaysia (`malaysia-market-context.md`), đối tượng người dùng chính là các SME Owners (thường dùng mobile nhiều, kỹ năng công nghệ ở mức basic) và Dropshippers. Do đó, giao diện CMS cần đáp ứng các yếu tố:
1. **Rõ ràng và trực quan (Clear & Straightforward):** Tránh sử dụng icon quá trừu tượng. Phải có text đi kèm icon ở Side Menu.
2. **Hỗ trợ đa ngôn ngữ (Multi-language):** Dễ dàng chuyển đổi giữa Bahasa Melayu (BM) và English (EN) ngay tại top header (Avatar dropdown).
3. **Mobile-Responsive:** Dropshippers thường xuyên kiểm tra đơn hàng (Orders) qua điện thoại. Sidebar cần có dạn hamburger menu chuẩn chỉ trên màn hình nhỏ.
4. **Hỗ trợ qua kênh quen thuộc:** Tích hợp Help Center (F20) nội bộ cung cấp hướng dẫn sử dụng và Q&A, giúp giảm tải cho bộ phận support, từ đó mới hiển thị link lên WhatsApp dành cho Support nếu cần thiết.

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
  AND mỗi menu item hiển thị icon rõ ràng kèm text (VD: 📊 Dashboard, 📦 Products, 🛒 Orders)
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

#### AC-3: Help Center Link

```gherkin
GIVEN user nhìn vào cuối Side Menu
WHEN  click vào item "Help Center"
THEN  hệ thống điều hướng sang trang Help Center (F20)
```

### Additional Criteria

- [ ] Active state của menu item phải cập nhật đúng khi navigate giữa các route mà không cần reload trang.
- [ ] Sidebar collapse/expand animation mượt (<200ms) trên mobile khi toggle hamburger.

### Open Questions

- **Q:** Sidebar có cần hỗ trợ mini mode (collapsed icon-only) trên tablet không, hay chỉ có 2 trạng thái (expanded / hidden)?
- **Assumption:** Nút Help Center sẽ điều hướng vào module F20. Link WhatsApp sẽ nằm trong nội dung của F20.

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

### Additional Criteria

- [ ] Language toggle phải persist qua sessions (localStorage hoặc user preference trong DB).
- [ ] Avatar dropdown phải đóng khi click ra ngoài (click-outside handler).

### Open Questions

- **Q:** Switch Workspace có scope trong Phase này không, hay chỉ cho các tài khoản có nhiều site?
- **Assumption:** Language switch (BM/EN) sẽ được xử lý bằng i18n middleware, không reload trang.

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

#### AC-3: Empty State — Trang không có nội dung

```gherkin
GIVEN user truy cập vào một sub-route chưa có dữ liệu (VD: Blog list trống)
WHEN  Main Content area load xong
THEN  hiển thị shared Empty State component (illustration + message + CTA button)
  AND Header và Sidebar vẫn cố định, không bị ảnh hưởng
```

### Additional Criteria

- [ ] Tuân thủ Spacing và Grid system của Design System.
- [ ] Scroll position của Main Content được reset về đầu trang khi navigate sang route mới.

### Open Questions


- **Assumption:** Main Content area sử dụng `overflow-y: auto` và `height: calc(100vh - header-height)`.

### Market Notes *(nếu có)*

- Khoảng cách (padding/margin) nên thoáng để dễ chạm trên mobile (fat-finger friendly).

### Definition of Done

- [ ] Tuân thủ Spacing và Grid system của Design System.


