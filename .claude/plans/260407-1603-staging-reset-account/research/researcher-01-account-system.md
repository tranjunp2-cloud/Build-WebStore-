# ECH Prime Web v2: Account/Auth System Research

## 1. User/Account Storage

**Payload CMS Collections** (`/src/collections/`):
- **Users.ts** (45KB): Platform users; can be super-admins or tenant members
- **Tenants.ts** (10KB): Customer organizations; each tenant owns one or more websites
- Database: PostgreSQL via `@payloadcms/db-postgres` 
- Connection: `DATABASE_URI` env var (handles both local and remote SSL)

## 2. User Data Model & Associations

Users table fields (from collection):
- `email`, `firstName`, `lastName`, `password` (auth)
- `roles`: array (e.g., 'super-admin', 'tenant-owner')
- `tenants`: array of membership objects:
  - `tenant`: object with `id` or string ID
  - `role`: 'owner' | 'admin' | 'custom'
  - `status`: 'pending' | active
  - `permissions`: array (for custom role)

Associated data accessed via tenant membership:
- **Sites.ts**: Websites (multiple per tenant)
- **Pages.ts**: Web pages (multiple per site)
- **Products.ts**: Store products (multi-tenant)
- **Orders.ts**: Customer orders
- **Categories.ts**: Product categories
- **Blogs.ts**, **BlogCategories.ts**: Blog content
- **Media.ts**: File uploads (S3/MinIO storage)
- **Subscribers.ts**, **Subscriptions.ts**: Email list & billing

Access control: Tenants enforce read/update via `access` rules checking `req.user?.tenants` membership.

## 3. Test Account Handling

**No special "test@primeweb.app" logic found.** However:

- **SSO Service account**: `sso-service@primeweb.app` (hardcoded at line 160, Users.ts)
  - Bypasses MFA on login (mints custom JWT with `mfa_verified: true`)
  - Used for internal Payload/SSO integration
- **Bootstrap accounts** (.env):
  - `BOOTSTRAP_ADMIN_EMAIL=admin@primeweb.app` (default)
  - `BOOTSTRAP_ADMIN_PASSWORD=change-me-in-production`
  - `SSO_SERVICE_EMAIL=sso-service@primeweb.app`
  - Auto-created on startup via `db-setup.js`

**Test data approach**: Uses `TEST_EMAIL` and `TEST_PASSWORD` env vars (E2E testing only).

## 4. Environment Detection

No staging vs. production detection in code; relies on environment variables:

**Key NEXT_PUBLIC_* vars** (exposed to client):
- `NEXT_PUBLIC_SERVER_URL`: API endpoint (default: `http://localhost:3000`)
- `NEXT_PUBLIC_PLATFORM_DOMAIN`: Base domain (default: `primeweb.app`)
- `NEXT_PUBLIC_ADMIN_DOMAIN`: Admin domain (default: `admin.{PLATFORM_DOMAIN}`)
- `NEXT_PUBLIC_APP_URL`: App URL (default: `http://localhost:3000`)
- `NEXT_PUBLIC_S3_ENDPOINT`: File storage endpoint

**Environment variables** (.env.example):
- `NODE_ENV`: Set in build/runtime (affects cookie security at line 178, Users.ts)
- `MAIL_HOST`, `MAIL_PORT`: SMTP config (e.g., AWS SES for production)
- Database URIs: No built-in staging detection; uses `DATABASE_URI` directly

**Middleware** (src/middleware.ts):
- Uses `NEXT_PUBLIC_PLATFORM_DOMAIN` to route subdomains
- No explicit staging vs. production flag; relies on domain names

## Key File Paths

- `/src/payload.config.ts` - Payload CMS root config
- `/src/collections/Users.ts` - User collection & auth endpoints
- `/src/collections/Tenants.ts` - Tenant/workspace collection
- `/src/collections/Sites.ts`, `Pages.ts` - Site/page collections
- `/src/collections/*.ts` - All domain models (Orders, Products, Media, etc.)
- `/src/lib/auth.ts` - Auth utility library
- `/src/middleware.ts` - Next.js middleware (subdomain routing)
- `.env.example` - Environment template
- `.env.staging.example` - Staging-specific example

## Observations

- No explicit "staging mode" flag; uses environment variables for detection
- Multi-tenant isolation enforced via access control queries
- JWT tokens bypass MFA only for `sso-service@primeweb.app` (hardcoded exception)
- S3 storage supports both AWS S3 and MinIO (path-style) configs
- Welcome emails sent on user creation (unless invited/SSO-provisioned)
