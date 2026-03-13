# 📚 PrimeWeb — Team Hub

> **Đọc file này trước. Tất cả docs có link ở đây.**

---

## 🚀 Bắt đầu

| Bạn là | Đọc file này |
|--------|-------------|
| **Dev mới** | [README.md](../README.md) (setup) → [CONTRIBUTING.md](../.github/CONTRIBUTING.md) (rules) |
| **Designer** | [Design Workflow](design/DESIGN_WORKFLOW.md) (rules + Figma links) |
| **QC** | [Features](#features) bên dưới → xem stories |
| **DevOps** | [DEPLOY.md](../.github/DEPLOY.md) → [GIT_AND_CI_RULES.md](../.github/GIT_AND_CI_RULES.md) |
| **Tất cả** | [PROJECT_ALIGNMENT.md](PROJECT_ALIGNMENT.md) (timeline, priority) |

---

## 📂 Cấu trúc docs

```
docs/
├── README.md                    ← Bạn đang đây (Team Hub)
├── PROJECT_ALIGNMENT.md         ← Timeline, priority, team rules, task tóm tắt
├── SPRINT0_DETAIL.md            ← Chi tiết từng task (files, steps, DoD)
│
├── prd/                         ← PRD mỗi feature (yêu cầu)
├── stories/                     ← User Stories + Gherkin AC
├── architecture/                ← Technical design
├── design/DESIGN_WORKFLOW.md     ← Rules + Figma links (1 file duy nhất)
├── decisions/decisions-log.md   ← Product decisions đã chốt
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
| **F01** AI Chat Builder | [📄](prd/F01-ai-chat-builder.md) | [📝](stories/F01-ai-chat-builder-stories.md) | [🏗️](architecture/F01-ai-chat-builder.md) | [🎨](design/DESIGN_WORKFLOW.md) |
| **F02** Auth | [📄](prd/F02-auth.md) | [📝](stories/F02-auth-stories.md) | [🏗️](architecture/F02-auth.md) | [🎨](design/DESIGN_WORKFLOW.md) |
| **F03** Dashboard | [📄](prd/F03-dashboard.md) | [📝](stories/F03-dashboard-stories.md) | [🏗️](architecture/F03-dashboard.md) | [🎨](design/DESIGN_WORKFLOW.md) |
| **F05** AI Editor | [📄](prd/F05-ai-editor.md) | [📝](stories/F05-ai-editor-stories.md) | [🏗️](architecture/F05-ai-editor.md) | [🎨](design/DESIGN_WORKFLOW.md) |
| **F06** Onboarding | [📄](prd/F06-onboarding.md) | [📝](stories/F06-onboarding-stories.md) | ❌ | [🎨](design/DESIGN_WORKFLOW.md) |
| **F07** Templates | [📄](prd/F07-template-gallery.md) | [📝](stories/F07-template-gallery-stories.md) | ❌ | [🎨](design/DESIGN_WORKFLOW.md) |
| **F08** Publish | [📄](prd/F08-publish-flow.md) | [📝](stories/F08-publish-stories.md) | [🏗️](architecture/F08-publish-flow.md) | [🎨](design/DESIGN_WORKFLOW.md) |
| **F09** Products | [📄](prd/F09-products-crud.md) | [📝](stories/F09-products-crud-stories.md) | [🏗️](architecture/F09-products-crud.md) | [🎨](design/DESIGN_WORKFLOW.md) |
| **F10** Storefront | [📄](prd/F10-storefront-commerce.md) | [📝](stories/F10-storefront-stories.md) | [🏗️](architecture/F10-storefront-commerce.md) | [🎨](design/DESIGN_WORKFLOW.md) |
| **F11** Orders | [📄](prd/F11-orders-management.md) | [📝](stories/F11-orders-stories.md) | [🏗️](architecture/F11-orders-management.md) | [🎨](design/DESIGN_WORKFLOW.md) |
| **F12** SEO | [📄](prd/F12-seo-dashboard.md) | [📝](stories/F12-seo-dashboard-stories.md) | [🏗️](architecture/F12-seo-dashboard.md) | [🎨](design/DESIGN_WORKFLOW.md) |
| **F13** Analytics | [📄](prd/F13-analytics-dashboard.md) | ❌ | ❌ | [🎨](design/DESIGN_WORKFLOW.md) |
| **F14** Undo/Redo | [📄](prd/F14-undo-redo.md) | [📝](stories/F14-undo-redo-stories.md) | ❌ | — |
| **F15** Auto-save | [📄](prd/F15-auto-save-draft.md) | ❌ | ❌ | — |
