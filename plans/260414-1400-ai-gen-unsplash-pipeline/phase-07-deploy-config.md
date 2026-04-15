# Phase 07 — Deploy config: env vars, Unsplash account, feature flag docs

## Context
- Parent: [plan.md](./plan.md)
- Depends on: phase-01..06 (code must be in to deploy)
- Related: CLAUDE.md §Env vars (GitHub Secrets → DO sync pipeline)
- Research: [researcher-01 §2, §10](./research/researcher-01-unsplash-api.md)

## Overview
- Date: 2026-04-14
- Description: Final ops phase — register Unsplash dev app, add `UNSPLASH_ACCESS_KEY` + `ENABLE_DALLE_HERO` to GitHub Secrets, update env example files, apply for Unsplash production tier (async, 1–3 days), document feature flag in runbook.
- Priority: P1 — must complete before staging rollout
- Implementation: pending
- Review: pending

## Key insights
- **CLAUDE.md workflow:** env vars flow `GitHub Secrets → sync-do-envs.py → DigitalOcean App → container`. Just add to GH Secrets, CI auto-syncs.
- **Unsplash registration:** https://unsplash.com/oauth/applications → "New Application" → accept guidelines → copy Access Key. Demo tier 50/hr is enough for staging QA.
- **Production tier requires a working demo** — apply via dashboard after staging works, include screenshot + 2-liner app description. Approval 1–3 days.
- **Feature flag default:** `ENABLE_DALLE_HERO=false` — means Unsplash is default. For rollback, set to `true` and redeploy (or no redeploy needed if env hot-swap supported by DO app).
- **Do NOT commit real keys** — `.env.example` files use placeholders only (per CLAUDE.md).

## Requirements
- Unsplash app registered, Access Key copied
- GH Secret `UNSPLASH_ACCESS_KEY` set
- GH Secret `ENABLE_DALLE_HERO` set to `false`
- Env example files updated (3 files)
- Feature flag doc in `docs/AI_WEBSITE_GENERATION_GUIDE.md`
- Production tier application submitted (async wait OK)

## Architecture
No code. Ops checklist only.

## Related code files
- `.env.example`
- `.env.staging.example`
- `.env.production.example`
- `docs/AI_WEBSITE_GENERATION_GUIDE.md` (UPDATE)
- `.github/scripts/sync-do-envs.py` (no change — auto-picks new keys)
- `scripts/check-env-vars.js` (no change — auto-picks new keys)

## Implementation steps
1. **Register Unsplash app** (15 min):
   - Go to https://unsplash.com/oauth/applications
   - Click "New Application"
   - Accept API guidelines checklist
   - Name: "ECH Prime Web v2 — AI Site Generator"
   - Description: "Auto-generates website templates for SMB businesses using AI — images sourced from Unsplash as hero/gallery/avatar backgrounds"
   - Copy Access Key (Secret Key not needed for read-only).
2. **Add GH Secrets** (5 min):
```bash
gh secret set UNSPLASH_ACCESS_KEY --body "..."
gh secret set ENABLE_DALLE_HERO --body "false"
```
3. **Update env example files** (5 min):
   - `.env.example`: add `UNSPLASH_ACCESS_KEY=` and `ENABLE_DALLE_HERO=false`
   - `.env.staging.example`: same placeholders
   - `.env.production.example`: same placeholders
4. **Update AI generation guide** (20 min):
   - Add section "Image sourcing" describing Unsplash pipeline
   - Document `ENABLE_DALLE_HERO` flag: "`true` → legacy DALL-E hero only. `false` (default) → Unsplash 8+ images per gen, $0 cost."
   - Rollback instructions: "To revert, set `ENABLE_DALLE_HERO=true` in DO env, no redeploy needed."
5. **Apply for Unsplash Production tier** (5 min + async 1–3 day wait):
   - Dashboard → Applications → select app → "Apply for Production"
   - Form: describe how photos are used, upload screenshot of generated site with Unsplash attribution visible, submit
   - Wait for approval email (1–3 days)
6. **Attribution UI decision** (async — PM call):
   - Option A: footer caption "Images by Unsplash photographers"
   - Option B: alt-text-only with photographer name
   - Option C: admin panel only (not user-facing) — risk-averse
   - Record decision in this file, implement as tiny followup PR if needed
7. **Staging deploy smoke test** (15 min):
   - Deploy branch to staging
   - Generate AI site for beauty category
   - Verify: 8+ images in gen, all hosted on our S3 (not hot-linked), Unsplash rate-limit header logged
8. **Production rollout** (async — after QA sign-off):
   - Merge PR to staging → QA 1–2 days → merge to main

## Todo
- [ ] Unsplash dev app registered
- [ ] Access Key in GH Secrets
- [ ] `ENABLE_DALLE_HERO=false` in GH Secrets
- [ ] 3 env.example files updated with placeholders
- [ ] `docs/AI_WEBSITE_GENERATION_GUIDE.md` documents flag
- [ ] Production tier application submitted
- [ ] Staging smoke test passes
- [ ] Attribution approach decided + documented
- [ ] Rollback path verified (flip flag → restart gen → DALL-E path)

## Success criteria
- [ ] Staging gen produces 8+ images successfully
- [ ] Rate-limit log visible in staging logs
- [ ] Rollback flag works (set `ENABLE_DALLE_HERO=true` → next gen uses DALL-E)
- [ ] CI env-check green (no missing keys)
- [ ] Production tier application has confirmation email

## Risk assessment
- **R1 — Production tier rejected:** mitigation = iterate on app description, add specific use case detail. Demo tier still supports 50/hr = ~20 gens/hr (acceptable for limited beta).
- **R2 — Unsplash account owner = individual dev:** single point of failure if dev leaves. Mitigation = use team email alias, document credentials in 1Password.
- **R3 — Attribution lawsuit risk (edge case):** Unsplash License doesn't require attribution, but API ToS strongly recommends. Mitigation = display caption in footer (Option A). Low risk overall.
- **R4 — Demo-tier rate limit on staging during QA burst:** mitigation = QA throttles to 5 gens/min, or flip to prod-tier key once approved.
- **R5 — Secret leakage in logs:** mitigation = unsplash-client redacts Authorization header (phase-01 requirement).

## Security considerations
- `UNSPLASH_ACCESS_KEY` is GitHub Secret, server-side only, `import 'server-only'` in consumers.
- Key rotation plan: if leaked, revoke in Unsplash dashboard → `gh secret set UNSPLASH_ACCESS_KEY --body "new"` → CI syncs on next deploy.
- No PII in Unsplash queries (no businessName sent — only industry keywords per phase-03 privacy rule).
- Attribution text, if rendered, is plain text — no XSS surface.

## Next steps
After land: monitor gen cost ($0 target), rate-limit logs, image quality via user feedback. Follow-ups:
- Pexels real implementation (currently stub)
- Unsplash photo ID → Media ID cache (avoid re-downloads across tenants)
- Tenant scoping on Media read (flagged in researcher-02 §2)
- Fold `content-injection` into `template-composer` for single source of truth
