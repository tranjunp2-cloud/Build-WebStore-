# F14 Shipping — Design & Wireframe Report

> **Epic:** Storefront Commerce & Seller Settings
> **Feature Code:** F14
> **Links:**
> - PRD: [`docs/prd/F14-shipping.md`](../prd/F14-shipping.md)
> - Stories: [`docs/stories/F14-shipping-stories.md`](../stories/F14-shipping-stories.md)
> - Architecture: [`docs/architecture/F14-shipping.md`](../architecture/F14-shipping.md)
> - Approved Shipping Settings prototype: [`docs/design/shipping-redesign.html`](./shipping-redesign.html)
> - Delivery issue: [GitHub #1698](https://github.com/primeproduction/ech-prime-web-v2/issues/1698)
> - Related: F09 Storefront Commerce, F18 CMS Global Layout, F19 Store Configuration

Tài liệu này cung cấp wireframe và UI spec cho Shipping Malaysia gồm Flat Rate, EasyParcel và global Free Shipping rule. Settings UI tuân thủ **F18 CMS Global Layout** (Sidebar + Topbar). Checkout UI thuộc Storefront F09 (không có Sidebar Admin).

---

## 1. Feature Summary

Shipping có ba surface chính:

- **Shipping Settings (CMS Dashboard):** một trang phẳng gồm `Shipping Providers` và `Global Shipping Rules`. EasyParcel nằm trên Flat Rate; không còn tab hay setup stepper.
- **Checkout Shipping (Storefront):** ưu tiên EasyParcel Live Rates khi integration đã bật và sẵn sàng; nếu chưa sẵn sàng, bị tắt hoặc live-rate lỗi thì dùng Flat Rate. Free Shipping Threshold áp dụng cho cả hai provider.
- **Mobile Optimization (375px):** card, form và action stack dọc; input/action có hit area tối thiểu 44px.

> **Superseded:** mô hình hai tab **Flat Rate / EasyParcel**, wizard nhiều bước, form API/Auth key, edit/re-test credentials và courier picker trong Settings không còn thuộc thiết kế hiện hành. Kết nối dùng OAuth qua **Setup Connection**; courier được chọn tự động ở rate flow, không cấu hình tại màn này.

### Design Principles

- **Một trang, một mental model:** provider và global rule nhìn thấy trong cùng luồng cuộn.
- **Progressive disclosure:** chỉ hiện pickup management sau khi account được link; chỉ hiện wallet và Disconnect khi cấu hình sẵn sàng.
- **Safe fallback:** Flat Rate luôn có cấu hình khả dụng khi EasyParcel không hoạt động.
- **Derived readiness:** không lưu một cờ `isReady` độc lập; suy ra từ trạng thái link và địa chỉ lấy hàng mặc định hợp lệ.
- **Mobile-first:** control 44px, text không tràn, action chuyển full-width khi hẹp.

---

## 2. Wireframes & UI Layouts

### 2.1. Screen A — Unified Shipping Settings <a id="screen-a-shipping-settings"></a>

**Path:** `Dashboard > Settings > Shipping` (`/settings/shipping` trong dashboard shell).

**Nguồn thiết kế hiện hành:** [`docs/design/shipping-redesign.html`](./shipping-redesign.html). Prototype và Issue #1698 supersede các hi-fi/tab/stepper cũ cho Screen A.

```text
Shipping
Configure delivery methods, rates, and free shipping rules.

Shipping Providers
┌────────────────────────────────────────────────────┐
│ EasyParcel Integration                   [OFF ▢]   │
│ [disconnected / partial / ready content]           │
└────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────┐
│ Flat Rate (Regional)                [Live Rates]   │
│ Used as your primary shipping rate at checkout.   │
│ West Malaysia [RM 8.00]  East Malaysia [RM 15.00]│
│ Live Preview                                       │
└────────────────────────────────────────────────────┘

Global Shipping Rules
┌────────────────────────────────────────────────────┐
│ Free Shipping Threshold                    [ON ▣]  │
│ Minimum subtotal for free shipping [RM 100.00]    │
└────────────────────────────────────────────────────┘
```

#### 2.1.1 Layout and provider order

- `Shipping Providers` không có tab, section description trùng lặp hoặc stepper.
- `EasyParcel Integration` render trước `Flat Rate (Regional)` với khoảng cách card rõ ràng.
- `Free Shipping Threshold` nằm ngoài provider cards trong `Global Shipping Rules`; rule này áp dụng cho Flat Rate và EasyParcel.
- Flat Rate giữ West/East inputs, state chips và `LivePreviewPanel`.
- Footer Flat Rate chỉ xuất hiện khi rate/free-shipping state dirty; EasyParcel có save action riêng trong card khi pickup/toggle dirty.

#### 2.1.2 EasyParcel derived state

Thiết kế phân biệt “đã xác thực account” và “đã sẵn sàng quote”:

```ts
const isLinked = Boolean(accountId || authToken)
const isReady =
  isLinked &&
  addresses.some(
    (address) => address.isDefault && isValidPickupAddress(address),
  )
```

Một pickup hợp lệ cần `label | name`, Malaysian phone dùng được, `address1`, `state`, `city` và `postcode`; readiness phải có ít nhất một pickup hợp lệ. Token/account identifier vẫn là dữ liệu server-side; client chỉ nhận metadata không bí mật để render.

| Derived state | Điều kiện | Live Rates toggle | Nội dung chính |
|---|---|---|---|
| Disconnected | `isLinked = false` | Ẩn | Card nhẹ hơn, badge `OFF`/`DISCONNECTED`, 4 benefit tiles, **Setup Connection** |
| Partial | `isLinked = true`, `isReady = false` | OFF + disabled | Warning yêu cầu pickup, Import/Add và inline form; chưa có account/wallet/Disconnect |
| Ready + enabled | `isReady = true`, `enabled = true` | ON | Active copy, address list, account, wallet, Top up, Disconnect |
| Ready + disabled | `isReady = true`, `enabled = false` | OFF nhưng enabled control | Warning copy; checkout và Flat Rate chuyển sang primary |

#### 2.1.3 Disconnected

```text
┌ EasyParcel Integration                    [OFF] ┐
│ Each store uses its own EasyParcel account.    │
│ [Live courier rates] [No platform markup]      │
│ [One-click AWB labels] [Flat-rate safety net]  │
│ [🔌 Setup Connection]                           │
│ While EasyParcel is off, checkout uses Flat    │
│ Rate shipping.                                 │
└────────────────────────────────────────────────┘
```

- **Setup Connection** điều hướng đến `/api/tenant/{tenantId}/easyparcel-oauth-start`.
- Chưa hiển thị toggle, pickup addresses, account row, wallet, Top up hoặc Disconnect.
- Không thu API Key/Auth Key trong UI.

#### 2.1.4 Linked but incomplete (partial)

- Card mở rộng inline ngay tại Shipping Providers.
- Toggle hiển thị OFF và disabled.
- Warning copy chính xác: `Account linked successfully! Please add a pickup address to enable EasyParcel Live Rates.`
- Hiển thị **Import addresses from EasyParcel** và **Add address**; khi chưa có address, form Add mở inline mặc định.
- **Add address** disabled trong lúc form Add/Edit đang mở.
- Warning thay thế account row; không hiển thị account identity, wallet, Top up hoặc Disconnect trước khi `isReady`.
- Import gọi sync flow hiện có; nếu đã có local warehouse thì yêu cầu xác nhận trước khi thay thế.

#### 2.1.5 Ready, disabled and enabled

Khi lần đầu thêm/import được default pickup hợp lệ, UI tính lại `isReady`, enable toggle và tự bật `enabled` trong draft. Merchant vẫn phải lưu EasyParcel settings để state checkout thay đổi.

| EasyParcel toggle | EasyParcel description | Flat Rate status | Flat Rate description |
|---|---|---|---|
| ON | `Live courier rates and pickup address management.` | `Backup Rate` | `Used as a safety net if live courier rates are unavailable.` |
| OFF | `⚠️ Currently disabled. Checkout is using your Flat Rate shipping.` | `Live Rates` | `Used as your primary shipping rate at checkout.` |

Ready state hiển thị:

- Một wallet frame chứa `EasyParcel account: {accountName}`, `Wallet balance: {currency} {balance}` và link **Top up**.
- Wallet banner tải balance động; implementation có thể bổ sung ước lượng số label còn lại khi có cheapest rate và cảnh báo thấp dưới MYR 10.
- Link ngoài **Top up** mở `https://app.easyparcel.com`.
- **Disconnect** destructive nằm cùng row với wallet nhưng ngoài wallet banner.
- Pickup list giữ Default badge, action Edit/Delete bằng icon và Add/Import.
- Xóa pickup cuối khi EasyParcel active dùng confirmation copy rằng lưu thay đổi sẽ tắt EasyParcel và trả checkout về Flat Rate.

#### 2.1.6 Inline pickup-address form

| Field | Control / copy | Validation and dependency |
|---|---|---|
| Label | Input; `e.g. HQ Warehouse` | Required |
| Sender phone | Numeric/tel input; `e.g. 0123456789` | Required Malaysian phone; normalize thành `60...` khi lưu |
| Address line 1 | Input | Required |
| State | Select | Required; options từ `/api/geo/states` |
| City | Select | Disabled trước khi có State; options từ `/api/geo/districts?stateId=...` |
| Postcode | Select | Disabled trước khi có City; options từ `/api/geo/postcodes?districtId=...`; phải là 5 chữ số |
| Set as default pickup address | Checkbox | Quy tắc default bên dưới |

Phone validation chấp nhận format số Malaysia hợp lệ, loại ký tự/độ dài không dùng được và chuẩn hóa trước khi gửi. Form chỉ commit khi toàn bộ field bắt buộc hợp lệ; lỗi hiển thị inline.

**Default-address rules:**

1. Address đầu tiên tự chọn Default và checkbox disabled.
2. Address thứ hai trở đi mở với checkbox enabled, mặc định không chọn.
3. Chọn address mới làm Default phải gỡ Default khỏi address cũ; list luôn được normalize để có đúng một Default.
4. Khi edit Default và cố bỏ chọn, không bỏ Default; hiển thị popup English:
   - Title: `Cannot remove the default pickup address`
   - Body: `To remove this address, please select another address as the new default first.`
   - Button: `Got it`
5. Xóa address dùng confirmation modal; nếu xóa address cuối đang active, copy phải nói rõ EasyParcel sẽ tắt sau Save.

#### 2.1.7 Disconnect modal

- Title: `Remove EasyParcel connection?`
- Body: `Your store will switch back to the Flat Rate setup. You can reconnect EasyParcel anytime. Your saved addresses won't be deleted.`
- Actions: **Cancel** và destructive **Disconnect** với unlink icon.
- Confirm gọi disconnect, reload trạng thái về Disconnected và checkout dùng Flat Rate.
- Disconnect chỉ xóa liên kết/account authorization; các pickup addresses đã lưu được giữ lại để tái kết nối.

#### User Flow — EasyParcel onboarding and management

```text
1. Open Shipping
   → EasyParcel disconnected card + Setup Connection
   → Flat Rate = Live Rates / primary

2. Setup Connection
   → OAuth provider flow
   → return with ep=connected notification
   → server-side account/token metadata confirms isLinked

3. Linked, no valid default pickup
   → partial warning
   → toggle OFF + disabled
   → Add inline or Import from EasyParcel

4. Save/import valid default pickup
   → isReady = true
   → warning hides; toggle becomes enabled and draft turns ON
   → account + wallet + Top up + Disconnect appear

5. Save EasyParcel settings
   → checkout uses live rates
   → Flat Rate becomes Backup Rate

6a. Toggle OFF + Save
    → addresses/account remain; checkout uses Flat Rate

6b. Disconnect + confirm
    → authorization removed; saved addresses preserved
    → disconnected card; checkout uses Flat Rate
```

#### 2.1.8 Superseded design

The following must not be reintroduced without a new approved design:

- Flat Rate/EasyParcel tabs and `ShippingTab`.
- `EpSetupStepper`, separate Connect/Pickup/Review screens or forward/back wizard navigation.
- API Key/Auth Key password fields, environment selector, edit-credentials or re-test gate.
- Manual single/multi-courier selection, courier price cards or default courier.
- Default parcel dimensions/weight and fulfillment-mode controls on Shipping Settings.

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
│ ☰  Shipping          │ ◄── Mobile header (drawer nav)
├──────────────────────┤
│ Shipping Providers   │
│ ┌──────────────────┐ │
│ │ EasyParcel  [OFF]│ │
│ │ benefits / setup │ │
│ │ [Setup Connection]││
│ └──────────────────┘ │
│                      │
│ ┌──────────────────┐ │
│ │ Flat Rate        │ │
│ │     [Live Rates] │ │
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
│ │ Live Preview     │ │
│ └──────────────────┘ │
│                      │
│ Global Shipping Rules│
│ ┌──────────────────┐ │
│ │ Free Shipping [●]│ │ ◄── 44px tap target
│ │ Threshold        │ │
│ │ [RM 100.00]      │ │
│ └──────────────────┘ │
│                      │
│ [Reset]       [Save] │ ◄── fixed dirty-state bar
└──────────────────────┘
```

Khi EasyParcel đã link, pickup form stack theo thứ tự Label → Phone → Address lines → State → City → Postcode → Default. Import/Add, Save/Cancel, wallet/Top up và Disconnect chuyển full-width hoặc stack dọc; không tạo horizontal overflow.

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
- Pickup edit/delete icon buttons: 44x44px
- Settings dirty footer remains fixed above viewport edge; form has bottom padding so footer không che field
- Save / Place Order: full-width primary button on narrow layouts

---

## 3. UI States Matrix

| Screen | State | UI / transition |
|---|---|---|
| EasyParcel | Disconnected | `OFF`/`DISCONNECTED`, benefits + Setup Connection; management controls hidden |
| EasyParcel | Partial | Linked warning; toggle OFF/disabled; inline pickup controls; wallet/Disconnect hidden |
| EasyParcel | Ready + ON | Active copy; account, wallet, Top up, Disconnect and pickup list; Flat Rate = Backup Rate |
| EasyParcel | Ready + OFF | Disabled warning; saved addresses remain; Flat Rate = Live Rates |
| EasyParcel | Sync/test/save | Disable conflicting actions; spinner/toast; network/API errors use localized error feedback |
| Pickup form | Invalid | Required/phone/postcode errors inline; no commit |
| Pickup form | Editing | Add disabled; save controls inside inline form; changing default normalizes list |
| Flat Rate / global rule | Dirty | Fixed Reset/Save footer; save success toast; validation errors inline |
| Checkout shipping row | Empty/loading | Dash placeholder hoặc inline spinner cạnh fee |
| Checkout shipping row | Success/error | Fee number/green FREE badge; lỗi dùng toast + inline retry |
| Checkout form | Validation | Postcode red border + `5 digits required` |
| Mobile | Same business states | Cards/forms/actions stack; 44px controls; no horizontal overflow |

---

## 4. Component Inventory

| Production component / primitive | Responsibility |
|---|---|
| `ShippingSettingsClient` | Page composition; EasyParcel → Flat Rate order; global Free Shipping section; propagates saved EP enabled state |
| `EasyParcelSettingsTab` | Despite legacy filename, renders the inline provider card (not a tab); OAuth, derived state, toggle, sync/save/disconnect |
| `PickupAddresses` | Address list, inline Add/Edit form, default selection, delete confirmations, geo cascade |
| `EpWalletBanner` | Fetch/display wallet, low-balance/label estimate and external Top up |
| `ShippingRatesCard` | `Flat Rate (Regional)`, West/East inputs, state chips, dynamic status/copy and Live Preview |
| `FreeShippingCard` | Global Free Shipping toggle and threshold |
| `SettingsFooter` | Fixed dirty-state Reset/Save bar for Flat Rate/global rule changes |
| `Switch` | EasyParcel enable and Free Shipping enable |
| `Select` | Pickup State → City → Postcode and checkout state |
| `Input` / native input | Rate, threshold and pickup text/phone fields |
| `Button` | Setup, Add/Import, form actions, save, disconnect |
| `ConfirmModal` | Disconnect, sync-replace and pickup deletion confirmations |
| Sonner toast / `Loader2` | Async success, failure and loading feedback |

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
| Mobile | 375-639px | Provider cards stay in one column; benefit tiles, pickup fields, wallet/account and actions stack; full-width actions; 44px targets |
| Tablet | 640-1023px | Benefits 2 columns; pickup Label/Phone 2 columns and geo fields 3 columns when space permits; cards remain vertically ordered |
| Desktop | ≥1024px | Unified settings column in dashboard content; EasyParcel above Flat Rate; global rule below; checkout remains 2 columns |

---

## 7. Acceptance & Design Notes

| Acceptance area | Design verification |
|---|---|
| Unified layout | No Tabs/stepper; EasyParcel precedes Flat Rate; Free Shipping is a separate global section |
| Disconnected onboarding | Setup Connection + four benefits only; no account/address/wallet/toggle/Disconnect controls |
| Linked vs ready | `isLinked` and valid default pickup independently determine partial vs ready state |
| Inline address | Add/Edit remains inside EasyParcel card; Add disabled while editor is open |
| Readiness transition | First valid default pickup enables and drafts toggle ON; wallet/account actions appear only when ready |
| Geo + validation | State gates City, City gates Postcode; required fields, 5-digit postcode and Malaysian phone gate commit |
| Default address | Exactly one default; first forced default; changing default clears the former; English protection popup prevents unsetting the only default |
| Dynamic provider copy | EasyParcel ON ↔ Flat Rate Backup Rate; EasyParcel OFF ↔ Flat Rate Live Rates |
| Disconnect | Destructive confirmation; fallback to Flat Rate; stored pickup addresses preserved |
| Responsive | One-column provider order, stacked form/actions and minimum 44px interactive targets on mobile |

**Implementation note:** `EasyParcelSettingsTab` is retained as a filename/export for compatibility but no longer represents a visual tab. `ep-setup-stepper.tsx` and `shipping-tab.ts` are superseded and must have no runtime/documentation dependency.

**Persistence note:** Flat Rate/global rule changes and EasyParcel changes have separate save paths. Automatic toggle-on after the first valid pickup is draft behavior until the EasyParcel save succeeds.

---

## 8. Out of Scope (Wave 7+)

- ❌ Provider tabs or setup wizard
- ❌ API/Auth key entry or credential editing in Settings (OAuth owns authorization)
- ❌ Manual courier picker or courier allowlist in Settings (quote flow selects automatically)
- ❌ Default parcel dimensions/weight and fulfillment-mode controls in Settings
- ✅ ~~Tracking number input + tracking link in order detail~~ → **F36**: AWB tự đổ vào `trackingNumber` + tracking status (F10 drawer)
- ❌ Estimated delivery days field (per-region days)
- ❌ Per-product shipping override (ShippingDimensionsSection trong product form sẽ scoped riêng cho carrier integration)
- ❌ Multi-seller free shipping isolation UI

---

## 9. Decisions Log (Resolved Open Questions)

> Chốt 2026-05-12 theo PM direction.

### 9.1. Reset to Defaults — `freeAbove` behavior

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

### 9.2. Checkout Postcode Validation — Regex vs State mapping

**Phạm vi:** quyết định này chỉ áp dụng cho postcode trong **checkout shipping address**. Pickup address trong EasyParcel Settings sử dụng State → City → Postcode geo cascade như §2.1.6.

**Quyết định:** Checkout Wave 6 chỉ dùng regex `^\d{5}$`. State-based postcode validation tại checkout defer Wave 7+.

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

### 9.3. "Add RM X more for FREE" hint — Display logic

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

> **Note Phase 03:** Các decision §9.1–9.3 cần phản ánh trong:
> - US-F14-04 (validate boundaries) — thêm AC reset behavior §9.1
> - US-F14-02 (seller settings) — clarify default values §9.1
> - PRD §7 FR-05 — update "Add RM X more" với 3-tier logic §9.3
> - PRD §7 thêm FR-11: Postcode format validate `^\d{5}$` §9.2
