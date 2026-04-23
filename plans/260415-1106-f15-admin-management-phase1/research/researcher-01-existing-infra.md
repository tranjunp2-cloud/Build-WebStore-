# Existing Infrastructure for F15

## Users Collection
- Platform roles: `super-admin`, `tenant-owner`
- Tenant membership: role (owner/admin/editor/viewer/custom), status (active/pending/suspended), permissions array
- Custom endpoints: login, invite-staff, remove-staff, update-staff, update-staff-status, resend-invite
- Auth: JWT cookies, 2FA via email OTP, maxLoginAttempts: 5, lockTime: 15min

## Tenants Collection
- Workspace = tenant. Fields: name, slug, plan (free/starter/pro/business), status (active/trialing/past_due/cancelled/suspended)
- Stripe fields: stripeCustomerId, stripeSubscriptionId, stripeAccountId, stripeOnboardingComplete
- Settings: allowedWebsites, storageUsed, storageLimitBytes (500MB default), dashboardPreferences
- SSO: customerId, serviceId, packCode, orderId

## Auth & RBAC
- `withAuth` HOC at src/lib/auth.ts — standard guard for API routes
- `getCurrentUser(req?)` reads JWT from Bearer/cookie
- RBAC is inline per route — no centralized checkRole()
- Two layers: platform role (users.roles) + workspace role (users.tenants[].role)

## Existing Admin APIs
- Only `POST /api/admin/broadcasts` (super-admin only)

## No audit/activity logging exists
- Closest: AiUsageLogs (AI call tracking), Analytics (storefront events)
- Staff operations only log via console.error
