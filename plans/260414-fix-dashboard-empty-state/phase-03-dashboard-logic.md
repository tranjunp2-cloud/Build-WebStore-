# Phase 03: Update Dashboard Empty State Logic

> Parent: [plan.md](plan.md) | Depends on: [Phase 01](phase-01-generation-status-field.md), [Phase 02](phase-02-update-generate-route.md)

## Overview

- **Priority:** P0
- **Status:** done
- **Effort:** 45m

## Context

Dashboard `OverviewView.tsx` check `totalDocs > 0` — cần thêm filter `generationStatus` và show recovery UI khi site generation failed.

## Related Files

- `src/components/dashboard/views/OverviewView.tsx` — main dashboard logic (line 64-80)
- `src/app/(dashboard)/sites/page.tsx` — sites list page (line 61-70, cũng check sites count)
- `src/components/dashboard/DashboardEmptyState.tsx` — existing empty state (reference style)
- `src/components/dashboard/DashboardGenerationFailed.tsx` — **NEW** recovery component

**Không cần sửa:**
- `src/components/dashboard/views/AnalyticsView.tsx` — check analytics data (views=0, clicks=0), không check site existence → OK
- `src/components/dashboard/AnalyticsEmptyState.tsx` — analytics-specific empty, không liên quan

## Implementation Steps

### Step 1: Update OverviewView.tsx query logic

Thay đổi empty state check từ:

```typescript
const sitesResult = await payload.find({
  collection: 'sites',
  where: { tenant: { equals: tenantId } },
  limit: 1,
})
totalSites = sitesResult.totalDocs
```

Thành 3 queries:

```typescript
// 1. Tìm site usable (completed hoặc none — none = tạo manual)
const usableSites = await payload.find({
  collection: 'sites',
  where: {
    tenant: { equals: tenantId },
    or: [
      { generationStatus: { equals: 'completed' } },
      { generationStatus: { equals: 'none' } },
    ],
  },
  limit: 1,
})

// 2. Nếu không có usable site → check failed
if (usableSites.totalDocs === 0) {
  const failedSites = await payload.find({
    collection: 'sites',
    where: {
      tenant: { equals: tenantId },
      generationStatus: { equals: 'failed' },
    },
    limit: 1,
  })

  if (failedSites.totalDocs > 0) {
    return (
      <div className="space-y-8">
        <DashboardGenerationFailed />
      </div>
    )
  }

  // 3. Check generating (đang xử lý)
  const generatingSites = await payload.find({
    collection: 'sites',
    where: {
      tenant: { equals: tenantId },
      generationStatus: { equals: 'generating' },
    },
    limit: 1,
  })

  if (generatingSites.totalDocs > 0) {
    return (
      <div className="space-y-8">
        <DashboardEmptyState generating />
      </div>
    )
  }

  // Không có site nào → empty state bình thường
  return (
    <div className="space-y-8">
      <DashboardEmptyState />
    </div>
  )
}

// Có usable site → render full dashboard (giữ nguyên logic hiện tại)
```

**Optimization option:** Có thể gộp thành 1 query lấy tất cả sites rồi check `generationStatus` trong code thay vì 3 queries. Vì mỗi tenant thường chỉ có 1 site:

```typescript
const allSites = await payload.find({
  collection: 'sites',
  where: { tenant: { equals: tenantId } },
  limit: 5,
})

const usable = allSites.docs.filter(s => 
  s.generationStatus === 'completed' || s.generationStatus === 'none' || !s.generationStatus
)
const failed = allSites.docs.filter(s => s.generationStatus === 'failed')
const generating = allSites.docs.filter(s => s.generationStatus === 'generating')

if (usable.length > 0) {
  // render full dashboard
} else if (failed.length > 0) {
  return <DashboardGenerationFailed />
} else if (generating.length > 0) {
  return <DashboardEmptyState generating />
} else {
  return <DashboardEmptyState />
}
```

**Chốt: Dùng approach 1 query** — simple hơn, 1 DB call, handle được cả `null`/`undefined` field.

### Step 1b: Update sites list page (`/sites`)

File: `src/app/(dashboard)/sites/page.tsx` (line 61-70)

Tương tự OverviewView, sites page cũng list tất cả sites rồi check `sites.length === 0`. Cần filter tương tự:

```typescript
// Existing query (giữ nguyên)
const result = await payload.find({
  collection: 'sites',
  where: { tenant: { equals: tenantId } },
  sort: '-updatedAt',
  limit: 100,
})

// Filter usable sites for display
const usableSites = result.docs.filter(s => {
  const gs = (s as any).generationStatus
  return !gs || gs === 'none' || gs === 'completed'
})
const failedSites = result.docs.filter(s => (s as any).generationStatus === 'failed')

// Update empty state check
if (usableSites.length === 0) {
  if (failedSites.length > 0) {
    // Show recovery UI (similar to dashboard)
  }
  // Show existing empty state
}
// Use usableSites instead of sites for rendering
```

**Note:** Sites page hiển thị list cards — site failed nên show với badge "Generation Failed" + retry CTA thay vì ẩn hoàn toàn. Approach khác với dashboard (dashboard ẩn hẳn).

### Step 2: Tạo DashboardGenerationFailed component

File mới: `src/components/dashboard/DashboardGenerationFailed.tsx`

Copy style từ `DashboardEmptyState.tsx` (giữ consistent), thay đổi:
- Icon/illustration: warning icon thay vì rocket
- Heading: "Website generation encountered an error"
- Subtext: "Something went wrong during website creation. Please try again."
- CTA: "Try Again" → link `/builder/new`
- Secondary CTA (optional): "Contact Support"

**Lưu ý:** KHÔNG tự design UI mới — follow exact pattern của DashboardEmptyState, chỉ thay text/icon. (Feedback memory: Existing UI follows Figma, don't modify styles/layout)

### Step 3: Update DashboardEmptyState cho `generating` prop (optional)

Nếu muốn handle case "đang generating":
- Thêm optional `generating?: boolean` prop
- Khi `generating=true`: show loading text "Your website is being created..." + skeleton/spinner
- Tuy nhiên case này rất hiếm (user phải mở 2 tab) — có thể skip và chỉ show empty state bình thường

**Recommend:** Skip generating state cho MVP — focus vào failed case.

## Success Criteria

- [ ] Site `generationStatus=completed` → dashboard hiển thị bình thường
- [ ] Site `generationStatus=failed` → show DashboardGenerationFailed với CTA retry
- [ ] Không có site → show DashboardEmptyState (giữ nguyên)
- [ ] Site `generationStatus=none` (tạo manual) → dashboard hiển thị bình thường
- [ ] Site chưa có field (null/undefined) → dashboard hiển thị bình thường (backward compat)
- [ ] `/sites` page: failed site hiển thị với badge, không bị ẩn
- [ ] Không thay đổi UI cho site đã hoạt động đúng

## Risk Assessment

- **Low** — chỉ thêm filter condition, không đụng rendering logic của full dashboard
- `!gs` fallback handle case field chưa có (backward compat cho sites tạo trước migration)
- New component copy style từ existing → consistent
- Sites page: show failed site với badge thay vì ẩn → user vẫn thấy và retry được
