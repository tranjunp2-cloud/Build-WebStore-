# Phase 2: Code Changes — Bỏ Docker Dependencies + SSE→Polling

## Context
- Parent: [plan.md](plan.md)
- Dependencies: Phase 1 ✅ DONE (Neon connection confirmed, SSL strict OK)
- **Day 1** | **Priority:** P0 | **Status:** 🔄 in-progress
- ⚠️ **SSE→Polling moved here** (prediction review: phải fix TRƯỚC first deploy)

## Phase 1 Results (Input for Phase 2)
- **SSL strict**: `rejectUnauthorized: true` works → update payload.config.ts
- **DB**: Neon PostgreSQL 17.8, `neondb` database, 23.3MB / 512MB
- **Latency**: ~312ms (VN → Singapore) — acceptable
- **Connection**: `postgresql://neondb_owner:***@ep-purple-smoke-a1adhdbz.ap-southeast-1.aws.neon.tech/neondb?sslmode=require`

## Implementation Steps

### Step 1: Tạo `vercel.json` [NEW FILE]
```json
{
  "buildCommand": "node scripts/db-setup.js --migrate-only && next build",
  "framework": "nextjs",
  "regions": ["sin1"],
  "functions": {
    "src/app/api/**/*.ts": {
      "maxDuration": 60
    }
  }
}
```

### Step 2: Update `scripts/db-setup.js` — thêm --migrate-only
Thêm handler ở đầu main():
```javascript
const MIGRATE_ONLY = process.argv.includes('--migrate-only')
// ... run migrations ...
if (MIGRATE_ONLY) {
  console.log('✅ Migrations complete, exiting for Vercel build')
  await pool.end()
  process.exit(0)
}
// ... else start server (Docker mode) ...
```

### Step 3: Update `src/payload.config.ts`
- Bỏ `HOSTNAME === '0.0.0.0'` check (line ~64) — Docker-specific
- Update SSL: `rejectUnauthorized: true` (Phase 1 confirmed Neon supports strict SSL)
- Bỏ DigitalOcean Spaces URL detection (line ~158-161)

### Step 4: Update `src/middleware.ts`
- Bỏ `hostname.includes('ondigitalocean.app')` redirect (lines 58-64)
- Bỏ `hostname === '0.0.0.0'` from isDoInternalHost (lines 116-125)
- Thay `isDoInternalHost` → `isPlatformHost` (remove DO naming)

### Step 5: SSE → Polling (NotificationProvider)
**Current:** EventSource → SSE stream → pg LISTEN/NOTIFY
**Target:** setInterval(fetch) → REST endpoint (already exists at `/api/notifications`)

Files cần sửa:
1. **`src/providers/NotificationProvider.tsx`** — Replace EventSource (line 89) with polling:
   - `setInterval(() => fetch('/api/notifications?since=...'), 15000)`
   - Keep toast dispatch logic (CustomEvent)
   - Pause polling when tab hidden (Visibility API)
   - Keep reconnect/error handling

2. **`src/app/api/notifications/stream/route.ts`** — Deprecate:
   - Change `maxDuration: 300` → `maxDuration: 60`
   - Add deprecation comment
   - Keep for backward compat (xóa ở Phase 5)

3. **`src/store/notificationStore.ts`** — No change needed (already compatible)

### Step 6: Update `.env.*.example`
- Remove: `DO_API_TOKEN`, `DO_APP_ID`, `SERVER_IP`
- Update: `DATABASE_URI` example → Neon format
- Keep all other vars (Stripe, S3, Mail, Lark, etc.)

### Step 7: Update CI (`ci.yml`)
Lines to REMOVE:
- Lines 309-363: `deploy-staging` job (DO deploy)
- Lines 368-418: `deploy-production` job (DO deploy)
- Lines 327-331, 382-386: `sync-do-envs.py` calls

Lines to KEEP:
- Lines 1-258: All CI steps (lint, typecheck, test, build, quality metrics)
- Docker build check (lines 107-140) — keep for PR verification
- Notification steps — keep (platform-agnostic)

### Step 8: Update Domain Actions (tạm)
`src/app/(app)/settings/domains/actions.ts`:
- Lines 71-129 (`addCustomDomain`): DO API → comment out, add TODO for Vercel API
- Lines 161-206 (`removeCustomDomain`): DO API → comment out
- Lines 250-290 (`verifyCustomDomain`): DO API → keep DNS lookup (platform-agnostic), remove DO SSL phase check
- Keep: `setPrimaryDomain()`, `clearPrimaryDomain()` (DB-only, no DO deps)

### Step 9: Cleanup files
- Delete: `.github/scripts/sync-do-envs.py`
- Keep: `Dockerfile`, `Dockerfile.dev`, `docker-compose.yml` (local dev)
- Update: `CLAUDE.md` — add Vercel sections, update Docker/DO refs

## Files Changed Summary

| File | Action | Priority |
|------|--------|----------|
| `vercel.json` | CREATE | 🔴 |
| `scripts/db-setup.js` | ADD --migrate-only | 🔴 |
| `src/payload.config.ts` | UPDATE SSL + remove Docker checks | 🔴 |
| `src/middleware.ts` | REMOVE DO hostname checks | 🔴 |
| `src/providers/NotificationProvider.tsx` | REWRITE SSE→polling | 🔴 |
| `src/app/api/notifications/stream/route.ts` | DEPRECATE maxDuration | 🟡 |
| `.env.example`, `.env.staging.example`, `.env.production.example` | UPDATE | 🟡 |
| `.github/workflows/ci.yml` | REMOVE deploy jobs | 🔴 |
| `src/app/(app)/settings/domains/actions.ts` | DISABLE DO API (temporary) | 🟡 |
| `.github/scripts/sync-do-envs.py` | DELETE | 🟡 |
| `CLAUDE.md` | UPDATE | 🟢 |

## Success Criteria
- [ ] `npm run build` works locally với Neon connection
- [ ] `db-setup.js --migrate-only` runs + exits cleanly
- [ ] CI passes (lint + typecheck + test)
- [ ] Không còn `ondigitalocean.app` hoặc `hostname === '0.0.0.0'` trong src/
- [ ] SSE route maxDuration <= 60
- [ ] Polling notifications arrive within 15-30s
- [ ] `grep -r "DO_API_TOKEN\|DO_APP_ID" src/` → 0 matches (trừ domains/actions.ts TODO)

## Risk Assessment
| Risk | Impact | Mitigation |
|------|--------|------------|
| Middleware redirect loop sau bỏ DO check | High | Test localhost trước deploy |
| Notification delay (SSE realtime → 15s polling) | Medium | Acceptable trade-off cho Vercel compat |
| Domain management broken (DO API removed) | Medium | Disable UI tạm, implement Vercel API ở Phase 4 |
| CI deploy jobs removed → no auto-deploy | Low | Vercel GitHub integration auto-deploys |

## Dò Lỗi

| Lỗi | Nguyên nhân | Fix |
|-----|-------------|-----|
| `db-setup.js` không exit | Thiếu `--migrate-only` handler | Thêm process.exit(0) |
| SSL handshake fail | Config sai | `ssl: { rejectUnauthorized: true }` + `?sslmode=require` |
| CI fail sau bỏ deploy jobs | Job dependency broken | Update `needs:` trong ci.yml |
| Middleware redirect loop | Bỏ sai condition | Test middleware trên localhost |
| Notifications không arrive | Polling endpoint bug | Test `/api/notifications?since=...` manually |
