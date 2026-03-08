# Contributing to PrimeWeb

## BMAD Workflow (Required for ALL features)

PrimeWeb follows the **BMAD (Build-Measure-Act-Document)** workflow.
Full details: [`SPEC.md §2`](./SPEC.md)

### Quick Reference: What to do BEFORE coding

| Step | Action | Output |
|------|--------|--------|
| 1 | **Classify** your task | Full BMAD / Quick Flow / Bug Fix / Infra |
| 2 | **Create PRD** | `docs/prd/{feature}.md` (use `docs/prd/_TEMPLATE.md`) |
| 3 | **Create Architecture doc** | `docs/architecture/{feature}.md` (use template) |
| 4 | **Pass Gate** | 4/4 checklist items pass |
| 5 | **Code** | Only after gate passes |
| 6 | **QA Report** | `docs/qa/{feature}.md` after build |
| 7 | **PR** | Use PR template, fill BMAD checklist |

### When to skip full BMAD

- **Bug fixes**: Describe bug → Fix → Test → PR
- **Infra/DevOps**: Task → Implement → Done
- **Small changes** (add field, rename): Short description → 5-min gate → Implement

### 3 Mandatory Build Rules

Every feature/template/page MUST follow:

1. **📱 Mobile-First** — Works on 375px (iPhone SE). Use `clamp()`, stack grids.
2. **🔍 SEO Optimized** — Meta tags, JSON-LD, semantic HTML, image alt text.
3. **🌏 Bilingual EN/MY** — All user-facing text in English + Bahasa Melayu.

### PR Merge Checklist (9-Point from SPEC.md §13)

- [ ] Loading states
- [ ] Empty states
- [ ] Error states
- [ ] Form validation
- [ ] Button states (disabled/loading)
- [ ] Toast feedback
- [ ] Auth redirect (401)
- [ ] Mobile responsive (375px)
- [ ] TypeScript clean (`tsc --noEmit`)

### Agent Routing (for AI-assisted development)

| Domain | Agent |
|--------|-------|
| Frontend / UI | `frontend-specialist` |
| Backend / API | `backend-specialist` |
| AI / LLM | `ai-engineer` |
| Security | `security-auditor` |
| Multi-domain | `orchestrator` |

---

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **CMS**: Payload CMS 3
- **Database**: PostgreSQL
- **Styling**: Tailwind CSS
- **AI**: OpenAI GPT-4
- **Market**: Malaysia (MYR currency)

## Getting Started

```bash
pnpm install
cp .env.example .env.local
docker compose up -d  # PostgreSQL
pnpm dev
```
