# Phase 3: Setup Vercel Projects + Deploy

## Context
- Parent: [plan.md](plan.md)
- Dependencies: Phase 1 (Neon ready) + Phase 2 (code changes pushed)
- **Day 2** | **Priority:** P0 | **Status:** ⬜ pending

## Steps

### 3.1 Tạo Vercel Account + Team
- [ ] Đăng ký https://vercel.com (GitHub login)
- [ ] Upgrade Pro Plan ($20/mo)
- [ ] Tạo team: `primeproduction`

### 3.2 Import Project: prime-web-v2
- [ ] Vercel Dashboard → "Add New Project"
- [ ] Import from GitHub: `primeproduction/ech-prime-web-v2`
- [ ] Framework: Next.js (auto-detect)
- [ ] Root directory: `/` (default)
- [ ] Build Command: `node scripts/db-setup.js --migrate-only && next build`
- [ ] Output Directory: `.next` (default)

### 3.3 Set Environment Variables
Vào Project Settings → Environment Variables:

**Tất cả environments (Production + Preview + Development):**
```
DATABASE_URI = postgresql://user:pass@ep-xxx.neon.tech/primeweb?sslmode=require
PAYLOAD_SECRET = [copy from GitHub Secrets]
NEXT_PUBLIC_SERVER_URL = https://your-vercel-domain.vercel.app (tạm)
NEXT_PUBLIC_PLATFORM_DOMAIN = web-v2.dev.ecommercehub.my
NEXT_PUBLIC_APP_URL = https://web-v2.dev.ecommercehub.my
NEXT_PUBLIC_ADMIN_DOMAIN = web-cms-v2.dev.ecommercehub.my
OPENAI_API_KEY = [copy]
STRIPE_SECRET_KEY = [copy]
STRIPE_WEBHOOK_SECRET = [copy]
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = [copy]
S3_ENDPOINT = [copy]
S3_BUCKET = primeweb-media
S3_ACCESS_KEY_ID = [copy]
S3_SECRET_ACCESS_KEY = [copy]
S3_REGION = ap-southeast-1
LARK_APP_ID = [copy]
LARK_APP_SECRET = [copy]
LARK_ENCRYPT_KEY = [copy]
LARK_VERIFICATION_TOKEN = [copy]
LARK_BOT_OPEN_ID = [copy]
MAIL_DRIVER = smtp
MAIL_HOST = email-smtp.ap-southeast-1.amazonaws.com
MAIL_PORT = 587
MAIL_USERNAME = [copy]
MAIL_PASSWORD = [copy]
MAIL_FROM_NAME = Web Store
MAIL_FROM_ADDRESS = no-reply-web-dev@admin.ecommercehub.unifi.com.my
ECH_DISTRIBUTION_API_URL = [copy]
ECH_DISTRIBUTION_API_KEY = [copy]
```
- [ ] Copy 30+ env vars từ GitHub Secrets / DO dashboard
- [ ] Double-check: không thiếu var nào

### 3.4 First Deploy
- [ ] Click "Deploy" hoặc push to main/staging
- [ ] Watch build logs: db-setup.js → next build
- [ ] Verify build success
- [ ] Check Vercel preview URL: `https://ech-prime-web-v2-xxx.vercel.app`

### 3.5 Import Project: prime-bot-assistant
- [ ] Same process, separate project trong cùng team
- [ ] Env vars riêng cho bot
- [ ] DATABASE_URI → Neon `primebot` database

### 3.6 Verify Both Projects
- [ ] prime-web-v2: `/admin` loads, login works
- [ ] prime-web-v2: frontend site renders
- [ ] prime-bot-assistant: health check passes
- [ ] Both connect Neon DB successfully

## Dò Lỗi

| Lỗi | Nguyên nhân | Fix |
|-----|-------------|-----|
| Build fail: `db-setup.js` error | Neon connection blocked during build | Vercel build IP whitelist, hoặc Neon cho phép all IPs (default) |
| Build fail: `next build` OOM | Build cần > 8GB RAM | Vercel Pro có 8GB build RAM, đủ. Nếu fail → optimize imports |
| Build timeout (>45min) | Too slow | Check db-setup.js không hang. Add timeout. |
| Deploy OK nhưng 500 error | Missing env var | Check Vercel logs → identify missing var |
| `/admin` 404 | Payload admin route not configured | Check `payload.config.ts` admin URL config |
| DB connection timeout | Neon auto-suspend | Neon wakes up trong 1-2s, retry logic trong Payload handles this |
| `ECONNREFUSED` | Wrong connection string | Verify DATABASE_URI format chính xác |

## Success Criteria
- [ ] Both projects deploy successfully on Vercel
- [ ] Build time < 5 minutes
- [ ] All pages load without 500 errors
- [ ] DB queries work (create/read/update)
- [ ] Admin panel accessible
