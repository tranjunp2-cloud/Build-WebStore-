# Phase 4: DNS Migration + Domains

## Context
- Parent: [plan.md](plan.md)
- Dependencies: Phase 3 (Vercel deploy working)
- **Day 2** | **Priority:** P0 | **Status:** ⬜ pending

## Steps

### 4.1 Add Domains to Vercel
Vercel Dashboard → Project → Settings → Domains:

- [ ] Add: `web-v2.dev.ecommercehub.my` (primary)
- [ ] Add: `web-cms-v2.dev.ecommercehub.my` (admin alias)
- [ ] Add: `*.web-v2.dev.ecommercehub.my` (wildcard subdomain)
- [ ] Vercel shows required DNS records (CNAME)

### 4.2 Update DNS Records (AWS Route 53)
AWS Console → Route 53 → Hosted Zones → ecommercehub.my:

```
# TRƯỚC (pointing to DO)
web-v2.dev.ecommercehub.my         CNAME  do-app-xxx.ondigitalocean.app
*.web-v2.dev.ecommercehub.my       CNAME  do-app-xxx.ondigitalocean.app
web-cms-v2.dev.ecommercehub.my     CNAME  do-app-xxx.ondigitalocean.app

# SAU (pointing to Vercel)
web-v2.dev.ecommercehub.my         CNAME  cname.vercel-dns.com
*.web-v2.dev.ecommercehub.my       CNAME  cname.vercel-dns.com
web-cms-v2.dev.ecommercehub.my     CNAME  cname.vercel-dns.com
```

- [ ] Update primary domain CNAME
- [ ] Update wildcard CNAME
- [ ] Update admin domain CNAME
- [ ] Wait DNS propagation (5-30 min)

### 4.3 Verify SSL
- [ ] Vercel auto-provisions SSL certificates
- [ ] Check: `https://web-v2.dev.ecommercehub.my` — valid SSL ✅
- [ ] Check: `https://mystore.web-v2.dev.ecommercehub.my` — wildcard SSL ✅
- [ ] Check: `https://web-cms-v2.dev.ecommercehub.my` — admin SSL ✅

### 4.4 Update Env Vars
- [ ] `NEXT_PUBLIC_SERVER_URL` → `https://web-v2.dev.ecommercehub.my`
- [ ] `NEXT_PUBLIC_APP_URL` → `https://web-v2.dev.ecommercehub.my`
- [ ] Redeploy để pick up new URLs

### 4.5 Update Stripe Webhook
- [ ] Stripe Dashboard → Developers → Webhooks
- [ ] Update endpoint URL: `https://web-v2.dev.ecommercehub.my/api/webhooks/stripe`
- [ ] Test webhook: Stripe Dashboard → "Send test webhook"
- [ ] Verify: webhook received OK

### 4.6 Custom Domain Handling
- [ ] Middleware domain check: update nếu cần (bỏ DO internal URLs)
- [ ] Test: subdomain routing works (`mystore.web-v2.dev...`)
- [ ] Test: admin routing works (`web-cms-v2.dev...`)

## ⚠️ Downtime Window
DNS switch = **5-30 phút downtime** (propagation).
- Làm ngoài giờ cao điểm (10PM-6AM)
- Hoặc: giảm DNS TTL xuống 60s trước 24h → switch → restore TTL

## Dò Lỗi

| Lỗi | Nguyên nhân | Fix |
|-----|-------------|-----|
| SSL certificate pending | DNS chưa propagate | Wait 30min, check `dig CNAME domain` |
| Wildcard SSL fail | Cần dùng Vercel nameservers | Hoặc add wildcard domain explicitly trong Vercel |
| Redirect loop | Unlikely with Route 53 (no proxy) | Check Vercel domain settings |
| Stripe webhook fail | Old URL still in Stripe | Update endpoint URL in Stripe Dashboard |
| Subdomain 404 | Middleware không detect tenant | Check middleware hostname matching logic |
| Old DO URL still works | DNS cache | Clear DNS cache, wait TTL expire |

## Rollback
- Switch DNS CNAME back to DO → 5 phút recovery
- DO app vẫn running (keep 1 tuần)

## Success Criteria
- [ ] All 3 domains resolve to Vercel
- [ ] SSL valid on all domains
- [ ] Wildcard subdomains work
- [ ] No redirect loops
- [ ] Admin panel accessible via admin domain
