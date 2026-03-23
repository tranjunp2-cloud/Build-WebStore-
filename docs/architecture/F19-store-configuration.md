# Architecture: F19 Store Configuration & Staff Management
> **Version:** 1.0 | **Created:** 2026-03-23 | **Agent:** `ba-po-copilot`  
> **PRD:** [`docs/prd/F19-store-configuration.md`](../prd/F19-store-configuration.md)

---

## 1. Overview

This document outlines the technical design for the F19 feature, which encompasses Custom Domain Management (routing, DNS verification, auto-SSL) and Staff Management (Role-Based Access Control in Payload CMS). It addresses the complex multi-tenant routing requirements in Next.js and the granular permissions required for store staff.

## 2. System Context

```mermaid
graph TD
    Client(Customer Browser) -->|Custom Domain A Record| LB(Load Balancer / Ingress)
    LB --> NextApp(Next.js Server)
    NextApp -->|Middleware Rewrite| Tenant(Tenant Context)
    
    Owner(Store Owner) -->|CMS Admin Portal| Payload(Payload CMS)
    Payload -->|Create Staff User| DB[(MongoDB: Users Collection)]
    
    Owner -->|Add Domain| Payload
    Payload -->|API Call| ExternalDNS(Provider: Cloudflare / Vercel Domains API)
    ExternalDNS -->|Provision SSL| LB
```

## 3. Component Tree

```
[app/(admin)/settings]
├── SettingsLayout
│   ├── SettingsNav
│   ├── /domains
│   │   ├── DomainList
│   │   └── AddDomainModal
│   ├── /payments
│   │   └── PaymentToggles
│   └── /staff
│       ├── StaffList
│       └── InviteStaffModal
│           └── PermissionPicker
```

### Component Responsibility

| Component | File | Responsibility |
|-----------|------|---------------|
| `DomainList` | `app/(admin)/settings/domains/page.tsx` | Fetches and displays connected domains. Handles "Set Primary" and "Verify". |
| `AddDomainModal` | `components/settings/AddDomainModal.tsx` | Form to input new custom domain and trigger the API creation. |
| `InviteStaffModal` | `components/settings/InviteStaffModal.tsx` | Handles inviting a user and dynamically selecting RBAC features if "Custom" is chosen. |

## 4. Data Flow

**Staff Management Data Flow:**
Owner Action -> Opens Invite Modal -> Selects Custom Roles -> Submits `/api/staff/invite` -> Payload hooks create `User` with scoped `tenantId` and `roles`.

**Domain Provisioning Data Flow:**
Owner adds domain -> Payload saves `Domain` record as `pending` -> Next.js calls external DNS provider API -> Provider checks DNS config -> If connected, triggers webhook -> Payload updates `Domain` status to `connected` -> SSL is issued.

## 5. State Management

| State | Location | Type | Description |
|-------|----------|------|-------------|
| `domains` | Server/SWR | `Domain[]` | List of tenant domains fetched from CMS. |
| `staffList` | Server/SWR | `User[]` | List of staff belonging to the current tenant. |
| `inviteForm`| useState | `Object` | Tracks email, role type (Full/Custom), and selected features. |

## 6. API Design

### POST /api/domains/verify
```json
Request:
{
  "domain": "mystore.com" // required - the domain string
}

Response (success):
{
  "success": true,
  "data": { "status": "connected", "ssl_active": true }
}
```

### POST /api/staff/invite
```json
Request:
{
  "email": "staff@mystore.com", // required
  "role_type": "custom",        // required: 'full' | 'custom'
  "permissions": ["products", "orders"] // required if role_type is custom
}

Response (success):
{
  "success": true,
  "data": { "inviteToken": "xyz..." }
}
```

## 7. Database / Collection Changes

| Collection | Change | Fields |
|-----------|--------|--------|
| `Users` | MODIFY | Add `tenant_id` (rel), `role_type` (select: owner, full, custom), `permissions` (array of strings). |
| `Domains` | NEW | `domain` (String, unique), `tenant_id` (rel), `is_primary` (boolean), `status` (select: pending, connected, error). |
| `Stores` (Tenants) | MODIFY | Add `payment_cod` (bool), `payment_qr` (bool), `qr_image` (upload rel). |

## 8. Error Handling Matrix

| Error | HTTP Code | User Message | Recovery |
|-------|-----------|-------------|----------|
| DNS_NOT_PROPAGATED | 400 | DNS records not found. Please wait 24h. | Wait and click "Verify" again. |
| DOMAIN_TAKEN | 409 | This domain is already in use. | Contact support to claim domain ownership. |
| MAX_STAFF_LIMIT | 403 | Upgrade your plan to invite more staff. | Go to billing. |

## 9. Security Considerations

- [x] Auth required? → JWT (Payload). Staff API routes must verify `req.user` owns the `tenant_id`.
- [x] Tenant-scoped access? → Payload Access Control functions must block staff from fetching/modifying data outside their `tenant_id` or `permissions` scope.
- [x] Input validation? → Zod schemas for domain format and email.
- [x] Rate limiting? → Invites API limited to prevent email spam.

## 10. Performance Considerations

- [x] SSR vs CSR → Settings pages can be CSR client components fetching via SWR for fast toggling, or use React Server Components for initial load.
- [ ] Caching strategy → Domain verification endpoint should not be cached.
- [x] Bundle impact → QR upload requires lightweight image compression before send.

## 11. Testing Strategy

| Type | What to Test | Tool |
|------|-------------|------|
| Unit | Domain validation regex | Jest |
| Integration | Payload Payload access control rules (RBAC) | Jest + Payload Test Config |
| E2E | Multi-tenant domain rewrite in Next.js Middleware | Playwright |

## 12. Migration / Rollback Plan

- **Migration**: Deploy Payload schema updates. Setup External Domains API tokens in Env.
- **Rollback**: Revert Next.js Middleware changes if custom domain routing fails for the default `*.echprime.com` domains.
