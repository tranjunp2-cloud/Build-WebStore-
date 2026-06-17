# F36 EasyParcel Delivery — Design & Wireframe Report

> **Epic:** Storefront Commerce & Fulfillment (Malaysia)
> **Feature Code:** F36
> **Links:**
> - PRD: [`docs/prd/F36-easyparcel-delivery.md`](../prd/F36-easyparcel-delivery.md)
> - Stories: `docs/stories/F36-easyparcel-delivery-stories.md` _(planned — chưa tạo)_
> - Architecture: `docs/architecture/F36-easyparcel-delivery.md` _(planned — chưa tạo)_
> - Research: [`easyparcel-api-deep-dive`](../../plans/reports/researcher-260611-1614-easyparcel-api-deep-dive.md), [`my-shipping-aggregators`](../../plans/reports/researcher-260611-1614-my-shipping-aggregators.md)
> - **🎨 Hi-fi design:** _TBD — chưa generate; ASCII low-fi bên dưới là source-of-truth tạm thời._
> - Related: F14 Shipping (flat-rate fallback), F09 Storefront Commerce, F10 Orders, F34 Xendit Payment, F18 CMS Global Layout

Tài liệu wireframe & UI spec low-fi cho **EasyParcel Delivery Integration**. Mở rộng (KHÔNG phá) UI Shipping flat-rate hiện có của F14. Settings UI tuân thủ **F18 CMS Global Layout** (Sidebar + Topbar). Checkout & trang đơn buyer thuộc Storefront F09 (không có Sidebar Admin).

---

## 1. Feature Summary

> **🚚 Delivery Model:** AGGREGATOR (EasyParcel) — per-merchant API key, **non-custody** (platform RM0). UI có courier picker, "Tạo vận đơn" (mua AWB), in label, đặt pickup, tracking sync. **Hybrid:** chưa cấu hình đủ → fallback flat-rate F14 (UI cũ không vỡ).

F36 gồm 5 surface chính, theo 4 phase PRD:

- **Screen A — EasyParcel Settings (Phase A):** Tab "EasyParcel" trong `settings/shipping`. Merchant dán 2 key (`api` + `authentication`), nhập warehouse origin (geo cascade), "Test connection" (auto-detect env), chọn 1 courier cho shop.
- **Screen B — Checkout Rate (Phase B):** Buyer nhập địa chỉ (reuse F14 cascade) → phí ship thật vào thẳng Order Summary (1 dòng "Shipping", KHÔNG section vận chuyển, KHÔNG SST). Hybrid: chưa cấu hình → giữ UI fee đơn F14.
- **Screen C — Create Label (Phase C):** KHÔNG màn riêng. Mua label gắn vào nút **"Ready to Ship"** có sẵn trong `OrderDetailPanel` → AWB + label PDF; in label; pickup/dropoff. Non-EP: `ShipOrderModal` manual giữ nguyên (nhánh do config tenant, KHÔNG tab toggle).
- **Screen D — Order Tracking (Phase C):** KHÔNG màn riêng — làm giàu component có sẵn của trang đơn buyer (`OrderTrackingClient`: `OtShippingCard` + `OtTimeline`) + badge tracking trong `OrderDetailPanel` merchant. Dual-field: `order.status` (lifecycle, manual) tách khỏi `shippingTrackingStatus` (13 status chuẩn EasyParcel, cron poll 30–60′).
- **Screen E — Returns (Phase D):** KHÔNG dựng RMA/buyer-request UI. 2 luồng phân biệt bằng banner: **Case 1 Courier RTS** (auto khi `shippingTrackingStatus=RETURNED`) + **Case 2 Buyer RMA** (merchant tự mở, buyer tự gửi + nhập tracking tay). Cả 2 reuse `/refund` + `/cancel`; cancel refund = message theo trạng thái label gốc. Reverse label = cắt khỏi MVP (§8).

### Design Principles
- **KISS:** Mirror pattern `echIntegration` cho connect; reuse Card form của F14/F19.
- **Hybrid an toàn:** Mọi surface phải degrade về flat-rate F14 khi EasyParcel OFF/lỗi/timeout — không chặn checkout.
- **Non-custody rõ ràng:** UI luôn nói rõ "cước trừ ví EasyParcel của bạn", "platform không giữ tiền" — không hiển thị markup.
- **shadcn/ui only:** `Card`, `Input`, `Select`, `Switch`, `Checkbox`, `RadioGroup`, `Button`, `Badge`, `Dialog`, `Alert`, `Skeleton`, `Loader2`.
- **Mobile-first:** Mỗi screen có note responsive 375px.
- **Tiền tệ:** Hiển thị `formatPrice(sen, 'MYR')` → "RM 8.00". Internal sen, EasyParcel RM (×100 khi nhận). Không bao giờ render raw RM float.

---

## 2. Wireframes & UI Layouts

### 2.1. Screen A — EasyParcel Settings <a id="screen-a-settings"></a>

**Path:** `Dashboard > Settings > Shipping > tab "EasyParcel"` (`/dashboard/settings/shipping`)
**Trạng thái:** Merchant chưa connect (form trống), tab flat-rate F14 vẫn là tab mặc định.

```text
┌─────────────────────────────────────────────────────────┐
│ [≡ Logo]  Search...                           [👤 Admin]│ ◄── Global Header
├──────────────┬──────────────────────────────────────────┤
│ 🏠 Dashboard │ Store Settings > Shipping                │
│ 📦 Products  │ ┌────────────┬─────────────┐             │
│ 🛒 Orders    │ │ Flat Rate  │ EasyParcel ●│ ◄── Tabs    │
│ ⚙️ Settings  │ └────────────┴─────────────┘             │
│  ↳ Payments  │ ┌──────────────────────────────────────┐ │
│  ↳ Shipping ●│ │ 🔌 Connect EasyParcel       [○━ OFF] │ │
│  ↳ Staff     │ │ Mỗi cửa hàng dùng tài khoản EasyParcel│ │
│              │ │ riêng. Cước trừ thẳng ví của bạn.    │ │
│              │ │                                      │ │
│              │ │ API Key (api)                        │ │
│              │ │ ┌──────────────────────────────┐     │ │
│              │ │ │ ••••••••••••••••••••          │     │ │
│              │ │ └──────────────────────────────┘     │ │
│              │ │ Auth Key (authentication)            │ │
│              │ │ ┌──────────────────────────────┐     │ │
│              │ │ │ ••••••••••••••••••••          │     │ │
│              │ │ └──────────────────────────────┘     │ │
│              │ │                                      │ │
│              │ │ 🏭 Warehouse (origin)                │ │
│              │ │ Address Line 1                       │ │
│              │ │ ┌──────────────────────────────┐     │ │
│              │ │ └──────────────────────────────┘     │ │
│              │ │ ┌──────────┐ ┌────────┐ ┌─────────┐  │ │
│              │ │ │ City     │ │Postcode│ │ State ▼ │  │ │
│              │ │ └──────────┘ └────────┘ └─────────┘  │ │
│              │ │                                      │ │
│              │ │         [ 🔍 Test connection ]       │ │
│              │ └──────────────────────────────────────┘ │
└──────────────┴──────────────────────────────────────────┘
```

**Sau khi "Test connection" OK → mở khoá phần chọn courier:**

```text
│ ┌──────────────────────────────────────┐ │
│ │ ✅ Connected — Production (tự nhận)  │ │ ◄── green Alert
│ │                                      │ │
│ │ 🚚 Courier (chọn 1 cho shop)         │ │
│ │  (•) J&T Express    [Phổ biến SME]   │ │
│ │  ( ) Pos Laju       [Phổ biến SME]   │ │
│ │  ( ) Flash Express  [Phổ biến SME]   │ │
│ │  ＋ Xem thêm courier (3)             │ │
│ │  (không show giá — giá thật ở        │ │
│ │   checkout · vận đơn tạo manual)     │ │
│ └──────────────────────────────────────┘ │
│                            [Cancel] [Save]│
```

**Components (shadcn/ui mapping):**
- Tabs: `<Tabs>` "Flat Rate" / "EasyParcel" (default = Flat Rate khi chưa connect)
- Connect toggle: `<Switch>` (enabled)
- Keys: `<Input type="password">` × 2 (api + authentication) — luôn masked, có nút 👁 reveal. KHÔNG có RadioGroup env — auto-detect ở Test connection (production trước, fail → demo)
- Warehouse: `line1/2` = `<Input>`; **State → City → Postcode = geo cascade `<Select>`** reuse có sẵn (`/api/geo/{states,districts,postcodes}`, bảng `malaysia_*`). Warehouse = **Prime SoT** (dùng cho cả rate + label/pickup), KHÔNG sync từ EP — merchant nhập, postcode force-validate ở Test connection. Cascade trả `zone` (west/east) → dùng cho COD West-MY. DRY: cân nhắc tách `AddressCascadeFields` dùng chung với checkout
- Test connection: `<Button variant="outline">` + `<Loader2>` khi gọi `EPRateCheckingBulk` (validate cả key lẫn warehouse postcode)
- Courier: `<RadioGroup>` **single-select** từ response (`courier_id` stable key, `courier_name` + logo, **KHÔNG show giá** — giá thật chỉ ở checkout). Chỉ **1 courier** active/shop (`selectedCourier`). Default = **J&T**; top 3 (J&T, Pos Laju, Flash) + `<Badge>` "Phổ biến SME"; còn lại gập trong `<Collapsible>`/`<details>` "＋ Xem thêm courier". KHÔNG có setting label mode (vận đơn luôn manual ở Phase C)
- Parcel weight/dims: KHÔNG có form trong settings — lấy từ `Products.weight` + `Products.dimensions` (có sẵn); product=0 → fallback hằng số hệ thống (`DEFAULT_PARCEL` const trong code)

**States:**
| State | UI |
|-------|-----|
| Disconnected | Chỉ hiện block Connect; phần chọn courier ẩn |
| Testing | Test button → spinner "Đang kiểm tra..."; form disabled |
| Connected OK | Green `<Alert>` "Connected — env tự nhận"; lộ phần chọn courier; Save enabled |
| Invalid key | Red `<Alert>` `EASYPARCEL_INVALID_KEY` — "API key hoặc Auth key không hợp lệ" (đã thử cả production + demo); KHÔNG lưu |
| Invalid warehouse | Red `<Alert>` `EASYPARCEL_INVALID_WAREHOUSE` — "Địa chỉ kho không hợp lệ — kiểm tra lại postcode" (key OK nhưng origin sai); KHÔNG lưu |
| API error | Red `<Alert>` "EasyParcel tạm lỗi, thử lại" — không lộ key trong message/log |
| Saving | Save → spinner; on success Toast "Đã lưu cấu hình EasyParcel" |

> **Security note:** PATCH key yêu cầu auth + IDOR check (chỉ owner tenant, mirror `hasSiteAccess`). 2 key lưu trong `tenant.easyParcelIntegration` (`apiKey` + `authKey`), masked ở response.

---

### 2.2. Screen B — Checkout Shipping Fee (1 courier) <a id="screen-b-checkout"></a>

**Path:** `/sites/[slug]/checkout`
**Trạng thái:** Tenant EasyParcel ON, buyer đã nhập đủ địa chỉ + chọn state → fetch rate.

```text
┌─────────────────────────────────────────────────────────────┐
│ [≡ Logo]                                       [🛒 (2)]    │
├─────────────────────────────────────────────────────────────┤
│ ┌──────────────────────────────┬───────────────────────────┐│
│ │ 📍 Shipping Address          │ 🛒 Order Summary          ││
│ │ (reuse F14 cascade)          │ • Áo Khoác Bò    RM 50 x1 ││
│ │ State:    [ Selangor     ▼ ] │ ───────────────────────── ││
│ │ City:     [ Shah Alam    ▼ ] │ Subtotal:         RM 50   ││
│ │ Postcode: [ 40000        ▼ ] │ Shipping:         RM 5.42 ││
│ │                              │ ───────────────────────── ││
│ │ (KHÔNG có section vận        │ Total:         RM 55.42   ││
│ │  chuyển — shop chốt 1        │                           ││
│ │  courier; buyer không chọn)  │ [ Place Order ]           ││
│ │                              │ (KHÔNG có dòng SST)       ││
│ └──────────────────────────────┴───────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

**Hybrid fallback (EasyParcel OFF / lỗi / timeout) → giữ nguyên UI F14:**

```text
│ Shipping (West):  RM 8.00 │ ◄── 1 fee đơn (UI F14 cũ)
```

**Free-shipping threshold áp lên phí ship (nếu merchant bật):**

```text
│ J&T Express  FREE  │ Shipping:    FREE      │
│ 2–3 ngày           │                        │
```

**COD payment option — eligibility gating UI:**

```text
┌─────────────────────────────────────────────────────────────┐
│ Phương thức thanh toán                                      │
│ (•) Thanh toán online (card/FPX)                            │
│ ( ) COD — Trả tiền mặt khi nhận  ◄── chỉ enabled khi đủ đk │
└─────────────────────────────────────────────────────────────┘
```

**COD disabled states — helper text theo lý do:**

| Điều kiện chặn | Helper Text (hiện dưới COD option) |
|----------------|-------------------------------------|
| Địa chỉ East MY (Sabah/Sarawak) | "COD chỉ khả dụng cho địa chỉ West Malaysia" |
| total > RM7,000 | "Đơn vượt hạn mức COD (RM7,000)" |
| selectedCourier không hỗ trợ COD | "Courier đang chọn không hỗ trợ COD" |
| total < RM5.01 | "Giá trị đơn tối thiểu để dùng COD là RM5.01" |

**COD selected — fee disclosure (informational):**

```text
│ ( • ) COD — Trả tiền mặt khi nhận                          │
│ i Phí COD ~RM7 hoặc 4% (tuỳ cao hơn) do J&T trừ khỏi      │
│   tiền thu hộ. Platform không thu thêm.                     │
```

**Components:**
- Shipping address: **reuse F14 geo cascade** State → City → Postcode (`<Select>` × 3, `/api/geo/*` + `CheckoutForm`) — KHÔNG dựng form mới
- Phí ship: 1 dòng trong Order Summary — `formatPrice(fee,'MYR')` (KHÔNG có section vận chuyển riêng, KHÔNG picker, KHÔNG courier branding; shop đã chốt 1 courier)
- **KHÔNG có dòng SST** ở Order Summary (SST gỡ ở checkout từ F33 phase-06 — `total = subtotal − discount + shipping`)
- COD option: `<RadioGroup>` trong payment methods; eligibility check từ zone (geo lookup `/api/geo/lookup/[postcode]` → `zone='west'`) + `cod_service_available` từ rate response + total vs min/max. Disabled → `<RadioGroupItem disabled>` + `<p className="text-xs text-muted-foreground">` helper text.
- COD fee disclosure: `<Alert variant="default" className="text-xs">` hiện khi buyer chọn COD — informational only, không block.
- Loading: `<Skeleton>` 1 row khi gọi `/api/orders/calculate-shipping` (debounce 300ms sau khi đủ địa chỉ)
- Fallback: render block fee đơn F14 (zero thay đổi)

**States:**
| State | UI |
|-------|-----|
| Chưa đủ địa chỉ | Block phí ẩn; "Nhập địa chỉ để xem cước" |
| Loading | Skeleton 1 row; Place Order disabled |
| Có phí | 1 dòng "Shipping" trong Order Summary + giá thật → cập nhật Total realtime (KHÔNG SST, KHÔNG courier branding) |
| Rate API lỗi/timeout | Fallback flat-rate F14 + log warning (im lặng với buyer, không chặn) |
| Free triggered | Badge "FREE" trên dòng phí ship |
| COD available | COD option enabled trong payment methods |
| COD East MY | COD `<RadioGroupItem disabled>` + helper "COD chỉ khả dụng cho địa chỉ West Malaysia" |
| COD over limit | COD disabled + helper "Đơn vượt hạn mức COD (RM7,000)" |
| COD courier không hỗ trợ | COD disabled + helper "Courier đang chọn không hỗ trợ COD" |
| COD selected | `<Alert>` fee disclosure hiện (informational) |

---

### 2.3. "Ready to Ship" modal — Create Label (KHÔNG phải màn riêng) <a id="screen-c-create-label"></a>

> **Đây là 1 `<Dialog>` confirm bật từ nút "Ready to Ship" có sẵn — KHÔNG phải scene/route riêng.** Lý do giữ modal: bấm = **trừ tiền thật từ ví EasyParcel** → cần confirm cân nặng/dims (cước phụ thuộc cân) + chọn pickup trước khi trừ ví. Bỏ modal = trừ ví mù.

**Path:** `Dashboard > Orders > [order] > nút "Ready to Ship"` (action inline có sẵn trong `OrderDetailPanel`) → EP tenant mở `<Dialog>` confirm tạo label.
**Trạng thái:** Order confirmed/paid, courier = J&T (courier shop chọn), chưa có AWB. Non-EP: nút này flip thẳng confirmed→ready_to_ship như cũ (không modal).

```text
┌───────────────────────────────────────────────┐
│ Ready to Ship — Đơn #PRM-1042            [x]  │ ◄── KHÔNG hiện courier (đã khoá 1 courier)
├───────────────────────────────────────────────┤
│ Cân nặng (g)        Kích thước thùng (cm)     │
│ ┌────────┐          ┌───┐ ┌───┐ ┌───┐         │
│ │  1200  │          │20 │ │15 │ │10 │         │
│ └────────┘          └───┘ └───┘ └───┘         │
│ Cân = Σ(qty×weight) từ order (sửa được).      │
│ Dims = thùng thật bạn gói (prefill box mặc     │
│ định; đơn 1 món → dims sản phẩm). KHÔNG cộng   │
│ dims nhiều SP.                                 │
│                                               │
│ [COD] Thu hộ: RM 155.42  ◄── hiện khi paymentMethod='cod'   │
│ i Phí COD ~RM7 hoặc 4% (J&T) bị trừ khỏi    │
│   tiền thu hộ. Cước ship vẫn trừ ví bạn.      │
│                                               │
│ Pickup    (•) Đặt lấy hàng  ( ) Tự gửi (drop) │
│ Ngày lấy  ┌──────────────┐ cut-off-aware:       │
│           │ 17/06/2026 ▼ │ hôm nay nếu < cut-off│
│           └──────────────┘ courier; chặn quá    │
│           "Lấy hôm nay nếu  khứ+T7/CN            │
│            tạo trước 13:50"                      │
│                                               │
│ Cước dự kiến: RM 5.42 — trừ ví của bạn        │
│ ───────────────────────────────────────────── │
│              [ Hủy ]   [ Tạo & trừ ví ]       │
└───────────────────────────────────────────────┘
```

**Sau khi tạo OK (2 bước: EPSubmitOrderBulk → EPPayOrderBulk):**

```text
┌───────────────────────────────────────────────┐
│ ✅ Đã tạo vận đơn — Đơn #PRM-1042       [×]  │
├───────────────────────────────────────────────┤
│ AWB: 631234567890        [📋 Copy]            │
│ Trạng thái đơn → Ready to ship                │
│                                               │
│ [ 🖨️ In nhãn (PDF) ]   [ 📅 Xem lịch pickup ]│
│                                               │
│ 💡 Đã trừ RM 5.42 từ ví EasyParcel của bạn.   │
└───────────────────────────────────────────────┘
```

**Ví hết tiền / API fail → order KHÔNG đổi trạng thái:**

```text
│ ⚠️ EASYPARCEL_WALLET_LOW                       │
│ Ví không đủ cước.                              │
│ Nạp ví rồi thử lại — đơn chưa thay đổi.        │
│            [ Nạp ví EasyParcel ↗ ]  [ Thử lại ]│
```

**Nhánh thủ công (tenant chưa bật EasyParcel) — `ShipOrderModal` hiện tại giữ NGUYÊN, qua nút "Ship Order":**

```text
│ Số vận đơn (nhập tay)                          │
│ ┌───────────────────────────────────────────┐ │
│ │                                           │ │ ◄── free-text trackingNumber (đang chạy hôm nay)
│ └───────────────────────────────────────────┘ │
│                                  [ Lưu & ship ]│
```

> **KHÔNG có tab toggle `[EasyParcel] | [Nhập tracking thủ công]`.** Nhánh do **cấu hình tenant** quyết: EP ON + order có serviceId → modal tạo label (qua "Ready to Ship"); EP OFF → ShipOrderModal manual (qua "Ship Order"). EP tenant: "Ship Order" = xác nhận pickup → shipped, KHÔNG nhập tracking (AWB = trackingNumber đã set khi tạo label).

**Components:**
- Modal: `<Dialog>` tạo label gắn vào action "Ready to Ship" của `OrderDetailPanel`. **Điểm intercept (code-level):** nút status-dependent ở `OrderDetailPanel.tsx` (onClick ~L861–863). EP tenant chặn đúng nhánh `status==='confirmed'` (hiện gọi `handleAction('ready_to_ship')`) → mở `<Dialog>` Create Label thay vì flip status thẳng. **KHÔNG** đụng nhánh `status==='ready_to_ship'` (`setIsShipModalOpen(true)`) — đó là bước "Ship Order" (xác nhận pickup → shipped), giữ nguyên. `ShipOrderModal.tsx` giữ nguyên cho nhánh manual non-EP.
- Courier: **KHÔNG hiển thị trong modal** — shop đã khoá 1 courier (`selectedCourier`), không cần nhắc lại ở đây (courier vẫn dùng `selectedCourier` ngầm khi gọi label).
- Weight: `<Input type="number">` prefill từ `order.parcelWeight` (snapshot `Σ(qty×Products.weight)` lúc checkout; =0 → `DEFAULT_PARCEL`). Sửa được.
- Dims (thùng): `<Input type="number">` × 3 (L/W/H) = thùng thật merchant gói — prefill `DEFAULT_PARCEL` box (đơn 1 món → `Products.dimensions`). **KHÔNG gộp dims đa-SP.** Sửa được.
- Pickup: `<RadioGroup>` pickup/dropoff + `<DatePicker>` (`collection_date`) — **CUT-OFF-AWARE**: `min = HÔM NAY` nếu T2–T6 & giờ MYT (server-side) < cut-off của `selectedCourier` (J&T 13:50 / Flash 14:00 / Pos 12:50 — const `COURIER_CUTOFF`), ngược lại `min = ngày làm việc kế`; default = min; disable quá khứ + Sat/Sun; holiday để API bump; KHÔNG time picker. Hint: "Lấy hôm nay nếu tạo trước HH:MM". Dropoff vẫn truyền `collection_date`.
- Primary: `<Button>` "Tạo & trừ ví" → spinner 2 bước; idempotent theo bước **pay** (đã có `awbNo` → disable)
- Print: `<Button variant="outline">` mở `labelUrl` (PDF) tab mới
- Copy AWB: `<Button size="icon">` + clipboard

**Components (COD-specific additions):**
- COD badge: `<Badge variant="secondary">COD</Badge>` hiện dưới tiêu đề modal khi `order.paymentMethod='cod'`; kèm `codAmount` = `formatPrice(order.codAmount, 'MYR')`.
- COD fee note: `<Alert variant="default" className="text-xs">` thông tin phí COD max(flat, 4%) của courier — informational; không block.
- COD East MY block: `<Alert variant="destructive">` "EasyParcel COD chỉ West Malaysia — không thể tạo label COD cho địa chỉ này" + disable nút tạo; merchant phải xử lý thủ công.

**States:**
| State | UI |
|-------|-----|
| Ready (non-COD) | Form prefill; "Tạo & trừ ví" enabled |
| Ready (COD order) | Form prefill + COD badge + codAmount + fee note; "Tạo & trừ ví" enabled |
| Đã có AWB | Form khóa; chỉ hiện In nhãn / pickup (idempotent — chống double-charge) |
| Creating | Spinner "Đang giữ chỗ..." → "Đang trừ ví..." (2 bước) |
| Wallet low | Red `<Alert>` `EASYPARCEL_WALLET_LOW` + link nạp + Thử lại; order unchanged |
| API error | Red `<Alert>` generic + Thử lại; order unchanged |
| COD East MY | Red `<Alert>` "EasyParcel COD chỉ West Malaysia" + disable nút tạo |

---

### 2.4. Screen D — Order Tracking (nhúng order detail) <a id="screen-d-tracking"></a>

**Path:** `/sites/[slug]/orders/[orderNumber]` (buyer) + `OrderDetailPanel` (merchant) — **KHÔNG màn riêng**, làm giàu component có sẵn.
**Trạng thái:** Đơn shipped, có AWB, cron đã sync 1 mốc.

```text
┌─────────────────────────────────────────────┐
│ Đơn #PRM-1042                    [Shipped]  │
├─────────────────────────────────────────────┤
│ 🚚 Vận chuyển                                │
│ Đơn vị: J&T Express                          │
│ Mã vận đơn: 631234567890        [📋 Copy]   │
│ [ 🔗 Theo dõi trên J&T ↗ ]                   │
│                                             │
│ ● Đã lấy hàng        16/06 10:20            │
│ ● Đang trung chuyển  16/06 18:40   ◄── now  │
│ ○ Đang giao                                  │
│ ○ Đã giao                                    │
│                                             │
│ ⏱️ Cập nhật mỗi 30–60 phút                   │
└─────────────────────────────────────────────┘
```

**Merchant order detail — COD status badge:**

```text
┌─────────────────────────────────────────────┐
│ Đơn #PRM-1042 [Shipped] [COD — Đang chờ]   │ ◄── codStatus badge khi paymentMethod='cod'
├─────────────────────────────────────────────┤
│ Thanh toán: COD     Thu hộ: RM 155.42       │
│ COD Status: [Đang chờ]  ◄── pending/collected/settled badge  │
│ i Merchant tự theo dõi settlement trên       │
│   dashboard EasyParcel. Không có API đối soát│
└─────────────────────────────────────────────┘
```

**`codStatus` badge variants:**

| `codStatus` | Badge Label | Variant |
|-------------|-------------|---------|
| `pending` | "COD — Đang chờ" | `secondary` (grey) |
| `collected` | "COD — Đã thu" | `default` (blue) |
| `settled` | "COD — Đã đối soát" | `outline` (green border) |

> Badge chỉ hiện khi `order.paymentMethod='cod'`. Transition do merchant thủ công (không có API EasyParcel đối soát).

**Embed (KHÔNG dựng component mới):**
- Buyer: làm giàu `OtShippingCard` (thêm courier + AWB + deep-link) + chèn milestone EasyParcel vào `OtTimeline` (đã có sẵn trong `OrderTrackingClient`, live qua EventSource).
- Merchant: thêm 1 `<Badge>` trạng thái tracking trong `OrderDetailPanel` (cạnh `OrderProgress`) — hiện chưa show tracking; thêm `codStatus` badge + codAmount gần block payment info.

**Components:**
- Lifecycle badge: `<Badge>` theo `order.status` (8 giá trị, merchant bấm tay)
- Tracking badge/timeline: từ `shippingTrackingStatus` (13 status chuẩn EasyParcel, cron sync — chỉ hiển thị)
- COD status badge: `<Badge>` theo `codStatus` (pending/collected/settled) — chỉ hiện khi COD order; thủ công update
- Track link: `<Button variant="link">` (deep-link courier nếu có; else copy AWB)
- Empty (chưa ship): "Đơn đang được chuẩn bị" — ẩn timeline

**Dual-field + mapping (EasyParcel normalize mọi courier về 1 enum 13 giá trị):**

> EasyParcel ẩn toàn bộ từ vựng raw của từng courier (J&T, Pos Laju, Flash, Ninja Van... top 10) → `EPParcelStatusBulk` chỉ trả 13 status chuẩn. KHÔNG map full vào lifecycle; chỉ 4/13 là *gợi ý* cho merchant (vẫn bấm tay).

| EasyParcel `shippingTrackingStatus` (13) | Hiển thị timeline | Gợi ý `order.status` (manual) |
|---|---|---|
| Scheduled · Pending For Collection | Chờ lấy hàng | — |
| **Collected** · Drop Off | Đã lấy hàng | → merchant bấm `shipped` |
| In Transit | Đang trung chuyển | — (chỉ display) |
| Out for Delivery | Đang giao | — (chỉ display) |
| Delivery On Hold · Exception | ⚠️ Mốc cảnh báo | — (KHÔNG đổi state) |
| **Delivered** | Đã giao ✓ | → merchant tự bấm `completed` (KHÔNG auto) |
| **Returned** | Hoàn trả | → `refunded` sau khi kiểm |
| **Cancelled · Admin Cancel · Expired** | Đã huỷ | → `cancelled` |

**States:**
| State | UI |
|-------|-----|
| Chưa ship | Ẩn block tracking; "Đang chuẩn bị hàng" |
| Shipped, chưa sync | Timeline 1 mốc "Đã tạo vận đơn" |
| In transit / Out for delivery | Timeline mốc mới nhất highlight |
| On Hold / Exception | Mốc cảnh báo (vàng) — `order.status` giữ nguyên |
| Delivered | Tất cả filled + Badge "Đã giao" (chỉ update tracking; merchant tự bấm completed — KHÔNG auto) |

---

### 2.5. Screen E — Returns (merchant) <a id="screen-e-returns"></a>

**Path:** `Dashboard > Orders > [order]` — dùng nút **Refund / Cancel có sẵn** trong `OrderDetailPanel`. **KHÔNG có màn RMA, KHÔNG buyer return-request.** 1 màn, **2 context phân biệt bằng banner đầu đơn**, cùng hội tụ về nút Refund.

> **2 luồng trả hàng khác bản chất — phải phân biệt:**
> - **Case 1 — Courier Return (RTS):** khách bùng / từ chối / giao fail → courier trả hàng về kho. **EasyParcel CÓ track** (status `Returned`, cùng AWB gốc). Banner **tự hiện** khi `shippingTrackingStatus = RETURNED`.
> - **Case 2 — Buyer Return (RMA):** khách **đã nhận** → đổi ý / lỗi SP → seller đồng ý → buyer **tự ra bưu cục gửi về**. **NGOÀI EasyParcel** (booking mới, EP mù) → nhập tracking tay. Merchant tự mở bằng nút "Khách xin trả hàng".
>
> Cả 2 đều kết thúc bằng **nút Refund có sẵn** (`/api/orders/[id]/{refund,cancel}` → refund + restock). KHÔNG component refund mới.

```text
CASE 1 — Courier Return (TỰ ĐỘNG, EP báo Returned)
┌───────────────────────────────────────────────┐
│ 🔴 HÀNG TRẢ VỀ — Courier (tự động) · #PRM-1042 │ ◄── banner tự hiện khi shippingTrackingStatus=RETURNED
├───────────────────────────────────────────────┤
│ EasyParcel: Returned · kiện đang về kho bạn    │
│ Lý do: giao fail / khách từ chối nhận          │
│ ⚠️ Cước đi đã mất · COD: chưa thu được tiền    │
│ → Nhận + kiểm hàng → [ Refund + nhập kho ]     │
└───────────────────────────────────────────────┘

CASE 2 — Buyer Return (THỦ CÔNG, ngoài EP)
┌───────────────────────────────────────────────┐
│ 🟡 KHÁCH XIN TRẢ HÀNG (đã nhận) · #PRM-1043   │ ◄── merchant bấm "Khách xin trả hàng" để mở
├───────────────────────────────────────────────┤
│ Buyer tự gửi về — EasyParcel KHÔNG track       │
│ Mã vận đơn trả (nhập tay): [____________]      │ ┐ field phụ — DB DEFERRED (xem §10)
│ Ai chịu phí: (•) Khách  ( ) Shop (lỗi SP)      │ ┘
│ → Nhận hàng về → [ Refund + nhập kho ]         │
└───────────────────────────────────────────────┘
```

> **Reverse label (EP tạo đơn đảo origin↔dest để đi lấy hàng tại nhà buyer) ĐÃ CẮT khỏi MVP** — buyer tự gửi + nhập tracking tay là đủ. Xem §8 Out of Scope.

**Khác biệt UI (2 điểm), còn lại dùng chung:**

| | Case 1 RTS | Case 2 RMA |
|---|---|---|
| Banner | Đỏ, **tự hiện** (`RETURNED`) | Vàng, merchant **tự mở** |
| Field phụ | không | tracking tay + ai chịu phí (DB deferred) |
| Hội tụ | **nút Refund + cancel tiers chung** | như Case 1 |

**Flow cancel refund (hiển thị theo trạng thái label gốc — đơn ship đi):**

```text
Chưa mua label:  → "Refund FULL (hàng + ship) + nhập kho lại"   [Xác nhận hủy]
Đã mua, chưa pickup: → "Refund tiền hàng. Cước: hủy đơn trên dashboard EasyParcel
                        để hoàn ví." [Đi tới EasyParcel ↗] [Xác nhận]
Đã pickup:       → "Refund tiền hàng. ⚠️ Cước đã mất." [Xác nhận]
```

**Components:**
- Case 1 banner: `<Alert variant="destructive">` tự render khi `shippingTrackingStatus = RETURNED` (0 field mới — dùng lại tracking enum của Screen D).
- Case 2 trigger + fields: nút "Khách xin trả hàng" mở `<Alert>` + input tracking tay + `<RadioGroup>` ai chịu phí. **Field lưu DB chưa chốt — xem §10.**
- Refund + restock (chung cả 2 case): **REUSE nút Refund/Cancel có sẵn** trong `OrderDetailPanel` (`/api/orders/[id]/{refund,cancel}`). KHÔNG component refund mới.
- Cancel tiers: `<Alert>` text theo trạng thái label chọn endpoint — chưa label → `/cancel` (full refund+restock); đã label → `/refund` + message hủy cước trên dashboard EP.
- Refund tiền hàng qua provider có sẵn (Stripe live; manual COD/bank; Xendit = F34) — KHÔNG qua EasyParcel.

**States:**
| State | UI |
|-------|-----|
| Case 1 — EP báo `RETURNED` | Banner đỏ tự hiện; gợi ý kiểm hàng → Refund; cảnh báo cước/COD đã mất |
| Case 2 — merchant mở RMA | Banner vàng; input tracking tay + radio ai chịu phí |
| Nhận hàng về (cả 2) | Bấm nút Refund có sẵn → refund + restock (reuse) |
| Cancel chưa label | `/cancel` có sẵn: refund full + restock ngay |
| Cancel chưa pickup | `/refund` có sẵn: refund hàng; link EasyParcel hủy cước thủ công |
| Cancel đã pickup | `/refund` có sẵn: refund hàng; cảnh báo cước mất |

---

## 3. Mobile 375px <a id="mobile"></a>

**Settings (Mobile):** tabs full-width; keys/warehouse stack vertical; courier list 1-col radio (single-select); Save full-width sticky bottom.

**Checkout shipping fee (Mobile):** buyer KHÔNG chọn courier (shop đã khoá 1 courier) — chỉ 1 dòng "Shipping" trong Order Summary, đồng nhất desktop §2.2.

```text
┌──────────────────────┐
│ Order Summary        │
│ ─────────────────── │
│ Subtotal:   RM 50.00 │
│ Shipping:   RM 5.42  │ ◄── 1 dòng, KHÔNG radio chọn courier
│   J&T · 2–3 ngày     │ ◄── courier + ETA read-only (info)
│ Total:      RM 55.42 │
│ ┌──────────────────┐ │
│ │   Place Order    │ │ ◄── full-width
│ └──────────────────┘ │
└──────────────────────┘
```

**Create label (Mobile):** `<Dialog>` full-screen sheet; field stack vertical; primary "Tạo & trừ ví" full-width sticky.

**Mobile rules:**
- Inputs stack vertical (NO side-by-side); min height 44px
- Postcode `inputmode="numeric" maxlength={5}`
- Dòng phí ship (courier + giá + ETA) đọc rõ 1–2 dòng; settings courier radio tap target ≥ 44px
- Modal → bottom sheet full-width; primary sticky bottom

---

## 4. UI States Matrix

| Screen | Loading | Empty | Error | Success | Validation |
|--------|---------|-------|-------|---------|-----------|
| A Settings | Test spinner / Save spinner | Chỉ block Connect | Red Alert `INVALID_KEY` / API err, không lộ key | Toast "Đã lưu" + green Connected | Key trống → disable Test; warehouse thiếu field → helper |
| B Checkout | Skeleton 1 row (debounce 300ms) | "Nhập địa chỉ để xem cước" | **Fallback flat-rate F14** (im lặng) + log | 1 dòng "Shipping" trong Order Summary / FREE badge | Postcode `^\d{5}$` (reuse F14) |
| B COD option | Skeleton khi check eligibility | COD ẩn (non-eligible) | — | COD option enabled + fee disclosure | East MY → disabled + helper; over limit → disabled; courier không hỗ trợ → disabled |
| C Create label | Spinner 2 bước (submit→pay) | Form prefill | `WALLET_LOW`/API err — order unchanged + Thử lại | Toast + AWB + In nhãn | COD East MY → block + disable nút; idempotent khi có AWB |
| C COD label | COD badge + codAmount prefill | — | East MY block (Alert destructive + disable) | COD badge + fee note trong modal | cod_enabled + cod_amount gửi đi; param name verify sandbox |
| D Tracking | Timeline skeleton | "Đang chuẩn bị hàng" | "Chưa lấy được trạng thái" | Timeline mốc mới | — |
| D COD status | — | codStatus badge ẩn (non-COD) | — | Badge pending/collected/settled | Merchant update thủ công; no API auto-transition |
| E Returns | Refund spinner (reuse) | — | API err + Thử lại | Toast refund + restock | Case 1 auto (`RETURNED`); Case 2 cancel tiers theo label gốc |
| E COD return | — | — | codStatus=pending + cước mất cảnh báo | Merchant nhận hàng → Refund (reuse) | COD không thu được; không hoàn tiền qua EasyParcel |

---

## 5. Component Inventory

| Component | shadcn/ui | Usage |
|-----------|-----------|-------|
| Tabs | `Tabs`, `TabsList`, `TabsTrigger` | Flat Rate / EasyParcel (Screen A) |
| Card group | `Card`, `CardHeader`, `CardContent`, `CardFooter` | Mọi block settings + courier item |
| Secret input | `Input type="password"` + reveal toggle | api key + auth key |
| Text/number input | `Input` | Warehouse, weight, dims |
| Dropdown | `Select` | MY states (geo cascade) |
| Radio | `RadioGroup`, `RadioGroupItem` | Courier picker (settings, single-select), return fee responsibility (Case 2), pickup |
| Switch | `Switch` | Connect enable |
| Date picker | `Popover` + `Calendar` | `collection_date` pickup |
| Dialog | `Dialog` | Create label (→ Sheet on mobile) |
| Badge | `Badge` | ETA, order status, FREE, "Phổ biến SME" |
| Alert | `Alert` (default/destructive) | Non-custody hint, wallet low, errors |
| Skeleton | `Skeleton` | Rate loading, tracking loading |
| Spinner | `Loader2` (lucide) | Test conn, create label, calc rate |
| Toast | `Sonner` | Save / create / return feedback |

---

## 6. Design Tokens

Reference: [`docs/design/decorative-vocabulary.md`](./decorative-vocabulary.md)

| Token | Value | Used in |
|-------|-------|---------|
| Card padding (desktop / mobile) | 24 / 16px | Settings, modals |
| Input height (desktop / mobile) | 40 / 44px | All inputs |
| Courier radio tap target | ≥ 44px | Settings courier picker |
| Wallet-low color | `amber-600` text / `amber-50` bg | Create label error |
| Success / Connected | `green-600` / `green-50` | Connected alert, FREE badge |
| Error border / alert | `red-500` / `destructive` | Validation, wallet low, API err |
| Masked key char | `••••` | API/Auth key display |
| Rate debounce | 300ms | Checkout recalc |

---

## 7. Responsive Breakpoints

| Breakpoint | Width | Behavior |
|-----------|-------|----------|
| Mobile | 375–639px | Vertical stack, full-width buttons, modal → bottom sheet, 44px tap targets, Numpad postcode |
| Tablet | 640–1023px | Settings 1-col; checkout 2-col stacked; courier picker full-width |
| Desktop | ≥1024px | Settings 1-col (max-width 720px); checkout 2-col side-by-side |

---

## 8. Out of Scope (UI)

- ❌ UI nạp ví EasyParcel (không có API topup — chỉ link ra dashboard EasyParcel)
- ❌ Markup/phụ phí cước trong UI (giá = raw EasyParcel)
- ❌ Insurance / parcel-protection toggle
- ❌ Multi-warehouse picker (1 origin/merchant cho MVP)
- ❌ COD reconciliation dashboard (chỉ lưu `codAmount`; đối soát xem trên EasyParcel)
- ❌ Auto-cancel shipment trong app (xử lý trên dashboard EasyParcel)
- ❌ Webhook tracking realtime (polling cron 30–60′)
- ❌ Màn/route "Tạo vận đơn" riêng + tab toggle manual/EP (label gắn vào nút "Ready to Ship" có sẵn)
- ❌ RMA collection + buyer return-request UI (return = reuse nút Refund/Cancel có sẵn)
- ❌ **Reverse label / EP-paid return pickup** (đảo origin↔dest qua `EPSubmitOrderBulk`) — buyer tự gửi + nhập tracking tay đã đủ cho MVP; pickup tại địa chỉ buyer lẻ chưa chắc mọi courier MY hỗ trợ. Backlog post-MVP.

---

## 9. Field Mapping — Checkout → EasyParcel

> Source: `plans/reports/researcher-260617-1430-easyparcel-field-mapping-final.md`

### 9.1 Rate Check Params (EPRateCheckingBulk)

| Prime Field | EasyParcel Param | Transform | Confidence |
|---|---|---|---|
| Sender postcode (warehouse) | `pick_code` | copy as-is | CONFIRMED |
| Sender state (warehouse) | `pick_state` | `mapState()` → 3-letter code | CONFIRMED |
| Sender country | `pick_country` | hardcode `"MY"` | CONFIRMED |
| Receiver postcode | `send_code` | copy as-is | CONFIRMED |
| Receiver state | `send_state` | `mapState()` → 3-letter code | CONFIRMED |
| Receiver country | `send_country` | hardcode `"MY"` | CONFIRMED |
| Package weight | `weight` | `aggregateWeightKg()` → kg decimal | CONFIRMED |
| Package width | `width` | copy as-is (cm) | CONFIRMED |
| Package length | `length` | copy as-is (cm) | CONFIRMED |
| Package height | `height` | copy as-is (cm) | CONFIRMED |

### 9.2 Order Create Receiver Params (EPSubmitOrderBulk)

| Prime Field | EasyParcel Param | Transform | Confidence |
|---|---|---|---|
| Buyer name | `send_name` | copy as-is | CONFIRMED |
| Buyer phone | `send_mobile` | `normalizePhone()` | CONFIRMED |
| Buyer email | `send_email` | copy as-is | CONFIRMED |
| Shipping line 1 | `send_addr1` | `buildAddress()[0]` | CONFIRMED |
| Shipping line 2 | `send_addr2` | `buildAddress()[1]` | CONFIRMED |
| Shipping city | `send_city` | copy as-is | CONFIRMED |
| Shipping state | `send_state` | `mapState()` → 3-letter code | CONFIRMED |
| Shipping postcode | `send_code` | copy as-is | CONFIRMED |
| Shipping country | `send_country` | hardcode `"MY"` | CONFIRMED |
| Package weight | `weight` | `aggregateWeightKg()` → kg decimal | CONFIRMED |
| Package width | `width` | copy as-is (cm) | CONFIRMED |
| Package length | `length` | copy as-is (cm) | CONFIRMED |
| Package height | `height` | copy as-is (cm) | CONFIRMED |

### 9.3 State Code Mapping (16 states)

| Prime Full State Name | EasyParcel Code | Confidence |
|---|---|---|
| Johor | `jhr` | CONFIRMED |
| Kedah | `kdh` | CONFIRMED |
| Kelantan | `ktn` | CONFIRMED |
| Kuala Lumpur | `kul` | CONFIRMED |
| Labuan | `lbn` | INFERRED (std abbreviation) |
| Melaka | `mlk` | INFERRED (std abbreviation) |
| Negeri Sembilan | `nsn` | INFERRED (std abbreviation) |
| Pahang | `phg` | INFERRED (std abbreviation) |
| Pulau Pinang | `png` | CONFIRMED |
| Perak | `prk` | INFERRED (std abbreviation) |
| Perlis | `pls` | INFERRED (std abbreviation) |
| Putrajaya | `pjy` | INFERRED (std abbreviation) |
| Sabah | `sbh` | INFERRED (std abbreviation) |
| Sarawak | `swk` | INFERRED (std abbreviation) |
| Selangor | `sgr` | CONFIRMED |
| Terengganu | `trg` | INFERRED (std abbreviation) |

6 CONFIRMED (jhr, kdh, ktn, kul, png, sgr) from GitHub apih/easyparcel README examples. 10 INFERRED follow ISO 3166-2:MY standard — verify all 16 in sandbox before go-live.

### 9.4 Transform Functions (Pseudo-code)

#### mapState(primeStateName)

```
INPUT:  "Selangor"
OUTPUT: "sgr"

const stateMap = {
  "Johor": "jhr", "Kedah": "kdh", "Kelantan": "ktn", "Kuala Lumpur": "kul",
  "Labuan": "lbn", "Melaka": "mlk", "Negeri Sembilan": "nsn", "Pahang": "phg",
  "Pulau Pinang": "png", "Perak": "prk", "Perlis": "pls", "Putrajaya": "pjy",
  "Sabah": "sbh", "Sarawak": "swk", "Selangor": "sgr", "Terengganu": "trg"
};
return stateMap[primeStateName] || null;  // null → fail loudly, do not send unmapped state
```

#### normalizePhone(phone)

```
INPUT:  "+60-12-2134567"  OR  "0122134567"  OR  "122134567"
OUTPUT: "0122134567" (digits-only, leading 0, no +60 prefix)

1. Strip all non-digits: phone.replace(/\D/g, "")
2. If result starts with "60": remove "60", prepend "0"
3. If result doesn't start with "0": prepend "0"
4. Validate 10 <= length <= 11; reject if not
5. Return result

"+60122134567" → "0122134567" ✓
"0122134567"   → "0122134567" ✓
"122134567"    → "0122134567" ✓
"6012"         → FAIL (too short)
```

#### buildAddress(line1, line2)

```
EasyParcel supports send_addr1 + send_addr2 as separate fields — NO concat needed.

INPUT (both lines): line1="123 Main St", line2="Apt 4B"
OUTPUT: send_addr1="123 Main St", send_addr2="Apt 4B"

INPUT (single line): line1="123 Main St, Apt 4B", line2=""
OUTPUT: send_addr1="123 Main St", send_addr2="Apt 4B"  (split on first comma)

LOGIC:
- If line2 provided: send_addr1 = line1, send_addr2 = line2
- Else if line1 contains comma: split on first comma
- Else: send_addr1 = line1, send_addr2 = ""
```

#### aggregateWeightKg(items)

```
CRITICAL: DB stores weight in GRAMS. EasyParcel expects KILOGRAMS as decimal.
Divide by 1000 ONCE. Do NOT divide a value that is already in kg.

INPUT:  items = [{ weight_g: 250 }, { weight_g: 750 }, { weight_g: 500 }]
OUTPUT: weight = 1.5  (kg, decimal)

total_grams = SUM(item.weight_g for each item)
weight_kg   = total_grams / 1000      // divide ONCE — double-division bug = weight off by 1000x
weight_kg   = ROUND(weight_kg, 2)
return weight_kg
```

### 9.5 Key Gotchas

- **Phone param is `send_mobile`**, not `send_phone`. Using the wrong name silently sends no phone.
- **Postcode param is `send_code`**, not `send_postcode`. Applies to both EPRateCheckingBulk and EPSubmitOrderBulk — field name is consistent.
- **Country must be `"MY"`** (ISO 3166-1 alpha-2), not `"Malaysia"`. Full name not accepted by API.
- **Address has 2 separate fields** (`send_addr1` / `send_addr2`). Do not concatenate into one string.
- **Weight: DB=grams → EP=kg.** `aggregateWeightKg` divides by 1000. Never divide a value already converted.
- **Money: DB=sen → EP=RM.** Divide by 100 when sending to EasyParcel rate/order calls. Multiply by 100 when receiving prices back. Wrong direction = 100× error (NFR-1).

---

## 10. Open Questions

- Courier logo: dùng `courier_logo` URL từ response `EPRateCheckingBulk` trực tiếp, hay cache/proxy? (ảnh external → cân nhắc CSP / next/image domain allowlist)
- Pickup date picker: giới hạn min = ngày làm việc kế tiếp — cần xác nhận lịch nghỉ courier có ảnh hưởng validation không (MVP: cho chọn tự do, courier tự sắp).
- Hi-fi Claude Design: có generate cho Screen A (Settings) + Screen C (Create label) như F14 không, hay giữ low-fi cho MVP?
- **[DEV QUYẾT — liên quan expand DB] Buyer Return (Case 2 §2.5) lưu gì vào bảng `orders`?** Case 1 (Courier RTS) = 0 field mới (dùng lại `shippingTrackingStatus`). Case 2 cần lưu tracking buyer tự gửi + ai chịu phí + (có thể) số tiền. 3 phương án, đánh đổi:
  - **Full (3 cột):** `return_tracking` varchar + `return_fee_by` varchar (`buyer`\|`seller`) + `return_fee` integer (**sen**) → report được "shop tốn bao nhiêu cho returns".
  - **Gọn (2 cột):** `return_tracking` + `return_fee_by`, bỏ số tiền → đủ track + trách nhiệm phí, chưa report được con số.
  - **Tối thiểu (1 cột):** `return_note` text tự do → ít cấu trúc nhất, khó tổng hợp sau.
  - Ràng buộc khi implement (CRITICAL override): cột scalar trên `orders` (KHÔNG array-table) → sửa đồng bộ `src/collections/Orders.ts` + `scripts/db-setup.js` (`ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, NEVER DROP); CI `check-migrations.js` hard-gate. Atomic 1 agent, không tách parallel.
