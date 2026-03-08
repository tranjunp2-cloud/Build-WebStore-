# Web Store — Documentation Hub

> Feature documentation organized by BMAD workflow phase.
> **Product:** Web Store (AI-first website builder for SMEs)

## 📂 Structure

```
docs/
├── README.md                   ← This file
├── AI_BUILDER_SPEC.md          ← AI features deep technical spec (16 sections)
├── PLAN-ai-webbuilder.md       ← BMAD master plan (10 features, agent-routed)
├── prd/                        ← Product Requirement Documents
│   ├── auth.md                 ← Auth flow PRD
│   ├── dashboard.md            ← Dashboard PRD
│   ├── ai-chat-builder.md      ← (to create) AI Builder PRD
│   ├── ai-editor.md            ← (to create) AI Editor PRD
│   └── ai-seo-engine.md        ← (to create) SEO Engine PRD
├── architecture/               ← System design notes
│   ├── ai-chat-builder.md      ← (to create) AI Builder architecture
│   └── ai-editor.md            ← (to create) AI Editor architecture
├── stories/                    ← User Stories with Gherkin AC
├── qa/                         ← QA reports & test checklists
├── decisions/                  ← Architecture Decision Records (ADR)
└── tracking/                   ← Build progress & walkthroughs
```

## 🚀 BMAD Workflow

```
PLAN              BUILD            CHECK           ACT
────              ─────            ─────           ───
project-planner → worker agents → quality-inspector → orchestrator
(PRD + Stories)   (code + tests)   (audit + verify)   (review + ship)
```

| Step | Agent | Output |
|------|-------|--------|
| 1 | `project-planner` | PRD → `docs/prd/{feature}.md` |
| 2 | `backend/frontend-specialist` | Architecture → `docs/architecture/{feature}.md` |
| 3 | **Readiness Gate** | 4/4 PASS required |
| 4 | Worker Agents | Code implementation |
| 5 | `quality-inspector` | QA → `docs/qa/{feature}.md` |

## 📋 Key Documents

| Document | Purpose | Status |
|----------|---------|--------|
| [AI_BUILDER_SPEC.md](./AI_BUILDER_SPEC.md) | Deep technical spec for ALL AI features | ✅ Complete |
| [PLAN-ai-webbuilder.md](./PLAN-ai-webbuilder.md) | BMAD master plan with 10 features | ✅ Complete |
| [SPEC.md](../SPEC.md) | Product-level spec (high-level) | ✅ Complete |

## 🔗 Quick Reference

- **Before coding any AI feature:** Read `AI_BUILDER_SPEC.md`
- **Before starting a sprint:** Check `PLAN-ai-webbuilder.md` for agent assignments
- **Before submitting PR:** Check 9-Point Done Checklist in `SPEC.md §13`
