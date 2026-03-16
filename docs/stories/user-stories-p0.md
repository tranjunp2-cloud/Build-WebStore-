# PrimeWeb — User Stories Index (P0)

> **Format:** BMAD-style Gherkin (GIVEN/WHEN/THEN)
> **ID Convention:** `US-F[FeatureNumber]-[SequenceNumber]` (e.g. `US-F01-01`, `US-F02-03`)
> **Rule:** Mỗi feature có file story riêng trong `docs/stories/`. File này là index tổng hợp.
> **Ref:** [SPEC.md §6](../SPEC.md#6-user-stories-p0) | [malaysia-market-context.md](../malaysia-market-context.md)

---

> [!IMPORTANT]
> **Stories-First Rule:** User Stories được viết TRƯỚC, PRD được viết SAU.
> Mọi Functional Requirement trong PRD PHẢI có Story ID tham chiếu.
> Không tự tạo scope mới trong PRD mà chưa có Story cover.

---

## 📋 Story Registry — P0 Stories

| Story ID | Feature | Title | File | Priority | Wave | Size | Status |
|----------|---------|-------|------|----------|------|------|--------|
| US-F01-01 | F01 AI Builder | AI Chat Builder — Generate Site from Prompt ⭐ | [F01-ai-chat-builder-stories.md](./F01-ai-chat-builder-stories.md) | P0 | 3 | XL | Ready |
| US-F01-02 | F01 AI Builder | Store Setup — Basic Info (AI Context Collection) | [F01-ai-chat-builder-stories.md](./F01-ai-chat-builder-stories.md) | P0 | 1 | S | Ready |
| US-F01-03 | F01 AI Builder | AI Image Generation for Store | [F01-ai-chat-builder-stories.md](./F01-ai-chat-builder-stories.md) | P0 | 3 | L | Draft |
| US-F01-04 | F01 AI Builder | One-Click Publish to Live Store | [F01-ai-chat-builder-stories.md](./F01-ai-chat-builder-stories.md) | P0 | 3 | M | Draft |
| US-F01-05 | F01 AI Builder | Conversational AI Onboarding Flow | [F01-ai-chat-builder-stories.md](./F01-ai-chat-builder-stories.md) | P0 | 3 | M | Draft |
| US-F01-06 | F01 AI Builder | Multilingual Site Output | [F01-ai-chat-builder-stories.md](./F01-ai-chat-builder-stories.md) | P0 | 3 | S | Draft |
| US-F01-07 | F01 AI Builder | Post-Generation Confirm & CMS Redirect | [F01-ai-chat-builder-stories.md](./F01-ai-chat-builder-stories.md) | P0 | 3 | M | Draft |
| US-F01-08 | F01 AI Builder | Drag-and-Drop Block Reorder in Builder Preview | [F01-ai-chat-builder-stories.md](./F01-ai-chat-builder-stories.md) | P0 | 3 | M | Draft |
| US-F02-01 | F02 Auth | Register & Welcome ✅ | [F02-auth-stories.md](./F02-auth-stories.md) | P0 | 1 | S | Done ✅ |
| US-F02-02 | F02 Auth | Login ✅ | [F02-auth-stories.md](./F02-auth-stories.md) | P0 | 1 | S | Done ✅ |
| US-F02-03 | F02 Auth | Auth Guard — Route Protection | [F02-auth-stories.md](./F02-auth-stories.md) | P0 | 1 | S | Done ✅ |
| US-F02-04 | F02 Auth | Logout | [F02-auth-stories.md](./F02-auth-stories.md) | P0 | 1 | XS | Done ✅ |
| US-F02-05 | F02 Auth | Forgot Password ✅ | [F02-auth-stories.md](./F02-auth-stories.md) | P0 | 1 | S | Done ✅ |
| US-F02-06 | F02 Auth | Reset Password ✅ | [F02-auth-stories.md](./F02-auth-stories.md) | P0 | 1 | S | Done ✅ |
| US-F03-01 | F03 Dashboard | Dashboard — Overview | [F03-dashboard-stories.md](./F03-dashboard-stories.md) | P0 | 1 | M | Ready |
| US-F05-01 | F05 AI Editor | AI Editor — Split Screen Chat + Preview ⭐ | [F05-ai-editor-stories.md](./F05-ai-editor-stories.md) | P0 | 3 | XL | Ready |
| US-F05-02 | F05 AI Editor | Page Manager | [F05-ai-editor-stories.md](./F05-ai-editor-stories.md) | P0 | 3 | M | Ready |
| US-F05-03 | F05 AI Editor | Inline Click-to-Edit Element | [F05-ai-editor-stories.md](./F05-ai-editor-stories.md) | P0 | 3 | L | Draft |
| US-F05-04 | F05 AI Editor | Add New Section via AI | [F05-ai-editor-stories.md](./F05-ai-editor-stories.md) | P0 | 3 | L | Draft |
| US-F05-05 | F05 AI Editor | Drag-and-Drop Block Reorder in Editor | [F05-ai-editor-stories.md](./F05-ai-editor-stories.md) | P0 | 3 | M | Draft |
| US-F06-01 | F06 Onboarding | User Registration & Auto-Login | [F06-onboarding-stories.md](./F06-onboarding-stories.md) | P0 | 1 | S | Ready |
| US-F06-02 | F06 Onboarding | Welcome Screen — Zero Friction to AI Builder | [F06-onboarding-stories.md](./F06-onboarding-stories.md) | P0 | 1 | S | Ready |
| US-F06-03 | F06 Onboarding | Basic Store Setup — Slug & Delivery Defaults | [F06-onboarding-stories.md](./F06-onboarding-stories.md) | P0 | 1 | M | Ready |
| US-F07-01 | F07 Templates | Browse Templates by Category | [F07-template-gallery-stories.md](./F07-template-gallery-stories.md) | P1 | 2 | M | Draft |
| US-F07-02 | F07 Templates | Preview Template Before Use | [F07-template-gallery-stories.md](./F07-template-gallery-stories.md) | P1 | 2 | M | Draft |
| US-F07-03 | F07 Templates | Create Site from Template | [F07-template-gallery-stories.md](./F07-template-gallery-stories.md) | P1 | 2 | M | Draft |
| US-F08-01 | F08 Publish | Publish Site to Live Subdomain | [F08-publish-stories.md](./F08-publish-stories.md) | P0 | 3 | M | Ready |
| US-F09-01 | F09 Products | Products CRUD + AI Description | [F09-products-crud-stories.md](./F09-products-crud-stories.md) | P0 | 4 | L | Draft |
| US-F10-01 | F10 Storefront | Browse Products on Storefront | [F10-storefront-stories.md](./F10-storefront-stories.md) | P0 | 5 | M | Draft |
| US-F10-02 | F10 Storefront | Add to Cart + Cart Drawer | [F10-storefront-stories.md](./F10-storefront-stories.md) | P0 | 5 | M | Draft |
| US-F10-03 | F10 Storefront | Checkout — Purchase Flow ⭐ | [F10-storefront-stories.md](./F10-storefront-stories.md) | P0 | 5 | XL | Draft |
| US-F10-04 | F10 Storefront | Order Confirmation | [F10-storefront-stories.md](./F10-storefront-stories.md) | P0 | 5 | S | Draft |
| US-F11-01 | F11 Orders | Order Management & Status Updates | [F11-orders-stories.md](./F11-orders-stories.md) | P0 | 5 | L | Draft |
| US-F11-02 | F11 Orders | Customer Checkout with Stripe | [F11-orders-stories.md](./F11-orders-stories.md) | P0 | 5 | L | Draft |
| US-F12-01 | F12 SEO | SEO Dashboard Overview ⭐ | [F12-seo-dashboard-stories.md](./F12-seo-dashboard-stories.md) | P0 | 4 | L | Draft |
| US-F12-02 | F12 SEO | Auto SEO Meta Generation on Publish | [F12-seo-dashboard-stories.md](./F12-seo-dashboard-stories.md) | P0 | 4 | M | Draft |
| US-F12-03 | F12 SEO | AI SEO Fix All Issues (Detailed) | [F12-seo-dashboard-stories.md](./F12-seo-dashboard-stories.md) | P0 | 4 | L | Draft |
| US-F14-01 | F14 Undo/Redo | Undo / Redo All Changes Including AI | [F14-undo-redo-stories.md](./F14-undo-redo-stories.md) | P0 | 3 | M | Draft |

---

## 🗂️ Story Files by Feature

| Feature File | Stories Contained |
|-------------|-------------------|
| `F01-ai-chat-builder-stories.md` | US-F01-01, US-F01-02, US-F01-03, US-F01-04 |
| `F02-auth-stories.md` | US-F02-01 → US-F02-06 |
| `F03-dashboard-stories.md` | US-F03-01 |
| `F05-ai-editor-stories.md` | US-F05-01, US-F05-02, US-F05-03, US-F05-04 |
| `F06-onboarding-stories.md` | US-F06-01, US-F06-02, US-F06-03 |
| `F07-template-gallery-stories.md` | US-F07-01, US-F07-02, US-F07-03 |
| `F08-publish-stories.md` | US-F08-01 |
| `F09-products-crud-stories.md` | US-F09-01 |
| `F10-storefront-stories.md` | US-F10-01, US-F10-02, US-F10-03, US-F10-04 |
| `F11-orders-stories.md` | US-F11-01, US-F11-02 |
| `F12-seo-dashboard-stories.md` | US-F12-01, US-F12-02, US-F12-03 |
| `F14-undo-redo-stories.md` | US-F14-01 |

---

## 📖 ID Convention

```
Format:  US-F[XX]-[NN]
Example: US-F01-01

FXX = Feature number (F01 = AI Chat Builder, F02 = Auth, etc.)
NN  = Story sequence number within the feature (01, 02, 03...)

KHÔNG dùng: US-001, US-AUTH-02, US-TG-001, US-10A, v.v.
```

---

## 🔗 Story Templates & Standards

- **Story Template:** [STORY_TEMPLATE.md](./STORY_TEMPLATE.md)
- **PRD Template:** [../prd/PRD_TEMPLATE.md](../prd/PRD_TEMPLATE.md)
- **Spec:** [../../SPEC.md](../../SPEC.md)
