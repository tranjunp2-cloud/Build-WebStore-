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
docs/prd/F{XX}-{name}.md           — PRD (Gherkin AC, 9-point checklist)
docs/architecture/F{XX}-{name}.md  — Architecture (component tree, data flow)
docs/design/F{XX}-{name}-*.png     — UI Mockups (desktop + mobile)
docs/qa/F{XX}-{name}.md            — QA Report (after build)
docs/tracking/                      — Product plan, feature registry
```

---

## 📋 PROJECT CONTEXT

- **Product**: PrimeWeb — AI-first SaaS website builder for SMEs
- **Stack**: Next.js 15 + Payload CMS 3 + PostgreSQL + Tailwind CSS
- **Market**: Malaysia (EN + Bahasa Melayu)
- **Currency**: MYR (Malaysian Ringgit)
- **Key docs**: `SPEC.md` (constitution), `docs/tracking/product_plan.md` (roadmap)

## 🏗️ 3 MANDATORY BUILD RULES

1. **📱 MOBILE-FIRST** — Works on 375px. Use `clamp()`, stack grids, 44px tap targets.
2. **🔍 SEO OPTIMIZED** — Meta tags, JSON-LD, semantic HTML, image alt text.
3. **🌏 BILINGUAL EN/MY** — All user-facing text in English + Bahasa Melayu.

## ✅ 9-POINT PR MERGE GATE (SPEC.md §13)

- [ ] Loading states
- [ ] Empty states
- [ ] Error states
- [ ] Form validation
- [ ] Button states (disabled/loading)
- [ ] Toast feedback
- [ ] Auth redirect (401 → /login)
- [ ] Mobile responsive (375px)
- [ ] TypeScript clean (`tsc --noEmit`)
