---
owner: PM
last_updated: 2026-04-19
---

# Open Blockers

Active blockers across v1.0 stabilization and v1.1 prep. Update weekly (every Friday PM sync) or after any incident is resolved.

Source of truth: Lark `[PrimeWeb - V2] — CI/CD` + GitHub issues labelled `blocker`.

## Security / Secrets

- 🔐 **Key rotation pending** — DO Spaces + Unsplash keys leaked in session history 2026-04-15 (`S3_ACCESS_KEY_ID=YGVGOA5T...`, `S3_SECRET_ACCESS_KEY=yh7QWHOD...`, `UNSPLASH_ACCESS_KEY=u65JQqw-...`). Rotate before prod launch.
- 🔐 **Production S3 setup** — Create `tm-prime-web-prod` bucket on DO Spaces, generate prod-only credentials, apply public-read policy. See `.claude/rules/env-vars.md` for Vercel add procedure.

## Runtime bugs (staging)

- 🐛 **SSO JWT mismatch** — `/api/v1/sso/provision` logs `signature verification failed`; JWT secret mismatch with `web-cms-v2.dev.ecommercehub.my`.
- 🐛 **AI gen JSON parse intermittent** — `[AI] OpenAI generation failed: 400 We could not parse JSON body`. Prompt format bug; falls back to legacy `generateBlocks`.
- 🐛 **Structure Enforcer gap** — `no library content for required "client-logos"` — seed data missing logos for recipe `biz-proof`.
- ⚠️ **Staging /admin 404** — Server HTML correct but client-side fails.

## Infrastructure

- ⚠️ **Missing Vercel secrets** — Stripe, Lark, ECH credentials not yet added to Vercel Production scope. S3 added 2026-04-15.
- ⚠️ **Coverage below target** — `docs/TEST_CONVENTION.md` deadline 2026-04-15 passed. Targets raised to 70/70/70 on 2026-04-19. Catch-up sprint pending.

## Phase 2 (v1.1) prerequisites

- [ ] v1.0 staging stable (< 10 errors/day sustained for 7 days)
- [ ] Coverage baseline measured + catch-up plan if < 70%
- [ ] Stripe production credentials provisioned
- [ ] MY shipping partner API access confirmed

## Related

- Timeline + priority: `docs/PROJECT_ALIGNMENT.md`
- Changelog: `docs/CHANGELOG.md`
- GitHub milestones: [v1.0](https://github.com/primeproduction/ech-prime-web-v2/milestone/8), [v1.1](https://github.com/primeproduction/ech-prime-web-v2/milestone/9)
