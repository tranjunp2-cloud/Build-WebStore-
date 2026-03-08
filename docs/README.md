# PrimeWeb — Documentation Hub

> Feature documentation organized by BMAD workflow.
> **Product:** PrimeWeb (AI-first SaaS website builder for SMEs)
> **Authority:** `SPEC.md` §2 is the master rule — read it before coding.

## 📂 Structure

```
docs/
├── README.md                      ← This file
├── prd/                           ← Product Requirement Documents
│   ├── _TEMPLATE.md               ← PRD template
│   ├── F01-ai-chat-builder.md
│   ├── F02-auth.md
│   ├── F03-dashboard.md
│   ├── F04-block-renderer.md
│   └── F10-storefront-commerce.md
├── architecture/                  ← System design & architecture
│   ├── _TEMPLATE.md               ← Architecture template
│   ├── AI_BUILDER_SPEC.md         ← AI features deep technical spec
│   ├── F01-ai-chat-builder.md
│   ├── F02-auth.md
│   ├── F03-dashboard.md
│   └── F10-storefront-commerce.md
├── design/                        ← UI Mockups (required by BMAD gate)
│   ├── F03-dashboard-mockup.png
│   ├── F10-storefront-products.jpg
│   ├── F10-storefront-detail.jpg
│   ├── F10-storefront-checkout.jpg
│   └── F10-storefront-cart.jpg
├── stories/                       ← User Stories with Gherkin AC
│   └── user-stories-p0.md         ← P0 stories (US-001 → US-010)
├── qa/                            ← QA Reports (after build)
│   ├── F02-auth.md
│   └── F03-dashboard.md
├── decisions/                     ← Architecture Decision Records
├── tracking/                      ← Build progress & plans
│   ├── product_plan.md            ← Full product roadmap
│   ├── PLAN-ai-webbuilder.md      ← BMAD master build plan
│   ├── implementation_plan.md
│   ├── task.md
│   └── walkthrough.md
```

## 📑 Naming Convention

All feature docs: **`F{XX}-{feature-name}.md`**

| ID | Feature | Wave | PRD | Architecture | Design | QA |
|----|---------|------|-----|-------------|--------|-----|
| F01 | AI Chat Builder | 3 | ✅ | ✅ | ⬜ | ⬜ |
| F02 | Auth | 1 | ✅ | ✅ | ⬜ | ✅ |
| F03 | Dashboard | 2 | ✅ | ✅ | ✅ | ✅ |
| F04 | Block Renderer | 3 | ✅ | ⬜ | ⬜ | ⬜ |
| F05 | SEO Dashboard | 4 | ⬜ | ⬜ | ⬜ | ⬜ |
| F06 | Products CRUD | 4 | ⬜ | ⬜ | ⬜ | ⬜ |
| F07 | Orders | 4 | ⬜ | ⬜ | ⬜ | ⬜ |
| F08 | Publish Flow | 4 | ⬜ | ⬜ | ⬜ | ⬜ |
| F09 | Templates + i18n | 3.5 | ⬜ | ⬜ | ⬜ | ⬜ |
| F10 | Storefront Commerce | 5 | ✅ | ✅ | ✅ | ⬜ |

## 🛑 BMAD Gate (5/5 Required)

Before coding any feature, verify:
1. ☐ PRD exists (`docs/prd/F{XX}-{name}.md`)
2. ☐ Architecture exists (`docs/architecture/F{XX}-{name}.md`)
3. ☐ UI Mockups exist (`docs/design/F{XX}-{name}-*.jpg`)
4. ☐ API contracts defined (in PRD §8)
5. ☐ Dependencies resolved

> **< 5/5 PASS → HOLD. Create docs FIRST.**

## 🔗 Key References

| Document | Purpose |
|----------|---------|
| [`SPEC.md`](../SPEC.md) | Constitution — master rules |
| [`AI_BUILDER_SPEC.md`](./architecture/AI_BUILDER_SPEC.md) | AI features deep spec |
| [`product_plan.md`](./tracking/product_plan.md) | Full product roadmap |
| [`PLAN-ai-webbuilder.md`](./tracking/PLAN-ai-webbuilder.md) | BMAD build plan |
