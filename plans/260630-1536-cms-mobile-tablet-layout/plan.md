# CMS Mobile/Tablet Layout — Screen-by-Screen Plan

> Branch: `fix/cms-mobile-tablet-layout` · Base: `staging` · Created: 2026-06-30
> Scope: sắp xếp lại **bố cục (layout)** màn hình CMS `(dashboard)` ở mobile/tablet (< lg). Làm **từng màn một**, không miss.

## Rules (bắt buộc)

- **Desktop (≥ lg) GIỮ NGUYÊN byte-identical** — không đụng path `lg:`.
- **Tablet = ưu tiên số 1** (md / iPad portrait+landscape) — làm cho thật gọn đẹp.
- **Mobile** — chỉ cần đọc được, không vỡ, không tràn ngang.
- 1 màn xong → typecheck + test liên quan pass → eyeball light+dark → tick ☑ → qua màn kế.
- **TRỪ Editor** (`/editor`) → tách nhánh riêng, KHÔNG làm ở đây.
- **Chung 1 nhánh** `fix/cms-mobile-tablet-layout`; **commit RIÊNG theo từng màn** (1 màn = 1 commit `fix(<scope>): ...`). 1 PR tổng sang `staging`.

## Trạng thái: ☐ chưa làm · 🔄 đang làm · ☑ xong

---

## Checklist màn hình (theo thứ tự sidebar)

### 1. Dashboard
- ☑ `/dashboard` — At a glance stat cards: mobile (≤560px) xếp dọc trong card (icon+label → delta/Coming Soon → value), 2 cột, nén font/padding; tablet/desktop giữ nguyên. (`dashboard-revamp.css`)

### 2. Online Store → Blog  *(Editor: tách nhánh khác)*
- ☑ `/blog` — list: mobile+iPad mini → card; iPad Air+ → table (breakpoint 820, dùng `.dash-table-compact`); filter 3 chip 1 hàng; colgroup responsive (desktop nguyên). + breadcrumb detail dọn `>`.
- ☑ `/blog/[id]` — bỏ breadcrumb tên bài (trùng h1), dọn separator
- ☑ `/blog/categories` — đã OK sẵn (responsive tốt, không cần chỉnh)

### 3. Core Operations
- ☐ `/orders` — list đơn hàng
- ☐ `/products` — list sản phẩm
- ☐ `/products/[id]` — edit sản phẩm
- ☐ `/products/new` — tạo sản phẩm
- ☐ `/products/categories` — danh mục sản phẩm
- ☐ `/discounts` — list giảm giá
- ☐ `/discounts/[id]` — edit giảm giá
- ☐ `/discounts/new` — tạo giảm giá
- ☐ `/discounts/usage-history` — lịch sử dùng mã

### 4. CRM
- ☑ `/customers` — list: card <820 / table compact ≥820 (dùng `.dash-table-compact`), colgroup cân lại. Commit `a43ae167`.
- ☐ `/customers/[id]` — chi tiết/sửa khách hàng (đã responsive sẵn từ `fix/1427`, chưa eyeball lại)
- ☑ `/contact-leads` — card/table 820; tách cột Profile → **Customer** (avatar) + **Profile** (tên); source badge wrap dải iPad. Commit `9f6423fc`.

### 5. Settings
- ☐ `/settings/payments` — thanh toán
- ☐ `/settings/shipping` — vận chuyển
- ☑ `/settings/domains` — mobile: 2 nút banner (select primary + add) trên 1 hàng (flex-1, wrap fallback); padding card domain 25→16px (<sm). Desktop giữ nguyên.
- ☐ `/settings/email-templates` — mẫu email
- ☐ `/settings/staff` — Team (Team & Account)
- ☐ `/settings/profile` — Account (hồ sơ cá nhân)
- ☐ `/settings` — trang index Settings (nếu có UI riêng)

### 6. Support → Help Center
- ☐ `/help` — trung tâm trợ giúp
- ☐ `/help/modules` — hướng dẫn module
- ☐ `/help/qna` — hỏi đáp

---

## Loại trừ (KHÔNG làm)

- ⛔ `/editor/**` — tách nhánh riêng (yêu cầu của anh)
- ⛔ `/media`, `/sites` — anh chốt KHÔNG làm lần này (ngoài sidebar nav)
- ⛔ `/forbidden`, `/[...not-found]`, `/templates-health`, `/dashboard/settings` — trang lỗi/tiện ích/dev, không phải màn layout

---

## Cách làm mỗi màn (lặp lại)

1. Mở route ở viewport tablet (768/834/1024-1) + mobile (375) → chụp hiện trạng, ghi lỗi layout.
2. Sửa bố cục **chỉ ở < lg** (grid→stack, toolbar wrap, table→card nếu cần, padding, overflow-x).
3. `npx tsc --noEmit` + chạy test unit liên quan (nếu có).
4. Eyeball light + dark.
5. Tick ☑, ghi chú ngắn nếu có điểm đặc biệt.

## Tiến độ
- Tổng route (trừ Editor, media, sites): **25** route · Đã xong: **6** (Dashboard + Blog + Customers list + Contact-leads)
- Chiến lược: **chung 1 nhánh, commit theo từng màn**, 1 PR tổng.

## Đã chốt
- ✅ Bỏ `/media`, `/sites` — chỉ làm các màn trong sidebar nav.
- ✅ Chung nhánh `fix/cms-mobile-tablet-layout`, commit riêng mỗi màn.
