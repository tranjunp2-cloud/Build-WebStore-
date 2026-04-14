# Research: DO→Vercel Migration Checklist

## Files to REMOVE
| File | Lines | Reason |
|------|-------|--------|
| `.do/app.yaml` | 152 | DO App Platform spec |
| `.github/scripts/sync-do-envs.py` | 172 | DO env sync script |

## Files to MODIFY
| File | Change | Risk |
|------|--------|------|
| `scripts/db-setup.js` | Build command thay Docker CMD | HIGH |
| `src/payload.config.ts` | Bỏ HOSTNAME=0.0.0.0 check, SSL config cho Neon | MEDIUM |
| `.github/workflows/ci.yml` | Bỏ Docker build step, DO deploy steps | MEDIUM |
| `src/middleware.ts` | Bỏ 0.0.0.0 exclusion | LOW |
| `.env.*.example` | Bỏ DO_API_TOKEN, DO_APP_ID, SERVER_IP | LOW |
| `CLAUDE.md` | Update deploy instructions | LOW |

## Files KEEP (no change)
- Dockerfile (local dev only)
- src/app/api/health/ (compatible)
- Domain settings UI (unrelated to DO)
- All tests

## Critical Path
Current: Docker CMD → db-setup.js → server start
New: Vercel buildCommand → db-setup.js → next build → deploy

## Total: ~450 lines DO-specific code to remove/change
