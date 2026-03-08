# Contributing to PrimeWeb

> ⚠️ KEEP IN SYNC: `.cursorrules`, `.gemini/GEMINI.md`, and this file
> must contain the SAME rules. Edit all 3 when changing rules.

## BMAD Workflow (Required for ALL features)

PrimeWeb follows the **BMAD (Build-Measure-Act-Document)** workflow.
Full details: [`SPEC.md §2`](./SPEC.md)

### 🛑 BMAD STOP GATE — Before ANY code

#### Step 1: Classify
| Type | Examples | Required |
|------|----------|----------|
| **Full BMAD** | New feature, new page, new module | All 5 gate docs |
| **Quick Flow** | Add field, simple CRUD | Short story + 5-min gate |
| **Bug Fix** | Fix error, patch behavior | Direct fix → test → PR |
| **Infra** | Docker, CI/CD, config | Direct → implement |

#### Step 2: BMAD Gate — 5/5 PASS required

```
☐ 1. PRD exists?           → docs/prd/F{XX}-{name}.md
☐ 2. Architecture exists?  → docs/architecture/F{XX}-{name}.md
☐ 3. UI Mockups exist?     → docs/design/F{XX}-{name}-*.png
☐ 4. API contracts ready?  → In PRD or SPEC.md §8
☐ 5. Dependencies resolved?
```

> **< 5/5 PASS → HOLD. Create missing docs FIRST.**

---

## 📂 Naming Convention

All docs: `F{XX}-{feature-name}.md` or `.png`

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
docs/prd/F{XX}-{name}.md           — PRD
docs/architecture/F{XX}-{name}.md  — Architecture
docs/design/F{XX}-{name}-*.png     — UI Mockups
docs/qa/F{XX}-{name}.md            — QA Report
```

---

## 🏗️ 3 Mandatory Build Rules

1. **📱 Mobile-First** — Works on 375px (iPhone SE)
2. **🔍 SEO** — Meta tags, JSON-LD, semantic HTML
3. **🌏 Bilingual EN/MY** — All user-facing text

## ✅ 9-Point PR Merge Gate

- [ ] Loading states
- [ ] Empty states
- [ ] Error states
- [ ] Form validation
- [ ] Button states (disabled/loading)
- [ ] Toast feedback
- [ ] Auth redirect (401)
- [ ] Mobile responsive (375px)
- [ ] TypeScript clean (`tsc --noEmit`)

## Agent Routing (AI development)

| Domain | Agent |
|--------|-------|
| Frontend / UI | `frontend-specialist` |
| Backend / API | `backend-specialist` |
| AI / LLM | `ai-engineer` |
| Security | `security-auditor` |
| Multi-domain | `orchestrator` |

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **CMS**: Payload CMS 3
- **Database**: PostgreSQL
- **Styling**: Tailwind CSS
- **Market**: Malaysia (MYR)

## Getting Started

```bash
pnpm install
cp .env.example .env.local
docker compose up -d
pnpm dev
```
