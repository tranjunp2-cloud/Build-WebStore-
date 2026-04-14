# PRD: Custom Subdomain Slug (F23)
> **Version:** 1.0 | **Updated:** 2026-04-09 | **Priority:** P2
> **Sprint:** Wave 2 | **Size:** M (8h) | **Agent:** `documentation-engineer`
> **Depends on:** F06 Onboarding, F19 Store Config | **Blocks:** —

---

> [!IMPORTANT]
> **Stories-First Rule:** PRD này được xây dựng từ plan đã validate ngày 2026-04-09.
> Mọi FR phải có Story Ref. AC được derive từ plan decisions. Không tự mở rộng scope.

---

## 0. Story Traceability

| Story ID    | Title                                     | Phase | Status  |
|-------------|-------------------------------------------|-------|---------|
| US-F23-01   | Smart slug generation from business name  | 1     | Pending |
| US-F23-02   | Slug availability check API               | 2     | Pending |
| US-F23-03   | Onboarding slug picker UI                 | 3     | Pending |
| US-F23-04   | Settings page slug editor                 | 4     | Pending |
| US-F23-05   | Reserved words + validation               | 5     | Pending |

---

## 1. Problem Statement

**Current state:** Mọi tenant mới được gán slug tự động theo format `store-{user.id}`, ví dụ `store-7.web-v2.dev.ecommercehub.my`. Format này:

- **Thiếu tính nhận diện thương hiệu:** URL dạng `store-7` không thể dùng trong marketing materials, business cards, hay quảng cáo — làm giảm tỉ lệ conversion khi khách hàng nhận được link từ seller.
- **Gây mất tin cậy:** Khách hàng thấy `store-7` thay vì tên thương hiệu (ví dụ `rimba-tours`) → nghi ngờ tính chuyên nghiệp, tỉ lệ bounce rate cao hơn.
- **Khoảng cách cạnh tranh:** Shopify, Wix đều cho phép chọn subdomain ngay khi tạo store. PrimeWeb chưa có tính năng này → mất điểm khi so sánh sản phẩm.

**Evidence trong code:**
```typescript
// src/app/api/ai/generate-site/route.ts:115
const fallbackSlug = `store-${user.id}` // Không brandable
```

---

## 2. Target User

- **Persona chính:** SME owner mới đăng ký — không am hiểu kỹ thuật, muốn URL phản ánh thương hiệu của mình ngay từ đầu.
- **Persona phụ:** Tenant cũ (`store-{id}`) muốn nâng cấp subdomain lên tên thương hiệu thông qua Settings.

---

## 3. Solution Overview

Thay thế cơ chế `store-{user.id}` bằng flow slug 3 bước:

1. **Auto-generate** slug từ business name khi user nhập (ví dụ: "Rimba Adventure Tours" → `rimba-adventure-tours`)
2. **Slug picker** trong flow AI Builder/Template: user thấy slug được generate, có thể chỉnh sửa, check availability real-time
3. **Settings editor** cho tenant cũ: thay đổi slug với 301 redirect grace period 30 ngày từ slug cũ

**Ví dụ kết quả:** `mybakery.web-v2.dev.ecommercehub.my` thay vì `store-7.web-v2.dev.ecommercehub.my`

---

## 4. Scope

### In Scope
- Smart slug generation từ business name (slugify + uniqueness check)
- API `GET /api/slug/check?slug=` — kiểm tra availability
- Slug picker UI trong flow tạo site (sau bước nhập business name)
- Settings slug editor với confirmation dialog và 301 redirect
- `previousSlugs` array field trong Tenants collection + DB migration
- `beforeChange` hook validate slug format trước khi save
- Reserved words blocklist (admin, api, www, dashboard...)
- Collision handling: auto-append random suffix (ví dụ `rimba-tours-7k3`)
- Giữ nguyên `store-{id}` cho tenant cũ — KHÔNG migrate tự động

### Out of Scope
- Custom domain (`mybakery.com`) — đã có trong F19 Store Config
- Slug migration tự động cho toàn bộ tenant cũ
- Multi-language slug generation (chỉ Latin/ASCII)
- Paid/premium subdomain features
- Slug analytics (click tracking, etc.)
- Email/notification khi slug thay đổi

---

## 5. User Stories

### US-F23-01: Smart Slug Generation
```
AS A   user vừa nhập tên doanh nghiệp "Rimba Adventure Tours" vào AI Builder
I WANT hệ thống tự generate slug gợi ý là "rimba-adventure-tours"
SO THAT tôi không phải tự nghĩ URL, tiết kiệm thời gian và có URL phù hợp ngay lập tức
```

### US-F23-03: Onboarding Slug Picker
```
AS A   user đang tạo website lần đầu
I WANT xem slug được gợi ý, kiểm tra availability, và chỉnh sửa nếu muốn
SO THAT tôi kiểm soát được URL của store trước khi site được generate
```

### US-F23-04: Settings Slug Editor
```
AS A   tenant cũ với slug "store-7" hoặc tenant muốn đổi subdomain
I WANT có thể thay đổi subdomain trong trang Settings > Domains
SO THAT khách hàng cũ vẫn được redirect đúng (không bị 404) trong khi tôi cập nhật tất cả marketing materials
```

---

## 6. Architecture

### 6.1 Tổng quan luồng

```
┌─────────────────────────────────────────────────────────────────┐
│                         ONBOARDING FLOW                         │
│                                                                 │
│  [Enter Business Name] → [Auto-generate slug]                   │
│         │                        │                              │
│         │               "rimba-adventure-tours"                 │
│         │                        │                              │
│         ▼                        ▼                              │
│  [SlugPicker UI] ←── GET /api/slug/check?slug=... ─────────────►│
│         │                    { available: true/false }          │
│         │                                                       │
│         ▼                                                       │
│  [User confirms slug] → POST /api/ai/generate-site              │
│         │               { slug: "rimba-adventure-tours" }       │
│         ▼                                                       │
│  tenant.slug = "rimba-adventure-tours"                          │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                         SETTINGS FLOW                           │
│                                                                 │
│  Settings > Domains                                             │
│  Current: rimba-tours.web-v2.dev.ecommercehub.my               │
│         │                                                       │
│         ▼                                                       │
│  [Change subdomain] → [Edit slug] → [Check availability]       │
│         │                                                       │
│         ▼                                                       │
│  [Confirm dialog] → PATCH /api/tenant/slug                      │
│         │                                                       │
│         ├── tenant.slug = "new-slug"                            │
│         └── tenant.previousSlugs[] += "old-slug" + expires_at  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                      MIDDLEWARE ROUTING                         │
│                                                                 │
│  Request: old-slug.web-v2.dev.ecommercehub.my                   │
│         │                                                       │
│         ▼                                                       │
│  isSubdomain = true → tenantSlug = "old-slug"                   │
│         │                                                       │
│         ▼                                                       │
│  DB check: slug in previousSlugs? + expired?                    │
│         │                                                       │
│  YES ───► 301 → new-slug.web-v2.dev.ecommercehub.my             │
│  NO  ───► 404 (slug not found)                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 Files cần tạo mới

| File | Mục đích |
|------|----------|
| `src/lib/utils/slugify.ts` | Slug generation + uniqueness check |
| `src/lib/utils/reserved-slugs.ts` | Blocklist reserved words |
| `src/app/api/slug/check/route.ts` | Availability check API |
| `src/app/api/tenant/slug/route.ts` | Slug update API (auth required) |
| `src/components/onboarding/SlugPicker.tsx` | Slug picker component |

### 6.3 Files cần sửa

| File | Thay đổi |
|------|---------|
| `src/app/api/ai/generate-site/route.ts` | Line 115: dùng `smartSlug()` thay `store-${user.id}` |
| `src/app/api/ai/apply-template/route.ts` | Line 56: tương tự |
| `src/collections/Tenants.ts` | Thêm `previousSlugs` array field + `beforeChange` hook |
| `src/middleware.ts` | Thêm 301 redirect cho previousSlugs |
| `src/app/(dashboard)/settings/domains/DomainsClient.tsx` | Thêm slug editor section |
| `scripts/db-setup.js` | Thêm migration cho `tenants_previous_slugs` table |

---

## 7. Functional Requirements

| FR-ID | Requirement | Story Ref | Priority | Notes |
|-------|-------------|-----------|----------|-------|
| FR-01 | Hàm `slugify(name)` convert tên doanh nghiệp thành slug lowercase, chỉ `[a-z0-9-]`, loại bỏ ký tự đặc biệt | US-F23-01 | P0 | "Rimba Tour's!" → "rimba-tours" |
| FR-02 | Khi slug sau slugify bị trùng, auto-append suffix ngẫu nhiên 3 ký tự alphanumeric | US-F23-01 | P0 | "rimba-tours" → "rimba-tours-7k3" |
| FR-03 | API `GET /api/slug/check?slug={slug}` trả về `{ available: boolean, suggestion?: string }` trong <200ms | US-F23-02 | P0 | Không cần auth |
| FR-04 | API validate slug: chỉ chấp nhận `[a-z0-9-]`, 3–63 ký tự, không bắt đầu/kết thúc bằng `-` | US-F23-02 | P0 | HTTP 422 nếu invalid format |
| FR-05 | API từ chối slug nằm trong reserved words blocklist (admin, api, www, app, dashboard, login, register, help, static, assets, health, status, billing, support) | US-F23-05 | P0 | HTTP 409 với message cụ thể |
| FR-06 | SlugPicker component hiển thị slug gợi ý, input chỉnh sửa, trạng thái available/unavailable real-time (debounce 400ms) | US-F23-03 | P0 | Inline trong builder/template flow |
| FR-07 | Khi user submit generate-site/apply-template với slug hợp lệ, slug được lưu vào `tenant.slug` | US-F23-03 | P0 | Thay thế `store-${user.id}` |
| FR-08 | Settings > Domains hiển thị subdomain hiện tại (`{slug}.{PLATFORM_DOMAIN}`) kèm nút "Change subdomain" | US-F23-04 | P1 | Read-only display by default |
| FR-09 | Settings slug editor yêu cầu confirmation dialog trước khi save (hiển thị cảnh báo về grace period 30 ngày) | US-F23-04 | P1 | Không thể undo ngay sau confirm |
| FR-10 | Khi slug thay đổi trong Settings, slug cũ được lưu vào `previousSlugs[]` với `expiresAt = now + 30 days` | US-F23-04 | P1 | beforeChange hook tự động |
| FR-11 | Middleware detect request tới slug trong `previousSlugs` chưa expired → 301 redirect sang slug mới | US-F23-04 | P1 | Extend logic custom domain redirect |
| FR-12 | `beforeChange` hook trong Tenants collection validate slug format trước khi lưu vào DB | US-F23-05 | P0 | Reject nếu reserved hoặc invalid format |

---

## 8. Acceptance Criteria

### AC-01: Slugify chuẩn
> Source: US-F23-01 — FR-01

```gherkin
GIVEN business name là "Rimba Adventure Tours & Co."
WHEN  hàm slugify() được gọi
THEN  output là "rimba-adventure-tours-co"
  AND chỉ chứa ký tự [a-z0-9-]
  AND không có ký tự đặc biệt hoặc khoảng trắng
  AND không bắt đầu hoặc kết thúc bằng "-"
```

### AC-02: Collision handling với random suffix
> Source: US-F23-01 — FR-02

```gherkin
GIVEN slug "rimba-tours" đã tồn tại trong DB
WHEN  user mới nhập business name generate ra slug "rimba-tours"
THEN  hệ thống tự động generate slug mới dạng "rimba-tours-{3chars}"
  AND suffix là alphanumeric ngẫu nhiên (ví dụ "7k3", "a9x")
  AND slug mới phải unique trong DB trước khi trả về
```

### AC-03: Availability check API — available
> Source: US-F23-02 — FR-03

```gherkin
GIVEN slug "mybakery" chưa có trong DB và không phải reserved word
WHEN  GET /api/slug/check?slug=mybakery
THEN  HTTP 200
  AND response body: { "available": true }
  AND response time < 200ms
```

### AC-04: Availability check API — unavailable
> Source: US-F23-02 — FR-03, FR-02

```gherkin
GIVEN slug "rimba-tours" đã tồn tại trong DB
WHEN  GET /api/slug/check?slug=rimba-tours
THEN  HTTP 200
  AND response body: { "available": false, "suggestion": "rimba-tours-{suffix}" }
```

### AC-05: Từ chối reserved words
> Source: US-F23-05 — FR-05

```gherkin
GIVEN slug "admin" nằm trong reserved words blocklist
WHEN  GET /api/slug/check?slug=admin
THEN  HTTP 409
  AND response body: { "available": false, "reason": "reserved" }
```

### AC-06: Validate format slug
> Source: US-F23-02 — FR-04

```gherkin
GIVEN slug "-invalid-" (bắt đầu bằng "-")
  OR  slug "MY STORE" (chứa chữ hoa/khoảng trắng)
  OR  slug "ab" (ít hơn 3 ký tự)
WHEN  GET /api/slug/check?slug={slug_trên}
THEN  HTTP 422
  AND response body chứa message mô tả lỗi format cụ thể
```

### AC-07: SlugPicker real-time feedback
> Source: US-F23-03 — FR-06

```gherkin
GIVEN user đang ở bước nhập business name trong AI Builder flow
WHEN  user nhập business name "My Bakery"
THEN  SlugPicker tự động populate slug gợi ý "my-bakery"
  AND hiển thị badge "Available" màu xanh nếu slug chưa tồn tại
  AND sau khi user edit slug input, debounce 400ms rồi gọi check API
  AND nếu unavailable, hiển thị badge "Taken" màu đỏ kèm gợi ý slug khác
```

### AC-08: Slug được lưu khi generate site
> Source: US-F23-03 — FR-07

```gherkin
GIVEN user đã chọn/confirm slug "my-bakery" trong SlugPicker
WHEN  user submit "Generate My Site"
THEN  tenant được tạo với slug = "my-bakery"
  AND KHÔNG sử dụng format "store-{user.id}"
  AND subdomain site truy cập được tại my-bakery.{PLATFORM_DOMAIN}
```

### AC-09: Settings hiển thị subdomain và slug editor
> Source: US-F23-04 — FR-08, FR-09

```gherkin
GIVEN user đang ở Settings > Domains
WHEN  trang load
THEN  hiển thị subdomain hiện tại: "{slug}.{PLATFORM_DOMAIN}" (read-only)
  AND có nút "Change subdomain"
WHEN  user click "Change subdomain"
THEN  hiển thị input edit slug + nút Save
  AND khi user click Save, hiển thị confirmation dialog với nội dung:
      "Slug cũ sẽ redirect sang slug mới trong 30 ngày"
```

### AC-10: previousSlugs được lưu sau khi đổi slug
> Source: US-F23-04 — FR-10

```gherkin
GIVEN tenant có slug hiện tại là "rimba-tours"
WHEN  user đổi slug thành "rimba-adventure" và confirm
THEN  tenant.slug = "rimba-adventure"
  AND tenant.previousSlugs[] có entry { slug: "rimba-tours", expiresAt: now+30days }
  AND truy cập rimba-tours.{PLATFORM_DOMAIN} được redirect 301 tới rimba-adventure.{PLATFORM_DOMAIN}
```

### AC-11: 301 redirect cho old slug
> Source: US-F23-04 — FR-11

```gherkin
GIVEN slug "old-slug" tồn tại trong previousSlugs của tenant "new-slug"
  AND expiresAt chưa qua
WHEN  browser gửi request tới old-slug.{PLATFORM_DOMAIN}
THEN  middleware trả về HTTP 301 redirect tới new-slug.{PLATFORM_DOMAIN}
  AND header Location chứa URL chính xác
```

### AC-12: Old slug hết hạn không redirect
> Source: US-F23-04 — FR-11

```gherkin
GIVEN slug "expired-slug" tồn tại trong previousSlugs
  AND expiresAt đã qua (>30 ngày)
WHEN  browser gửi request tới expired-slug.{PLATFORM_DOMAIN}
THEN  hệ thống trả về 404 (không redirect)
```

### AC-13: Tenant cũ giữ nguyên slug store-{id}
> Source: Decision validated 2026-04-09

```gherkin
GIVEN tenant đã tồn tại với slug "store-7" (tạo trước khi F23 deploy)
WHEN  tenant đó login và truy cập site
THEN  slug vẫn là "store-7", không bị thay đổi tự động
  AND user có thể đổi thủ công trong Settings > Domains
```

---

## 9. Non-Functional Requirements

| Category | Requirement | Target | Notes |
|----------|-------------|--------|-------|
| **Performance** | API `/api/slug/check` response time | <200ms p99 | Index trên cột slug + previousSlugs |
| **Performance** | Middleware old-slug redirect lookup | <50ms thêm vào request | Cache previousSlugs lookup |
| **Availability** | Slug check API uptime | >99.9% | Không block site generation nếu check fail |
| **Scalability** | Số lượng previousSlugs per tenant | Tối đa 20 entries | Cron job cleanup entries expired |
| **Security** | Slug không được phép chứa profanity | Blocklist cơ bản 50 từ | Extend reserved-slugs.ts |
| **UX** | SlugPicker debounce | 400ms | Tránh spam API khi user đang gõ |

---

## 10. Data Model Changes

### 10.1 Field mới trong Tenants collection

```typescript
// src/collections/Tenants.ts — Thêm sau field slug (line 52)
{
    name: 'previousSlugs',
    type: 'array',
    admin: {
        description: 'Previous slugs for 301 redirect (30-day grace period)',
        readOnly: true,
    },
    fields: [
        { name: 'slug', type: 'text', required: true },
        { name: 'expiresAt', type: 'date', required: true },
    ],
},
```

### 10.2 beforeChange hook trong Tenants collection

```typescript
// src/collections/Tenants.ts — Thêm hooks
hooks: {
    beforeChange: [
        async ({ data, originalDoc, operation }) => {
            if (operation === 'update' && data.slug && originalDoc?.slug && data.slug !== originalDoc.slug) {
                const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                data.previousSlugs = [
                    ...(originalDoc.previousSlugs || []),
                    { slug: originalDoc.slug, expiresAt: expiresAt.toISOString() }
                ]
            }
            return data
        }
    ]
}
```

### 10.3 DB Migration (scripts/db-setup.js)

Theo Payload Drizzle naming convention (array field → `{collection}_{field}`, id là varchar UUID):

```javascript
// scripts/db-setup.js — Thêm vào MIGRATIONS array
{
    name: 'tenants_previous_slugs.create_table',
    sql: `CREATE TABLE IF NOT EXISTS tenants_previous_slugs (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
        _order integer NOT NULL DEFAULT 0,
        _parent_id integer NOT NULL,
        _uuid varchar NOT NULL DEFAULT gen_random_uuid()::text,
        slug varchar NOT NULL,
        expires_at timestamp with time zone NOT NULL
    );`,
},
{
    name: 'tenants_previous_slugs.create_index',
    sql: `CREATE INDEX IF NOT EXISTS tenants_previous_slugs_slug_idx ON tenants_previous_slugs(slug);`,
},
```

> **CRITICAL:** Array tables dùng `varchar` id (UUID), `_parent_id`, `_order` (có underscore). Xem CLAUDE.md > Database Schema Changes.

---

## 11. API Contracts

### 11.1 Slug Availability Check

```
GET /api/slug/check?slug={slug}
Auth: không required
```

**Response 200 — Available:**
```json
{ "available": true }
```

**Response 200 — Unavailable:**
```json
{ "available": false, "suggestion": "rimba-tours-7k3" }
```

**Response 409 — Reserved:**
```json
{ "available": false, "reason": "reserved", "message": "This slug is reserved and cannot be used." }
```

**Response 422 — Invalid format:**
```json
{ "available": false, "reason": "invalid_format", "message": "Slug must be 3-63 characters, lowercase letters, numbers, and hyphens only." }
```

### 11.2 Slug Update (Settings)

```
PATCH /api/tenant/slug
Auth: required (Bearer token — payload-token cookie)
Content-Type: application/json
```

**Request body:**
```json
{ "slug": "new-slug" }
```

**Response 200:**
```json
{ "slug": "new-slug", "previousSlugs": [{ "slug": "old-slug", "expiresAt": "2026-05-09T..." }] }
```

**Response 409 — Slug taken:**
```json
{ "error": "SLUG_TAKEN", "message": "Slug is already in use.", "suggestion": "new-slug-a3b" }
```

**Response 422 — Validation error:**
```json
{ "error": "INVALID_SLUG", "message": "..." }
```

---

## 12. UI Specifications

### 12.1 SlugPicker Component (Onboarding/Builder flow)

**Vị trí:** Sau bước nhập business name, trước khi bấm "Generate My Site"

**States:**

| State | UI |
|-------|-----|
| Default | Input với placeholder `your-store-name`, slug tự động populate từ business name |
| Checking | Spinner nhỏ bên phải input, text mờ "Checking..." |
| Available | Badge xanh "Available", nút Submit enabled |
| Unavailable | Badge đỏ "Taken", hiển thị text "Suggestion: {slug}" có thể click để apply |
| Invalid format | Border đỏ, text helper mô tả rule vi phạm |

**Preview URL:** Hiển thị bên dưới input:
```
https://{slug}.web-v2.dev.ecommercehub.my
```

**Mobile (375px):** Input full-width, badge hiển thị inline.

### 12.2 Settings Slug Editor

**Vị trí:** Settings > Domains, phía trên phần Custom Domain

**Layout:**
```
Platform Subdomain
┌──────────────────────────────────────────────────┐
│ rimba-tours.web-v2.dev.ecommercehub.my  [Change] │
└──────────────────────────────────────────────────┘
```

**Sau khi click "Change":**
```
┌──────────────────────────────────────────────────┐
│ [rimba-tours              ] .web-v2.dev...  [Save]│
│ ✅ Available                           [Cancel]  │
└──────────────────────────────────────────────────┘
```

**Confirmation Dialog:**
```
Xác nhận thay đổi subdomain
─────────────────────────────────────────────────
Subdomain cũ "rimba-tours" sẽ tiếp tục hoạt động
và redirect sang subdomain mới trong 30 ngày.

Sau 30 ngày, link cũ sẽ không còn hoạt động.
Hãy cập nhật tất cả marketing materials của bạn.
─────────────────────────────────────────────────
[Hủy]                              [Xác nhận đổi]
```

### 12.3 UI States cần handle

| State | Behavior |
|-------|---------|
| Loading | Spinner khi check availability, button disabled |
| Error | Toast "Không thể kiểm tra slug, vui lòng thử lại" nếu API fail |
| Success | Toast "Subdomain đã được cập nhật" sau khi save |
| Conflict | Inline error "Slug này đã được sử dụng" + suggestion |

---

## 13. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| **Slug check API bị spam/abuse** — endpoint không cần auth dễ bị enumerate | Medium | Low | Rate limiting 60 req/min per IP, không expose tenant info trong response |
| **previousSlugs tích lũy vô hạn** — tenant đổi slug nhiều lần làm bảng phình to | Low | Medium | Giới hạn tối đa 20 entries per tenant, cron job xóa entries expired |
| **Middleware lookup previousSlugs làm chậm mọi request** — DB query thêm trên mỗi subdomain request | Medium | High | Cache kết quả lookup trong Redis với TTL 5 phút; chỉ query khi slug không khớp tenant hiện tại |
| **Reserved words blocklist không đủ** — user đăng ký slug nhạy cảm (profanity, competitor names) | Medium | Medium | Review blocklist trước launch, thêm mechanism để admin add reserved words qua Payload CMS |
| **Collision suffix trùng nhau** — xác suất thấp nhưng có thể sinh suffix đã tồn tại | Low | Low | Retry loop tối đa 5 lần với suffix khác nhau trước khi báo lỗi |

---

## 14. Phase Breakdown

| Phase | Tên | Effort | Deliverables |
|-------|-----|--------|-------------|
| **Phase 1** | Smart slug generation | 2h | `src/lib/utils/slugify.ts` — hàm `slugify()` + `generateUniqueSlug()` + unit tests |
| **Phase 2** | Slug availability check API | 1h | `src/app/api/slug/check/route.ts` + `src/lib/utils/reserved-slugs.ts` |
| **Phase 3** | Onboarding slug picker UI | 2h | `src/components/onboarding/SlugPicker.tsx` + tích hợp vào `generate-site/route.ts` và `apply-template/route.ts` |
| **Phase 4** | Settings slug editor | 2h | Update `DomainsClient.tsx` + `src/app/api/tenant/slug/route.ts` + middleware 301 redirect + `previousSlugs` migration |
| **Phase 5** | Reserved words + validation | 1h | Hoàn thiện blocklist, `beforeChange` hook trong `Tenants.ts`, integration tests |

**Tổng cộng:** 8h

### Phase 1 — Detail: slugify.ts

```typescript
// src/lib/utils/slugify.ts
export function slugify(name: string): string {
    return name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // strip diacritics
        .replace(/[^a-z0-9\s-]/g, '')    // remove special chars
        .trim()
        .replace(/\s+/g, '-')            // spaces → hyphens
        .replace(/-+/g, '-')             // collapse multiple hyphens
        .replace(/^-|-$/g, '')           // trim leading/trailing hyphens
        .slice(0, 63)                    // max 63 chars
}

export async function generateUniqueSlug(name: string, payload: Payload): Promise<string> {
    const base = slugify(name)
    // Check availability, retry with suffix if needed
    // ...
}
```

### Phase 3 — Key change trong generate-site/route.ts

```typescript
// TRƯỚC (line 115):
const fallbackSlug = `store-${user.id}`

// SAU:
const fallbackSlug = await generateUniqueSlug(
    body.businessName || `${firstName}'s Store`,
    payload
)
// Nếu user đã chọn slug trong SlugPicker, dùng body.slug thay vì fallbackSlug
const tenantSlug = body.slug ?? fallbackSlug
```

---

## 15. Dependencies

| Dependency | Status | Ghi chú |
|-----------|--------|---------|
| F06 Onboarding | Done | SlugPicker tích hợp sau step business name input |
| F19 Store Config (Settings Domains) | Done | Thêm slug editor vào DomainsClient.tsx có sẵn |
| Redis (cache) | Done | Dùng cho cache previousSlugs lookup trong middleware |
| `scripts/db-setup.js` migration system | Done | Thêm `tenants_previous_slugs` table migration |
| Rate limiting middleware | Pending (optional) | Nếu chưa có, slug check API có thể không cần ngay v1 |

---

## 16. Related Docs

| Document | Link | Ghi chú |
|----------|------|---------|
| Plan (validated) | `plans/260409-1930-custom-subdomain-slug/plan.md` | Decisions đã confirm |
| F06 Onboarding PRD | `docs/prd/F06-onboarding.md` | Flow context |
| F19 Store Config PRD | `docs/prd/F19-store-configuration.md` | Settings Domains context |
| Tenants Collection | `src/collections/Tenants.ts` | Schema source of truth |
| Middleware | `src/middleware.ts` | Routing logic hiện tại |
| DB Setup Script | `scripts/db-setup.js` | Migration executor |
| CLAUDE.md | `CLAUDE.md` | DB migration conventions |

---

## 17. 9-Point Done Checklist

| Item | Expected Behavior |
|------|------------------|
| Loading State | Spinner trong SlugPicker khi checking, button disabled |
| Empty State | SlugPicker với placeholder khi business name chưa nhập |
| Error State | Toast + inline error nếu API check fail hoặc slug taken |
| Form Validation | Inline error message cho slug format invalid |
| Button States | "Generate/Apply" disabled khi slug unavailable hoặc checking |
| Toast Feedback | "Subdomain đã cập nhật" sau Settings save thành công |
| Auth Redirect | PATCH /api/tenant/slug trả 401 nếu không có session |
| Mobile 375px | SlugPicker full-width, badge không bị cắt |
| TypeScript Clean | `tsc --noEmit` pass — không có `any` types |

---

## 18. Definition of Ready

- [ ] Plan validated (`plans/260409-1930-custom-subdomain-slug/plan.md`)
- [ ] F06 Onboarding flow đã được deploy và stable
- [ ] F19 DomainsClient.tsx đã được review (slug editor sẽ thêm vào đây)
- [ ] DB migration convention đã clear (xem CLAUDE.md)

---

## 19. Definition of Done

- [ ] Tất cả FR (FR-01 đến FR-12) được implement
- [ ] Tất cả AC (AC-01 đến AC-13) pass trong QA test
- [ ] `tenants_previous_slugs` table có trong `scripts/db-setup.js`
- [ ] CI `check-migrations.js` pass (không block PR)
- [ ] Tenant mới tạo KHÔNG còn dùng `store-{id}` format
- [ ] Tenant cũ `store-{id}` vẫn hoạt động bình thường
- [ ] Slug change trong Settings tạo ra 301 redirect đúng
- [ ] `tsc --noEmit` pass, không có lint errors
- [ ] Unit tests cho `slugify()` và `generateUniqueSlug()` pass
