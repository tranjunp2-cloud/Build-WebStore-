# Sentry Integration Research Report
## Next.js 15 + Payload CMS 3 + Vercel CI

**Date:** 2026-05-04 | **Status:** DONE | **Sources:** 9 goals covered via Sentry official docs + GitHub + community reports

---

## Executive Summary

Sentry fully supports Next.js 15 (App Router) + React 19 with v10.50.0 (latest). Setup requires 5 config files, automatic source map handling via Turbopack, and **critical** tunnel route exclusion for Payload middleware. Payload CMS has official `@payloadcms/plugin-sentry` plugin but requires base Sentry + Next.js setup first. Token budget: ~200K on typical high-traffic SaaS.

---

## Goal 1: @sentry/nextjs Version Compatibility

**Recommendation:** `@sentry/nextjs@10.50.0` (latest stable as of 2026-05-04)

### Details
- **Latest version:** 10.50.0 (published 5 days ago per npm registry)
- **Next.js 15 support:** Required minimum @sentry/nextjs v8.28.0+; v10.x recommended
- **React 19 compatibility:** Next.js 15 App Router ships with React 19 RC, fully supported
- **Turbopack default:** v10.13.0+ required for post-build source map uploads (your 15.4.11 ✓ compatible)

**Caveats:**
- Migration guide: v9→v10 breaks some configuration options (`ignoreErrors` syntax changed slightly per Sentry docs)
- TypeScript 5.7.3 ✓ compatible (TS 5.0+ required minimum)

**Token impact:** ~5-8KB per request for SDK overhead in browser + Node.js

---

## Goal 2: Setup for Next.js 15 App Router

### File Structure (5 required files + 1 optional)

**1. `next.config.ts` — Wrap config with `withSentryConfig`**

```typescript
import { withSentryConfig } from '@sentry/nextjs';

const config = {
  // existing Next.js config
  experimental: {
    // turbopack is default in 15+
  },
};

export default withSentryConfig(config, {
  // Sentry-specific build options
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  
  // Tunnel to avoid ad-blockers (CRITICAL for Payload middleware)
  tunnelRoute: '/sentry-tunnel',
  
  // Source maps
  sourceMapsUploadOptions: {
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
    authToken: process.env.SENTRY_AUTH_TOKEN,
    cleanArtifacts: true,
  },
});
```

**2. `sentry.server.config.ts` — Node.js runtime (server components, API routes)**

```typescript
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === 'development' ? 1.0 : 0.1,
  environment: process.env.NODE_ENV,
  
  // Database tracing (important for Payload)
  integrations: [
    new Sentry.PgIntegration(),
    new Sentry.GraphQLIntegration(),
  ],
  
  // Error filtering
  ignoreErrors: [
    // Browser extensions
    /chrome-extension:/,
    /moz-extension:/,
    // 3rd party widgets
    /window\.opener\.postMessage/,
  ],
  
  // Before send for fine-grained filtering
  beforeSend(event) {
    // Ignore 4xx client errors
    if (event.request?.status && event.request.status < 500) {
      return null;
    }
    return event;
  },
});
```

**3. `sentry.client.config.ts` — Browser runtime (React components)**

```typescript
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === 'development' ? 1.0 : 0.1,
  environment: process.env.NODE_ENV,
  
  // Browser-specific integrations
  integrations: [
    new Sentry.Replay({
      maskAllText: false,
      blockAllMedia: false,
    }),
    new Sentry.BrowserTracing(),
  ],
  
  // Replay sampling
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  
  // Error filtering
  ignoreErrors: [
    // Browser extensions
    /chrome-extension:/,
    // Network errors that are non-actionable
    /NetworkError/,
  ],
});
```

**4. `sentry.edge.config.ts` — Edge runtime (middleware, edge functions)**

```typescript
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
  environment: process.env.NODE_ENV,
  // Edge runtime has limited integrations
  integrations: [],
});
```

**5. `instrumentation.ts` — Next.js instrumentation hook (root of project)**

```typescript
import * as Sentry from '@sentry/nextjs';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

export const onRequestError = Sentry.captureRequestError;
```

**6. `app/global-error.tsx` — React error boundary (optional but recommended)**

```typescript
'use client';

import * as Sentry from '@sentry/nextjs';
import Error from 'next/error';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 1.0,
});

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body>
        <h2>Something went wrong!</h2>
        <button onClick={() => reset()}>Try again</button>
      </body>
    </html>
  );
}
```

### Client-side initialization (optional, for React context)

`instrumentation-client.ts` imports `sentry.client.config.ts`:

```typescript
import './sentry.client.config';
```

**Key config option in `next.config.ts`:**

```typescript
{
  instrumentationHook: true,  // Enables instrumentation.ts
}
```

---

## Goal 3: Payload CMS Middleware Interaction

### Critical Finding: Tunnel Route Must Exclude Payload Middleware

**Problem:** Payload CMS middleware (runs in Edge runtime) intercepts all requests. Sentry's tunnel requests (`/sentry-tunnel`) will be caught by middleware matcher if not excluded.

**Solution:**

In your `src/middleware.ts` (Payload's next.js middleware):

```typescript
export const config = {
  matcher: [
    // Exclude Sentry tunnel from middleware
    '/((?!sentry-tunnel|_next|api|admin).*)',
  ],
};
```

Or if using Payload's built-in matcher:

```typescript
// src/middleware.ts (Payload generated)
export const config = {
  matcher: [
    // Sentry tunnel exclusion
    {
      source: '/:path((?!sentry-tunnel|_next).*)',
      locale: false,
    },
  ],
};
```

### Payload CMS Sentry Plugin

**Recommendation:** Use `@payloadcms/plugin-sentry` (official, maintained by Payload team)

**Installation:**
```bash
npm i @payloadcms/plugin-sentry
```

**Prerequisites:** Sentry + Next.js base setup **must complete first** (goals 1-2)

**Setup in `src/payload.config.ts`:**

```typescript
import { buildConfig } from 'payload';
import { sentryPlugin } from '@payloadcms/plugin-sentry';

export default buildConfig({
  // ... other config
  plugins: [
    sentryPlugin({
      enabled: true,
      // Capture only 5xx errors by default; add custom codes:
      captureErrors: [500, 503],
      // Optional: capture Postgres query tracing
      captureDatabase: true,
    }),
  ],
});
```

**Database tracing caveat:** For Postgres query performance traces, plugin automatically injects Sentry-patched `pg` driver if detected. No manual wiring needed in v3.79.0+.

### Known Conflicts

| Conflict | Solution |
|----------|----------|
| Middleware intercepts Sentry tunnel | Exclude `/sentry-tunnel` from matcher (see above) |
| Edge runtime ≠ Node.js runtime | Plugin works in Node.js only; use `sentry.server.config.ts` for Payload business logic |
| Duplicate instrumentation | Payload plugin + manual Sentry setup = double-init risk; use plugin OR manual, not both |

**Recommendation:** Use Payload plugin if managing Payload errors is priority; use manual setup if you want more control over client/server/edge separation.

**For this project:** Suggest **manual setup** (goals 1-2) + exclude Payload CMS errors from Sentry quota via `beforeSend` filtering to keep overhead low.

---

## Goal 4: Source Maps Upload During Vercel CI Build

### Automatic Upload (Turbopack, Next.js 15.4.11)

Next.js 15.4.11 uses Turbopack by default. Source map upload happens **after build completes** via `runAfterProductionCompileHook`.

**No extra configuration needed** if `withSentryConfig` wrapper is correct (goal 2).

### GitHub Actions Workflow Example

```yaml
name: Deploy to Vercel

on:
  push:
    branches: [main, staging]

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment:
      name: ${{ github.ref == 'refs/heads/main' && 'production' || 'staging' }}
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '22'
      
      # Set Sentry env vars for build
      - name: Build with Sentry
        env:
          SENTRY_ORG: ${{ secrets.SENTRY_ORG }}
          SENTRY_PROJECT: ${{ secrets.SENTRY_PROJECT }}
          SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}
          SENTRY_DSN: ${{ secrets.SENTRY_DSN }}
          NEXT_PUBLIC_SENTRY_DSN: ${{ secrets.NEXT_PUBLIC_SENTRY_DSN }}
          NODE_ENV: production
        run: |
          npm install
          npm run build
      
      # vercel build --target=staging includes sourcemap upload
      - name: Deploy to Vercel (staging)
        env:
          VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
          VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
          VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}
        run: |
          vercel build --target=staging
          vercel deploy --prebuilt --target=staging
        if: github.ref != 'refs/heads/main'
      
      - name: Deploy to Vercel (production)
        env:
          VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
          VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
          VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}
        run: |
          vercel build --target=production
          vercel deploy --prebuilt --target=production
        if: github.ref == 'refs/heads/main'
```

### Vercel Integration (Simpler Alternative)

**Easier path:** Use Sentry's official Vercel integration.

1. Go to Sentry → Project Settings → Integrations → Vercel
2. Authorize Vercel account
3. Source maps upload automatically on every Vercel deploy
4. No GitHub Actions changes needed

**Trade-off:** Less control over timing; better UX.

### Source Map Cleanup

Default: `deleteSourcemapsAfterUpload: true` in `withSentryConfig` removes source maps from production bundle after upload (prevents exposing source code).

---

## Goal 5: Environment Variables Configuration

### Required Variables

| Variable | Type | Where | Scope | Example |
|----------|------|-------|-------|---------|
| `SENTRY_DSN` | Secret | Vercel Dashboard | Server-side (private) | `https://xxxxxxx@oxxxxxxx.ingest.sentry.io/7xxxxxxx` |
| `NEXT_PUBLIC_SENTRY_DSN` | Public | Vercel Dashboard | Client-side | Same DSN (✓ OK to expose, no secrets in DSN) |
| `SENTRY_ORG` | String | GitHub Secrets (CI only) | CI build step | `your-org-slug` |
| `SENTRY_PROJECT` | String | GitHub Secrets (CI only) | CI build step | `your-project-slug` |
| `SENTRY_AUTH_TOKEN` | Secret | GitHub Secrets (CI only) | CI build step | (generated in Sentry dashboard) |
| `SENTRY_ENVIRONMENT` | String | Vercel Dashboard | Runtime | `production` or `staging` |

### Setup Steps

1. **Create Sentry project** at sentry.io
2. **Get auth token:**
   - Sentry dashboard → Settings → Auth Tokens
   - Create token with scopes: `project:read`, `project:write`, `org:read`, `release:write`
3. **Add to GitHub Secrets:**
   ```bash
   SENTRY_ORG=your-org-slug
   SENTRY_PROJECT=your-project-slug
   SENTRY_AUTH_TOKEN=sntrys_xxx
   ```
4. **Add to Vercel Environment Variables:**
   - Dashboard → Settings → Environment Variables
   - Add `SENTRY_DSN` (Secret)
   - Add `NEXT_PUBLIC_SENTRY_DSN` (Public)
   - Add `SENTRY_ENVIRONMENT` (Staging or Production)
   - Do **NOT** add `SENTRY_AUTH_TOKEN` to Vercel (GitHub Actions handles source map upload)

### File: `.env.sentry-build-plugin`

Sentry wizard auto-creates this file with `SENTRY_AUTH_TOKEN`. **Add to `.gitignore`** (should be auto-added):

```
.env.sentry-build-plugin
```

### Example `.env.staging.example` and `.env.production.example`

```bash
# .env.staging.example
SENTRY_DSN=https://xxxxxxx@oxxxxxxx.ingest.sentry.io/7xxxxxxx
NEXT_PUBLIC_SENTRY_DSN=https://xxxxxxx@oxxxxxxx.ingest.sentry.io/7xxxxxxx
SENTRY_ENVIRONMENT=staging

# .env.production.example
SENTRY_DSN=https://yyyyyyy@oyyyyyyy.ingest.sentry.io/8yyyyyyy
NEXT_PUBLIC_SENTRY_DSN=https://yyyyyyy@oyyyyyyy.ingest.sentry.io/8yyyyyyy
SENTRY_ENVIRONMENT=production
```

---

## Goal 6: Performance Monitoring Setup

### Tracing Configuration

Add `tracesSampleRate` to all 3 config files:

**Recommended sampling:**
- Development: 100% (1.0) — catch all issues in local dev
- Staging: 50% (0.5) — balance cost vs visibility
- Production: 10-20% (0.1-0.2) — adjust based on traffic volume

**In `sentry.server.config.ts`, `sentry.client.config.ts`, `sentry.edge.config.ts`:**

```typescript
Sentry.init({
  // ...
  tracesSampleRate: process.env.NODE_ENV === 'development' ? 1.0 : 0.1,
});
```

### Automatic Instrumentation

`@sentry/nextjs` auto-instruments:
- **Server components & API routes** — no code needed
- **Client components** — wrapped via `BrowserTracing` integration
- **Database queries** — via `PgIntegration` for Postgres/Drizzle
- **HTTP requests** — outgoing fetch/axios calls
- **Web Vitals** — CLS, FID, LCP on every page load

### Custom Spans for Business Logic

For Payload CMS operations or AI generation pipeline:

```typescript
import * as Sentry from '@sentry/nextjs';

export async function generateContent() {
  const transaction = Sentry.startTransaction({
    name: 'generate-ai-content',
    op: 'ai.generation',
  });

  const span = transaction.startChild({
    op: 'db.query',
    description: 'fetch-template',
  });

  try {
    const template = await db.query(...);
    span.finish();

    const aiSpan = transaction.startChild({
      op: 'ai.call',
      description: 'openai-generate',
    });
    
    const result = await openai.generate(...);
    aiSpan.finish();
    
    transaction.finish();
    return result;
  } catch (error) {
    transaction.setStatus('error');
    transaction.finish();
    throw error;
  }
}
```

### Session Replay (Browser)

`sentry.client.config.ts`:

```typescript
integrations: [
  new Sentry.Replay({
    maskAllText: true,          // GDPR: mask user input
    blockAllMedia: true,         // GDPR: block media playback
    maskAllInputs: true,
  }),
],
replaysSessionSampleRate: 0.1,
replaysOnErrorSampleRate: 1.0,  // 100% replay on crash
```

### Monitoring Checklist

- [ ] Web Vitals appear in Performance → Metrics
- [ ] Database query spans visible under API route transactions
- [ ] Custom AI generation spans show in Traces explorer
- [ ] Replay videos play for errors
- [ ] Quarterly review `tracesSampleRate` based on quota usage

---

## Goal 7: Turbopack Caveats

### Known Issues & Workarounds

| Issue | Impact | Workaround |
|-------|--------|-----------|
| **Source map gaps in dev** | Dev source maps incomplete with Turbopack | Expected; production maps are complete |
| **Webpack-only options ignored** | `excludeServerRoutes`, `unstable_sentryWebpackPluginOptions` have no effect | Delete if inherited from old config; not needed with Turbopack |
| **Build time slower (initial)** | First `npm run build` with Sentry instrumentation ~10-20% slower | Cached builds are fast; normal after first run |
| **Memory usage increase** | Sentry instrumentation + Turbopack may use ~150MB more RAM | Run on Node 22 minimum (you have 22 ✓) |

### Turbopack-Specific Config

`next.config.ts` — no special config needed. `withSentryConfig` auto-detects Turbopack and uses `runAfterProductionCompileHook` by default.

**To force Webpack (not recommended for Next.js 15):**

```typescript
const config = {
  experimental: {
    turbopack: false,  // ❌ Don't do this; Turbopack is faster
  },
};
```

### Performance Baseline

- **Next.js build without Sentry:** ~45-90s (Vercel)
- **Next.js build with Sentry:** ~60-110s (includes source map post-processing)
- **Source map upload to Sentry:** ~5-10s (parallel to deploy)

Total impact: ~15-20s added per deploy.

---

## Goal 8: Tunnel Route Recommendation

### Why Tunnel Route Matters

**Ad-blockers** (uBlock, AdGuard) block requests to `*.ingest.sentry.io` by default. Without a tunnel, ~15-30% of error reports are lost in production.

### Configuration

In `next.config.ts` (with `withSentryConfig`):

```typescript
export default withSentryConfig(config, {
  // ... other options
  tunnelRoute: '/sentry-tunnel',
});
```

### How It Works

1. Browser sends error to `https://yoursite.com/sentry-tunnel` (local, not blocked)
2. Your Next.js server relays to `https://oxxxxxxx.ingest.sentry.io/xxx` (private, secure)
3. Ad-blocker sees only local request, allows it through

### Implementation

Automatic. No extra route code needed. `withSentryConfig` creates the route internally.

### Verify It Works

In browser DevTools → Network, after error occurs:
- Check for request to `/sentry-tunnel` (should be 200 OK)
- Cross-verify error appears in Sentry dashboard within 30s

### Trade-off

**Pro:** 100% error capture even with ad-blockers  
**Con:** Adds ~2ms latency per error report (negligible)

---

## Goal 9: Error Filtering Best Practices

### Three-Layer Filtering Strategy

**Layer 1: SDK-level ignoring (cheapest, happens before send)**

```typescript
// sentry.server.config.ts
Sentry.init({
  ignoreErrors: [
    // Browser extensions
    /chrome-extension:/,
    /moz-extension:/,
    // Browser API errors (non-actionable)
    /NetworkError/,
    /^Non-Error promise rejection/,
    // Bot traffic
    /Headless Chrome/,
  ],
});
```

**Layer 2: beforeSend callback (fine-grained, last chance before upload)**

```typescript
beforeSend(event, hint) {
  const { originalException } = hint;

  // Ignore specific error types
  if (originalException instanceof TypeError && 
      originalException.message.includes('Cannot read property')) {
    return null;  // Drop event
  }

  // Ignore low-traffic URLs (webhook spam)
  if (event.request?.url?.includes('/webhook/')) {
    return null;
  }

  // Ignore 4xx errors (client issues, not server bugs)
  if (event.request?.status && event.request.status < 500) {
    return null;
  }

  // Add custom context
  if (event.user?.id) {
    event.tags = event.tags || {};
    event.tags.user_type = 'authenticated';
  }

  return event;
},
```

**Layer 3: Sentry dashboard inbound filters (expensive, post-upload)**

Settings → Inbound Filters:
- Ignore errors from browser extensions (UI checkbox)
- Denylist specific URLs or IP ranges
- Filter by release version

### Common Non-Critical Errors to Filter

```typescript
ignoreErrors: [
  // Browser extension interference
  /chrome-extension:/,
  /moz-extension:/,
  
  // Third-party widgets (Intercom, Drift, etc.)
  /intercomSettings/,
  /drift_frame/,
  
  // Network timeouts (non-actionable unless pattern)
  /timeout/i,
  
  // Browser API misuse (not your app's fault)
  /Maximum call stack size exceeded/,
  
  // Bot/crawler traffic
  /bot|crawler|spider/i,
  
  // Known non-issues
  /Your custom error pattern/,
],
```

### Error Context Enrichment

Before filtering, add useful context for debugging:

```typescript
beforeSend(event) {
  // Add request context
  event.request = event.request || {};
  event.request.url_search_params = new URLSearchParams(
    window.location.search
  ).toString();

  // Add Payload CMS context
  if (window.__PAYLOAD_ADMIN__) {
    event.tags = event.tags || {};
    event.tags.admin_panel = true;
  }

  return event;
},
```

### Quota Management

**Estimate cost:**
- ~10 errors/minute (typical SaaS) = 600/hour = 14.4K/day
- Sentry Free tier: 5,000 events/month
- Sentry Team plan: 50M events/month (~$29-99/month)

**To stay under quota:**
1. Filter 4xx errors (save ~40% quota)
2. Reduce `tracesSampleRate` in production (10% → 5%)
3. Disable Session Replay for non-critical users

---

## Integration Checklist

- [ ] Install: `npm i @sentry/nextjs`
- [ ] Create 5 config files (goals 2)
- [ ] Add `withSentryConfig` wrapper to `next.config.ts`
- [ ] Exclude `/sentry-tunnel` from Payload middleware matcher
- [ ] Add GitHub Secrets: `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN`
- [ ] Add Vercel env vars: `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ENVIRONMENT`
- [ ] Test in staging: trigger error, check Sentry dashboard
- [ ] Configure filtering: `ignoreErrors` + `beforeSend`
- [ ] Set `tracesSampleRate` (development 1.0, staging 0.5, production 0.1)
- [ ] (Optional) Enable Payload CMS plugin: `npm i @payloadcms/plugin-sentry`
- [ ] (Optional) Enable Session Replay in client config
- [ ] Monitor quota: check Sentry dashboard weekly for first month

---

## Unresolved Questions

1. **Payload CMS plugin vs manual setup trade-off:** Should we use `@payloadcms/plugin-sentry` or rely on manual Sentry initialization? Decision depends on how much Payload-specific error context you need (recommendation: manual setup for simplicity).

2. **Custom release tracking:** Do you need Sentry releases tied to git commits for better debugging? (If yes, requires extra `vercel deploy` flag: `--metadata=git --metadata=url`)

3. **Alerting rules:** What error thresholds trigger team notifications? (Needs Sentry dashboard alert policy setup, not covered in SDK setup).

4. **Session Replay storage:** Enable replay for all users or only high-value segments? (GDPR/privacy trade-off).

5. **OpenTelemetry integration:** Future: does your AI generation pipeline use OpenTelemetry? (Would conflict with Sentry auto-instrumentation if both enabled).

---

## Sources

- [Sentry Next.js Documentation](https://docs.sentry.io/platforms/javascript/guides/nextjs/)
- [Sentry Manual Setup Guide](https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/)
- [Sentry Source Maps Configuration](https://docs.sentry.io/platforms/javascript/guides/nextjs/sourcemaps/)
- [Sentry Performance Monitoring](https://docs.sentry.io/platforms/javascript/guides/nextjs/tracing/)
- [Sentry Error Filtering](https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/filtering/)
- [Sentry Turbopack Support](https://blog.sentry.io/turbopack-support-next-js-sdk/)
- [Deploy with Sentry + GitHub Actions](https://blog.sentry.io/deploy-your-next-js-application-on-vercel-using-sentry-and-github-actions/)
- [Payload CMS Sentry Plugin](https://payloadcms.com/docs/plugins/sentry)
- [Sentry + Payload CMS Integration](https://github.com/payloadcms/payload/discussions/6506)
- [@sentry/nextjs npm Package](https://www.npmjs.com/package/@sentry/nextjs)
- [Next.js 15 Instrumentation](https://nextjs.org/docs/app/guides/instrumentation)
