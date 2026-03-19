# Architecture: CMS Core Layout & Navigation (F18)
> **Version:** 1.0 | **Created:** 2026-03-18 | **Agent:** `frontend-specialist`
> **PRD:** [`docs/prd/F18-cms-layout.md`](../prd/F18-cms-layout.md)

---

## 1. Overview

Tài liệu mô tả kiến trúc kỹ thuật cho khung bố cục toàn cục của CMS (`(dashboard)/layout.tsx`). Bao gồm: cấu trúc component, quản lý state cho Sidebar và i18n, tích hợp Notification bell với F16, và routing cho Navigation menu.

---

## 2. System Context

```
app/(dashboard)/layout.tsx          ← CMS Root Layout (Server Component)
      │
      ├── TopHeader.tsx              ← Fixed top bar
      │     ├── Logo → /dashboard
      │     ├── NotificationBell    ← Integrates F16
      │     └── UserAvatarMenu      ← Profile, Language, Workspace, Logout
      │
      ├── Sidebar.tsx                ← Fixed left navigation
      │     ├── NavItem[] (Icon + Text)
      │     └── SupportLink          ← WhatsApp link
      │
      └── <main> (children)          ← Scrollable content area
            └── Breadcrumbs.tsx      ← Shows on depth > 1
```

---

## 3. Component Tree

```
(dashboard)/layout.tsx    [Server Component — wraps all CMS pages]
├── CMSLayoutClient        [Client Component — handles Sidebar open/close state]
│   ├── TopHeader
│   │   ├── HamburgerButton       [Mobile only — toggles sidebar]
│   │   ├── LogoLink              [→ /dashboard]
│   │   ├── NotificationBell      [Fetches F16 badge count]
│   │   │   └── NotificationDropdown [F16 Component]
│   │   └── UserAvatarMenu
│   │       ├── LanguageSwitcher  [BM / EN via i18n + localStorage]
│   │       ├── WorkspaceSwitcher [If multi-site]
│   │       └── LogoutButton
│   │
│   ├── Sidebar
│   │   ├── NavItem (Dashboard)
│   │   ├── NavItem (Editor)
│   │   ├── NavItem (Products)
│   │   ├── NavItem (Orders)
│   │   ├── NavItem (Blog)
│   │   ├── NavItem (SEO)
│   │   ├── NavItem (Config)
│   │   └── WhatsAppSupportLink
│   │
│   └── <main className="cms-content">
│       ├── Breadcrumbs           [Auto-generated from URL pathname]
│       └── {children}            [Feature page content]
│
└── MobileSidebarOverlay          [Backdrop overlay on mobile]
```

### Component Responsibility

| Component | File | Responsibility |
|-----------|------|----------------|
| `CMSLayoutClient` | `app/(dashboard)/_components/CMSLayoutClient.tsx` | Client root — sidebar open state |
| `TopHeader` | `app/(dashboard)/_components/TopHeader.tsx` | Fixed header bar |
| `NotificationBell` | `app/(dashboard)/_components/NotificationBell.tsx` | Badge count + F16 dropdown |
| `UserAvatarMenu` | `app/(dashboard)/_components/UserAvatarMenu.tsx` | Avatar dropdown |
| `LanguageSwitcher` | `app/(dashboard)/_components/LanguageSwitcher.tsx` | BM/EN toggle |
| `Sidebar` | `app/(dashboard)/_components/Sidebar.tsx` | Navigation menu |
| `NavItem` | `app/(dashboard)/_components/NavItem.tsx` | Single nav link with icon + text |
| `Breadcrumbs` | `app/(dashboard)/_components/Breadcrumbs.tsx` | URL-aware breadcrumbs |
| `MobileSidebarOverlay` | `app/(dashboard)/_components/MobileSidebarOverlay.tsx` | Backdrop for mobile drawer |

---

## 4. Data Flow

```
User loads /dashboard
      │
      ▼
layout.tsx (Server):
  → getSession() → resolve tenantId + user data
  → Pass user to TopHeader (Avatar, Lang preference)
  → Pass tenantId to NotificationBell
      │
      ▼
Client hydration (CMSLayoutClient):
  → Reads `lang` from localStorage → apply i18n
  → Sidebar: expand default (desktop) / collapse (mobile)
  → NotificationBell: poll /api/notifications/unread-count every 30s
```

---

## 5. State Management

| State | Location | Type | Description |
|-------|----------|------|-------------|
| `sidebarOpen` | `CMSLayoutClient` (useState) | `boolean` | Mobile sidebar open/close |
| `lang` | localStorage + Context | `'BM' \| 'EN'` | User language preference |
| `notifCount` | SWR / React Query | `number` | Unread notification count |
| `activeRoute` | `usePathname()` | `string` | Current route for active nav highlight |

---

## 6. Navigation Config

```typescript
// config/navigation.ts

export const NAV_ITEMS = [
  { label: { en: 'Dashboard', bm: 'Papan Pemuka' }, icon: '📊', href: '/dashboard' },
  { label: { en: 'Editor',    bm: 'Editor' },       icon: '✏️',  href: '/editor' },
  { label: { en: 'Products',  bm: 'Produk' },        icon: '📦', href: '/products' },
  { label: { en: 'Orders',    bm: 'Pesanan' },        icon: '🛒', href: '/orders' },
  { label: { en: 'Blog',      bm: 'Blog' },           icon: '📝', href: '/blog' },
  { label: { en: 'SEO',       bm: 'SEO' },            icon: '🔍', href: '/seo' },
  { label: { en: 'Settings',  bm: 'Tetapan' },        icon: '⚙️', href: '/settings' },
];

export const SUPPORT_WHATSAPP_URL = 'https://wa.me/60XXXXXXXXX?text=Hi+PrimeWeb+Support';
```

---

## 7. API Endpoints Used

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/notifications/unread-count` | Bell badge count (F16) |
| POST | `/api/auth/logout` | Logout action |
| PATCH | `/api/user/preferences` | Save language preference |

---

## 8. Responsive Behavior

| Breakpoint | Sidebar | Header |
|-----------|---------|--------|
| `≥ 1024px` (Desktop) | Expanded (240px fixed left) | Full bar |
| `768–1023px` (Tablet) | Collapsed to icons only | Full bar |
| `< 768px` (Mobile) | Hidden → Slide-in Drawer on ☰ click | Compact with ☰ |

### Mobile Drawer Implementation
```typescript
// Sidebar slide-in via Tailwind + CSS transition
// translate-x-0 (open) / -translate-x-full (closed)
// Overlay: fixed inset-0 bg-black/40 z-40
// Sidebar: fixed left-0 top-0 h-full w-64 z-50 transition-transform
```

---

## 9. i18n Implementation

```typescript
// Language stored in localStorage: key = 'primeweb_lang'
// Context provider wraps CMSLayoutClient
// NavItem reads labels from NAV_ITEMS[n].label[currentLang]
// Switch triggers: localStorage.setItem() + router refresh (shallow)
```

> Translation scope for F18: Navigation labels only.
> Full page i18n is handled per-feature.

---

## 10. Error Handling Matrix

| Error | User Sees | Recovery |
|-------|-----------|----------|
| Session expired | Redirect → /login | — |
| Notif API fail | Bell badge tidak muncul | Silent fail, retry 30s |
| Logout API fail | Toast: "Logout gagal, cuba lagi" | Retry button |

---

## 11. Security Considerations

- [x] Auth required → All routes under `(dashboard)` protected via middleware
- [x] Tenant-scoped — notification count scoped to tenantId
- [x] No sensitive data exposed in Sidebar/Header (no tokens, no raw IDs)

---

## 12. Performance Considerations

- **TopHeader**: Server Component → pre-rendered, no client JS for static parts
- **NotificationBell**: SWR polling every 30s (not websocket at this stage)
- **Sidebar**: Static config-driven, no DB call needed
- **Breadcrumbs**: Generated from `usePathname()` — zero extra API call

---

## 13. Testing Strategy

| Type | What to Test | Tool |
|------|-------------|------|
| Unit | `Breadcrumbs` — correct generation from pathname | Jest |
| Unit | `LanguageSwitcher` — toggle + localStorage persist | Jest |
| E2E | Sidebar open/close on mobile (375px) | Playwright |
| E2E | Navigation to each menu item routes correctly | Playwright |
| E2E | Bell → opens F16 dropdown | Playwright |
| E2E | Avatar → Language switch → labels change | Playwright |
