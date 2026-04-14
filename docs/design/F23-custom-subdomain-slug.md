# UI Design Specs: Custom Subdomain Slug (F23)

> **Version:** 1.0 | **Date:** 2026-04-09 | **Author:** Documentation Engineer
> **PRD Ref:** `docs/prd/F23-custom-subdomain-slug.md`
> **Dependencies:** F06 Onboarding (`/onboarding`), F19 Store Config (`/settings/domains`)
> **Status:** Draft — pending Dev review

---

## 1. Screen List

| # | Screen Name | Route | Mô tả | US Ref |
|---|-------------|-------|-------|--------|
| S1 | AI Builder — Slug Picker | `/builder/new` | SlugPicker inline sau BusinessInfoForm, trước khi submit | US-F23-01, US-F23-03 |
| S2 | Template Apply — Slug Picker | `/templates` (modal apply) | SlugPicker inline trong apply-template flow | US-F23-01, US-F23-03 |
| S3 | Settings Domains — Slug Section | `/settings/domains` | Section "Platform Subdomain" mới, phía trên custom domains | US-F23-04 |
| S3a | Settings Domains — Edit Mode | `/settings/domains` | Inline edit slug, hiện input + availability check | US-F23-04 |
| S4 | Slug Change Confirmation Dialog | `/settings/domains` (modal) | Modal confirm khi user save slug mới trong Settings | US-F23-04 |

---

## 2. Screen Flows

```
ONBOARDING / BUILDER FLOW
─────────────────────────

/onboarding
    │
    ├─► [Build with AI] ──► /builder/new
    │                            │
    │                     BusinessInfoForm
    │                      (business name input)
    │                            │
    │                     [name onChange]
    │                            │
    │                     auto-slugify()
    │                            │
    │                     SlugPicker component (S1)
    │                      ├─ state: checking
    │                      ├─ state: available  ──► [Generate My Site] enabled
    │                      ├─ state: unavailable ──► show suggestion
    │                      └─ state: invalid    ──► inline error
    │                            │
    │                     user confirms slug
    │                            │
    │                     POST /api/ai/generate-site
    │                      { businessName, slug, ... }
    │
    └─► [Choose Template] ──► /templates
                                   │
                            [Apply Template] modal
                                   │
                             SlugPicker component (S2)
                             (same states as S1)
                                   │
                            POST /api/ai/apply-template


SETTINGS FLOW
─────────────

/settings/domains
    │
    [Platform Subdomain section] (S3 — read-only by default)
    │
    user click [Thay đổi subdomain]
    │
    [S3a — Edit Mode]: input + check availability
    │
    user click [Lưu]
    │
    [S4 — Confirmation Dialog]
    │
    ├─ [Hủy] ──► back to S3a (edit mode)
    └─ [Xác nhận] ──► PATCH /api/tenant/slug
                           │
                      success ──► toast "Subdomain đã được cập nhật"
                                  S3 reload với slug mới
                      error   ──► toast error, S3a ở nguyên
```

---

## 3. Component Specifications

### 3.1 SlugPicker Component

**File:** `src/components/onboarding/SlugPicker.tsx`

**Vị trí trong builder flow:** Render inline bên dưới `BusinessInfoForm`, ngay sau khi `businessName` được nhập. Không phải step riêng — là phần của cùng form.

**Vị trí trong template flow:** Render bên trong apply-template modal, sau bước chọn template.

#### Props Interface

```typescript
interface SlugPickerProps {
  /** Slug value được control từ bên ngoài */
  value: string
  /** Callback khi slug thay đổi */
  onChange: (slug: string) => void
  /** Platform domain để hiển thị preview URL */
  platformDomain: string
  /** Disable toàn bộ component (khi form đang submit) */
  disabled?: boolean
  /** Callback báo trạng thái validity cho parent form */
  onValidityChange?: (isValid: boolean) => void
  /** Tên class thêm vào wrapper */
  className?: string
}

/** State nội bộ của SlugPicker */
type SlugCheckStatus =
  | 'idle'        // chưa check (slug chưa nhập)
  | 'checking'    // đang gọi API (debounce đang chờ hoặc đang fetch)
  | 'available'   // API trả về { available: true }
  | 'unavailable' // API trả về { available: false, suggestion }
  | 'invalid'     // format sai (FR-04), chưa gọi API
  | 'reserved'    // API trả về 409 reserved (FR-05)
  | 'error'       // network/server error
```

#### Cấu trúc sub-components

```
SlugPicker
├── SlugInputRow          — input + badge trạng thái
│   ├── <input>           — h-[44px], font-mono, border đổi màu theo state
│   └── StatusBadge       — "Available" / "Taken" / spinner / "Reserved"
├── PreviewURL            — text bên dưới: "your-slug.platform.domain"
├── SuggestionLink        — chỉ hiện khi unavailable
└── HelperText            — error message khi invalid format
```

#### Debounce: 400ms sau mỗi keystroke (FR-06)

#### Data: `GET /api/slug/check?slug={slug}`

---

#### STATE: idle (Chưa nhập / Business Name trống)

```
┌─────────────────────────────────────────────────────────┐
│ Your Store URL                                          │
│                                                         │
│ ┌────────────────────────────────────────────────────┐  │
│ │  your-store-name                                   │  │
│ └────────────────────────────────────────────────────┘  │
│   ↳ Được tự động tạo từ tên doanh nghiệp               │
│                                                         │
│   Preview: ──────────────────────────────────           │
│   your-store-name.web-v2.dev.ecommercehub.my            │
└─────────────────────────────────────────────────────────┘
```

CSS input (idle):
```
h-[44px] px-[16px] rounded-[12px]
border border-white/[0.08]
bg-[#1E293B]/40
font-mono text-[14px] text-[rgba(248,250,252,0.4)]
placeholder: "your-store-name"
```

---

#### STATE: checking (Đang kiểm tra)

```
┌─────────────────────────────────────────────────────────┐
│ Your Store URL                                          │
│                                                         │
│ ┌─────────────────────────────┐  ┌──────────────────┐  │
│ │  rimba-adventure-tours      │  │ ⟳  Checking...   │  │
│ └─────────────────────────────┘  └──────────────────┘  │
│                                                         │
│   Preview:                                              │
│   rimba-adventure-tours.web-v2.dev.ecommercehub.my      │
└─────────────────────────────────────────────────────────┘
```

CSS badge (checking):
```
h-[26px] px-[12px] rounded-full
border border-white/[0.15] bg-white/[0.05]
text-[12px] font-medium text-[rgba(248,250,252,0.5)]
flex items-center gap-[6px]
```

Icon spinner: `Loader2` lucide, `animate-spin`, `h-[14px] w-[14px]`

---

#### STATE: available (Slug khả dụng) — AC-07

```
┌─────────────────────────────────────────────────────────┐
│ Your Store URL                                          │
│                                                         │
│ ┌─────────────────────────────┐  ┌──────────────────┐  │
│ │  rimba-adventure-tours      │  │ ✓  Available     │  │
│ └─────────────────────────────┘  └──────────────────┘  │
│                                                         │
│   Preview:                                              │
│   rimba-adventure-tours.web-v2.dev.ecommercehub.my      │
└─────────────────────────────────────────────────────────┘
```

CSS input (available):
```
border border-[#00C950]/40
```

CSS badge (available):
```
h-[26px] px-[12px] rounded-full
border border-[#00C950]/30 bg-[#00C950]/10
text-[12px] font-semibold text-[#B9F8CF]
```

Icon: `Check` lucide, `h-[14px] w-[14px] text-[#05DF72]`

---

#### STATE: unavailable (Slug đã bị dùng) — AC-07, AC-04

```
┌─────────────────────────────────────────────────────────┐
│ Your Store URL                                          │
│                                                         │
│ ┌─────────────────────────────┐  ┌──────────────────┐  │
│ │  rimba-tours                │  │ ✕  Taken         │  │
│ └─────────────────────────────┘  └──────────────────┘  │
│                                                         │
│   Slug này đã được sử dụng.                            │
│   Dùng gợi ý: rimba-tours-7k3  →                       │
│                                                         │
│   Preview:                                              │
│   rimba-tours.web-v2.dev.ecommercehub.my                │
└─────────────────────────────────────────────────────────┘
```

CSS input (unavailable):
```
border border-[rgba(251,44,54,0.4)]
```

CSS badge (unavailable):
```
h-[26px] px-[12px] rounded-full
border border-[rgba(251,44,54,0.3)] bg-[rgba(251,44,54,0.1)]
text-[12px] font-semibold text-[#FFC9C9]
```

Icon: `X` lucide, `h-[14px] w-[14px] text-[#FF6467]`

CSS suggestion link:
```
text-[12px] text-[#22D3EE] underline-offset-2 hover:underline cursor-pointer
```

Khi user click suggestion → slug input được fill với suggestion, trigger check lại.

---

#### STATE: invalid (Format sai) — AC-06

```
┌─────────────────────────────────────────────────────────┐
│ Your Store URL                                          │
│                                                         │
│ ┌─────────────────────────────┐                        │
│ │  -invalid slug!             │                        │
│ └─────────────────────────────┘                        │
│   ! Chỉ được dùng chữ thường, số và dấu gạch ngang.   │
│     Tối thiểu 3 ký tự, không bắt đầu/kết thúc bằng -  │
│                                                         │
│   Preview:                                              │
│   -invalid-slug-.web-v2.dev.ecommercehub.my             │
└─────────────────────────────────────────────────────────┘
```

CSS input (invalid):
```
border border-[rgba(251,44,54,0.5)]
```

CSS helper text (invalid):
```
text-[12px] text-[#FF6467] mt-[6px]
flex items-start gap-[6px]
```

Icon: `AlertCircle` lucide, `h-[14px] w-[14px] shrink-0 mt-[1px]`

Không gọi API khi format invalid — validate client-side trước (FR-04).

---

#### STATE: reserved (Slug bị chặn) — AC-05

```
┌─────────────────────────────────────────────────────────┐
│ Your Store URL                                          │
│                                                         │
│ ┌─────────────────────────────┐  ┌──────────────────┐  │
│ │  admin                      │  │ ✕  Taken         │  │
│ └─────────────────────────────┘  └──────────────────┘  │
│                                                         │
│   ! Slug này bị giữ lại và không thể sử dụng.         │
│                                                         │
│   Preview:                                              │
│   admin.web-v2.dev.ecommercehub.my                      │
└─────────────────────────────────────────────────────────┘
```

Badge CSS giống state `unavailable`. Helper text khác:
```
"Slug này bị giữ lại và không thể sử dụng."
```

---

#### STATE: error (API thất bại)

```
┌─────────────────────────────────────────────────────────┐
│ Your Store URL                                          │
│                                                         │
│ ┌─────────────────────────────┐                        │
│ │  rimba-tours                │                        │
│ └─────────────────────────────┘                        │
│                                                         │
│   ! Không thể kiểm tra slug. Vui lòng thử lại.        │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

Input: border `border-orange-500/40`

Behavior: nút Submit của form bị disable khi ở trạng thái `error` (không thể proceed với slug chưa verify).

---

#### Preview URL sub-component

```
URL of your store:
rimba-adventure-tours.web-v2.dev.ecommercehub.my
```

CSS:
```
mt-[8px]
text-[11px] font-medium text-[rgba(248,250,252,0.4)] uppercase tracking-wider
— label
text-[13px] font-mono text-[rgba(248,250,252,0.6)]
— value (slug phần + domain phần màu khác)
```

Slug portion: `text-[#F8FAFC]` (trắng, nổi bật)
Domain suffix: `text-[rgba(248,250,252,0.4)]` (mờ)

```
rimba-adventure-tours  .web-v2.dev.ecommercehub.my
───────────────────── ─────────────────────────────
text-[#F8FAFC]         text-[rgba(248,250,252,0.4)]
```

---

#### Submit button behavior

Nút "Generate My Site" / "Apply Template" của parent form:
- `disabled` khi SlugPicker ở state: `checking`, `unavailable`, `invalid`, `reserved`, `error`
- `enabled` chỉ khi state: `available`
- Prop callback: `onValidityChange(isValid: boolean)` truyền lên parent

---

### 3.2 Settings Slug Section

**File cần sửa:** `src/app/(dashboard)/settings/domains/DomainsClient.tsx`

**Vị trí:** Thêm section mới TRÊN platform subdomain card hiện tại (line 279), trong `space-y-[16px]` wrapper.

**Refs FR-08, FR-09, AC-09**

---

#### STATE: read-only (Mặc định) — AC-09

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  Platform Subdomain                                             │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  ┌──────────────────────────────────────────┐  ┌────────────┐  │
│  │  rimba-tours.web-v2.dev.ecommercehub.my  │  │  Thay đổi  │  │
│  └──────────────────────────────────────────┘  └────────────┘  │
│                                                                 │
│  URL subdomain của bạn trên PrimeWeb.                          │
│  Thay đổi sẽ tạo redirect 30 ngày từ subdomain cũ.            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

CSS wrapper:
```
py-[25px] px-[25px] rounded-[16px]
border border-white/[0.08] bg-[#1E293B]/60
```

CSS section label:
```
text-[12px] font-semibold text-[rgba(248,250,252,0.4)]
uppercase tracking-wider mb-[12px]
```

CSS URL display:
```
flex-1 h-[44px] flex items-center px-[16px] rounded-[12px]
border border-white/[0.08] bg-[#0B1120]/50
font-mono text-[14px] text-[#F8FAFC] truncate
```

CSS "Thay đổi" button:
```
h-[44px] px-[16px] rounded-[12px]
border border-white/[0.08] bg-transparent
text-[14px] font-medium text-[#F8FAFC]
hover:bg-white/[0.05] transition-colors
font-['Inter'] whitespace-nowrap shrink-0
```

CSS description text:
```
mt-[8px] text-[12px] text-[rgba(248,250,252,0.4)] font-['Inter']
```

---

#### STATE: editing (Đang chỉnh sửa) — AC-09

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  Platform Subdomain                                             │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  Subdomain mới:                                                 │
│  ┌────────────────────────────────────────┐                     │
│  │  rimba-tours                           │  ✓  Available      │
│  └────────────────────────────────────────┘                     │
│                                                                 │
│  Preview: rimba-tours.web-v2.dev.ecommercehub.my               │
│                                                                 │
│  ┌──────────────────────┐  ┌────────────────────────────────┐  │
│  │       Hủy            │  │         Lưu subdomain          │  │
│  └──────────────────────┘  └────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

CSS input edit slug (giống SlugPicker, đồng nhất design system):
```
w-full h-[44px] px-[16px] rounded-[12px]
border border-white/[0.08] bg-[#1E293B]/40
font-mono text-[14px] text-[#F8FAFC]
focus:outline-none focus:border-blue-500/40 transition-colors
```

Badge check status: dùng chung logic với SlugPicker (available/unavailable/checking)

CSS "Hủy" button:
```
flex-1 h-[48px] rounded-[16px]
border border-white/[0.08] bg-transparent
text-[14px] font-medium text-[#F8FAFC]
hover:bg-white/[0.05] transition-colors font-['Inter']
```

CSS "Lưu subdomain" button:
```
flex-1 h-[48px] rounded-[16px]
background: linear-gradient(90deg, #3B82F6 0%, #2DD4BF 100%)
text-[14px] font-semibold text-white
hover:opacity-90 transition-opacity
disabled:opacity-50 font-['Inter']
```

Disabled khi: slug chưa thay đổi so với slug gốc, hoặc status không phải `available`.

---

#### STATE: saving (Đang lưu)

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  Platform Subdomain                                             │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  ┌────────────────────────────────────────┐                     │
│  │  rimba-adventure                       │  ✓  Available      │
│  └────────────────────────────────────────┘                     │
│                                                                 │
│  ┌──────────────────────┐  ┌────────────────────────────────┐  │
│  │       Hủy            │  │  ⟳  Đang lưu...               │  │
│  └──────────────────────┘  └────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

"Lưu subdomain" button khi saving: disabled + `Loader2` spinner + text "Đang lưu..."

---

#### STATE: success (Sau khi lưu thành công)

Transition về read-only, hiển thị slug mới. Toast xuất hiện:

```
[sonner toast — bottom-right]
┌─────────────────────────────────────────────┐
│  ✓  Subdomain đã được cập nhật thành công!  │
│     rimba-adventure.web-v2.dev...            │
└─────────────────────────────────────────────┘
```

Toast CSS (sonner): `toast.success('Subdomain đã được cập nhật thành công!')`

---

### 3.3 Slug Change Confirmation Dialog

**Trigger:** User click "Lưu subdomain" trong Settings edit mode khi slug hợp lệ và available.

**Refs FR-09, AC-09, AC-10**

```
┌──────────────────────────────────────────────────────────┐
│                                                          │
│   ⚠  Xác nhận thay đổi subdomain                        │
│                                                          │
│  ─────────────────────────────────────────────────────   │
│                                                          │
│  Bạn đang đổi subdomain từ                              │
│                                                          │
│  rimba-tours  →  rimba-adventure                         │
│  ─────────────   ────────────────                        │
│  (slug cũ)       (slug mới)                              │
│                                                          │
│  ─────────────────────────────────────────────────────   │
│                                                          │
│  ⚠  Lưu ý quan trọng:                                   │
│                                                          │
│  • Subdomain cũ "rimba-tours" sẽ tự động redirect       │
│    sang subdomain mới trong 30 ngày.                     │
│  • Sau 30 ngày, link cũ sẽ không còn hoạt động.         │
│  • Hãy cập nhật tất cả marketing materials của bạn.     │
│                                                          │
│  ─────────────────────────────────────────────────────   │
│                                                          │
│  ┌───────────────┐     ┌───────────────────────────┐    │
│  │     Hủy       │     │     Xác nhận đổi slug      │    │
│  └───────────────┘     └───────────────────────────┘    │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

CSS modal container:
```
fixed inset-0 z-[100] flex items-center justify-center
bg-[#0B1120]/80 p-4
animate-in fade-in duration-200
```

CSS modal card:
```
flex flex-col w-[448px] max-w-full p-[25px] rounded-[16px]
bg-[#1E293B] border border-white/[0.08]
shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)]
animate-in zoom-in-95 duration-200
```

CSS title:
```
text-[20px] font-semibold text-[#F8FAFC]
leading-[1.4em] font-['Inter'] mb-[4px]
```

Icon title: `AlertTriangle` lucide, `h-5 w-5 text-orange-400 shrink-0`

CSS slug comparison row:
```
flex items-center gap-[8px] my-[16px] py-[12px] px-[16px]
rounded-[12px] bg-[#0B1120]/50 border border-white/[0.06]
```

CSS old slug badge:
```
font-mono text-[14px] font-semibold text-[#F8FAFC]
line-through opacity-60
```

CSS arrow icon: `ArrowRight` lucide, `h-4 w-4 text-[rgba(248,250,252,0.4)] shrink-0`

CSS new slug badge:
```
font-mono text-[14px] font-semibold text-[#22D3EE]
```

CSS warning box:
```
flex flex-col gap-[8px] p-[16px] rounded-[12px]
border border-orange-500/30 bg-orange-500/10
```

CSS warning bullet:
```
text-[13px] text-orange-300 font-['Inter'] leading-[1.5em]
```

CSS separator:
```
border-t border-white/[0.06] my-[20px]
```

CSS button row:
```
flex items-center gap-[12px] mt-[4px]
```

CSS "Hủy" button (modal):
```
flex-1 h-[50px] rounded-[16px]
border border-white/[0.08] bg-transparent
text-[#F8FAFC] text-[16px] font-medium
hover:bg-white/5 transition-colors font-['Inter']
```

CSS "Xác nhận đổi slug" button:
```
flex-1 h-[50px] rounded-[16px]
background: linear-gradient(90deg, #3B82F6 0%, #2DD4BF 100%)
text-white text-[16px] font-semibold
hover:opacity-90 transition-opacity
shadow-[0px_4px_6px_-4px_rgba(0,0,0,0.1),0px_10px_15px_-3px_rgba(0,0,0,0.1)]
font-['Inter'] disabled:opacity-50
```

Khi đang loading sau confirm: button disabled + `Loader2` spinner.

---

## 4. Responsive Breakpoints

### 4.1 SlugPicker Component (S1, S2)

| Breakpoint | Width | Layout |
|------------|-------|--------|
| Mobile | 375px | Input full-width. Badge hiện phía trên bên phải của input (absolute positioned) hoặc bên dưới input trên row riêng |
| Tablet | 768px | Input + badge inline cùng row, badge shrink-0 |
| Desktop | 1024px+ | Input + badge inline, preview URL full |

**Mobile 375px — SlugPicker:**

```
┌───────────────────────────────────────────┐
│  Your Store URL                           │
│                                           │
│  ┌────────────────────────────────────┐   │
│  │  rimba-adventure-tours             │   │
│  └────────────────────────────────────┘   │
│  ┌──────────────┐                         │
│  │ ✓ Available  │                         │
│  └──────────────┘                         │
│                                           │
│  rimba-adventure-tours                    │
│  .web-v2.dev.ecommercehub.my              │
└───────────────────────────────────────────┘
```

CSS mobile override: badge dùng `flex-wrap` trên row, không overflow clip.

### 4.2 Settings Slug Section (S3, S3a)

| Breakpoint | Width | Layout |
|------------|-------|--------|
| Mobile | 375px | URL display + button stack vertical (flex-col). Edit mode: input full-width, buttons full-width stack |
| Tablet | 768px | URL display + button inline (sm:flex-row) |
| Desktop | 1024px+ | URL display flex-1, button shrink-0, side by side |

**Mobile 375px — Settings read-only:**

```
┌──────────────────────────────────────────┐
│  Platform Subdomain                      │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │  rimba-tours.web-v2.dev...         │  │
│  └────────────────────────────────────┘  │
│  ┌────────────────────────────────────┐  │
│  │         Thay đổi subdomain         │  │
│  └────────────────────────────────────┘  │
└──────────────────────────────────────────┘
```

**Mobile 375px — Settings edit mode:**

```
┌──────────────────────────────────────────┐
│  Platform Subdomain                      │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │  rimba-tours                       │  │
│  └────────────────────────────────────┘  │
│  ┌──────────────┐                        │
│  │ ✓ Available  │                        │
│  └──────────────┘                        │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │              Hủy                   │  │
│  └────────────────────────────────────┘  │
│  ┌────────────────────────────────────┐  │
│  │         Lưu subdomain              │  │
│  └────────────────────────────────────┘  │
└──────────────────────────────────────────┘
```

### 4.3 Confirmation Dialog (S4)

| Breakpoint | Width | Layout |
|------------|-------|--------|
| Mobile | 375px | `max-w-full` với padding 16px. Buttons: flex-col (Hủy trên, Confirm dưới) |
| Desktop | 1024px+ | `w-[448px]` fixed width. Buttons: flex-row |

---

## 5. Interaction States

### 5.1 SlugPicker Input

| Trạng thái | Border | Background | Text |
|-----------|--------|------------|------|
| Default/Idle | `border-white/[0.08]` | `bg-[#1E293B]/40` | `text-[rgba(248,250,252,0.4)]` |
| Focus | `border-blue-500/40` | `bg-[#1E293B]/40` | `text-[#F8FAFC]` |
| Checking | `border-white/[0.08]` | `bg-[#1E293B]/40` | `text-[#F8FAFC]` |
| Available | `border-[#00C950]/40` | `bg-[#00C950]/5` | `text-[#F8FAFC]` |
| Unavailable | `border-[rgba(251,44,54,0.4)]` | `bg-[rgba(251,44,54,0.05)]` | `text-[#F8FAFC]` |
| Invalid | `border-[rgba(251,44,54,0.5)]` | `bg-[rgba(251,44,54,0.05)]` | `text-[#F8FAFC]` |
| Disabled | `border-white/[0.04]` | `bg-[#1E293B]/20` | `text-[rgba(248,250,252,0.3)]` |

**Focus ring:** `outline-none` + border color change (không dùng ring mặc định của Tailwind để giữ nhất quán với DomainsClient).

### 5.2 Buttons

| Button | Default | Hover | Disabled | Loading |
|--------|---------|-------|----------|---------|
| Primary gradient | `opacity-100` | `opacity-90` | `opacity-50` | `opacity-50` + spinner |
| Secondary (Cancel) | `bg-transparent` | `bg-white/[0.05]` | `opacity-50` | — |
| "Thay đổi" | `bg-transparent` | `bg-white/[0.05]` | `opacity-50` | — |

### 5.3 Suggestion Link

| Trạng thái | Style |
|-----------|-------|
| Default | `text-[#22D3EE]` không underline |
| Hover | `underline` |
| Active | `opacity-70` |

### 5.4 Animations / Transitions

| Element | Animation | Duration |
|---------|-----------|----------|
| Badge status (fade in/out) | `animate-in fade-in` | `150ms` |
| Modal open | `animate-in zoom-in-95 fade-in` | `200ms` |
| Settings slide-in panel | `animate-in slide-in-from-right` | `300ms` |
| Edit mode expand | CSS `transition-all` trên parent div | `200ms` |
| Input border color | `transition-colors` | `150ms` |
| Badge border/bg color | `transition-all` | `150ms` |
| Toast (sonner) | Managed by sonner library | auto |

---

## 6. Design Tokens

### 6.1 Colors

| Token | Value | Dùng trong |
|-------|-------|-----------|
| `--bg-main` | `#0F172A` | Page background |
| `--bg-deep` | `#0B1120` | Modal backdrop, input bg |
| `--bg-card` | `#1E293B` | Card, modal body |
| `--text-primary` | `#F8FAFC` | Heading, input text |
| `--text-muted` | `rgba(248,250,252,0.6)` | Descriptions, labels |
| `--text-faint` | `rgba(248,250,252,0.4)` | Placeholder, section label |
| `--border-subtle` | `rgba(255,255,255,0.08)` | Card border, input border default |
| `--success-border` | `rgba(0,201,80,0.3)` | Available badge border |
| `--success-bg` | `rgba(0,201,80,0.1)` | Available badge bg |
| `--success-icon` | `#05DF72` | Check icon |
| `--success-text` | `#B9F8CF` | "Available" text |
| `--error-border` | `rgba(251,44,54,0.3)` | Taken/Invalid badge border |
| `--error-bg` | `rgba(251,44,54,0.1)` | Taken/Invalid badge bg |
| `--error-icon` | `#FF6467` | X icon, error text |
| `--error-text` | `#FFC9C9` | "Taken" badge text |
| `--warning-border` | `rgba(249,115,22,0.3)` | Warning box border |
| `--warning-bg` | `rgba(249,115,22,0.1)` | Warning box bg |
| `--warning-text` | `rgb(253,186,116)` | Warning bullet text (orange-300) |
| `--accent-blue` | `#3B82F6` | Gradient start, focus border |
| `--accent-cyan` | `#2DD4BF` | Gradient end |
| `--accent-cyan-bright` | `#22D3EE` | Suggestion link, slug new text |
| `--gradient-primary` | `linear-gradient(90deg, #3B82F6 0%, #2DD4BF 100%)` | Primary buttons |

### 6.2 Spacing

| Token | Value | Dùng trong |
|-------|-------|-----------|
| `--card-pad-x` | `25px` | Card horizontal padding |
| `--card-pad-y` | `25px` | Card vertical padding |
| `--input-h` | `44px` | Input height |
| `--button-h-md` | `48px` | Button height medium |
| `--button-h-lg` | `50px` | Button height large (modal) |
| `--badge-h` | `26px` | Status badge height |
| `--gap-section` | `28px` | Section spacing |
| `--gap-card` | `16px` | Card list spacing |
| `--gap-inline` | `12px` | Inline element gap |

### 6.3 Typography

| Element | Size | Weight | Family |
|---------|------|--------|--------|
| Section label | `12px` | `600` | Inter |
| Input text | `14px` | `400` | Inter (monospace cho slug input: `font-mono`) |
| Badge text | `12px` | `600` | Inter |
| Helper/description | `12px` | `400` | Inter |
| Preview URL — slug | `13px` | `400` | Monospace |
| Button text (md) | `14px` | `600` | Inter |
| Button text (lg) | `16px` | `600` | Inter |
| Modal title | `20px` | `600` | Inter |
| Card title | `18px` | `600` | Inter |
| Warning bullet | `13px` | `400` | Inter |

### 6.4 Border Radius

| Element | Value |
|---------|-------|
| Card | `16px` |
| Input | `12px` |
| Button large | `16px` |
| Button medium | `12px` |
| Badge (pill) | `9999px` (rounded-full) |
| Badge (chip) | `12px` |

### 6.5 Shadows

| Element | Value |
|---------|-------|
| Modal card | `0px 25px 50px -12px rgba(0,0,0,0.25)` |
| Primary button | `0px 4px 6px -4px rgba(0,0,0,0.1), 0px 10px 15px -3px rgba(0,0,0,0.1)` |

---

## 7. Accessibility

### 7.1 ARIA Labels

| Element | ARIA attribute | Value |
|---------|---------------|-------|
| SlugPicker input | `aria-label` | `"Your store URL"` |
| SlugPicker input | `aria-describedby` | `"slug-helper-text"` (ID của helper text div) |
| SlugPicker input | `aria-invalid` | `"true"` khi state là `invalid`, `unavailable`, `reserved` |
| Status badge | `role` | `"status"` |
| Status badge | `aria-live` | `"polite"` (announce khi badge thay đổi) |
| Suggestion link | `aria-label` | `"Dùng slug gợi ý: {suggestion}"` |
| Modal dialog | `role` | `"dialog"` |
| Modal dialog | `aria-modal` | `"true"` |
| Modal dialog | `aria-labelledby` | ID của tiêu đề dialog |
| Confirmation dialog title | `id` | `"slug-confirm-title"` |
| Spinner icon | `aria-hidden` | `"true"` |
| Spinner wrapper | `aria-label` | `"Đang kiểm tra..."` |
| "Thay đổi" button | `aria-label` | `"Thay đổi subdomain"` |
| "Lưu" button | `aria-label` | `"Lưu subdomain mới"` |

### 7.2 Keyboard Navigation

| Action | Key |
|--------|-----|
| Focus vào SlugPicker input | `Tab` |
| Submit form (khi slug valid) | `Enter` trong input |
| Đóng modal dialog | `Escape` |
| Focus Hủy button trong modal | `Shift+Tab` từ Confirm button |
| Click suggestion link | `Enter` hoặc `Space` khi focused |

**Focus trap:** Modal dialog (S4) phải trap focus. Khi modal open, focus move đến button "Hủy". Tab cycle chỉ trong modal.

### 7.3 Screen Reader

- Badge status dùng `aria-live="polite"` — screen reader đọc khi trạng thái thay đổi ("Available", "Taken", "Đang kiểm tra")
- Helper text gắn `id` khớp với `aria-describedby` của input
- Preview URL có `aria-label="URL preview của store"` trên wrapper

### 7.4 Color Contrast

| Text | Background | Contrast ratio | Status |
|------|------------|----------------|--------|
| `#B9F8CF` (success text) | `rgba(0,201,80,0.1)` | ≥ 4.5:1 | Pass AA |
| `#FFC9C9` (error text) | `rgba(251,44,54,0.1)` | ≥ 4.5:1 | Pass AA |
| `#F8FAFC` (input text) | `#1E293B` | > 7:1 | Pass AAA |
| `rgba(248,250,252,0.4)` (placeholder) | `#1E293B` | ~ 2.5:1 | Note: placeholder exempt per WCAG |
| `orange-300` (warning) | `rgba(249,115,22,0.1)` | ≥ 4.5:1 | Pass AA |

### 7.5 Focus Indicators

Tất cả interactive elements phải có focus indicator rõ ràng:
- Input: border color thay đổi sang `border-blue-500/40` — đủ visible
- Buttons: `focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1E293B]`
- Suggestion link: `focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#22D3EE]`

---

## 8. AC-to-UI Mapping

| AC-ID | Mô tả | Component | UI Element |
|-------|-------|-----------|------------|
| AC-01 | Slugify chuẩn output | SlugPicker | Input auto-populate khi business name thay đổi |
| AC-02 | Collision + random suffix | SlugPicker | State `unavailable` hiện suggestion đã có suffix |
| AC-03 | API available → HTTP 200 | SlugPicker | State `available` — badge "Available" màu xanh |
| AC-04 | API unavailable → suggestion | SlugPicker | State `unavailable` — badge "Taken" + suggestion link cyan |
| AC-05 | Reserved words → reject | SlugPicker | State `reserved` — badge "Taken" + helper "bị giữ lại" |
| AC-06 | Format invalid → 422 | SlugPicker | State `invalid` — border đỏ + helper text mô tả rule |
| AC-07 | Real-time feedback + debounce | SlugPicker | Badge đổi state sau 400ms, spinner khi checking |
| AC-08 | Slug lưu khi generate site | SlugPicker + Parent form | Nút Generate disabled khi slug chưa valid |
| AC-09 | Settings hiển thị + edit flow | S3 + S3a | Read-only card → Click "Thay đổi" → edit mode inline |
| AC-10 | previousSlugs được lưu | S4 Dialog | Warning text "30 ngày redirect" trong confirmation dialog |
| AC-11 | 301 redirect | Middleware (không có UI) | Confirmation dialog đề cập redirect |
| AC-12 | Expired slug → 404 | Middleware (không có UI) | Confirmation dialog: "sau 30 ngày link cũ không còn hoạt động" |
| AC-13 | Tenant cũ giữ slug | S3 read-only | Hiển thị slug cũ `store-7`, có nút Thay đổi thủ công |

---

## 9. Edge Cases & Error Handling

| Scenario | UI Behavior |
|----------|-------------|
| Business name để trống trong Builder | SlugPicker state `idle`, nút Generate disabled |
| Business name chỉ có ký tự đặc biệt (vd: "!!@#") | Sau slugify → slug rỗng → state `invalid`, helper: "Tên doanh nghiệp không thể chuyển thành slug hợp lệ" |
| Slug dài quá 63 ký tự | `slugify()` tự cắt ở 63 ký tự, input `maxLength={63}` |
| Network timeout khi check API | State `error`, helper text + nút retry nhỏ |
| User thay đổi business name sau khi slug đã available | Re-trigger auto-slugify + check mới |
| User submit trong khi debounce đang đếm | Button disabled cho đến khi check xong |
| Slug trong Settings giống slug hiện tại | Nút "Lưu subdomain" disabled (không có thay đổi) |
| PATCH API trả về 409 (slug bị lấy giữa lúc check và lúc lưu) | Toast error "Slug này vừa được đăng ký, vui lòng chọn slug khác" + reopen edit mode |
| Session expired khi PATCH | Toast error "Phiên đăng nhập hết hạn" + redirect `/login` |

---

## 10. Implementation Notes (dành cho Dev)

1. **SlugPicker** là uncontrolled-friendly — parent cung cấp `value` + `onChange`, internal state chỉ là `status` + `suggestion`.

2. **Debounce** implement bằng `useEffect` + `useRef` cho timeout ID:
   ```typescript
   const debounceRef = useRef<ReturnType<typeof setTimeout>>()
   useEffect(() => {
     clearTimeout(debounceRef.current)
     debounceRef.current = setTimeout(() => checkSlug(value), 400)
     return () => clearTimeout(debounceRef.current)
   }, [value])
   ```

3. **DomainsClient.tsx** thêm state:
   ```typescript
   const [isEditingSlug, setIsEditingSlug] = useState(false)
   const [slugDraft, setSlugDraft] = useState(tenantSlug)
   const [showSlugConfirm, setShowSlugConfirm] = useState(false)
   const [slugStatus, setSlugStatus] = useState<SlugCheckStatus>('idle')
   ```

4. **Prop mới cho DomainsClient:**
   ```typescript
   // Thêm vào props interface
   tenantSlug: string  // đã có
   // không cần prop mới — slug editor đọc tenantSlug từ props
   ```

5. **Tích hợp SlugPicker vào BusinessInfoForm:** Mount SlugPicker khi `businessName.length >= 2`. Truyền `value={slugDraft}` và `onChange={setSlugDraft}` lên store `builderStore`.

6. **Submit form (generate-site):** Thêm `slug: slugDraft` vào request body. Server side validate lại trước khi save (defense in depth với FR-12 beforeChange hook).

7. **Import lucide icons cần thêm** cho SlugPicker: `AlertTriangle`, `ArrowRight` (dialog). Các icon khác (`Check`, `X`, `AlertCircle`, `Loader2`) đã có trong DomainsClient.

---

*Tổng kết: 4 screens, 3 components chính, 6 states của SlugPicker, 4 states của Settings Slug Section, 13 AC được map đầy đủ.*
