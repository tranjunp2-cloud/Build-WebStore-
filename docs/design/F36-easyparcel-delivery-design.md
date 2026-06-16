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

- **Screen A — EasyParcel Settings (Phase A):** Tab "EasyParcel" trong `settings/shipping`. Merchant dán 2 key (`api` + `authentication`), chọn env demo/production, nhập warehouse origin, "Test connection", toggle courier khả dụng, set default parcel, chọn auto/manual label.
- **Screen B — Checkout Rate (Phase B):** Buyer nhập địa chỉ → radio list multi-courier (tên + giá raw RM→sen + ETA). Hybrid: chưa cấu hình → giữ UI fee đơn F14.
- **Screen C — Create Label / ShipOrderModal (Phase C):** Merchant 1-click "Tạo vận đơn" → AWB + label PDF; in label; đặt pickup/dropoff; cảnh báo ví thấp. Giữ nhánh nhập tracking thủ công.
- **Screen D — Buyer Order Tracking (Phase C):** Trang đơn buyer hiển thị courier + AWB + trạng thái tracking (poll cron 30–60′).
- **Screen E — Returns (Phase D):** Merchant duyệt return → chọn "Tạo nhãn trả hàng" (reverse) HOẶC "Buyer tự gửi"; cancel refund theo trạng thái label.

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
│              │ │ Environment   ( ) Demo  (•) Production│ │
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

**Sau khi "Test connection" OK → mở khoá phần courier + parcel + label mode:**

```text
│ ┌──────────────────────────────────────┐ │
│ │ ✅ Connected — 8 couriers khả dụng   │ │ ◄── green Alert
│ │                                      │ │
│ │ 🚚 Couriers (bật cái muốn hiện)      │ │
│ │  [✓] Pos Laju        from RM 5.40    │ │
│ │  [✓] J&T Express     from RM 5.42    │ │
│ │  [✓] Ninja Van       from RM 6.00    │ │
│ │  [ ] DHL eCommerce   from RM 6.50    │ │
│ │  [ ] Flash Express   from RM 5.30    │ │
│ │  [✓] City-Link       from RM 6.20    │ │
│ │                                      │ │
│ │ 📦 Default parcel (fallback khi SP   │ │
│ │    thiếu số đo)                      │ │
│ │  Weight (g)  ┌────────┐              │ │
│ │              │  1000  │              │ │
│ │              └────────┘              │ │
│ │  L×W×H (cm)  ┌───┐ ┌───┐ ┌───┐       │ │
│ │              │20 │ │15 │ │10 │       │ │
│ │              └───┘ └───┘ └───┘       │ │
│ │                                      │ │
│ │ 🏷️ Tạo vận đơn                       │ │
│ │  (•) Manual — tôi bấm tạo (default)  │ │
│ │  ( ) Auto — tự tạo khi đơn đã trả tiền│ │
│ └──────────────────────────────────────┘ │
│                            [Cancel] [Save]│
```

**Components (shadcn/ui mapping):**
- Tabs: `<Tabs>` "Flat Rate" / "EasyParcel" (default = Flat Rate khi chưa connect)
- Connect toggle: `<Switch>` (enabled)
- Env: `<RadioGroup>` Demo / Production
- Keys: `<Input type="password">` × 2 (api + authentication) — luôn masked, có nút 👁 reveal
- Warehouse: `<Input>` × N + `<Select>` MY states (16) reuse F14 `MY_STATES`
- Test connection: `<Button variant="outline">` + `<Loader2>` khi gọi `EPRateCheckingBulk`
- Couriers: `<Checkbox>` list từ response (`courier_id` stable key, hiển thị `courier_name` + logo)
- Default parcel: `<Input type="number">` weight + 3 dims
- Label mode: `<RadioGroup>` manual / auto

**States:**
| State | UI |
|-------|-----|
| Disconnected | Chỉ hiện block Connect; courier/parcel/label ẩn |
| Testing | Test button → spinner "Đang kiểm tra..."; form disabled |
| Connected OK | Green `<Alert>` "Connected — N couriers"; lộ phần dưới; Save enabled |
| Invalid key | Red `<Alert>` `EASYPARCEL_INVALID_KEY` — "API key hoặc Auth key sai / sai environment"; KHÔNG lưu |
| API error | Red `<Alert>` "EasyParcel tạm lỗi, thử lại" — không lộ key trong message/log |
| Saving | Save → spinner; on success Toast "Đã lưu cấu hình EasyParcel" |
| Wallet low (chủ động) | Amber `<Alert>` "Số dư ví thấp (RM X). [Nạp ví ↗]" (từ `EPCheckCreditBalance`) |

> **Security note:** PATCH key yêu cầu auth + IDOR check (chỉ owner tenant, mirror `hasSiteAccess`). 2 key lưu trong `tenant.easyParcelIntegration` (`apiKey` + `authKey`), masked ở response.

---

### 2.2. Screen B — Checkout Multi-Courier Rate <a id="screen-b-checkout"></a>

**Path:** `/sites/[slug]/checkout`
**Trạng thái:** Tenant EasyParcel ON, buyer đã nhập đủ địa chỉ + chọn state → fetch rate.

```text
┌─────────────────────────────────────────────────────────────┐
│ [≡ Logo]                                       [🛒 (2)]    │
├─────────────────────────────────────────────────────────────┤
│ ┌──────────────────────────────┬───────────────────────────┐│
│ │ 📍 Shipping Address          │ 🛒 Order Summary          ││
│ │ ... (reuse F14 form) ...     │ • Áo Khoác Bò    RM 50 x1 ││
│ │ State: [ Selangor        ▼ ] │ ───────────────────────── ││
│ │                              │ Subtotal:         RM 50   ││
│ │ 🚚 Chọn đơn vị vận chuyển    │ Shipping:    (chọn bên ←) ││
│ │ ┌──────────────────────────┐ │ SST (6%):       RM 3.00   ││
│ │ │(•) J&T Express   RM 5.42 │ │ ───────────────────────── ││
│ │ │    2–3 ngày              │ │ Total:         RM 58.42   ││
│ │ ├──────────────────────────┤ │                           ││
│ │ │( ) Pos Laju      RM 6.00 │ │ [ Place Order ]           ││
│ │ │    1–2 ngày      ⚡rẻ nhì │ │                           ││
│ │ ├──────────────────────────┤ │ 🔒 Cước EasyParcel raw,   ││
│ │ │( ) Ninja Van     RM 6.50 │ │    không phụ phí          ││
│ │ │    2–4 ngày              │ │                           ││
│ │ └──────────────────────────┘ │                           ││
│ └──────────────────────────────┴───────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

**Hybrid fallback (EasyParcel OFF / lỗi / timeout) → giữ nguyên UI F14:**

```text
│ Shipping (West):  RM 8.00 │ ◄── 1 fee đơn, không radio (UI F14 cũ)
```

**Free-shipping threshold áp lên option rẻ nhất (nếu merchant bật):**

```text
│ ┌──────────────────────────┐ │ Shipping:    🎉 FREE      │
│ │(•) J&T Express  🎉 FREE  │ │ (áp cho option rẻ nhất)   │
│ │    2–3 ngày              │ │                           │
│ │( ) Pos Laju     RM 6.00  │ │                           │
```

**Components:**
- Courier picker: `<RadioGroup>` — mỗi item `<Card>` nhỏ: radio + courier_name + logo + `formatPrice(fee,'MYR')` + ETA badge
- Loading: `<Skeleton>` 3 rows khi gọi `/api/orders/calculate-shipping` (debounce 300ms sau khi đủ địa chỉ)
- Non-custody hint: `<Alert variant="default">` "Cước EasyParcel raw, không phụ phí"
- Fallback: render block fee đơn F14 (zero thay đổi)

**States:**
| State | UI |
|-------|-----|
| Chưa đủ địa chỉ | Block courier ẩn; "💡 Nhập địa chỉ để xem cước" |
| Loading | Skeleton 3 rows; Place Order disabled |
| Multi-courier | RadioGroup; chọn → cập nhật Summary realtime; default = rẻ nhất |
| 1 courier | RadioGroup 1 item (vẫn chọn sẵn) |
| Rate API lỗi/timeout | Fallback flat-rate F14 + log warning (im lặng với buyer, không chặn) |
| Free triggered | Badge "🎉 FREE" trên option rẻ nhất |

---

### 2.3. Screen C — Create Label / ShipOrderModal <a id="screen-c-create-label"></a>

**Path:** `Dashboard > Orders > [order] > "Tạo vận đơn"` → mở `<Dialog>` (mở rộng `ShipOrderModal` hiện có)
**Trạng thái:** Order paid, courier = J&T (buyer đã chọn ở checkout), chưa có AWB.

```text
┌───────────────────────────────────────────────┐
│ 🚚 Tạo vận đơn — Đơn #PRM-1042          [×]  │
├───────────────────────────────────────────────┤
│ Đơn vị vận chuyển                             │
│ ┌───────────────────────────────────────────┐ │
│ │ J&T Express  (buyer đã chọn)            ▼ │ │ ◄── đổi được
│ └───────────────────────────────────────────┘ │
│                                               │
│ Cân nặng (g)        Kích thước (cm)           │
│ ┌────────┐          ┌───┐ ┌───┐ ┌───┐         │
│ │  1200  │          │20 │ │15 │ │10 │         │
│ └────────┘          └───┘ └───┘ └───┘         │
│ (mặc định từ SP / default parcel — sửa được)  │
│                                               │
│ Pickup    (•) Đặt lấy hàng  ( ) Tự gửi (drop) │
│ Ngày lấy  ┌──────────────┐                    │
│           │ 17/06/2026 ▼ │ (mặc định: hôm sau)│
│           └──────────────┘                    │
│                                               │
│ 💰 Cước dự kiến: RM 5.42 — trừ ví EasyParcel  │
│    Số dư ví: RM 48.00                          │
│ ───────────────────────────────────────────── │
│              [ Hủy ]   [ 🏷️ Tạo & trừ ví ]    │
└───────────────────────────────────────────────┘
```

**Sau khi tạo OK (2 bước: EPSubmitOrderBulk → EPPayOrderBulk):**

```text
┌───────────────────────────────────────────────┐
│ ✅ Đã tạo vận đơn — Đơn #PRM-1042       [×]  │
├───────────────────────────────────────────────┤
│ AWB: 631234567890        [📋 Copy]            │
│ Courier: J&T Express                           │
│ Trạng thái đơn → Ready to ship                │
│                                               │
│ [ 🖨️ In nhãn (PDF) ]   [ 📅 Xem lịch pickup ]│
│                                               │
│ 💡 Đã trừ RM 5.42. Số dư ví: RM 42.58         │
└───────────────────────────────────────────────┘
```

**Ví hết tiền / API fail → order KHÔNG đổi trạng thái:**

```text
│ ⚠️ EASYPARCEL_WALLET_LOW                       │
│ Ví không đủ cước (cần RM 5.42, còn RM 2.10).   │
│ Nạp ví rồi thử lại — đơn chưa thay đổi.        │
│            [ Nạp ví EasyParcel ↗ ]  [ Thử lại ]│
```

**Nhánh thủ công (merchant chưa dùng EasyParcel) — giữ nguyên:**

```text
│ Số vận đơn (nhập tay)                          │
│ ┌───────────────────────────────────────────┐ │
│ │                                           │ │ ◄── free-text trackingNumber (F10)
│ └───────────────────────────────────────────┘ │
│                                  [ Lưu & ship ]│
```

**Components:**
- Modal: `<Dialog>` (mở rộng `ShipOrderModal.tsx`)
- Courier: `<Select>` (default = `order.shippingCourier`)
- Weight/dims: `<Input type="number">` prefill từ order/default parcel
- Pickup: `<RadioGroup>` pickup/dropoff + `<DatePicker>` (`collection_date`, mặc định ngày làm việc kế)
- Wallet hint: `<Alert>` số dư từ `EPCheckCreditBalance`
- Primary: `<Button>` "Tạo & trừ ví" → spinner 2 bước; idempotent theo bước **pay** (đã có `awbNo` → disable)
- Print: `<Button variant="outline">` mở `labelUrl` (PDF) tab mới
- Copy AWB: `<Button size="icon">` + clipboard

**States:**
| State | UI |
|-------|-----|
| Ready | Form prefill; "Tạo & trừ ví" enabled |
| Đã có AWB | Form khóa; chỉ hiện In nhãn / pickup (idempotent — chống double-charge) |
| Creating | Spinner "Đang giữ chỗ..." → "Đang trừ ví..." (2 bước) |
| Wallet low | Red `<Alert>` `EASYPARCEL_WALLET_LOW` + link nạp + Thử lại; order unchanged |
| API error | Red `<Alert>` generic + Thử lại; order unchanged |
| COD East MY | Block + helper "EasyParcel COD chỉ West Malaysia" |
| Auto mode fail | Toast "Auto tạo nhãn thất bại — chuyển thủ công" + mở modal manual |

---

### 2.4. Screen D — Buyer Order Tracking <a id="screen-d-tracking"></a>

**Path:** `/sites/[slug]/orders/[orderNumber]`
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

**Components:**
- Status badge: `<Badge>` theo order status
- Timeline: vertical steps (filled = đã qua) từ `shippingTrackingStatus`
- Track link: `<Button variant="link">` (deep-link courier nếu có; else copy AWB)
- Empty (chưa ship): "Đơn đang được chuẩn bị" — ẩn timeline

**States:**
| State | UI |
|-------|-----|
| Chưa ship | Ẩn block tracking; "Đang chuẩn bị hàng" |
| Shipped, chưa sync | Timeline 1 mốc "Đã tạo vận đơn" |
| In transit | Timeline mốc mới nhất highlight |
| Delivered | Tất cả filled + Badge "Đã giao" (option order → completed) |

---

### 2.5. Screen E — Returns (merchant) <a id="screen-e-returns"></a>

**Path:** `Dashboard > Orders > [order] > "Xử lý trả hàng"` → `<Dialog>`
**Trạng thái:** Buyer request return, merchant duyệt.

```text
┌───────────────────────────────────────────────┐
│ ↩️ Xử lý trả hàng — Đơn #PRM-1042       [×]  │
├───────────────────────────────────────────────┤
│ Chọn cách trả hàng:                            │
│  (•) Tạo nhãn trả hàng (reverse)               │
│      EasyParcel tạo đơn đảo: kho bạn = nơi nhận│
│  ( ) Buyer tự gửi                              │
│      Bạn xác nhận khi nhận được hàng           │
│                                               │
│ ── Nếu reverse ──                              │
│ 💰 Cước trả ~RM 5.42 — trừ ví bạn             │
│            [ Hủy ]   [ Tạo nhãn trả & trừ ví ] │
└───────────────────────────────────────────────┘
```

**Flow cancel refund (hiển thị theo trạng thái label):**

```text
Chưa mua label:  → "Refund FULL (hàng + ship) + nhập kho lại"   [Xác nhận hủy]
Đã mua, chưa pickup: → "Refund tiền hàng. Cước: hủy đơn trên dashboard EasyParcel
                        để hoàn ví." [Đi tới EasyParcel ↗] [Xác nhận]
Đã pickup:       → "Refund tiền hàng. ⚠️ Cước đã mất." [Xác nhận]
```

**Components:**
- Method: `<RadioGroup>` reverse / buyer-self-send
- Reverse: `<Button>` → `EPSubmitOrderBulk` đảo origin↔dest, lưu return AWB
- Self-send: `<Button>` "Đã nhận hàng trả" → refund + restock (reuse F10 cancel-restock)
- Cancel tiers: `<Alert>` text theo trạng thái label; refund tiền hàng qua F34/F13 (KHÔNG qua EasyParcel)

**States:**
| State | UI |
|-------|-----|
| Reverse OK | Toast "Đã tạo nhãn trả" + return AWB hiển thị trong đơn |
| Self-send | Nút "Đã nhận hàng trả" → confirm → refund + restock |
| Cancel chưa label | Refund full + restock ngay |
| Cancel chưa pickup | Refund hàng; link EasyParcel hủy cước thủ công |
| Cancel đã pickup | Refund hàng; cảnh báo cước mất |

---

## 3. Mobile 375px <a id="mobile"></a>

**Settings (Mobile):** tabs full-width; keys/warehouse stack vertical; courier list 1-col checkbox; default parcel dims wrap 3-up nhỏ; Save full-width sticky bottom.

**Checkout courier picker (Mobile):**

```text
┌──────────────────────┐
│ 🚚 Đơn vị vận chuyển │
│ ┌──────────────────┐ │
│ │(•) J&T   RM 5.42 │ │ ◄── radio card, tap ≥44px
│ │    2–3 ngày      │ │
│ ├──────────────────┤ │
│ │( ) Pos   RM 6.00 │ │
│ │    1–2 ngày      │ │
│ └──────────────────┘ │
│ ─────────────────── │
│ Subtotal:   RM 50    │
│ Shipping:   RM 5.42  │
│ Total:      RM 58.42 │
│ ┌──────────────────┐ │
│ │   Place Order    │ │ ◄── full-width
│ └──────────────────┘ │
└──────────────────────┘
```

**Create label (Mobile):** `<Dialog>` full-screen sheet; field stack vertical; primary "Tạo & trừ ví" full-width sticky.

**Mobile rules:**
- Inputs stack vertical (NO side-by-side); min height 44px
- Postcode `inputmode="numeric" maxlength={5}`
- Radio courier card tap target ≥ 44px; giá + ETA luôn 1 dòng/2 dòng rõ
- Modal → bottom sheet full-width; primary sticky bottom

---

## 4. UI States Matrix

| Screen | Loading | Empty | Error | Success | Validation |
|--------|---------|-------|-------|---------|-----------|
| A Settings | Test spinner / Save spinner | Chỉ block Connect | Red Alert `INVALID_KEY` / API err, không lộ key | Toast "Đã lưu" + green Connected | Key trống → disable Test; warehouse thiếu field → helper |
| B Checkout | Skeleton 3 rows (debounce 300ms) | "Nhập địa chỉ để xem cước" | **Fallback flat-rate F14** (im lặng) + log | RadioGroup courier / FREE badge | Postcode `^\d{5}$` (reuse F14) |
| C Create label | Spinner 2 bước (submit→pay) | Form prefill | `WALLET_LOW`/API err — order unchanged + Thử lại | Toast + AWB + In nhãn | COD East MY chặn; idempotent khi có AWB |
| D Tracking | Timeline skeleton | "Đang chuẩn bị hàng" | "Chưa lấy được trạng thái" | Timeline mốc mới | — |
| E Returns | Spinner tạo nhãn | — | API err + Thử lại | Toast + return AWB | Tiers refund theo label state |

---

## 5. Component Inventory

| Component | shadcn/ui | Usage |
|-----------|-----------|-------|
| Tabs | `Tabs`, `TabsList`, `TabsTrigger` | Flat Rate / EasyParcel (Screen A) |
| Card group | `Card`, `CardHeader`, `CardContent`, `CardFooter` | Mọi block settings + courier item |
| Secret input | `Input type="password"` + reveal toggle | api key + auth key |
| Text/number input | `Input` | Warehouse, weight, dims |
| Dropdown | `Select` | MY states, courier (modal) |
| Radio | `RadioGroup`, `RadioGroupItem` | Env, courier picker, label mode, return method, pickup |
| Checkbox | `Checkbox` | enabledCouriers list |
| Switch | `Switch` | Connect enable |
| Date picker | `Popover` + `Calendar` | `collection_date` pickup |
| Dialog | `Dialog` | Create label, Returns (→ Sheet on mobile) |
| Badge | `Badge` | ETA, order status, FREE, "rẻ nhất" |
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
| Courier card radio tap target | ≥ 44px | Checkout picker |
| Wallet-low color | `amber-600` text / `amber-50` bg | Settings + create label |
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

---

## 9. Open Questions

- Courier logo: dùng `courier_logo` URL từ response `EPRateCheckingBulk` trực tiếp, hay cache/proxy? (ảnh external → cân nhắc CSP / next/image domain allowlist)
- Pickup date picker: giới hạn min = ngày làm việc kế tiếp — cần xác nhận lịch nghỉ courier có ảnh hưởng validation không (MVP: cho chọn tự do, courier tự sắp).
- Hi-fi Claude Design: có generate cho Screen A (Settings) + Screen C (Create label) như F14 không, hay giữ low-fi cho MVP?
