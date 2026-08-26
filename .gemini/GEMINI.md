---
trigger: always_on
---

# GEMINI.md — PrimeWeb Project Rules

> This file is auto-loaded by Antigravity/Gemini on every session.
> It enforces the BMAD workflow defined in `SPEC.md §2`.
> **Authority**: `SPEC.md` > this file. If conflict → SPEC.md wins.
>
> ⚠️ KEEP IN SYNC: `.cursorrules`, `.gemini/GEMINI.md`, `CONTRIBUTING.md`
>    must contain the SAME rules. Edit all 3 when changing rules.

---

## 🚨 STOP GATE: MUST READ SPEC.md §1-§2 BEFORE ANY CODE

---

## 🛑 BMAD STOP GATE (HARD RULE — NO EXCEPTIONS)

### Step 1: CLASSIFY the request

| Type | Trigger | Required |
|------|---------|----------|
| **Full BMAD** | "build", "create", "implement" new feature | All 5 gate docs |
| **Quick Flow** | "add field", "simple CRUD" | Short story + 5-min gate |
| **Bug Fix** | "fix", "broken", "error" | Direct fix → test |
| **Infra** | "deploy", "docker", "config" | Direct implement |

### Step 2: BMAD GATE — Verify 5/5 docs exist

```
──────────────────────────────────────────────────
BMAD GATE — Feature: [F{XX}-feature-name]
──────────────────────────────────────────────────
☐ 1. PRD exists?           → docs/prd/F{XX}-{name}.md
      Gherkin AC complete?   PASS ☐ / FAIL ☐

☐ 2. Architecture exists?  → docs/architecture/F{XX}-{name}.md
      Component tree clear?  PASS ☐ / FAIL ☐

☐ 3. UI Mockups exist?     → docs/design/F{XX}-{name}-*.png
      Mobile + Desktop?      PASS ☐ / FAIL ☐

☐ 4. API contracts ready?  → In PRD §8 or SPEC.md §8
      Error codes defined?   PASS ☐ / FAIL ☐

☐ 5. Dependencies resolved?
      API keys configured?   PASS ☐ / FAIL ☐
      Collections ready?     PASS ☐ / FAIL ☐

Result: ___/5 PASS → [PROCEED / HOLD]
──────────────────────────────────────────────────
```

> 🔴 **< 5/5 PASS → HOLD. Create missing docs FIRST.**

### Step 3: ANNOUNCE agent before coding

| Domain | Agent | Announce |
|--------|-------|----------|
| Frontend / UI / Pages | `frontend-specialist` | `🤖 @frontend-specialist` |
| Backend / API / DB | `backend-specialist` | `🤖 @backend-specialist` |
| AI / LLM / Prompts | `ai-engineer` | `🤖 @ai-engineer` |
| Security / Auth | `security-auditor` | `🤖 @security-auditor` |
| Multi-domain | `orchestrator` | `🤖 @orchestrator` |

### Step 4: SOCRATIC GATE — Ask before building

For any Full BMAD feature, ask minimum 3 questions:
- What are the edge cases?
- What's the scope boundary (what's NOT included)?
- What are the dependencies?

---

## 📂 NAMING CONVENTION

All docs use format: `F{XX}-{feature-name}.md`

| ID | Feature | Wave |
|----|---------|------|
| F01 | AI Chat Builder | 3 |
| F02 | Auth | 1 |
| F03 | Dashboard | 2 |
| F04 | Block Renderer | 3 |
| F05 | SEO Dashboard | 4 |
| F06 | Products CRUD | 4 |
| F07 | Orders | 4 |
| F08 | Publish Flow | 4 |
| F09 | Templates + i18n | 3.5 |
| F10 | Storefront Commerce | 5 |

### Doc paths:
```
docs/prd/F{XX}-{name}.md           — PRD (Gherkin AC, 10-point checklist)
docs/architecture/F{XX}-{name}.md  — Architecture (component tree, data flow)
docs/design/F{XX}-{name}-*.jpg     — UI Mockups (desktop + mobile)
docs/qa/F{XX}-{name}.md            — QA Report (after build)
docs/stories/                       — User stories with Gherkin AC
docs/tracking/                      — Product plan, feature registry
```

---

## 📋 PROJECT CONTEXT

- **Product**: PrimeWeb — AI-first SaaS website builder for SMEs
- **Stack**: Next.js 15 + Payload CMS 3 + PostgreSQL + Tailwind CSS
- **Testing**: Vitest (unit/integration) + Playwright (E2E)
- **Market**: Malaysia (EN + Bahasa Melayu)
- **Currency**: MYR (Malaysian Ringgit)
- **Key docs**: `SPEC.md` (constitution), `docs/tracking/product_plan.md` (roadmap)

## 🏗️ 3 MANDATORY BUILD RULES

1. **📱 MOBILE-FIRST** — Works on 375px. Use `clamp()`, stack grids, 44px tap targets.
2. **🔍 SEO OPTIMIZED** — Meta tags, JSON-LD, semantic HTML, image alt text.
3. **🌏 BILINGUAL EN/MY** — All user-facing text in English + Bahasa Melayu.

## 🎨 DESIGN WORKFLOW

### Primary: Figma MCP (Agent reads Figma directly)
- Figma MCP configured at `.cursor/mcp.json`
- Copy Figma frame link → paste in chat → agent reads design
- No manual export needed — agent extracts layout, colors, spacing

### Fallback: Exported mockups
- Export from Figma → `docs/design/F{XX}-{name}-*.jpg`
- Used when Figma MCP unavailable or for BMAD gate docs

### Design Tokens (Source of Truth: SPEC.md §4):
- Primary: teal-600 | Background: white (light) / gray-950 (dark)
- Font: Inter | Radius: rounded-lg (8px)
- Mobile: min-width 375px | Tap target: 44px
- Currency: MYR → format `RM XX.XX`

### Build order:
1. Read design from Figma MCP (or exported mockup)
2. Reference Design Tokens from SPEC.md §4
3. Build components with Tailwind CSS
4. Dashboard: Tailwind classes only (no inline styles)
5. Storefront: inline styles OK (iframe compatibility)

## 🧪 TESTING REQUIREMENTS

> **Full convention:** `docs/TEST_CONVENTION.md` — MUST READ before writing tests.

### Test every feature:
| Layer | Tool | What | Location |
|-------|------|------|----------|
| **Unit** | Vitest | Utils, stores, schemas | `src/__tests__/unit/` |
| **API** | Vitest | API routes, collections | `src/__tests__/api/` |
| **E2E** | Playwright | Smoke tests on staging | `tests/` |

### Key rules:
- Every test MUST reference **TC-ID** from `docs/qa/F*.md` (e.g., `TC-F02.23`)
- Import from source code — **NEVER re-implement logic** in test files
- **AAA pattern**: Arrange → Act → Assert
- `vi.mock()` at **top of file**, never inside test functions
- `beforeEach`/`afterEach` cleanup mandatory
- Gold standard files: `otp-generate.test.ts`, `builder-store.test.ts`, `f21-localization.test.tsx`

### Commands:
```bash
npm test              # Unit + API (Vitest)
npm run test:e2e      # E2E (Playwright)
npm run test:all      # All tests
npm run typecheck     # TypeScript check
```

## 🔧 INFRASTRUCTURE RULES

### Database Schema Changes:
- Modify `src/collections/*.ts` → MUST add migration to `scripts/db-setup.js`
- Array fields: `CREATE TABLE IF NOT EXISTS` with `id varchar` (UUID, NOT serial)
- New collections: add slug to `COLLECTION_SLUGS[]` in `db-setup.js`
- **NEVER** write `DROP TABLE` — use `CREATE TABLE IF NOT EXISTS`
- Test: `node scripts/check-migrations.js origin/staging`

### Environment Variables:
- Add secret: `gh secret set KEY` + add to `.env.staging.example` + `.env.production.example`
- CI auto-syncs all GitHub Secrets → DigitalOcean (no manual config needed)
- **NEVER** commit real secrets — placeholders only

### Docker Standalone:
- Pages using `getPayload()` MUST have `export const dynamic = 'force-dynamic'`
- `pushDevSchema` does NOT work reliably — always use SQL migrations
- Email uses Payload SMTP (AWS SES) — do NOT add Resend or other providers

## ✅ 10-POINT PR MERGE GATE (SPEC.md §13)

- [ ] Loading states
- [ ] Empty states
- [ ] Error states
- [ ] Form validation
- [ ] Button states (disabled/loading)
- [ ] Toast feedback
- [ ] Auth redirect (401 → /login)
- [ ] Mobile responsive (375px)
- [ ] TypeScript clean (`tsc --noEmit`)
- [ ] Tests pass (`npm test`)
