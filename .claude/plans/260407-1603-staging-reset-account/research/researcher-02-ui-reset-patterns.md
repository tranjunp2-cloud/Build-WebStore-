# UI Reset Patterns Research Report

## 1. Account Settings Page Structure
**Location:** `/src/app/(dashboard)/settings/page.tsx`

The main settings page is a client component with:
- **Profile Section:** Edit firstName/lastName; email & role are read-only
- **Password Section:** Change password with validation (min 8 chars)
- **Danger Zone Section:** Currently shows "Delete Account (Coming Soon)" with button disabled
  - Red-bordered container (`border-red-500/20 bg-red-500/5`)
  - Placeholder text acknowledges account deletion will remove "sites, media, and data"

**Related Settings Sub-Pages:**
- `/settings/payments/page.tsx` — Payment configuration
- `/settings/domains/page.tsx` — Domain management
- `/settings/staff/page.tsx` — Staff directory with RemoveStaffModal component

## 2. Danger Zone UI Pattern
The Danger Zone pattern is already established in the codebase:
- **Visual:** Red-bordered card container at bottom of settings
- **Current Implementation:** Disabled button with "Coming Soon" text
- **Ready for Extension:** Structure can be repurposed for account reset/deletion once backend routes are added

## 3. Data Deletion & Reset Patterns
**Files Examined:**
- `/src/app/(dashboard)/settings/staff/RemoveStaffModal.tsx` — Existing delete pattern for staff removal
- `/src/app/(dashboard)/settings/staff/StaffDirectoryClient.tsx` — Bulk staff management

**Payload CMS Collections (Tables):** `/src/collections/`
- `Users.ts` (45KB) — User auth, roles, tenants
- `Sites.ts` — Site data tied to users/tenants
- `Pages.ts` — Page content
- `Media.ts` — Uploaded assets
- `Products.ts`, `Orders.ts` — E-commerce data
- `Templates.ts`, `Blogs.ts`, `BlogCategories.ts`
- `Subscribers.ts`, `Subscriptions.ts`, `Analytics.ts`, `Notifications.ts`

**Reset Scope:** Account reset would need to cascade delete or archive:
- User record & auth tokens
- All associated sites, pages, media
- All subscriptions, products, orders
- Blog posts, templates, analytics records

## 4. Payload CMS Configuration
**File:** `/src/payload.config.ts`

Uses PostgreSQL adapter with:
- Email via SMTP (AWS SES when configured, otherwise console logging)
- S3 storage for media (via `@payloadcms/storage-s3`)
- Collections registered at lines 96+: Tenants, Users, Sites, Pages, Media, etc.
- No explicit soft-delete utilities found; uses hard deletion

## 5. Environment-Gated Features
**Staging-Only Patterns Found:**
- `/src/app/(dashboard)/settings/domains/DomainsClient.tsx` line 4: 
  - `NEXT_PUBLIC_CNAME_TARGET` and `NEXT_PUBLIC_PLATFORM_DOMAIN` for staging DNS
- `/src/app/(dashboard)/settings/staff/actions.ts`: 
  - `isDev = process.env.NODE_ENV !== 'production'` for dev-only behavior

**API Endpoint for User Data:**
- `/api/users/me` — Fetch current user profile
- `/api/users/{id}` (PATCH) — Update user profile/password
- Password reset flow uses Payload CMS built-in `forgotPassword` hook

## Implementation Readiness Summary
- **UI Container:** Exists; Danger Zone is ready to repurpose
- **Data Model:** All collections defined; no soft-delete layer exists
- **API Routes:** User endpoints exist; reset/delete route not yet implemented
- **Staging Flag:** Environment checks present; can gate reset feature to staging
- **Email Hooks:** Welcome & password reset hooks in place; deletion confirmation email can follow same pattern

**Next Steps:**
1. Create `/api/users/{id}/reset` or `/api/users/{id}/delete` endpoint
2. Implement cascade deletion logic for Sites, Pages, Media, etc.
3. Add confirmation modal before triggering
4. Gate feature behind `process.env.NODE_ENV === 'development'` or staging environment variable
5. Enable button in Danger Zone; wire to new endpoint
