# PRD: Dashboard — Site Overview

> **Date:** 2026-03-07 | **Priority:** P0 | **Wave:** 1  
> **Agent:** PO Agent | **Story:** US-006

---

## Problem Statement

Sau khi login, user (chủ shop SME) cần thấy **tổng quan ngay lập tức**:
- Tôi có bao nhiêu website?
- Website nào đang live, cái nào draft?
- Còn bao nhiêu AI credits?
- Action tiếp theo là gì?

Hiện tại login xong → blank page. User không biết làm gì tiếp.

## Proposed Solution

Dashboard `/dashboard` hiện 3 vùng chính:

```
┌─────────────────────────────────────────────────┐
│  Sidebar (240px)  │  Main Content               │
│  ─────────────    │  ┌─────────────────────────┐│
│  Dashboard ●      │  │ Good morning, Nhan! 👋   ││
│  My Sites         │  │ You have 3 websites      ││
│  Templates        │  └─────────────────────────┘│
│  Media            │  ┌───┐ ┌───┐ ┌───┐ ┌───┐   │
│  SEO              │  │ 3 │ │12K│ │1.2│ │15 │   │
│  Analytics        │  │sit│ │viw│ │GB │ │AI │   │
│  Settings         │  └───┘ └───┘ └───┘ └───┘   │
│  Billing          │  ┌─────┐ ┌─────┐ ┌─────┐   │
│                   │  │site1│ │site2│ │site3│   │
│                   │  │ Edit│ │ Edit│ │ Edit│   │
│                   │  └─────┘ └─────┘ └─────┘   │
│                   │  [+ Create New Website]      │
└───────────────────┴─────────────────────────────┘
```

### 3 States bắt buộc:
1. **Has Sites** — Stats + Site Cards grid
2. **Empty** — Icon + "Tạo website đầu tiên" + CTA
3. **Loading** — Skeleton cards

## User Stories

### US-006A: Dashboard — Has Sites
```
GIVEN user đã login, có ≥1 site
WHEN  vào /dashboard
THEN  hiện greeting "Good morning/afternoon/evening, [name]"
AND   4 stat cards: Total Sites | Total Views | Storage | AI Credits
AND   site cards grid (max 6, "Xem thêm" nếu >6)
AND   mỗi card: thumbnail, name, status badge (Published/Draft), 
      last edited, [Edit] [Preview] buttons
```

### US-006B: Dashboard — Empty State
```
GIVEN user đã login, chưa có site nào
WHEN  vào /dashboard
THEN  hiện empty state: icon 🌐 + "Chưa có website nào"
AND   subtitle: "Tạo website đầu tiên chỉ trong 5 phút với AI"
AND   CTA button "Tạo website mới" → /onboarding
AND   KHÔNG hiện stat cards (không có data)
```

### US-006C: Dashboard — Unpublished Banner
```
GIVEN user có site nhưng chưa publish
WHEN  vào /dashboard
THEN  banner vàng top: "⚠️ Website chưa live. Publish ngay →"
AND   click → /editor/:siteId
```

### US-006D: Dashboard — Loading
```
GIVEN user vào /dashboard
WHEN  data đang fetch
THEN  hiện skeleton: 4 card placeholders + 3 site card skeletons
AND   skeleton animate shimmer
AND   KHÔNG hiện spinner tròn
```

## Out of Scope (Wave 1)
- ❌ Real analytics data (sẽ dùng mock số)
- ❌ Drag-drop reorder sites
- ❌ Search/filter sites
- ❌ Notification bell

## Dependencies
- Payload CMS `sites` collection (có sẵn ✅)
- Payload CMS `users` collection (có sẵn ✅)
- Auth session (Payload built-in ✅)

## Success Metrics
- User nhìn thấy sites trong < 2s sau login
- CTA "Tạo website" click-through > 50% (cho empty state)
