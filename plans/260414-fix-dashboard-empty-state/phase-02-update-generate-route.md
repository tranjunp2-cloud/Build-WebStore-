# Phase 02: Update Generate-Site Route to Set Status

> Parent: [plan.md](plan.md) | Depends on: [Phase 01](phase-01-generation-status-field.md)

## Overview

- **Priority:** P0
- **Status:** done
- **Effort:** 45m

## Context

`generate-site/route.ts` hiện tạo site record rồi tạo pages — nhưng không mark generation status. Cần set `generating` trước khi tạo pages, `completed` khi xong, `failed` khi lỗi.

## Related Files

- `src/app/api/ai/generate-site/route.ts` — main file to modify

## Implementation Steps

### Step 1: Set `generationStatus: 'generating'` khi tạo/update site

**Case tạo mới (line ~326):** Thêm `generationStatus: 'generating'` vào data object:

```typescript
site = await payload.create({
  collection: 'sites',
  data: {
    // ...existing fields
    generationStatus: 'generating',  // ADD
  },
})
```

**Case update (line ~294):** Tương tự:

```typescript
site = await payload.update({
  collection: 'sites',
  id: existingSites.docs[0].id,
  data: {
    // ...existing fields
    generationStatus: 'generating',  // ADD
  },
})
```

### Step 2: Set `generationStatus: 'completed'` sau khi tạo pages xong

Đặt **sau** increment `aiGenerationsCount` (line ~445), **trước** cả SSE và JSON response paths:

```typescript
// FR-15: Increment AI generation count (existing, line ~439)
await payload.update({ collection: 'tenants', id: resolvedTenantId, data: { ... } })

// Mark generation completed — ADD THIS
await payload.update({
  collection: 'sites',
  id: site.id,
  data: { generationStatus: 'completed' },
})

// ── SSE Streaming Response ── (existing, line ~450)
if (isStreaming) { ... }
// ── JSON Response ── (existing, line ~492)
return NextResponse.json({ ... })
```

**Lý do đặt sau increment:** Nếu increment fail thì generation vẫn OK (chỉ count sai), không nên block completed status.

### Step 3: Set `generationStatus: 'failed'` trong catch block

Trong catch block (line ~505), thêm trước return:

```typescript
catch (error: unknown) {
  // Mark generation failed (if site was created)
  if (site?.id) {
    await payload.update({
      collection: 'sites',
      id: site.id,
      data: { generationStatus: 'failed' },
    }).catch((e) => console.error('[AI Generate] Failed to mark site as failed:', e))
  }

  // ...existing error handling
}
```

**Notes:**
- `.catch()` wrap để tránh double-throw
- Check `site?.id` vì nếu fail trước khi tạo site thì không cần update
- Biến `site` phải declare ở scope ngoài try/catch (kiểm tra xem đã declare chưa)

### Step 4: ~~Verify `site` variable scope~~ — DONE (no change needed)

Đã verify: `let site: Record<string, unknown>` declare ở line 287, **bên trong** try block (try bắt đầu line 79). Catch ở line 505 cùng scope → `site` accessible. Nếu fail trước line 287, `site` = `undefined` → `site?.id` = `undefined` → skip update. **Không cần move.**

## Success Criteria

- [ ] Generate thành công → site.generationStatus = `completed`
- [ ] Generate fail ở bước tạo pages → site.generationStatus = `failed`
- [ ] Generate fail trước khi tạo site → không crash (site?.id check)
- [ ] Re-generate → status reset về `generating` rồi `completed`

## Risk Assessment

- **Medium** — modify critical generation flow
- Mitigate: `.catch()` wrap trên failed update, không thay đổi business logic
- Không thay đổi thứ tự operations hiện tại (chưa fix delete-before-create)
