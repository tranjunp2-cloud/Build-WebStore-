# Phase 6: Verify + Load Test + Cleanup

## Context
- Parent: [plan.md](plan.md)
- Dependencies: Phase 1-5 complete
- **Day 4** | **Priority:** P1 | **Status:** ⬜ pending

## Steps

### 6.1 E2E Test Checklist
- [ ] Login/logout works
- [ ] OTP email arrives
- [ ] Admin panel (`/admin`) loads
- [ ] Dashboard loads
- [ ] Create new site (AI builder)
- [ ] Edit site (editor)
- [ ] Publish site
- [ ] View published site via subdomain
- [ ] Notifications arrive (polling)
- [ ] Stripe checkout works (nếu configured)
- [ ] File upload (S3) works
- [ ] Custom domain routing works
- [ ] Mobile responsive

### 6.2 Load Test (200 Concurrent)
```bash
# Install k6
brew install k6

# Run load test
k6 run --vus 200 --duration 5m load-test.js
```

Test scenarios:
- [ ] 200 users view published sites simultaneously
- [ ] 50 users in editor simultaneously
- [ ] 20 users trigger AI generation
- [ ] Check: p95 response time < 2s
- [ ] Check: error rate < 1%
- [ ] Check: Vercel function errors = 0

### 6.3 Monitor Vercel Metrics
- [ ] Vercel Dashboard → Analytics
- [ ] Check: Function duration (p95 < 5s)
- [ ] Check: Cold start frequency
- [ ] Check: Build minutes usage
- [ ] Check: Bandwidth usage

### 6.4 Cleanup DO (sau 1 tuần stable)
- [ ] ⚠️ **CHỜ 1 TUẦN** trước khi xóa DO resources
- [ ] Backup DO database lần cuối
- [ ] Scale down DO app → basic tier (save cost while keeping as backup)
- [ ] Sau 1 tuần OK → Delete DO app
- [ ] Sau 1 tuần OK → Delete DO dev-database
- [ ] Cancel DO billing

### 6.5 Update Documentation
- [ ] `CLAUDE.md` — update deploy instructions, bỏ Docker sections
- [ ] `.github/CONTRIBUTING.md` — update workflow
- [ ] `.github/GIT_AND_CI_RULES.md` — update deploy info
- [ ] README — update setup instructions

## Dò Lỗi

| Lỗi | Nguyên nhân | Fix |
|-----|-------------|-----|
| Load test fail ở 100 users | Neon connection limit | Upgrade Neon hoặc add connection pooling |
| Cold start > 5s | Large bundle | Optimize imports, reduce serverless function size |
| Vercel function timeout 60s | AI generation too slow | Add streaming response hoặc background job |
| High error rate | Missing env var hoặc DB issue | Check Vercel logs, verify all env vars |
| DO delete fails | Active deployments | Cancel all deployments first |

## Rollback Checklist (nếu cần quay lại DO)
1. DNS: switch CNAME back to DO app URL
2. Wait 5 min DNS propagation
3. DO app vẫn running → traffic flows to DO
4. Investigate Vercel issue
5. Fix → DNS switch back to Vercel

## Success Criteria
- [ ] All E2E tests pass
- [ ] Load test: 200 concurrent, p95 < 2s, error < 1%
- [ ] Vercel stable 1 tuần
- [ ] DO cleaned up
- [ ] Documentation updated
- [ ] **Cost: $20/mo (confirmed)**
