---
trigger: always_on
---

# GEMINI.md — PrimeWeb Project Rules

> This file is auto-loaded by Antigravity/Gemini on every session.
> It enforces the BMAD workflow defined in `SPEC.md §2`.
> **Authority**: `SPEC.md` > this file. If conflict → SPEC.md wins.

---

## 🚨 STOP GATE: MUST READ BEFORE ANY CODE

**On session start, ALWAYS read `SPEC.md` §1-§2 first.**

---

## 🛑 BMAD DOC GATE (HARD RULE — NO EXCEPTIONS)

### Before writing ANY code for a feature:

**1. CLASSIFY the request:**

| Type | Trigger | Required |
|------|---------|----------|
| **Full BMAD** | "build", "create", "implement" new feature | PRD + Architecture + Gate |
| **Quick Flow** | "add field", "simple CRUD" | Short story + 5-min gate |
| **Bug Fix** | "fix", "broken", "error" | Direct fix → test |
| **Infra** | "deploy", "docker", "config" | Direct implement |

**2. For Full BMAD — VERIFY 4/4 docs exist:**

```
☐ 1. PRD exists?           → docs/prd/{feature}.md
      Gherkin AC complete?  PASS ☐ / FAIL ☐

☐ 2. Architecture exists?  → docs/architecture/{feature}.md
      Component tree clear? PASS ☐ / FAIL ☐

☐ 3. API contracts ready?  → In PRD or SPEC.md §8
      Error codes defined?  PASS ☐ / FAIL ☐

☐ 4. Dependencies resolved?
      API keys configured?  PASS ☐ / FAIL ☐
      Collections ready?    PASS ☐ / FAIL ☐

Result: ___/4 PASS → PROCEED or HOLD
```

> 🔴 **< 4/4 PASS → HOLD. Create missing docs FIRST using templates:**
> - PRD: `docs/prd/_TEMPLATE.md`
> - Architecture: `docs/architecture/_TEMPLATE.md`

**3. ANNOUNCE agent before coding:**

| Domain | Agent | Announce |
|--------|-------|----------|
| Frontend / UI | `frontend-specialist` | `🤖 @frontend-specialist` |
| Backend / API | `backend-specialist` | `🤖 @backend-specialist` |
| AI / LLM | `ai-engineer` | `🤖 @ai-engineer` |
| Security | `security-auditor` | `🤖 @security-auditor` |
| Multi-domain | `orchestrator` | `🤖 @orchestrator` |

**4. SOCRATIC GATE — Ask before building:**

For any Full BMAD feature, ask minimum 3 questions:
- What are the edge cases?
- What's the scope boundary (what's NOT included)?
- What are the dependencies?

---

## 📋 PROJECT CONTEXT

- **Product**: PrimeWeb — AI-first SaaS website builder for SMEs
- **Stack**: Next.js 15 + Payload CMS 3 + PostgreSQL + Tailwind CSS
- **Market**: Malaysia (EN + Bahasa Melayu)
- **Key docs**: `SPEC.md` (constitution), `docs/tracking/product_plan.md` (roadmap)

## 🏗️ 3 MANDATORY BUILD RULES

1. **MOBILE-FIRST** — Works on 375px
2. **SEO** — Meta, JSON-LD, semantic HTML
3. **BILINGUAL** — EN + Bahasa Melayu (MY)

## 📂 Doc Paths

| Doc | Path |
|-----|------|
| Master Spec | `SPEC.md` |
| PRDs | `docs/prd/{feature}.md` |
| Architecture | `docs/architecture/{feature}.md` |
| QA Reports | `docs/qa/{feature}.md` |
| Tracking | `docs/tracking/` |
| Templates | `docs/prd/_TEMPLATE.md`, `docs/architecture/_TEMPLATE.md` |
