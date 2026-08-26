# 📚 PrimeWeb — Team Hub

> **Đọc file này trước. Tất cả docs có link ở đây.**

---

## 🚀 Bắt đầu

| Bạn là | Đọc file này |
|--------|-------------|
| **Dev mới** | [README.md](../README.md) (setup) → [CONTRIBUTING.md](../.github/CONTRIBUTING.md) (rules) |
| **Designer** | [Design Guide](design/DESIGN_WORKFLOW.md) (rules + screens + tokens + Figma links) |
| **QC** | [Features](#features) bên dưới → xem stories · [JMeter QC env](qa/jmeter-qc-env.md) · [QC runbook](qa/qc-test-runbook.md) |
| **DevOps** | [DEPLOY.md](../.github/DEPLOY.md) → [GIT_AND_CI_RULES.md](../.github/GIT_AND_CI_RULES.md) |
| **Tất cả** | [PROJECT_ALIGNMENT.md](PROJECT_ALIGNMENT.md) (timeline, priority) |
| **AI agents (Claude/Cursor)** | [CLAUDE.md](../CLAUDE.md) → [.claude/rules/](../.claude/rules/) (path-scoped rules) |
| **Onboarding (src/ map)** | [CODEBASE_SUMMARY.md](CODEBASE_SUMMARY.md) → [architecture/_OVERVIEW.md](architecture/_OVERVIEW.md) |
| **Release history** | [CHANGELOG.md](CHANGELOG.md) → [journals/](journals/) |
| **Open blockers** | [tracking/OPEN_BLOCKERS.md](tracking/OPEN_BLOCKERS.md) |
| **Code style** | [standards/CODE_STANDARDS.md](standards/CODE_STANDARDS.md) |

---

## 📂 Cấu trúc docs

```
docs/
├── README.md                    ← Bạn đang đây (Team Hub)
├── PROJECT_ALIGNMENT.md         ← Timeline, priority, team rules, task tóm tắt
├── SPRINT0_DETAIL.md            ← Chi tiết từng task (files, steps, DoD)
├── CODEBASE_SUMMARY.md          ← src/ directory map + key modules + entry points
├── CHANGELOG.md                 ← Per-release notes (v1.0 →)
├── TEST_CONVENTION.md           ← Test patterns, TC-ID mapping (authoritative)
├── DB-LIFECYCLE.md              ← Schema change workflow
│
├── prd/                         ← PRD mỗi feature (yêu cầu)
├── stories/                     ← User Stories + Gherkin AC
├── architecture/                ← Technical design
│   ├── _OVERVIEW.md             ← Unified layer diagram + F-feature index (read first)
│   └── F*.md                    ← Per-feature architecture
├── standards/                   ← Code + design standards
│   ├── CODE_STANDARDS.md        ← Lint, TS, naming, imports, modularization
│   ├── WEBSITE_TEMPLATE_STANDARDS.md
│   ├── DESIGN_TOKENS.md
│   └── AI_WEBSITE_GENERATION_GUIDE.md
├── tracking/                    ← Live status
│   ├── OPEN_BLOCKERS.md         ← Active v1.0/v1.1 blockers
│   └── implementation_plan.md, product_plan.md, task.md, ...
├── qa/                          ← Test cases per feature
├── design/DESIGN_WORKFLOW.md     ← Design Guide: rules + screens + tokens + Figma
├── decisions/decisions-log.md   ← Product decisions đã chốt
├── journals/                    ← Architectural decisions + incident post-mortems
└── malaysia-market-context.md   ← Ngữ cảnh thị trường MY

.github/
├── CONTRIBUTING.md              ← Git rules, PR rules, code rules
├── GIT_AND_CI_RULES.md          ← Chi tiết Git workflow
├── DEPLOY.md                    ← Deploy staging vs production
├── TEST_PLAN.md                 ← Phạm vi test
└── pull_request_template.md     ← Template PR

Root:
├── README.md                    ← Setup & run project
└── SPEC.md                      ← Product spec gốc (reference)
```

---

## Features

| Feature | PRD | Stories | Architecture | Design |
|---------|:---:|:-------:|:------------:|:------:|
| **F01** AI Web Builder | [📄](prd/F01-ai-builder.md) | [📝](stories/F01-ai-builder-stories.md) | [🏗️](architecture/F01-ai-builder.md) | [🎨](design/DESIGN_WORKFLOW.md) |
| **F02** Auth | [📄](prd/F02-auth.md) | [📝](stories/F02-auth-stories.md) | [🏗️](architecture/F02-auth.md) | [🎨](design/DESIGN_WORKFLOW.md) |
| **F03** Dashboard | [📄](prd/F03-dashboard.md) | [📝](stories/F03-dashboard-stories.md) | [🏗️](architecture/F03-dashboard.md) | [🎨](design/DESIGN_WORKFLOW.md) |
| **F05** AI Editor | [📄](prd/F05-ai-editor.md) | [📝](stories/F05-ai-editor-stories.md) | [🏗️](architecture/F05-ai-editor.md) | [🎨](design/DESIGN_WORKFLOW.md) |
| **F06** Onboarding | [📄](prd/F06-onboarding.md) | [📝](stories/F06-onboarding-stories.md) | ❌ | [🎨](design/DESIGN_WORKFLOW.md) |
| **F07** Templates | [📄](prd/F07-template-gallery.md) | [📝](stories/F07-template-gallery-stories.md) | ❌ | [🎨](design/DESIGN_WORKFLOW.md) |
| **F08** Publish | [📄](prd/F08-publish-flow.md) | [📝](stories/F08-publish-stories.md) | [🏗️](architecture/F08-publish-flow.md) | [🎨](design/DESIGN_WORKFLOW.md) |
| **F08** Products | [📄](prd/F08-products-crud.md) | [📝](stories/F08-products-crud-stories.md) | [🏗️](architecture/F08-products-crud.md) | [🎨](design/DESIGN_WORKFLOW.md) |
| **F09** Storefront | [📄](prd/F09-storefront-commerce.md) | [📝](stories/F09-storefront-stories.md) | [🏗️](architecture/F09-storefront-commerce.md) | [🎨](design/DESIGN_WORKFLOW.md) |
| **F10** Orders | [📄](prd/F10-orders-management.md) | [📝](stories/F10-orders-stories.md) | [🏗️](architecture/F10-orders-management.md) | [🎨](design/DESIGN_WORKFLOW.md) |
| **F11** SEO | [📄](prd/F11-seo-dashboard.md) | [📝](stories/F11-seo-dashboard-stories.md) | [🏗️](architecture/F11-seo-dashboard.md) | [🎨](design/DESIGN_WORKFLOW.md) |
| **F12** Analytics | [📄](prd/F12-analytics-dashboard.md) | ❌ | ❌ | [🎨](design/DESIGN_WORKFLOW.md) |
| **F11** Undo/Redo | [📄](prd/F11-undo-redo.md) | [📝](stories/F11-undo-redo-stories.md) | ❌ | — |
| **F12** Auto-save | [📄](prd/F12-auto-save-draft.md) | ❌ | ❌ | — |
| **F13** Payment Gateway 🇲🇾 | [📄](prd/F11-payment-gateway.md) | ❌ | ❌ | [🎨](design/DESIGN_WORKFLOW.md) |
| **F14** Shipping 🇲🇾 | [📄](prd/F12-shipping.md) | ❌ | ❌ | [🎨](design/DESIGN_WORKFLOW.md) |
