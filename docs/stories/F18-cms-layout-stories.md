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

#### AC-4: Hành vi đóng Menu trên Mobile (Slide-out)

```gherkin
GIVEN user đang sử dụng chức năng CMS trên Mobile với Side Menu Drawer đang mở trượt từ trái ra
WHEN  user nhấn Touch/Click ra vùng bóng mờ (Overlay) bên ngoài 
  OR  user thực hiện lệnh Swipe (Vuốt) trực tiếp từ nửa bên phải màn hình sang tay trái
  OR  user click vào một đường Link trực tiếp dẫn thẳng sang module khác (Route Leaf)
THEN  Side Menu phải tự động cuộn (Slide out) trượt khỏi màn hình
  AND Overlay bóng mờ đóng lại, không cản trở khu vực nội dung chính
```

#### AC-5: Thao tác mở cụm Menu Nhóm (Expandable Accordion)

```gherkin
GIVEN user click / hover (nếu là Desktop) vào cụm Menu hệ sinh thái phân tầng (VD: My Webstore) đang ở chế độ Đóng
THEN  Menu tự thiết lập xuống trạng thái Expanded liệt kê danh sách Menu con (`Blog`, `Editor`...)
  AND Icon mũi tên điều hướng đổ gập xuống (Arrow Down)
  AND Drawer Menu (nếu là Mobile) không bị gập lại
WHEN  user click lần thứ 2 vào cụm Menu Nhóm hiện tại
THEN  Menu xếp gập lại trọn vẹn (Collapsed), toàn bộ Menu con thụt giấu
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

#### AC-4: Đóng Dropdown/Popup (Accessibility)

```gherkin
GIVEN Dropdown Avatar / Chuông Notification F16 đang hiện rõ 
WHEN  user click chuột vào môi trường trống (Click outside)
  OR  user gõ lệnh phím [ESC]
THEN  Dropdown Popup tự động đóng lại lập tức
```

#### AC-5: Hành vi Runtime Language Switch

```gherkin
GIVEN user đang mở Dropdown Avatar
WHEN  user chọn một loại ngôn ngữ khác ngôn ngữ hiện tại (VD: Đang EN chọn BM)
THEN  Hệ thống lưu giá trị ưu tiên BM vào localStorage ngay lập tức
  AND Text tĩnh của Header, Sidebar Menu tự động thay đổi ngôn ngữ ngay tức khắc
  AND KHÔNG Refresh/Reload lại toàn bộ trang web nhằm giữ nguyên dữ liệu form đang làm dang dở
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

#### AC-4: Kích hoạt Route Loading Transition State

```gherkin
GIVEN user click vào một đường link điều hướng trên Sidebar (VD: Từ Dashboard qua Orders)
WHEN  hệ thống Browser thực thi fetch data và logic UI mới 
THEN  xuất hiện thanh progress loading bar 2px trôi ngang cạnh dưới của Header
WHEN  dữ liệu truy xuất API và load xong module 
THEN  Thanh Progress Bar đi đến mút 100% và ẩn đi (Disappear)
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

---

## US-F18-04: Light/Dark Mode Toggle trong Dashboard

**Wave 2** | **P1** | **S** | **Status:** Draft

> **Track:** B (AWC) — Prerequisite cho toàn bộ Track B features
> **Ref Design:** [Design System — Color System](../design/Design%20system.md) §1

### Story

```
As a   SME Owner / AWC Admin
I want một nút chuyển đổi Light/Dark mode trong CMS dashboard
So that tôi có thể chọn chế độ hiển thị phù hợp với môi trường làm việc và sở thích cá nhân
```

### Acceptance Criteria

#### AC-1: Toggle Button hiển thị đúng vị trí

```gherkin
GIVEN user đã đăng nhập vào CMS dashboard
WHEN  giao diện load thành công
THEN  toggle button Light/Dark hiển thị ở sidebar footer (desktop) hoặc header (mobile)
  AND button hiển thị icon Sun khi đang ở Dark mode
  AND button hiển thị icon Moon khi đang ở Light mode
```

#### AC-2: Chuyển đổi Dark → Light

```gherkin
GIVEN dashboard đang hiển thị ở Dark mode
WHEN  user click vào toggle button
THEN  toàn bộ dashboard chuyển sang Light mode trong < 200ms
  AND background chuyển từ #0B1120 sang #F8FAFC (theo Design System)
  AND surface color chuyển từ #161E2E sang #FFFFFF
  AND text color chuyển từ #FFFFFF sang #0F172A
  AND border color chuyển từ #1F2937 sang #E2E8F0
  AND không có flash trắng (FOUC) trong quá trình chuyển đổi
```

#### AC-3: Chuyển đổi Light → Dark

```gherkin
GIVEN dashboard đang hiển thị ở Light mode
WHEN  user click vào toggle button
THEN  toàn bộ dashboard chuyển sang Dark mode trong < 200ms
  AND các color tokens trở về giá trị Dark mode theo Design System
  AND transition mượt, không bị giật hay flash
```

#### AC-4: Theme persist sau khi refresh

```gherkin
GIVEN user đã chọn Light mode
WHEN  user refresh trang (F5) hoặc đóng tab rồi mở lại
THEN  dashboard vẫn hiển thị ở Light mode (persist via cookie)
  AND không có flash Dark→Light trong quá trình load
```

### Additional Criteria

- [ ] Toggle accessible bằng keyboard (Tab + Enter/Space)
- [ ] `aria-label` mô tả rõ action: "Switch to light mode" / "Switch to dark mode"
- [ ] Không ảnh hưởng đến Payload Admin panel (admin route riêng)
- [ ] Mobile 375px: toggle button không bị che khuất

### Definition of Done

- [ ] 9-Point Checklist pass (ref: `SPEC.md §13`)
- [ ] Color tokens khớp 100% với Design System §1 (Global Themes + Neutral Scale)
- [ ] Không có FOUC trên bất kỳ trang nào

---

## US-F18-05: Dashboard Color System đáp ứng Light/Dark

**Wave 2** | **P1** | **L** | **Status:** Draft

### Story

```
As a   SME Owner / AWC Admin
I want toàn bộ components trong dashboard (sidebar, header, cards, forms, modals) hiển thị đúng theo Light hoặc Dark mode
So that giao diện luôn dễ đọc, contrast tốt, và nhất quán trong mọi chế độ
```

### Acceptance Criteria

#### AC-1: Sidebar navigation đúng theme

```gherkin
GIVEN user đang ở Light mode
WHEN  nhìn vào sidebar
THEN  sidebar background là #FFFFFF với border phải #E2E8F0
  AND menu item text là #0F172A, muted text là #64748B
  AND active menu item highlight dùng Primary Blue (#2563EB) background subtle
  AND hover state rõ ràng (background #F1F5F9)
```

#### AC-2: Cards và content areas đúng theme

```gherkin
GIVEN user đang ở Light mode
WHEN  nhìn vào dashboard content area
THEN  card background là #FFFFFF với border #E2E8F0 và radius 12px
  AND card shadow dùng light shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1) (Design System §3)
  AND heading text là #0F172A, body text là #0F172A, muted text là #64748B
```

#### AC-3: Form inputs đúng theme

```gherkin
GIVEN user đang ở Light mode
WHEN  nhìn vào form inputs (text input, textarea, select, checkbox)
THEN  input background là #FFFFFF, border #E2E8F0
  AND placeholder text là #64748B
  AND focus ring dùng Primary Blue (#2563EB)
  AND disabled state giảm opacity 50% (Design System §4)
```

#### AC-4: Buttons đúng theme

```gherkin
GIVEN user đang ở bất kỳ mode nào
WHEN  nhìn vào buttons
THEN  Primary button giữ gradient background (Blue→Teal) + text trắng ở CẢ HAI mode
  AND Secondary button: Dark=#1F2937 bg / Light=#F1F5F9 bg (Design System §1)
  AND Outline button: border tông xám theo mode
  AND Ghost button: transparent, hover background theo mode
```

#### AC-5: Modal/Dialog đúng theme

```gherkin
GIVEN user mở một modal/dialog
WHEN  modal hiển thị
THEN  modal background theo surface color của mode hiện tại
  AND overlay backdrop mờ phù hợp (Dark: rgba(0,0,0,0.7) / Light: rgba(0,0,0,0.4))
  AND text và form bên trong modal tuân theo theme đang active
```

### Additional Criteria

- [ ] Semantic status colors (Success, Error, Warning, Info) tuân theo Design System §1 cho từng mode
- [ ] Badge colors (status, draft, AI) hiển thị đúng contrast trên cả hai nền
- [ ] Toast notifications hiển thị đúng trên cả hai mode
- [ ] Skeleton loading states hiển thị rõ ràng trên cả hai nền
- [ ] DataTable/list rows có alternating background phù hợp từng mode
- [ ] WCAG AA contrast ratio (4.5:1 text, 3:1 large text) trên cả hai mode

### Definition of Done

- [ ] 9-Point Checklist pass
- [ ] Mỗi trang dashboard đã visual QA ở cả Light và Dark
- [ ] Grep codebase: không còn hardcoded `bg-zinc-950`, `text-zinc-100` ở layout-level elements
- [ ] Contrast checker pass WCAG AA trên tất cả text/background pairs

---

## US-F18-06: Tenant-aware Default Theme (AWC Light, ECH Dark)

**Wave 2** | **P1** | **S** | **Status:** Draft

### Story

```
As a   AWC tenant admin
I want dashboard mặc định hiển thị Light mode khi lần đầu đăng nhập
So that giao diện AWC có brand identity riêng, phân biệt với ECH (mặc định Dark)
```

### Acceptance Criteria

#### AC-1: AWC tenant mặc định Light

```gherkin
GIVEN user thuộc AWC tenant đăng nhập lần đầu (chưa có preference)
WHEN  dashboard load
THEN  theme mặc định là Light mode
  AND toggle button hiển thị Moon icon (đang ở Light)
```

#### AC-2: ECH tenant mặc định Dark

```gherkin
GIVEN user thuộc ECH/SME tenant đăng nhập lần đầu
WHEN  dashboard load
THEN  theme mặc định là Dark mode (giữ nguyên behavior hiện tại)
  AND toggle button hiển thị Sun icon
```

#### AC-3: User preference override tenant default

```gherkin
GIVEN AWC user đã toggle sang Dark mode
WHEN  user logout rồi login lại
THEN  dashboard hiển thị Dark mode (user preference > tenant default)
  AND preference persist qua cookie
```

#### AC-4: New tenant onboarding

```gherkin
GIVEN admin tạo tenant mới
WHEN  chọn brand type "AWC" hoặc "Medium Enterprise"
THEN  tenant config có defaultTheme = 'light'
WHEN  chọn brand type "ECH" hoặc "SME"
THEN  tenant config có defaultTheme = 'dark'
```

### Additional Criteria

- [ ] Tenant default theme không ảnh hưởng storefront theme (tách biệt)
- [ ] Nếu cookie bị xóa → fall back về tenant default, không phải system preference

### Definition of Done

- [ ] 9-Point Checklist pass
- [ ] Test cả 2 tenant types với fresh login (no cookie)
- [ ] Test override scenario: user preference > tenant default

---

## US-F18-07: Storefront Theme Independence

**Wave 2** | **P1** | **S** | **Status:** Draft

### Story

```
As a   Store Owner
I want storefront (trang khách hàng truy cập) có theme riêng biệt với dashboard
So that tôi có thể dùng Dark dashboard trong khi storefront hiển thị Light cho khách hàng (hoặc ngược lại)
```

### Acceptance Criteria

#### AC-1: Storefront không kế thừa dashboard theme

```gherkin
GIVEN admin đang dùng Dark mode dashboard
  AND site config có colorMode = 'light'
WHEN  khách hàng truy cập storefront
THEN  storefront hiển thị Light mode theo site config
  AND không bị ảnh hưởng bởi dashboard theme cookie
```

#### AC-2: Site Settings cho phép chọn colorMode

```gherkin
GIVEN admin đang ở trang Site Settings / Theme Settings
WHEN  nhìn vào phần Color Mode
THEN  có option chọn Light hoặc Dark cho storefront
  AND preview cập nhật realtime khi chuyển mode
  AND save setting lưu vào DB (site.theme.colorMode)
```

#### AC-3: resolveTheme() output đúng theo colorMode

```gherkin
GIVEN site config có colorMode = 'light'
WHEN  resolveTheme() được gọi
THEN  surfaceColor = '#f8f8f8', textColor = '#09090b', backgroundColor = '#ffffff'
GIVEN site config có colorMode = 'dark'
WHEN  resolveTheme() được gọi
THEN  surfaceColor = '#111111', textColor = '#fafafa', backgroundColor = '#09090b'
```

### Additional Criteria

- [ ] Storefront dùng `generateThemeCSS()` inline styles, không dùng Tailwind `dark:` class
- [ ] Builder/Editor preview phản ánh đúng colorMode của site

### Definition of Done

- [ ] 9-Point Checklist pass
- [ ] Test: dashboard Dark + storefront Light = đúng cả hai
- [ ] Test: dashboard Light + storefront Dark = đúng cả hai
- [ ] resolveTheme() unit test cover cả light và dark colorMode

---

## US-F18-08: AWC Brand Color Tokens

**Wave 2** | **P2** | **M** | **Status:** Draft

### Story

```
As a   AWC tenant admin
I want dashboard và storefront mặc định dùng AWC brand colors (Blue #2563EB, Purple #7C3AED)
So that AWC có visual identity riêng biệt với ECH brand (Cyan #0EA5E9, Magenta #D946EF)
```

### Acceptance Criteria

#### AC-1: AWC default color palette

```gherkin
GIVEN user tạo site mới trên AWC tenant
WHEN  site được khởi tạo
THEN  theme mặc định dùng:
  | Token          | Value    |
  | primaryColor   | #2563EB  |
  | secondaryColor | #7C3AED  |
  | accentColor    | #06B6D4  |
  | colorMode      | light    |
  AND các color tokens khớp với Design System Primary Blue (#2563EB cho Light mode)
```

#### AC-2: ECH default color palette giữ nguyên

```gherkin
GIVEN user tạo site mới trên ECH tenant
WHEN  site được khởi tạo
THEN  theme mặc định giữ nguyên:
  | Token          | Value    |
  | primaryColor   | #0EA5E9  |
  | secondaryColor | #D946EF  |
  | colorMode      | dark     |
```

#### AC-3: Brand colors áp dụng cho dashboard accent

```gherkin
GIVEN AWC admin đang dùng dashboard
WHEN  nhìn vào primary actions (buttons, active states, links)
THEN  accent color dùng AWC Blue (#2563EB) thay vì ECH Cyan (#0EA5E9)
  AND gradient button dùng AWC palette
```

### Additional Criteria

- [ ] Site owner vẫn có thể customize colors sau khi tạo (override AWC defaults)
- [ ] AI Builder theme presets include AWC-specific preset option

### Definition of Done

- [ ] 9-Point Checklist pass
- [ ] AWC brand preset defined trong theme-presets hoặc awc-theme config
- [ ] Test: new AWC site có đúng default colors
- [ ] Test: ECH site không bị ảnh hưởng
