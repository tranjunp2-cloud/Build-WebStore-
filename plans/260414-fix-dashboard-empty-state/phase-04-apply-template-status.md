# Phase 04: Add generationStatus to apply-template + Smart Failed Logic

> Parent: [plan.md](plan.md) | Depends on: [Phase 01](phase-01-generation-status-field.md)

## Overview

- **Priority:** P0
- **Status:** done
- **Effort:** 1h

## Context

2 vấn đề bổ sung:

1. `apply-template/route.ts` cũng tạo/update sites nhưng không set `generationStatus` → cùng bug với generate-site
2. Cả 2 route đều mark `failed` ngay khi catch — nhưng nếu đã tạo được 1-2 pages thì site vẫn hoạt động được, không nên coi là failed

### Business Rule mới

> Nếu generation/apply bị lỗi nhưng đã có ≥1 page được tạo thành công và domain vẫn hoạt động → **không tính là failed** → mark `completed` (partial success).
> Chỉ mark `failed` khi site có **0 pages**.

## Related Files

- `src/app/api/ai/generate-site/route.ts` — sửa catch block logic
- `src/app/api/ai/apply-template/route.ts` — thêm generationStatus + catch logic
- `src/collections/Pages.ts` — `site` field là relationship, indexed

## Key Insights

### generate-site
- `createdPages` array (line 407) track pages đã tạo — nhưng nằm trong try scope
- Cần move ra outer scope để catch block access được
- Trong catch: check `createdPages.length > 0` → partial success → `completed`

### apply-template — 2 flows
| Flow | Trigger | DB Operations |
|------|---------|---------------|
| **Apply to existing site** | `siteId` provided | findByID → delete old pages → update theme → create new pages |
| **Create new site** | no `siteId` | create site → create pages + 404 page |

- Không có `createdPages` array → cần thêm
- Flow 1 (existing site): site đã có → chỉ cần track pages
- Flow 2 (new site): tạo site trước → cần generationStatus
- Catch block (line 398): không reference site/pages → cần outer scope vars

### Cách check pages trong catch — 2 options

**Option A: Track trong code** (recommend)
```typescript
let createdPagesCount = 0
// trong loop: createdPagesCount++
// trong catch: if (createdPagesCount > 0) → completed
```

**Option B: Query DB**
```typescript
const pageCount = await payload.count({
    collection: 'pages',
    where: { site: { equals: siteId } },
})
```

**Chọn Option A** — không cần thêm DB query, đơn giản hơn.

## Implementation Steps

### Step 1: generate-site — Smart failed logic

Sửa catch block hiện tại từ always-failed thành check pages:

**1a. Move `createdPages` ra outer scope (trước try):**

Hiện tại `createdPages` ở line 407 trong try. Thêm counter ở function scope:

```typescript
let _site: Record<string, unknown> | null = null    // đã có
let _payload: ... | null = null                       // đã có
let _createdPagesCount = 0                            // ADD
```

**1b. Increment counter trong page creation loop:**

Sau `createdPages.push(createdPage)` (line ~439), thêm:
```typescript
_createdPagesCount++
```

**1c. Update catch block — smart logic:**

```typescript
if (_site?.id && _payload) {
    // Partial success: nếu đã có pages → site vẫn dùng được
    const status = _createdPagesCount > 0 ? 'completed' : 'failed'
    await _payload.update({
        collection: 'sites',
        id: _site.id as string | number,
        data: { generationStatus: status },
    }).catch((_e: unknown) => console.error('[AI Generate] Failed to update generation status:', _e))
}
```

### Step 2: apply-template — Add generationStatus (Flow 2: create new site)

**2a. Add outer scope vars:**

```typescript
export const POST = withAuth(async (user, req) => {
    let _site: Record<string, unknown> | null = null
    let _payload: Awaited<ReturnType<typeof getPayload>> | null = null
    let _createdPagesCount = 0

    try {
        // ...existing code
        const payload = await getPayload({ config })
        _payload = payload
```

**2b. Set `generationStatus: 'generating'` khi tạo site mới (line 333):**

```typescript
const site = await payload.create({
    collection: 'sites',
    data: {
        // ...existing fields
        generationStatus: 'generating',  // ADD
    },
})
_site = site as Record<string, unknown>
```

**2c. Track created pages trong loop (line 349-362):**

```typescript
for (const [idx, page] of pagesToCreate.entries()) {
    await payload.create({ collection: 'pages', data: { ... } })
    _createdPagesCount++  // ADD
}
// 404 page
await payload.create({ collection: 'pages', data: { ... } })
_createdPagesCount++  // ADD
```

**2d. Set `completed` sau pages thành công (trước return, line ~390):**

```typescript
// Mark generation completed
if (_site?.id) {
    await payload.update({
        collection: 'sites',
        id: _site.id as string | number,
        data: { generationStatus: 'completed' },
    })
}
```

**2e. Smart catch block:**

```typescript
} catch (error: unknown) {
    // Mark generation status based on partial success
    if (_site?.id && _payload) {
        const status = _createdPagesCount > 0 ? 'completed' : 'failed'
        await _payload.update({
            collection: 'sites',
            id: _site.id as string | number,
            data: { generationStatus: status },
        }).catch((_e: unknown) => console.error('[Apply Template] Failed to update generation status:', _e))
    }

    // ...existing error handling
}
```

### Step 3: apply-template — Flow 1 (existing site) — Set generating/completed

Flow 1 update existing site, không tạo site mới. Nhưng vẫn xóa pages cũ rồi tạo mới → cùng risk.

**3a. Set `generating` trước khi xóa pages (line 274):**

```typescript
// Mark as generating before destructive operations
await payload.update({
    collection: 'sites',
    id: Number(siteId),
    data: { generationStatus: 'generating' },
})

// Delete old pages (existing, line 276-283)
// Update theme (existing, line 286-290)
// Create new pages (existing, line 293-306)
```

**3b. Track pages + set completed:**

Wrap page creation loop với counter, set `completed` trước return (line 315).

**3c. Catch block — cần track siteId cho Flow 1:**

Thêm `_siteId` outer var:
```typescript
let _siteId: string | number | null = null
// trong Flow 1: _siteId = Number(siteId)
// trong Flow 2: _siteId = site.id
```

Catch block check `_siteId` thay vì chỉ `_site?.id`.

## Success Criteria

- [ ] generate-site: fail với ≥1 page → `generationStatus = 'completed'`
- [ ] generate-site: fail với 0 pages → `generationStatus = 'failed'`
- [ ] apply-template Flow 2: thành công → `completed`
- [ ] apply-template Flow 2: fail 0 pages → `failed`
- [ ] apply-template Flow 2: fail với ≥1 page → `completed`
- [ ] apply-template Flow 1: thành công → `completed`
- [ ] apply-template Flow 1: fail giữa chừng → check pages, smart status
- [ ] Dashboard vẫn hiển thị đúng cho tất cả cases

## Risk Assessment

- **Medium** — sửa 2 critical routes
- Mitigate: `.catch()` wrap, không thay đổi business logic hiện tại
- Counter approach đơn giản, không thêm DB queries
- Flow 1 (existing site): nếu fail sau khi xóa pages cũ + chưa tạo pages mới → 0 pages → `failed` (đúng behavior — data cũ đã mất)
