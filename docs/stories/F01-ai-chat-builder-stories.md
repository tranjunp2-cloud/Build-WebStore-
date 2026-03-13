# User Stories: AI Chat Builder (F01)

> **Feature:** F01 — AI Chat Builder  
> **Wave:** 3 | **Priority:** P0 🌟 | **Ref PRD:** [F01-ai-chat-builder.md](../prd/F01-ai-chat-builder.md)

---

## US-002: AI Chat Builder — Generate Site from Prompt ⭐

**Wave 3** | **P0 🌟** | **XL** | Status: Ready

### Story
```
As a   SME owner mới đăng ký
I want mô tả business bằng ngôn ngữ tự nhiên (BM/EN/Mixed)
So that AI tạo đầy đủ website mà không cần pick template hay fill form
```

### Acceptance Criteria
```gherkin
GIVEN user ở /builder/new
WHEN  nhập mô tả (VD: "Tiệm bánh handmade quận 3, mở 2020")
AND   click Enter hoặc nút gửi
THEN  AI stream response ngay trong < 2 giây
AND   live preview bên phải update realtime
AND   progress: "Đang tạo Hero... About... Contact..."
AND   toàn bộ site hoàn thành trong < 60 giây

GIVEN AI cần thêm thông tin
WHEN  prompt thiếu tên shop hoặc ngành
THEN  AI hỏi tối đa 2 câu clarifying
AND   sau 2 câu → generate luôn với assumption hợp lý

GIVEN site đã generate xong
WHEN  user thấy preview
THEN  có 2 options: "Tinh chỉnh" (→ /editor) và "Publish ngay"
AND   auto-save draft vào DB

GIVEN user refresh/back trong lúc generate
WHEN  quay lại /builder/new
THEN  hiện lại draft, không mất progress

GIVEN AI service lỗi (timeout, API fail)
WHEN  generation thất bại
THEN  toast đỏ "Không thể tạo website. Thử lại"
AND   nút "Thử lại" KHÔNG cần nhập lại prompt
```

### MY Market Notes
- AI must understand BM, Manglish, and mixed-language prompts
- Category detection should map to MY business types (Modest Wear, Halal F&B, etc.)
- Color palette should match cultural context (ref: malaysia-market-context.md §6)

---

## US-003: Store Setup — Basic Info

**Wave 1** | **P0** | **S** | Status: Ready

### Story
```
As a   owner vừa đăng ký
I want cấu hình tên và ngành cho website
So that AI có đủ context để generate
```

### Acceptance Criteria
```gherkin
GIVEN user ở /onboarding chọn "Tạo bằng AI"
WHEN  redirect sang /builder/new
THEN  AI hỏi tên business + ngành trong chat (không form riêng)
AND   thông tin này lưu vào site.aiContext trong DB

GIVEN user chọn "Chọn Template"
WHEN  redirect sang /templates
THEN  hiện template gallery, chọn template → tạo site → /editor/:id
```

### Definition of Done
- [ ] 9-Point Checklist pass
- [ ] Site record tạo đúng trong Payload CMS

---

## US-004: AI Image Generation for Store

**Wave 3** | **P0** | **L** | Status: Draft

### Story
```
As a   store owner with no product photography
I want AI to generate professional-looking hero images
So that my store looks complete and trustworthy from day one
```

### Acceptance Criteria
```gherkin
GIVEN AI generates a store for "kedai baju kurung, warna pink pastel"
WHEN  image generation runs via OpenAI DALL-E / image API
THEN  Hero banner (1200×400px) is generated with:
      fashion-appropriate imagery, matching colour palette
  AND auto-uploaded to CDN (Cloudinary / Payload media)
```

### Additional Criteria
- [ ] If image API fails, curated stock image from correct category is used as fallback — never broken image
- [ ] Generated images stored in Payload CMS media library with store-namespaced path
- [ ] User can regenerate any image by clicking "Generate New Image"
- [ ] All AI-generated images labelled "AI Generated ✨" in editor — label removed on storefront

---

## US-005: One-Click Publish to Live Store

**Wave 3** | **P0** | **M** | Status: Draft

### Story
```
As a   store owner who has finished building
I want to publish my store with one click
So that my website goes live immediately on my subdomain
```

### Acceptance Criteria
```gherkin
GIVEN I click the "Publish" button in the editor toolbar
WHEN  publish action completes
THEN  my store is live at {slug}.primeweb.app within 30 seconds
  AND a success toast shows the live URL with a "View Store" button

GIVEN my store is published
WHEN  I make changes and click "Publish" again
THEN  changes are live within 30 seconds
  AND sitemap is re-generated
```

### Additional Criteria
- [ ] Publish button always visible in editor toolbar — disabled only if critical validation errors
- [ ] Editor changes from "Draft" badge to "Live" badge with green dot after first publish
- [ ] Published store URL is copyable — one-click copy with clipboard feedback toast
- [ ] SEO meta tags auto-generated on first publish if not manually set
