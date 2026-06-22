# F14 Shipping — Design & Wireframe Report

> **Epic:** Storefront Commerce & Seller Settings
> **Feature Code:** F14
> **Links:**
> - PRD: [`docs/prd/F14-shipping.md`](../prd/F14-shipping.md)
> - Stories: [`docs/stories/F14-shipping-stories.md`](../stories/F14-shipping-stories.md)
> - Architecture: [`docs/architecture/F14-shipping.md`](../architecture/F14-shipping.md)
> - **🎨 Claude Design (hi-fi reference):** https://api.anthropic.com/v1/design/h/cE8aBwHcJ-LiTp2MI8EGUQ?open_file=Shipping+Settings.html
>   - Open file: `Shipping Settings.html` — visual reference cho Screen A
>   - **Dev action:** Fetch design, đọc README, implement theo `Shipping Settings.html`
> - Related: F09 Storefront Commerce, F18 CMS Global Layout, F19 Store Configuration

Tài liệu này cung cấp wireframe & UI spec low-fi cho tính năng Shipping Malaysia (Wave 6 — flat-rate only). Settings UI tuân thủ **F18 CMS Global Layout** (Sidebar + Topbar). Checkout UI thuộc Storefront F09 (không có Sidebar Admin).

---

## 1. Feature Summary

> **🚚 Delivery Model:** SELF-DELIVERY — seller tự lo giao hàng. UI không có carrier picker, không có "Print Label", không có tracking URL field. `trackingNumber` chỉ là free-text input trong Order detail (F10), không thuộc F14 scope.
>
> **[F36 update — EasyParcel]** Wave 7+ thêm **EasyParcel** (courier aggregator) làm **tab thứ 2** cạnh Flat Rate trong Shipping Settings (§2.1b). Khi tenant bật EasyParcel: checkout dùng **giá courier thật** (1 courier/shop, buyer không chọn); chưa bật / lỗi / timeout → **fallback flat-rate** này (không vỡ). Tab Flat Rate giữ nguyên 100%. Nguồn: PRD `docs/prd/F36-easyparcel-delivery.md`.

Wave 6 Shipping bao gồm 3 surface chính:

- **Shipping Settings (CMS Dashboard):** Seller cấu hình `westRate` / `eastRate` / `freeAbove` cho cửa hàng. UI dạng card form, validate real-time, persist vào `site.shippingConfig`.
- **Checkout Shipping (Storefront):** Buyer chọn state từ dropdown 16 MY states → auto-classify West/East → fetch `POST /api/orders/calculate-shipping` → render fee inline trong Order Summary. Free shipping badge khi đạt threshold.
- **Mobile Optimization (375px):** Form fields stack vertical full-width, postcode dùng `inputmode="numeric"`, tap target ≥ 44px (US-F14-03).

### Design Principles
- **KISS:** Flat-rate Wave 6 — không animation phức tạp, không carrier picker, không async tracking
- **Reuse F19/F09 pattern:** Card layout giống F19 Payment Configuration, Order Summary giống F09 Checkout
- **shadcn/ui only:** `Card`, `Input`, `Switch`, `Select`, `Button`, `Badge` — không custom component
- **Mobile-first variants:** Mỗi screen có note responsive 375px

---

## 2. Wireframes & UI Layouts

### 2.1. Screen A — Shipping Settings <a id="screen-a-shipping-settings"></a>

> **🎨 Hi-fi reference:** [Claude Design — `Shipping Settings.html`](https://api.anthropic.com/v1/design/h/cE8aBwHcJ-LiTp2MI8EGUQ?open_file=Shipping+Settings.html)
>
> **Dev implementation steps:**
> 1. Fetch design file qua link trên
> 2. Đọc README (nếu có) trong design package
> 3. Implement `Shipping Settings.html` làm UI source-of-truth cho Screen A
> 4. Wireframe ASCII bên dưới chỉ là sketch low-fi — UI cuối phải khớp Claude Design hi-fi
> 5. Nếu Claude Design conflict với decisions §8 (Reset behavior, postcode validation, hint logic) → ưu tiên §8 (đã chốt với PM)

**Path:** `Dashboard > Settings > Shipping` (`/dashboard/settings/shipping`)
**Trạng thái:** Seller đã đăng nhập, đã cấu hình ban đầu (West RM 8, East RM 15, free toggle off).

> **[F36] Tab wrapper:** Màn Shipping giờ là 2 tab — **Flat Rate** (mặc định, wireframe dưới) + **EasyParcel** (§2.1b). Footer `[Reset] [Save]` dùng chung. Nội dung Flat Rate bên dưới **giữ nguyên** Wave 6.

```text
┌─────────────────────────────────────────────────────────┐
│ [≡ Logo]  Search...                           [👤 Admin]│ ◄── Global Header
│              │ ┌────────────┬─────────────┐             │
│              │ │ Flat Rate ●│ EasyParcel  │ ◄── Tabs (F36)
│              │ └────────────┴─────────────┘             │
├──────────────┬──────────────────────────────────────────┤
│ 🏠 Dashboard │ Store Settings > Shipping                │
│ 📦 Products  │                                          │
│ 🛒 Orders    │ ┌──────────────────────────────────────┐ │
│ ⚙️ Settings  │ │ 🚚 Shipping Rates by Region          │ │
│  ↳ Domains   │ │ Set flat rates for Malaysian regions │ │
│  ↳ Payments  │ │                                      │ │
│  ↳ Shipping ●│ │  West Malaysia (Semenanjung)         │ │
│  ↳ Staff     │ │  ┌──────────────────────────────┐    │ │
│              │ │  │ RM   8.00                    │    │ │
│              │ │  └──────────────────────────────┘    │ │
│              │ │  13 states: Johor, KL, Penang...     │ │
│              │ │                                      │ │
│              │ │  East Malaysia (Sabah/Sarawak)       │ │
│              │ │  ┌──────────────────────────────┐    │ │
│              │ │  │ RM  15.00                    │    │ │
│              │ │  └──────────────────────────────┘    │ │
│              │ │  3 states: Sabah, Sarawak, Labuan    │ │
│              │ └──────────────────────────────────────┘ │
│              │                                          │
│              │ ┌──────────────────────────────────────┐ │
│              │ │ 🎁 Free Shipping Threshold     [○━ ]│ │
│              │ │                                      │ │
│              │ │ Offer free shipping when buyer's     │ │
│              │ │ subtotal reaches or exceeds:         │ │
│              │ │  ┌──────────────────────────────┐    │ │
│              │ │  │ RM 100.00            (disabled)│  │ │
│              │ │  └──────────────────────────────┘    │ │
│              │ └──────────────────────────────────────┘ │
│              │                                          │
│              │           [ Reset to Defaults ]  [ Save ]│
└──────────────┴──────────────────────────────────────────┘
```

**Components (shadcn/ui mapping):**
- Outer cards: `<Card>` + `<CardHeader>` + `<CardContent>`
- Rate inputs: `<Input type="number">` with `prefix="RM"` adornment
- Free toggle: `<Switch>` + conditional `<Input>` (disabled when off)
- Footer buttons: `<Button variant="ghost">` (Reset) + `<Button>` (Save, disabled until dirty)

**States:**
| State | UI |
|-------|-----|
| Loading | Card skeleton (3 rows shimmer) khi fetch initial config |
| Dirty | Save button enabled, breadcrumb dot ●︎ next to "Shipping" |
| Saving | Save button → spinner + label "Saving..." |
| Success | `<Toast>` "Shipping settings updated" (3s auto-dismiss) |
| Validation Error | Input border red + helper text "Rate must be 0 – RM 1,000" |

**[F36] Dynamic state của tab Flat Rate (phụ thuộc trạng thái EasyParcel):**

| EasyParcel | Hiển thị thêm ở tab Flat Rate |
|---|---|
| **OFF** (chưa kết nối) | `<Badge>` **Active** (xanh dương) cạnh tiêu đề "Shipping Rates by Region" → báo "cụm cấu hình đang chạy thật ở checkout". + **Upsell** helper/alert-link dưới mô tả: *"Tip: Connect EasyParcel để tự lấy live rates từ J&T, Pos Laju, Ninja Van tại checkout. → Sang tab EasyParcel"* |
| **ON + Connected** | Amber `<Alert>` đầu thẻ: *"⚠️ Fallback Mode Active — flat rate chỉ dùng khi EasyParcel API timeout/lỗi ở checkout."* (badge Active ẩn) |

```text
┌──────────────────────────────────────┐
│ 🚚 Shipping Rates by Region  [Active] │ ◄── badge xanh khi EP OFF
│ Set flat rates for Malaysian regions │
│ 💡 Tip: Connect EasyParcel → live    │ ◄── upsell link khi chưa connect
│    rates · Sang tab EasyParcel ↗     │
│ ───── HOẶC khi EP ON + Connected: ── │
│ ⚠️ Fallback Mode Active — flat rate  │ ◄── amber banner (thay badge)
│   chỉ chạy khi EasyParcel lỗi/timeout │
└──────────────────────────────────────┘
```

> **Live Preview sync:** Khi EasyParcel ON + Connected, bảng Live Preview (khối Free Shipping) đổi dòng `Shipping (Flat Rate – West) RM 8.00` → giả lập cước EasyParcel `Shipping (EasyParcel – J&T Express) RM 5.42`, **tổng (Buyer pays) cập nhật theo**. (1 courier shop đã chọn — không phải multi.)

---

### 2.1.b Screen A — EasyParcel tab (F36) <a id="screen-a-easyparcel"></a>

> **Nguồn:** F36 PRD (`docs/prd/F36-easyparcel-delivery.md`, single-courier) + **Progressive Disclosure** (chỉ hiện thứ cần ở đúng thời điểm). Connect UI **mirror F34 `XenditConnectBlock`**.

**Path:** `Dashboard > Settings > Shipping > tab "EasyParcel"`

Tab theo **4 trạng thái** rõ rệt:

**(1) Disconnected — Empty State (Switch OFF):** ẩn toàn bộ form, chỉ 1 banner lớn.

```text
┌──────────────────────────────────────────┐
│ ┌ Flat Rate ┬ EasyParcel ● ┐             │
│                  🔌                       │
│      Connect your EasyParcel Account      │
│  Offer live, real-time shipping rates     │
│  from top Malaysian couriers to buyers    │
│  directly at checkout.                    │
│         [ Setup Connection ]              │ ◄── bấm = bật Switch → (2)
└──────────────────────────────────────────┘
```

**(2) Setup / Editing (Switch ON, chưa test OK):** form hiện. **"Test connection" = Primary button cuối thẻ**; phải test OK mới mở khóa Save tổng.

```text
│ 🔌 Connect EasyParcel               [●ON] │
│ API Key (api)      [•••••••••• 👁]        │
│ Auth Key (auth)    [•••••••••• 👁]        │ ◄── 2 key (KHÔNG env selector — auto-detect)
│ 🏭 Warehouse (origin)                     │
│ Address line 1  [______________________] │
│ State ▼  City/District ▼  Postcode ▼      │ ◄── geo cascade /api/geo/*
│        [ 🔍 Test connection ]   (Primary) │ ◄── gate Save
│ ⓘ Chọn courier mở khóa sau khi test OK    │
└──────────────────────────────────────────┘
   Footer: [Cancel]  [Save] (disabled tới khi test OK)
```

**(3) Connected (test OK):** credentials **khóa read-only** (chống gõ đè làm rớt kết nối); Test → đổi thành **[Edit Credentials]** + **[Disconnect]** (destructive). Lộ chọn **1 courier** (grid 2-col, single-select, no price).

```text
│ ✅ Connected — Production (tự nhận env)    │
│ API / Auth / Warehouse   🔒 (read-only)    │
│         [ Edit Credentials ] [ Disconnect ]│ ◄── thay nút Test
│ 🚚 Courier (chọn 1 cho shop)               │
│ ┌(•) J&T [Phổ biến]┐ ┌( ) Pos Laju [Phổ biến]┐ │ ◄── grid 2-col radio
│ ┌( ) Flash [Phổ biến]┐ ┌ ＋ Xem thêm (3)     ┐ │
│ (không show giá — giá thật ở checkout)     │
│                           [Cancel] [Save]  │
```

**(4) Edit Mode — Temporary Validation Lock (sửa key/kho khi đã connected):** kết nối cũ không còn chắc → **bắt buộc re-test**.
- Ẩn **[Disconnect]**, thay bằng **[🔍 Re-test Connection]** (Primary).
- **Blur/disable** phần chọn courier + overlay *"Please re-test your connection to unlock configurations"*.
- **Khóa Save** footer (không cho lưu cấu hình lỗi ra storefront).
- Re-test **OK** → restore [Disconnect] + mở khóa courier + Save sáng lại. **FAIL** → giữ khóa + báo lỗi.

**Components (shadcn/ui):**
- Tabs: `<Tabs>` Flat Rate / EasyParcel
- Empty state (1): `<Card>` icon + copy + `<Button>` "Setup Connection" (toggle `<Switch>`)
- Connect: `<Switch>` + 2× `<Input type="password">` (api + authentication) + eye reveal — **mirror `XenditConnectBlock`** (F34)
- Warehouse: `line1/2` = `<Input>`; **State → City → Postcode = geo cascade `<Select>`** reuse `/api/geo/{states,districts,postcodes}`. Warehouse = **Prime source of truth**; postcode force-validate ở Test connection
- Test/Re-test: `<Button>` **Primary** — auto-detect env (production → demo). **Gate Save**. KHÔNG có RadioGroup environment
- Disconnect: `<Button variant="destructive">` (chỉ ở state Connected, không Edit-mode)
- Courier: `<RadioGroup>` **single-select** (`selectedCourier` = 1 `courier_id`) render **grid 2-col** (tiết kiệm chiều cao), default **J&T**; top-3 + `<Badge>` "Phổ biến SME"; còn lại `<Collapsible>` "＋ Xem thêm". **KHÔNG show giá**
- Footer `[Cancel] [Save]` — dùng chung tab Flat Rate; khóa khi chưa test OK / Edit-mode

**Khác tab Flat Rate (KISS — đã bỏ):** KHÔNG default-parcel (lấy từ `Products.*`), KHÔNG auto/manual label (luôn manual ở F10), KHÔNG hiển thị số dư ví.

**States:**
| State | UI |
|-------|-----|
| Disconnected | Empty-state banner + `[Setup Connection]`; form ẩn |
| Setup/Editing | Form; Test = Primary; Save disabled tới khi test OK; courier ẩn |
| Testing | Spinner "Đang kiểm tra…"; form disabled |
| Invalid | Red `<Alert>` `EASYPARCEL_INVALID_KEY` / `EASYPARCEL_INVALID_WAREHOUSE` — **KHÔNG lưu** |
| Connected | Credentials 🔒 read-only; `[Edit][Disconnect]`; courier grid; Save enabled |
| Edit-mode lock | `[Re-test]` Primary; courier blur + overlay; Save khóa tới khi re-test OK |
| Saving | Save → spinner; success Toast "Đã lưu cấu hình EasyParcel" |

> ✅ **DECISION (chốt 2026-06-18) — giữ KISS single-courier, KHÔNG thêm 4 mục đề xuất sau** (chúng đảo ngược fidelity-fix PRD #1232; đã cân nhắc & loại):
> 1. **Courier hiển thị giá "From RM 5.40" + checkbox multi-select** → **bỏ.** Giữ single-select radio, **không show giá** (settings chưa có origin/dest/weight → "from" dễ sai).
> 2. **Default Parcel Weight/Dimensions form** → **bỏ.** Weight/dims lấy từ `Products.*` + hằng số `DEFAULT_PARCEL`.
> 3. **Fulfillment Mode (auto/manual)** → **bỏ.** Luôn manual qua nút "Ready to Ship" (F10).
> 4. **Environment selector / "Secret Key"** → **bỏ.** Auto-detect env; key = `api` + `authentication` (không gọi "secret").
> → Nếu sau này cần rich-settings (đa courier + parcel + fulfilment): phải mở rộng scope + cập nhật PRD #1232 trước khi vẽ.

#### User Flow — Kết nối EasyParcel (Phase A)

```text
Actor: Merchant (seller)

1. Merchant → Settings › Shipping › tab "EasyParcel"
   System   → Switch OFF: empty-state "Connect your EasyParcel Account" + [Setup Connection]

2. Merchant → bấm [Setup Connection] (hoặc gạt Switch ON)
   System   → hiện form: API Key + Auth Key + Warehouse (State→City→Postcode cascade)
              Save KHÓA; [🔍 Test connection] = Primary

3. Merchant → nhập 2 key + địa chỉ kho → bấm [Test connection]
   System   → EPRateCheckingBulk (auto-detect env: prod→demo) bằng key + warehouse postcode
              ├─ OK            → ✅ "Connected — Production"; lộ phần chọn courier
              ├─ key sai       → ❌ EASYPARCEL_INVALID_KEY — KHÔNG lưu
              └─ postcode sai  → ❌ EASYPARCEL_INVALID_WAREHOUSE — KHÔNG lưu

4. Merchant → chọn 1 courier (radio, default J&T) → [Save]
   System   → lưu tenant.easyParcelIntegration (key masked, selectedCourier); Toast "Đã lưu"
              → Phase B (checkout) mở khoá cho site

   [Edit sau khi connected] Merchant sửa key/kho
   System   → khóa courier (overlay) + đổi nút → [Re-test Connection] + khóa Save
              re-test OK → mở khoá lại; FAIL → giữ khóa
```

---

### 2.2. Screen B — Checkout Shipping <a id="screen-b-checkout-shipping"></a>

**Path:** `/sites/[slug]/checkout`
**Trạng thái:** Buyer guest, đã add 1 SP RM 50, chưa chọn state.

```text
┌─────────────────────────────────────────────────────────────┐
│ [≡ Logo]                                       [🛒 (2)]    │ ◄── Store Header
├─────────────────────────────────────────────────────────────┤
│ ← Continue Shopping                                          │
│                                                              │
│ ┌──────────────────────────────┬───────────────────────────┐│
│ │ 📍 Shipping Address          │ 🛒 Order Summary          ││
│ │                              │                           ││
│ │ Full Name                    │ • Áo Khoác Bò      RM 50  ││
│ │ ┌──────────────────────────┐ │   x1                      ││
│ │ │                          │ │ ───────────────────────── ││
│ │ └──────────────────────────┘ │ Subtotal:          RM 50  ││
│ │ Phone                        │ Shipping:           — —   ││ ◄── empty
│ │ ┌──────────────────────────┐ │ SST (6%):       RM 3.00   ││
│ │ │                          │ │ ───────────────────────── ││
│ │ └──────────────────────────┘ │ Total:         RM 53.00   ││
│ │ Address Line 1               │                           ││
│ │ ┌──────────────────────────┐ │ [ Place Order ]  (disabled)│
│ │ │                          │ │                           ││
│ │ └──────────────────────────┘ │ 💡 Select state to see    ││
│ │ Address Line 2 (optional)    │    shipping fee           ││
│ │ ┌──────────────────────────┐ │                           ││
│ │ │                          │ │                           ││
│ │ └──────────────────────────┘ │                           ││
│ │ ┌──────────────┐ ┌─────────┐ │                           ││
│ │ │ City         │ │Postcode │ │                           ││
│ │ └──────────────┘ └─────────┘ │                           ││
│ │ State                        │                           ││
│ │ ┌──────────────────────────┐ │                           ││
│ │ │ Select state...        ▼ │ │                           ││
│ │ └──────────────────────────┘ │                           ││
│ └──────────────────────────────┴───────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

**After buyer selects "Selangor" (West MY):**

```text
│ State                        │ Subtotal:          RM 50  │
│ ┌──────────────────────────┐ │ Shipping (West):  RM 8.00 │ ◄── filled
│ │ Selangor               ▼ │ │ SST (6%):       RM 3.00   │
│ └──────────────────────────┘ │ ─────────────────────────│
│                              │ Total:         RM 61.00   │
│                              │                           │
│                              │ 💡 Add RM 50 more for     │ ◄── free hint
│                              │    FREE shipping          │
```

**Free shipping triggered (subtotal RM 120, threshold RM 100):**

```text
                               │ Subtotal:         RM 120  │
                               │ Shipping:    🎉 FREE     │ ◄── green badge
                               │ SST (6%):       RM 7.20   │
                               │ ─────────────────────────│
                               │ Total:        RM 127.20   │
```

**Components:**
- Address form: existing fields trong `src/app/sites/[slug]/checkout/page.tsx` (line 358-595)
- State dropdown: `<Select>` populated từ `MY_STATES` (16 states)
- Shipping row: dynamic — empty dash → fee → free badge
- Free shipping hint: `<Alert variant="info">` dưới summary
- Free badge: `<Badge variant="success">` "🎉 FREE"

**States:**
| State | UI |
|-------|-----|
| Empty | Shipping row hiển thị `—`, Place Order disabled |
| Loading | Inline `<Loader2>` spinner cạnh "Shipping:" (debounced 300ms khi state change) |
| Calculated | Display fee bằng `formatPrice(fee, 'MYR')` |
| Free | Green `<Badge>` "FREE" + green text |
| Error | Toast `Failed to calculate shipping. Please try again.` + Retry inline button |
| Postcode invalid | Postcode input red border + helper "5 digits required" |

---

### 2.3. Screen C — Mobile 375px <a id="screen-c-mobile-375px"></a>

**Settings (Mobile):**

```text
┌──────────────────────┐
│ ☰  Shipping     [×]  │ ◄── Mobile header (drawer nav)
├──────────────────────┤
│                      │
│ 🚚 Rates by Region   │
│                      │
│ West Malaysia        │
│ ┌──────────────────┐ │
│ │ RM  8.00         │ │ ◄── input height 44px
│ └──────────────────┘ │
│ 13 states            │
│                      │
│ East Malaysia        │
│ ┌──────────────────┐ │
│ │ RM 15.00         │ │
│ └──────────────────┘ │
│ 3 states             │
│                      │
│ ─────────────────── │
│                      │
│ 🎁 Free Shipping     │
│ [○━ ] Enabled        │ ◄── 44px tap target
│                      │
│ Threshold            │
│ ┌──────────────────┐ │
│ │ RM 100.00        │ │
│ └──────────────────┘ │
│                      │
│ ┌──────────────────┐ │
│ │      Save        │ │ ◄── full-width primary
│ └──────────────────┘ │
│ [Reset to Defaults]  │
└──────────────────────┘
```

**Checkout (Mobile):**

```text
┌──────────────────────┐
│ ← Checkout      🛒 2 │
├──────────────────────┤
│ 📍 Shipping Address  │
│                      │
│ Full Name            │
│ ┌──────────────────┐ │ ◄── full-width
│ │                  │ │
│ └──────────────────┘ │
│ Phone                │
│ ┌──────────────────┐ │
│ │                  │ │
│ └──────────────────┘ │
│ Address Line 1       │
│ ┌──────────────────┐ │
│ │                  │ │
│ └──────────────────┘ │
│ City                 │
│ ┌──────────────────┐ │ ◄── stacked vertical
│ │                  │ │     (NOT side-by-side)
│ └──────────────────┘ │
│ Postcode             │
│ ┌──────────────────┐ │
│ │  [Numpad opens]  │ │ ◄── inputmode="numeric"
│ └──────────────────┘ │
│ State                │
│ ┌──────────────────┐ │
│ │ Selangor       ▼ │ │
│ └──────────────────┘ │
│ ─────────────────── │
│ 🛒 Order Summary     │
│ Subtotal:    RM 50   │
│ Shipping:  RM 8.00   │
│ SST:       RM 3.00   │
│ Total:    RM 61.00   │
│                      │
│ ┌──────────────────┐ │
│ │   Place Order    │ │
│ └──────────────────┘ │
└──────────────────────┘
```

**Mobile-specific rules (US-F14-03):**
- All inputs stack vertical (NO side-by-side City + Postcode like desktop)
- Min input height: **44px** (Apple HIG tap target)
- Postcode field: `<Input inputmode="numeric" pattern="[0-9]*" maxlength={5}>` → triggers Numpad
- Switch tap target: 44x44px minimum hit area
- Save / Place Order: full-width primary button, sticky bottom on long forms

---

## 3. UI States Matrix

| Screen | Loading | Empty | Error | Success | Validation |
|--------|---------|-------|-------|---------|-----------|
| Settings | Skeleton card 3 rows | N/A (defaults always present) | Toast `Failed to save` + retry | Toast `Settings updated` + breadcrumb dot clear | Red border + helper `Rate must be 0 – RM 1,000` |
| Checkout shipping row | Inline spinner cạnh fee, debounced 300ms | Dash `— —` placeholder | Toast `Failed to calculate` + inline retry | Fee number / green FREE badge | Postcode red border + `5 digits required` |
| Mobile both | Same as desktop | Same as desktop | Same as desktop | Same as desktop | Same + larger error text (≥14px) |

---

## 4. Component Inventory

| Component | shadcn/ui | Usage |
|-----------|-----------|-------|
| Card group | `Card`, `CardHeader`, `CardContent`, `CardFooter` | Settings sections |
| Number input | `Input type="number"` + custom `RM` prefix span | Rate inputs |
| Toggle | `Switch` | Free shipping enable |
| Dropdown | `Select`, `SelectTrigger`, `SelectContent`, `SelectItem` | State picker |
| Action buttons | `Button` (variants: default, ghost) | Save, Reset, Place Order |
| Toast | `Toast` / `Sonner` | Settings save feedback |
| Badge | `Badge variant="success"` | FREE shipping label |
| Info hint | `Alert variant="default"` | "Add RM X more for FREE" |
| Skeleton | `Skeleton` | Loading state cards |
| Spinner | `Loader2` from lucide-react | Inline calc loading |

---

## 5. Design Tokens

Reference: [`docs/design/decorative-vocabulary.md`](./decorative-vocabulary.md)

| Token | Value | Used in |
|-------|-------|---------|
| Card padding (desktop) | 24px | Settings cards |
| Card padding (mobile) | 16px | Mobile settings |
| Input height (desktop) | 40px | All inputs |
| Input height (mobile) | 44px | All inputs (US-F14-03 AC-2) |
| Free badge color | `green-600` text on `green-50` bg | Checkout summary |
| Error border | `red-500` | Validation states |
| Debounce delay | 300ms | Live recalc shipping fee |

---

## 6. Responsive Breakpoints

| Breakpoint | Width | Behavior |
|-----------|-------|----------|
| Mobile | 375-639px | Vertical stack, full-width buttons, Numpad postcode, 44px tap targets |
| Tablet | 640-1023px | Hybrid: settings 1-col, checkout 2-col stacked |
| Desktop | ≥1024px | Settings 1-col centered (max-width 720px), checkout 2-col side-by-side |

---

## 7. Out of Scope (Wave 7+)

- ✅ ~~Carrier picker dropdown (J&T, Pos Laju, Ninja Van)~~ → **đã vào scope qua F36 EasyParcel** (1 courier/shop, §2.1b)
- ✅ ~~Tracking number input + tracking link in order detail~~ → **F36**: AWB tự đổ vào `trackingNumber` + tracking status (F10 drawer)
- ❌ Estimated delivery days field (per-region days)
- ❌ Per-product shipping override (ShippingDimensionsSection trong product form sẽ scoped riêng cho carrier integration)
- ❌ Multi-seller free shipping isolation UI

---

## 8. Decisions Log (Resolved Open Questions)

> Chốt 2026-05-12 theo PM direction.

### 8.1. Reset to Defaults — `freeAbove` behavior

**Quyết định:** KHÔNG clear về `null`. Reset trả về **giá trị mặc định hệ thống**.

**Lý do:** `null` / empty có thể bị logic tính toán hiểu nhầm là "không bao giờ free" hoặc throw lỗi khi compare số. Default an toàn tránh edge case.

**Hành vi cụ thể:**
- Khi user nhấn **Reset to Defaults**, các field rollback:
  - `westRate` → `800` (RM 8.00)
  - `eastRate` → `1500` (RM 15.00)
  - `freeAbove` → `10000` (RM 100.00) — standard sàn (không phải `null`)
  - Free shipping toggle → ON
- Input fields hiển thị **ngay** con số mặc định sau Reset → user thấy mức đang áp dụng
- Save button auto-enable (dirty state) để user confirm

**Spec test:**
```gherkin
GIVEN seller đang chỉnh westRate = 2000, freeAbove = null (toggle off)
WHEN  click "Reset to Defaults"
THEN  westRate input shows "8.00", eastRate "15.00", freeAbove "100.00"
  AND free shipping toggle = ON
  AND Save button enabled (dirty)
```

---

### 8.2. Postcode Validation — Regex vs State mapping

**Quyết định:** **Wave 6 chỉ dùng regex `^\d{5}$`**. State-based postcode validation defer Wave 7+.

**Lý do:**
- **Regex (fast-track):** Đảm bảo đúng format bưu điện Malaysia (5 chữ số). Code đơn giản, ít edge case, không cần DB postcode mapping.
- **State-based check (complex):** Cần bản đồ postcode chính xác 100% (e.g. Sabah 88xxx-91xxx, Sarawak 93xxx-98xxx). Nếu DB lệch → buyer kẹt checkout → BLOCKER nghiêm trọng.
- **Dung hòa:** Phí ship tính dựa trên **State dropdown** (đã enum 16 states, không thể sai). Postcode chỉ phục vụ shipping label — validate format đủ.

**Hành vi cụ thể:**
- Client-side: `<Input pattern="\d{5}" maxLength={5} inputMode="numeric">`
- On blur: nếu không match `^\d{5}$` → red border + helper "Postcode must be 5 digits"
- Place Order disable khi postcode không valid
- KHÔNG cross-check postcode với state (Wave 7+ feature)

**Spec test:**
```gherkin
GIVEN buyer nhập postcode "ABC12"
WHEN  blur khỏi input
THEN  hiển thị error "Postcode must be 5 digits"
  AND Place Order button disabled

GIVEN buyer nhập postcode "88000" + state "Selangor" (logic lệch West/East)
WHEN  blur khỏi input
THEN  KHÔNG báo lỗi (Wave 6 không cross-check postcode-state)
```

---

### 8.3. "Add RM X more for FREE" hint — Display logic

**Quyết định:** **Luôn hiển thị khi `subtotal < threshold`**. Style thay đổi theo gap distance để upsell hiệu quả.

**Lý do:** Đây là upsell trigger. Hide khi gap > RM 50 = mất cơ hội nhắc đơn lớn (e.g. subtotal RM 140 / threshold RM 200 → vẫn nên nhắc thêm RM 60).

**Hành vi cụ thể (3 tier):**

| Gap (threshold - subtotal) | Style | Vị trí | Copy |
|----------|-------|--------|------|
| `> RM 50` | Neutral text (gray-600), icon 💡 | Dưới Shipping row trong Summary | "💡 Add RM {gap} more for FREE shipping" |
| `≤ RM 50` (gần đạt) | Highlight (green-700 bold), icon 🚚 | Sát Place Order button + Summary | "🚚 Just RM {gap} more for FREE shipping!" |
| `subtotal >= threshold` | Hide hint hoàn toàn | — | Replaced by `<Badge>FREE SHIPPING APPLIED</Badge>` ở Shipping row |

**Wireframe update (Screen B):**

```text
Gap > 50 (subtotal RM 50, threshold RM 200):
│ Shipping (West):  RM 8.00 │
│ 💡 Add RM 150 more for    │ ◄── gray neutral
│    FREE shipping          │

Gap ≤ 50 (subtotal RM 160, threshold RM 200):
│ Shipping (West):  RM 8.00 │
│ 🚚 Just RM 40 more for    │ ◄── green highlight, bold
│    FREE shipping!         │
│ [ Place Order ]  ←────── repeat hint cạnh CTA

Subtotal >= threshold (RM 220):
│ Shipping:  🎉 FREE SHIPPING APPLIED │ ◄── badge replaces hint
```

**Spec test:**
```gherkin
GIVEN threshold RM 200, subtotal RM 50
WHEN  buyer view checkout
THEN  hint "💡 Add RM 150 more for FREE shipping" hiển thị (neutral)
  AND chỉ xuất hiện 1 lần (dưới Shipping row)

GIVEN threshold RM 200, subtotal RM 170
WHEN  buyer view checkout
THEN  hint "🚚 Just RM 30 more for FREE shipping!" hiển thị (highlight)
  AND xuất hiện 2 vị trí: dưới Shipping row + cạnh Place Order

GIVEN threshold RM 200, subtotal RM 220
WHEN  buyer view checkout
THEN  hint hidden, replaced by Badge "🎉 FREE SHIPPING APPLIED"
```

---

> **Note Phase 03:** Các decision §8.1–8.3 cần phản ánh trong:
> - US-F14-04 (validate boundaries) — thêm AC reset behavior §8.1
> - US-F14-02 (seller settings) — clarify default values §8.1
> - PRD §7 FR-05 — update "Add RM X more" với 3-tier logic §8.3
> - PRD §7 thêm FR-11: Postcode format validate `^\d{5}$` §8.2
