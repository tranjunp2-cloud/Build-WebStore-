# PrimeWeb — Documentation Hub

> Feature documentation organized by BMAD workflow.  
> **Product:** PrimeWeb (AI-first SaaS website builder for SMEs — Malaysia market)  
> **Authority:** `SPEC.md` §2 is the master rule — read it before coding.  
> **Market Ref:** [`malaysia-market-context.md`](./malaysia-market-context.md)

## 📂 Structure

```
docs/
├── README.md                      ← This file
├── malaysia-market-context.md     ← 🆕 MY market personas, JTBD, payments
├── prd/                           ← Product Requirement Documents
│   ├── _TEMPLATE.md
│   ├── F01-ai-chat-builder.md
│   ├── F02-auth.md
│   ├── F03-dashboard.md
│   ├── F04-block-renderer.md
│   ├── F05-ai-editor.md           ← 🆕
│   ├── F06-onboarding.md          ← 🆕
│   ├── F07-template-gallery.md    ← 🆕
│   ├── F08-publish-flow.md        ← 🆕
│   ├── F09-products-crud.md       ← 🆕
│   ├── F10-storefront-commerce.md
│   ├── F11-orders-management.md   ← 🆕
│   ├── F12-seo-dashboard.md       ← 🆕
│   ├── F13-analytics-dashboard.md ← 🆕
│   ├── F14-undo-redo.md           ← 🆕
│   └── F15-auto-save-draft.md     ← 🆕
├── architecture/                  ← System design & architecture
│   ├── _TEMPLATE.md
│   ├── AI_BUILDER_SPEC.md
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
│   ├── user-stories-p0.md         ← Index file (links to per-feature)
│   ├── F01-ai-chat-builder-stories.md  ← 🆕
│   ├── F02-auth-stories.md             ← 🆕
│   ├── F03-dashboard-stories.md        ← 🆕
│   ├── F05-ai-editor-stories.md        ← 🆕
│   ├── F08-publish-stories.md          ← 🆕
│   ├── F09-products-crud-stories.md    ← 🆕
│   ├── F10-storefront-stories.md       ← 🆕
│   └── F12-seo-dashboard-stories.md    ← 🆕
├── qa/                            ← QA Reports (after build)
│   ├── F02-auth.md
│   └── F03-dashboard.md
├── decisions/                     ← Architecture Decision Records
└── tracking/                      ← Build progress & plans
    ├── product_plan.md
    ├── PLAN-ai-webbuilder.md
    ├── implementation_plan.md
    ├── task.md
    └── walkthrough.md
```

## 📑 Feature Registry (Unified F01-F15)

| ID | Feature | Wave | Priority | PRD | Stories | Code |
|----|---------|------|----------|-----|---------|------|
| F01 | AI Chat Builder | 3 | P0 🌟 | ✅ | ✅ | ✅ Built |
| F02 | Auth | 1 | P0 | ✅ | ✅ | ✅ Built |
| F03 | Dashboard | 1 | P0 | ✅ | ✅ | ✅ Built |
| F04 | Block Renderer | 3 | P0 | ✅ | — | ⚠️ Monolith |
| F05 | AI Editor | 3 | P0 🌟 | 📝 | ✅ | ⚠️ Basic |
| F06 | Onboarding | 1 | P0 | 📝 | — | ⚠️ Basic |
| F07 | Templates | 3.5 | P1 | 📝 | — | ⚠️ Static |
| F08 | Publish Flow | 3 | P0 | 📝 | ✅ | ❌ |
| F09 | Products CRUD | 4 | P0 | 📝 | ✅ | ⚠️ Basic |
| F10 | Storefront | 5 | P0 🌟 | ✅ | ✅ | ✅ Built |
| F11 | Orders | 4 | P0 | 📝 | — | ⚠️ Basic |
| F12 | SEO Dashboard | 4 | P0 🌟 | 📝 | ✅ | ⚠️ Basic |
| F13 | Analytics | 5 | P1 | 📝 | — | ⚠️ Basic |
| F14 | Undo/Redo | 3 | P0 | 📝 | — | ❌ |
| F15 | Auto-Save | 3 | P0 | 📝 | — | ❌ |

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
| [`malaysia-market-context.md`](./malaysia-market-context.md) | MY market personas, payments, UX |
| [`AI_BUILDER_SPEC.md`](./architecture/AI_BUILDER_SPEC.md) | AI features deep spec |
| [`product_plan.md`](./tracking/product_plan.md) | Full product roadmap |
| [`PLAN-ai-webbuilder.md`](./tracking/PLAN-ai-webbuilder.md) | BMAD build plan |
