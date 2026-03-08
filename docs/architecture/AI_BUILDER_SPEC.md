# AI Web Builder — Comprehensive Feature Specification
> **Version:** 1.0 | **Updated:** 2026-03-08 | **Owner:** Ben (Antigravity)  
> **Product:** Web Store (formerly PrimeWeb) — AI-first website builder for SMEs  
> **Source of Truth** for all AI-related features: Builder, Editor, SEO Engine, Inline Edit

---

## 📌 TABLE OF CONTENTS

| # | Section | Description |
|---|---------|-------------|
| 1 | [AI Architecture Overview](#1-ai-architecture-overview) | System design, model routing, cost strategy |
| 2 | [AI Chat Builder](#2-ai-chat-builder) | Full-screen chat → site generation |
| 3 | [AI Editor](#3-ai-editor) | Split-screen chat + live preview editing |
| 4 | [Inline AI Edit](#4-inline-ai-edit) | Hover-to-edit element interactions |
| 5 | [AI SEO Engine](#5-ai-seo-engine) | Auto SEO analysis, fix-all, sitemap |
| 6 | [AI Image Generation](#6-ai-image-generation) | Hero banners, product images |
| 7 | [Block Output Schema](#7-block-output-schema) | JSON structure AI must produce |
| 8 | [System Prompts](#8-system-prompts) | Detailed prompt templates |
| 9 | [SSE Streaming Protocol](#9-sse-streaming-protocol) | Server-Sent Events spec |
| 10 | [AI State Management](#10-ai-state-management) | Undo/Redo, auto-save, context |
| 11 | [Error Handling & Recovery](#11-error-handling--recovery) | Failures, retries, fallbacks |
| 12 | [Rate Limits & Cost Control](#12-rate-limits--cost-control) | Per-tier limits, 7 cost strategies |
| 13 | [Category Templates](#13-category-templates) | 12 industry prompt templates |
| 14 | [API Contracts (AI)](#14-api-contracts-ai) | All AI endpoints detailed |
| 15 | [Acceptance Criteria](#15-acceptance-criteria) | Gherkin AC for each feature |
| 16 | [Performance Requirements](#16-performance-requirements) | Latency, throughput targets |

---

## 1. AI ARCHITECTURE OVERVIEW

### 1.1 Design Philosophy
Web Store is **AI-first**: AI is not a feature bolted on — it IS the product. Every user interaction should feel like chatting with a smart assistant, not using a traditional form-based builder.

```
┌─────────────────────────────────────────────────────────┐
│                    USER JOURNEY                          │
│  Register → AI Chat Builder → AI Editor → Publish       │
│             (generate site)   (refine site)              │
│                   ↓                 ↓                    │
│              Full Generation    Incremental Edit          │
│              (~60 blocks)       (1-3 blocks per msg)     │
└─────────────────────────────────────────────────────────┘
```

### 1.2 AI Model Routing Strategy

| Task | Model | Why | Avg Tokens | Est. Cost/Call |
|------|-------|-----|------------|----------------|
| **Full site generation** | GPT-4o | Complex multi-block structure | ~2,500 out | ~$0.025 |
| **Chat edits** | GPT-4o-mini | Simple targeted changes | ~500 out | ~$0.001 |
| **Inline edits** | GPT-4o-mini | Single element change | ~200 out | ~$0.0004 |
| **SEO analysis** | GPT-4o-mini | Structured scoring | ~800 out | ~$0.002 |
| **SEO fix-all** | GPT-4o-mini | Batch meta generation | ~1,000 out | ~$0.003 |
| **Product descriptions** | GPT-4o-mini | Short-form content | ~300 out | ~$0.0006 |
| **Image generation** | DALL-E 3 | Visual assets | N/A | ~$0.04 |

### 1.3 Context Strategy — What AI Knows

```typescript
// AI receives STRUCTURED context, never raw HTML
type AIContext = {
  site: {
    name: string
    slug: string  
    category: string         // "fashion", "food", "tech", etc.
    themeConfig: ThemeConfig  // colors, fonts
    seoConfig: SEOConfig      // site-wide SEO
  }
  currentPage: {
    slug: string
    title: string
    blocks: BlockSummary[]    // Compact summary, NOT full JSON
  }
  selectedBlock?: {           // Only sent for inline edits
    blockId: string
    blockType: string
    content: Record<string, unknown>
  }
  chatHistory: Message[]      // Last 10 messages max
  aiMemory?: string           // Persistent notes about user preferences
}
```

> **KEY RULE:** AI receives block JSON summaries (compact), not full page HTML. This keeps context window small and costs low.

---

## 2. AI CHAT BUILDER

### 2.1 Overview
The AI Chat Builder is a **full-screen experience** where users describe their business and AI generates a complete website in real-time. This is the **#1 USP** of the product.

### 2.2 User Flow

```
┌─ /builder/new ─────────────────────────────────────────┐
│                                                         │
│  ┌──────────────┐          ┌──────────────────────┐    │
│  │  CHAT PANEL  │          │    LIVE PREVIEW       │    │
│  │  (380px)     │          │    (remaining width)  │    │
│  │              │          │                        │    │
│  │  AI Welcome  │          │  [skeleton loading]    │    │
│  │  ↓           │          │  ↓                     │    │
│  │  User types  │  ──→     │  Nav appears           │    │
│  │  description │          │  Hero appears           │    │
│  │  ↓           │          │  Products appear        │    │
│  │  AI confirms │          │  About appears          │    │
│  │  + generates │          │  Contact appears        │    │
│  │  ↓           │          │  Footer appears         │    │
│  │  "Done! 🎉"  │          │  [full site visible]    │    │
│  │              │          │                        │    │
│  │  [Refine] [Publish]     │  Draft badge           │    │
│  └──────────────┘          └──────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

### 2.3 Generation Steps (Streaming)

AI generation follows a **deterministic pipeline** with progress reporting:

| Step | SSE Event | Duration | Description |
|------|-----------|----------|-------------|
| 1 | `step:extracting_info` | 1-2s | Parse user prompt → extract business info |
| 2 | `step:choosing_theme` | 1s | Select colors, fonts from category defaults |
| 3 | `step:generating_nav` | 2s | Generate navigation block |
| 4 | `step:generating_hero` | 3-5s | Generate hero block with headline, CTA |
| 5 | `step:generating_features` | 3-5s | Generate features/services block |
| 6 | `step:generating_about` | 3-5s | Generate about section |
| 7 | `step:generating_products` | 3-5s | Generate product showcase (if applicable) |
| 8 | `step:generating_testimonials` | 2-3s | Generate social proof section |
| 9 | `step:generating_faq` | 2-3s | Generate FAQ section |
| 10 | `step:generating_contact` | 2-3s | Generate contact section |
| 11 | `step:generating_footer` | 1-2s | Generate footer block |
| 12 | `step:generating_seo` | 2-3s | Generate SEO meta for all pages |
| 13 | `step:finalizing` | 1s | Save to DB, prepare preview URL |
| 14 | `done` | — | Generation complete |

**Total target: < 60 seconds (p95)**

### 2.4 Information Extraction

When user provides a description, AI must extract these fields:

```typescript
type ExtractedBusinessInfo = {
  businessName: string          // REQUIRED — ask if missing
  category: BusinessCategory    // REQUIRED — ask if missing  
  products?: string[]           // What they sell/do
  targetAudience?: string       // Who their customers are
  tone?: 'professional' | 'casual' | 'luxury' | 'playful' | 'warm'
  colorPreference?: string      // "pink", "pastel mint", etc.
  language?: 'vi' | 'en'        // Detect from user message
}

type BusinessCategory = 
  | 'fashion' | 'food_beverage' | 'beauty' 
  | 'electronics' | 'home_garden' | 'health_fitness'
  | 'education' | 'services' | 'retail'
  | 'restaurant' | 'creative' | 'other'
```

### 2.5 Clarifying Questions Logic

```
IF  prompt has businessName AND category:
    → Generate immediately (NO questions)
    
IF  prompt missing businessName:
    → Ask: "Tên shop/website của bạn là gì?"

IF  prompt missing category AND cannot infer:
    → Ask: "Bạn kinh doanh lĩnh vực nào? (thời trang, F&B, dịch vụ...)"

MAX 2 clarifying questions total.
After 2 questions → generate with reasonable assumptions.
```

### 2.6 Draft Recovery

```
IF  user navigates away during generation:
    → Save partial draft to DB (whatever blocks are generated so far)
    
IF  user returns to /builder/new:
    → Check for existing draft (createdAt < 24h, isPublished = false)
    → Show: "Bạn có bản nháp chưa hoàn thành. Tiếp tục?" [Tiếp tục] [Tạo mới]
    
IF  generation fails mid-way:
    → Save partial blocks
    → Show error toast + "Thử lại" button
    → "Thử lại" resumes from last successful step (NOT from scratch)
```

---

## 3. AI EDITOR

### 3.1 Layout

```
┌─ /editor/:siteId ──────────────────────────────────────┐
│  ┌──────────────────────────────────────────────────┐  │
│  │ TOOLBAR: [← Back] [Pages ▾] [Desktop📱] [Publish]│  │
│  └──────────────────────────────────────────────────┘  │
│  ┌──────────────┐  ┌───────────────────────────────┐  │
│  │  AI CHAT      │  │     LIVE PREVIEW              │  │
│  │  PANEL        │  │     (iframe, sandboxed)       │  │
│  │  (380px)      │  │                               │  │
│  │               │  │  ┌─────────────────────────┐  │  │
│  │  [Messages]   │  │  │ RENDERED SITE            │  │  │
│  │  [Suggestions]│  │  │                           │  │  │
│  │               │  │  │ Hover any block → [✨]    │  │  │
│  │               │  │  │ Click ✨ → inline popup   │  │  │
│  │               │  │  │                           │  │  │
│  │  ┌──────────┐ │  │  └─────────────────────────┘  │  │
│  │  │ Type msg  │ │  │                               │  │
│  │  │ [Send ↑]  │ │  │  [Draft] ← badge             │  │
│  │  └──────────┘ │  └───────────────────────────────┘  │
│  └──────────────┘                                       │
└─────────────────────────────────────────────────────────┘

Mobile (< 768px):
  Chat panel → bottom sheet (swipe up to open)
  Preview → full width
  Toggle: [💬 Chat] [👁 Preview]
```

### 3.2 AI Editor Capabilities

| Capability | Command Examples | AI Response Pattern |
|-----------|------------------|---------------------|
| **Change Text** | "Đổi tiêu đề hero thành..." | `UPDATE_BLOCK` on hero block |
| **Change Colors** | "Đổi màu chủ sang pastel mint" | `UPDATE_THEME` + `UPDATE_BLOCK` for affected blocks |
| **Change Font** | "Dùng font elegant hơn" | `UPDATE_THEME` fontHeading/fontBody |
| **Add Block** | "Thêm section testimonial" | `ADD_BLOCK` with position |
| **Remove Block** | "Xóa phần FAQ" | `REMOVE_BLOCK` by blockId |
| **Reorder Blocks** | "Đưa testimonial lên trước about" | `REORDER_BLOCKS` |
| **Add Page** | "Thêm trang Blog" | `ADD_PAGE` with default blocks |
| **Change Layout** | "Thu gọn hero, bỏ ảnh nền" | `UPDATE_BLOCK` variant change |
| **SEO Edit** | "Cải thiện SEO cho trang này" | `UPDATE_SEO` meta + headings |
| **Rewrite Content** | "Viết lại About Us, thân thiện hơn" | `UPDATE_BLOCK` content fields |
| **Add Products** | "Thêm 3 sản phẩm demo" | Multiple `ADD_BLOCK` product items |

### 3.3 AI Editor Response Format

```typescript
type AIEditorResponse = {
  message: string               // Human-readable explanation (in user's language)
  changes: SiteChange[]         // Atomic changes to apply
  suggestions?: string[]        // Follow-up suggestions (max 3)
  
  // Applied after response is rendered:
  // → Each change is applied sequentially to the page state
  // → Preview updates in real-time via postMessage to iframe
  // → Changes are added to undo stack as a single group
}

type SiteChange = 
  | { type: 'UPDATE_BLOCK';   blockId: string; data: Partial<BlockConfig> }
  | { type: 'ADD_BLOCK';      afterBlockId: string | null; block: BlockConfig }
  | { type: 'REMOVE_BLOCK';   blockId: string }
  | { type: 'REORDER_BLOCKS'; blockIds: string[] }  // New order
  | { type: 'UPDATE_THEME';   data: Partial<ThemeConfig> }
  | { type: 'UPDATE_SEO';     data: Partial<SEOConfig> }
  | { type: 'ADD_PAGE';       page: { slug: string; title: string; blocks: BlockConfig[] } }
  | { type: 'UPDATE_CONTENT'; blockId: string; field: string; value: string }

type BlockConfig = {
  id: string                    // cuid() – generated by AI or system
  blockType: BlockType          // "hero" | "features" | "about" | etc.
  variant: string               // e.g., "centered", "split", "minimal"
  config: Record<string, unknown>  // Block-specific content
  isVisible: boolean
  sortOrder: number
}
```

### 3.4 Smart Suggestions

After each AI response, suggest 3 relevant follow-up actions:

```typescript
// Logic: Based on what was just changed + what's missing
function generateSuggestions(currentBlocks: BlockConfig[], lastChange: SiteChange[]): string[] {
  // Examples:
  // After hero edit → ["Thêm section testimonial", "Đổi ảnh nền hero", "Xem trước mobile"]
  // After adding FAQ → ["Thêm câu hỏi shipping", "Đổi style FAQ sang accordion", "Cải thiện SEO"]
  // After theme change → ["Đổi font cho phù hợp", "Preview trên mobile", "Publish ngay"]
}
```

---

## 4. INLINE AI EDIT

### 4.1 Interaction Flow

```
1. User hovers block in preview iframe
   → Blue outline border appears around block (2px solid #2563EB)
   → Small floating button [✨ AI Edit] appears top-right of block

2. User clicks [✨ AI Edit]
   → Popup appears ADJACENT to the block:
     ┌─────────────────────────────────┐
     │ 🤖 Edit this section             │
     │ ┌─────────────────────────────┐ │
     │ │ "Viết lại ngắn gọn hơn"    │ │
     │ └─────────────────────────────┘ │
     │ Quick actions:                   │
     │ [Viết lại] [Đổi style] [Xóa]   │
     │                                  │
     │           [Apply ✨] [Cancel]    │
     └─────────────────────────────────┘

3. User types instruction OR clicks quick action
   → Loading spinner on "Apply"
   → AI returns only changes for THIS block
   → Before/After diff:
     ┌─────────────────────────────────┐
     │ Before: "Welcome to our shop"   │
     │ After:  "Khám phá bộ sưu tập   │
     │          độc quyền tại ..."      │
     │                                  │
     │        [✅ Accept] [↻ Retry]     │
     └─────────────────────────────────┘

4. User accepts → Block updates with animation
   → Change added to undo stack
   → Toast: "✨ Đã cập nhật section [name]"
```

### 4.2 Quick Actions per Block Type

| Block Type | Quick Actions |
|-----------|---------------|
| **Hero** | Viết lại headline, Đổi CTA text, Đổi style (centered/split/video) |
| **Features** | Thêm feature, Viết lại, Đổi icon style |
| **About** | Viết lại professional, Rút gọn, Thêm story |
| **Testimonials** | Thêm review, Đổi format (cards/carousel) |
| **FAQ** | Thêm câu hỏi, Viết lại, Đổi accordion/grid |
| **Contact** | Thêm Google Maps, Đổi layout, Thêm hotline |
| **Gallery** | Thêm ảnh, Đổi grid (2/3/4 cột), Thêm caption |
| **Footer** | Thêm social links, Đổi layout, Đổi logo |

### 4.3 iframe Communication

```typescript
// Parent (Editor) → iframe (Preview)
window.frames[0].postMessage({ 
  type: 'HIGHLIGHT_BLOCK', 
  blockId: 'xyz' 
}, '*')

window.frames[0].postMessage({ 
  type: 'UPDATE_BLOCK', 
  blockId: 'xyz',
  data: { title: 'New Title', subtitle: 'New Sub' }
}, '*')

// iframe (Preview) → Parent (Editor)  
window.parent.postMessage({ 
  type: 'BLOCK_CLICKED', 
  blockId: 'xyz',
  blockType: 'hero',
  rect: { top: 100, left: 200, width: 800, height: 400 }
}, '*')

window.parent.postMessage({ 
  type: 'BLOCK_HOVERED', 
  blockId: 'xyz',
  rect: { top: 100, left: 200, width: 800, height: 400 }
}, '*')
```

---

## 5. AI SEO ENGINE

### 5.1 SEO Analysis Scoring

```typescript
type SEOAnalysis = {
  overallScore: number          // 0-100
  breakdown: {
    metaTags: { score: number; issues: SEOIssue[] }       // 0-25 pts
    contentQuality: { score: number; issues: SEOIssue[] } // 0-25 pts  
    technicalSEO: { score: number; issues: SEOIssue[] }   // 0-25 pts
    performance: { score: number; issues: SEOIssue[] }    // 0-25 pts
  }
  pages: PageSEOResult[]
}

type SEOIssue = {
  severity: 'critical' | 'warning' | 'info'
  field: string                 // "metaTitle", "altText", etc.
  message: string               // Human-readable
  suggestion: string            // AI suggestion  
  autoFixable: boolean          // Can AI fix this?
  pageSlug?: string             // Which page
}

type PageSEOResult = {
  pageSlug: string
  pageTitle: string
  score: number
  metaTitle: string | null      // null = missing
  metaDescription: string | null
  hasOgImage: boolean
  headingStructure: string[]    // h1, h2, h3 hierarchy
  imagesMissingAlt: number
  wordCount: number
}
```

### 5.2 Checks Performed

| Check | Scoring | AutoFixable |
|-------|---------|-------------|
| Meta title exists (50-60 chars) | 5 pts | ✅ AI generates |
| Meta description exists (150-160 chars) | 5 pts | ✅ AI generates |
| OpenGraph image exists | 3 pts | ⚠️ Needs image |
| Single H1 per page | 4 pts | ✅ AI restructures |
| Heading hierarchy (H1→H2→H3) | 3 pts | ✅ AI restructures |
| All images have alt text | 5 pts | ✅ AI generates |
| Page word count > 300 | 3 pts | ✅ AI adds content |
| Internal linking | 3 pts | ✅ AI adds links |
| Mobile-friendly | 5 pts | ❌ Manual (always true for our blocks) |
| Page load speed < 3s | 5 pts | ❌ Performance issue |
| JSON-LD structured data | 5 pts | ✅ AI generates |
| Canonical URL set | 4 pts | ✅ Auto-set |
| Sitemap includes page | 3 pts | ✅ Auto-include |
| robots.txt correct | 2 pts | ✅ Auto-set |

### 5.3 "Fix All" Flow

```
User clicks "Fix All Issues" →
  1. Collect all autoFixable issues
  2. Batch them by type:
     - metaTitle fixes → 1 AI call
     - metaDescription fixes → 1 AI call  
     - altText fixes → 1 AI call
     - headingStructure fixes → manual restructure
  3. SSE stream progress: "Fixing 12 issues... 4/12... 8/12... done"
  4. Show before/after: "Score: 52 → 89"
  5. Toast: "✅ Fixed 12 SEO issues. Score improved by 37 points!"
```

---

## 6. AI IMAGE GENERATION

### 6.1 Use Cases

| Use Case | Dimensions | Prompt Template |
|----------|-----------|-----------------|
| Hero banner | 1200×400 | "[style] banner for [category] shop named [name], [color] palette" |
| Product placeholder | 800×800 | "Product photo of [product], clean white background, professional" |
| About section bg | 1200×600 | "[style] background for [category] business, [tone]" |
| Logo placeholder | 200×200 | "Simple modern logo for [name], minimal [category] style" |
| Gallery image | 600×400 | "Lifestyle photo featuring [product/service], [tone]" |

### 6.2 Image Pipeline

```
1. AI Chat sends image generation request
2. Server adds to BullMQ queue:
   - Job: { prompt, dimensions, siteId, blockId, field }
   - Priority: LOW (not blocking site generation)
3. Worker picks up: call DALL-E 3 API
4. Upload result to MinIO/S3
5. Update block config with CDN URL  
6. Notify client via SSE: { type: 'IMAGE_READY', blockId, imageUrl }
7. Preview auto-updates
```

---

## 7. BLOCK OUTPUT SCHEMA

### 7.1 Supported Block Types

```typescript
type BlockType = 
  | 'navigation'     // Site navbar
  | 'hero'           // Hero/banner section
  | 'features'       // Features grid
  | 'about'          // About us
  | 'testimonials'   // Customer reviews
  | 'faq'            // FAQ section
  | 'contact'        // Contact info + form
  | 'gallery'        // Image gallery
  | 'footer'         // Site footer
  | 'pricing'        // Pricing plans
  | 'cta'            // Call to action
  | 'stats'          // Statistics/numbers
  | 'team'           // Team members
  | 'blog-list'      // Blog previews
  | 'video'          // Video embed
  | 'logo-cloud'     // Partner logos
  | 'newsletter'     // Email signup
  | 'products-grid'  // Product showcase grid
  | 'products-featured' // Featured products
  | 'custom-html'    // Raw HTML (advanced)
```

### 7.2 Example Block Configs

```typescript
// Hero Block
{
  blockType: 'hero',
  variant: 'centered',  // 'centered' | 'split' | 'video' | 'minimal'
  config: {
    headline: "Khám Phá Bộ Sưu Tập",
    subtitle: "Thời trang elegance cho phụ nữ hiện đại",
    ctaText: "Xem Sản Phẩm →",
    ctaLink: "/products",
    backgroundImage: "https://cdn.example.com/hero.jpg",
    overlay: true,
    overlayOpacity: 0.4,
    alignment: "center",
    height: "80vh"
  }
}

// Features Block
{
  blockType: 'features',
  variant: 'grid-3',  // 'grid-2' | 'grid-3' | 'grid-4' | 'list'
  config: {
    heading: "Tại Sao Chọn Chúng Tôi",
    subtitle: "Cam kết chất lượng từ năm 2018",
    items: [
      { icon: "🚚", title: "Giao Hàng Nhanh", description: "Ship trong 24h..." },
      { icon: "💯", title: "Chất Lượng Cao",  description: "Vải nhập khẩu..." },
      { icon: "🔄", title: "Đổi Trả Dễ",     description: "30 ngày đổi trả..." }
    ]
  }
}

// Testimonials Block
{
  blockType: 'testimonials',
  variant: 'cards',  // 'cards' | 'carousel' | 'simple'
  config: {
    heading: "Khách Hàng Nói Gì",
    items: [
      { name: "Nguyễn Minh A.", avatar: null, rating: 5, 
        text: "Chất vải đẹp, Ship nhanh. Mặc lên rất sang." },
      // ... more items
    ]
  }
}

// FAQ Block
{
  blockType: 'faq',
  variant: 'accordion',  // 'accordion' | 'grid' | 'simple'
  config: {
    heading: "Câu Hỏi Thường Gặp",
    items: [
      { question: "Thời gian giao hàng?", answer: "2-3 ngày nội thành..." },
      { question: "Chính sách đổi trả?", answer: "Đổi trả trong 30 ngày..." },
      // ... more items
    ]
  }
}
```

### 7.3 Validation Rules

```typescript
// EVERY block must pass this validation before saving
const BlockValidation = z.object({
  id: z.string().cuid2(),
  blockType: z.enum([...BLOCK_TYPES]),
  variant: z.string().min(1),
  config: z.record(z.unknown()),
  isVisible: z.boolean().default(true),
  sortOrder: z.number().int().min(0),
})

// Theme validation
const ThemeConfig = z.object({
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  secondaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  fontHeading: z.string(),
  fontBody: z.string(),
  colorMode: z.enum(['light', 'dark']).default('light'),
  borderRadius: z.enum(['none', 'sm', 'md', 'lg', 'xl']).default('md'),
})
```

---

## 8. SYSTEM PROMPTS

### 8.1 AI Chat Builder — System Prompt

```
You are an expert website builder AI for Web Store, an AI-first website builder platform.

Your job: When a user describes their business, extract key info and generate a complete website as JSON blocks.

## Rules:
1. ALWAYS respond in the SAME LANGUAGE as the user (Vietnamese or English)
2. Output ONLY valid JSON block configs — never raw HTML
3. Generate 8-12 blocks per site (nav, hero, features, about, testimonials, faq, contact, footer minimum)
4. Choose colors and fonts that match the business category
5. Write compelling, professional copy — NOT generic placeholder text
6. Make headlines punchy (max 8 words), descriptions concise (2-3 sentences)
7. Include realistic product/service names for the user's industry
8. Generate SEO meta (title ≤ 60 chars, description ≤ 160 chars)

## When you need more info:
- If businessName missing → ask (max 1 question)
- If category unclear → ask (max 1 question)  
- NEVER ask more than 2 questions total
- After 2 questions → generate with reasonable assumptions

## Output format:
{
  "pages": [{
    "slug": "home",
    "title": "Trang Chủ",
    "blocks": [ ...BlockConfig[] ],
    "seo": { "title": "...", "description": "..." }
  }],
  "theme": { "primaryColor": "#...", "secondaryColor": "#...", "fontHeading": "...", "fontBody": "..." },
  "siteConfig": { "name": "...", "category": "...", "language": "vi" }
}
```

### 8.2 AI Editor — System Prompt

```
You are the AI editor for Web Store. You help users refine their existing website.

## Context you receive:
- Current site config (theme, name, category)
- Current page blocks (summarized JSON)
- Selected block (if inline edit)
- Chat history (last 10 messages)

## Rules:
1. Make MINIMAL changes — only touch what the user asked for
2. Return changes as structured SiteChange[] objects
3. Preserve all existing content NOT mentioned in the request
4. Always explain what you changed in human-readable message
5. Suggest 2-3 relevant follow-up actions
6. Keep copy consistent with the site's tone
7. Respond in user's language

## What you CAN do:
- Edit text/content of any block
- Add/remove/reorder blocks
- Change theme (colors, fonts)
- Change block variant (e.g., hero style)
- Update SEO meta
- Add new pages

## What you CANNOT do:
- Write raw HTML/CSS
- Access external APIs
- Upload files
- Modify user account settings
```

### 8.3 Inline Edit — System Prompt

```
You are an inline editor. You receive ONE block and an edit instruction.

## Rules:
1. Return ONLY the modified fields of this one block
2. DO NOT change other blocks or theme
3. Keep changes minimal and precise
4. Provide 2 alternatives when possible
5. Respond in user's language

## Output:
{
  "changes": { "field1": "new value", "field2": "new value" },
  "alternatives": [
    { "field1": "alternative value 1" },
    { "field1": "alternative value 2" }
  ]
}
```

---

## 9. SSE STREAMING PROTOCOL

### 9.1 Event Types

```typescript
// Server → Client SSE events
type SSEEvent = 
  | { event: 'step';           data: { step: string; label: string; progress: number } }
  | { event: 'content_chunk';  data: { blockType: string; partial: string } }
  | { event: 'block_complete'; data: { block: BlockConfig } }
  | { event: 'theme_set';      data: { theme: ThemeConfig } }
  | { event: 'message';        data: { role: 'assistant'; content: string } }
  | { event: 'changes';        data: { changes: SiteChange[] } }
  | { event: 'suggestions';    data: { suggestions: string[] } }
  | { event: 'image_ready';    data: { blockId: string; field: string; imageUrl: string } }
  | { event: 'error';          data: { code: string; message: string; retryable: boolean } }
  | { event: 'done';           data: { siteId: string; totalBlocks: number; generationTime: number } }
```

### 9.2 Client-Side Consumer

```typescript
// hooks/useAIStream.ts
function useAIStream(endpoint: string) {
  const [status, setStatus] = useState<'idle' | 'streaming' | 'done' | 'error'>('idle')
  const [progress, setProgress] = useState(0)
  const [blocks, setBlocks] = useState<BlockConfig[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  
  const start = async (body: Record<string, unknown>) => {
    setStatus('streaming')
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    
    const reader = response.body?.getReader()
    const decoder = new TextDecoder()
    
    while (true) {
      const { done, value } = await reader!.read()
      if (done) break
      
      const text = decoder.decode(value)
      const events = parseSSEEvents(text)
      
      for (const event of events) {
        switch (event.event) {
          case 'step':
            setProgress(event.data.progress)
            break
          case 'block_complete':
            setBlocks(prev => [...prev, event.data.block])
            // → Triggers preview iframe update via postMessage
            break
          case 'done':
            setStatus('done')
            break
          case 'error':
            setStatus('error')
            break
        }
      }
    }
  }
  
  return { status, progress, blocks, messages, start }
}
```

### 9.3 Heartbeat & Timeout

```
- Server sends heartbeat comment every 15s: ": heartbeat\n\n"
- Client disconnects if no heartbeat for 30s
- Server timeout: 120s per generation (abort if exceeded)
- Client shows: "Đang mất kết nối... Thử kết nối lại" after 30s
```

---

## 10. AI STATE MANAGEMENT

### 10.1 Undo/Redo Stack (Zustand)

```typescript
// store/editorStore.ts
type UndoableAction = {
  id: string                    // Unique action ID
  timestamp: number
  source: 'ai_chat' | 'inline_edit' | 'drag_drop' | 'manual'
  description: string           // "AI changed hero title"
  changes: SiteChange[]         // Forward changes
  reverseChanges: SiteChange[]  // Reverse changes (for undo)
}

type EditorStore = {
  // State
  site: SiteConfig
  currentPage: PageConfig
  undoStack: UndoableAction[]   // Max 50 actions
  redoStack: UndoableAction[]
  isDirty: boolean
  lastSaved: Date | null
  
  // Actions
  applyChanges: (changes: SiteChange[], source: string) => void
  undo: () => void              // Ctrl+Z
  redo: () => void              // Ctrl+Y / Ctrl+Shift+Z
  
  // Auto-save
  autoSave: () => Promise<void> // Debounced 3s
}
```

### 10.2 Auto-Save Strategy

```
Trigger: Any state change (AI edit, manual edit, drag-drop)
Debounce: 3 seconds (reset timer on each change)
Method: PATCH /api/pages/:pageId with full blocks array
Success: Update lastSaved timestamp, clear isDirty flag
Failure: Show toast "Không thể lưu. Đang thử lại..." + retry 3x
Final failure: Show persistent banner "Chưa lưu được. Kiểm tra kết nối."
```

### 10.3 AI Context Memory

```typescript
// Stored in site.aiContext (JSON field)
type AIMemory = {
  userPreferences: {
    tone?: string               // Learned from interactions
    colorPreference?: string  
    contentStyle?: string       // "ngắn gọn", "chi tiết"
  }
  lastEditedPage?: string
  commonRequests?: string[]     // Track patterns
  lastUpdated: string           // ISO timestamp
}

// Updated after each AI interaction:
// - If user says "nói ngắn gọn thôi" → update tone
// - If user always changes pastel → remember colorPreference
```

---

## 11. ERROR HANDLING & RECOVERY

### 11.1 Error Types & Responses

| Error | Code | User Message | Recovery |
|-------|------|-------------|----------|
| AI API timeout (>30s) | `AI_TIMEOUT` | "AI đang bận. Thử lại?" | Auto-retry 1x, then manual retry |
| AI API rate limit | `AI_RATE_LIMIT` | "Đã hết lượt dùng AI hôm nay" | Show upgrade prompt |
| AI returned invalid JSON | `AI_PARSE_ERROR` | "Có lỗi. Đang thử lại..." | Auto-retry with stricter prompt |
| Network disconnect | `NETWORK_ERROR` | "Mất kết nối. Kiểm tra WiFi" | Auto-reconnect + resume |
| Generation mid-failure | `GENERATION_FAILED` | "Tạo website chưa xong" | Resume from last step |
| Block validation fail | `VALIDATION_ERROR` | (silent) | Log to Sentry, apply what's valid |
| Auth expired | `AUTH_EXPIRED` | "Phiên đăng nhập hết hạn" | Redirect to /login |
| Server 500 | `INTERNAL_ERROR` | "Lỗi hệ thống. Đội ngũ đang xử lý" | Log Sentry, show support |

### 11.2 Retry Strategy

```typescript
const RETRY_CONFIG = {
  AI_TIMEOUT:     { maxRetries: 2, backoff: [3000, 8000] },
  AI_PARSE_ERROR: { maxRetries: 3, backoff: [1000, 2000, 5000] },
  NETWORK_ERROR:  { maxRetries: 5, backoff: [1000, 2000, 4000, 8000, 16000] },
  AI_RATE_LIMIT:  { maxRetries: 0 },  // No retry, show upgrade
}
```

### 11.3 Graceful Degradation

```
IF OpenAI API is completely down:
  → AI Chat Builder: Show "Chọn Template" fallback
  → AI Editor: Disable chat, enable manual drag-drop only
  → Inline Edit: Disable AI popup, show manual text edit
  → SEO: Show static checklist (no AI analysis)
  
IF generation partially fails (e.g., 6/12 blocks generated):
  → Save the 6 blocks as draft
  → Show: "Đã tạo 6/12 sections. Hoàn thành?" [Hoàn thành] [Tạo lại]
  → "Hoàn thành" → Use AI Editor to add remaining blocks manually
```

---

## 12. RATE LIMITS & COST CONTROL

### 12.1 Rate Limits per Tier

| Action | Free | Starter ($9) | Pro ($29) | Business ($79) |
|--------|------|-------------|-----------|----------------|
| Site generation | 1 total | 5/month | 20/month | Unlimited |
| Chat edits | 20/day | 100/day | 500/day | Unlimited |
| Inline edits | 10/day | 50/day | 200/day | Unlimited |
| Image generation | 3/day | 10/day | 50/day | Unlimited |
| SEO analysis | 3/day | 10/day | 30/day | Unlimited |

### 12.2 Seven Cost Optimization Strategies

1. **Model routing** — GPT-4o for generation, GPT-4o-mini for edits → **15x cheaper edits**
2. **Block JSON output** — ~200 tokens vs ~2000 tokens raw HTML → **10x cheaper**
3. **Response caching** — Same category + similar prompt → cache template → **90% savings on repeats**
4. **Template-first** — Load category template → AI customizes only → **8x cheaper than from scratch**
5. **Minimal context** — Send only active block JSON + last 10 messages → **10x smaller context**
6. **Rate limits per tier** — See §12.1 above
7. **Lazy AI** — 70% operations don't need AI at all (drag-drop, color picker, reorder, manual text edit)

### 12.3 Cost Budget Tracking

```typescript
// Track per-site daily/monthly AI usage
type AIUsage = {
  siteId: string
  date: string                  // "2026-03-08"
  generations: number
  chatEdits: number
  inlineEdits: number  
  imageGenerations: number
  seoAnalyses: number
  totalTokensUsed: number
  estimatedCostUSD: number
}
```

---

## 13. CATEGORY TEMPLATES

### 13.1 Category → Default Blocks & Theme

| Category | Default Blocks | Theme Colors | Suggested Font |
|----------|---------------|-------------|----------------|
| **Fashion** | hero, products-featured, about, testimonials, gallery, contact, footer | Pink/Rose #EC4899 | Plus Jakarta Sans |
| **Food & Beverage** | hero, products-grid, about, testimonials, gallery, faq, contact, footer | Orange/Amber #F59E0B | DM Sans |
| **Beauty & Spa** | hero, features, about, testimonials, pricing, contact, footer | Pink #F472B6 | Cormorant Garamond |
| **Electronics** | hero, features, products-grid, stats, testimonials, faq, contact, footer | Blue #3B82F6 | Inter |
| **Home & Garden** | hero, features, gallery, about, testimonials, contact, footer | Green #22C55E | Nunito |
| **Health & Fitness** | hero, features, pricing, testimonials, stats, faq, contact, footer | Teal #14B8A6 | Outfit |
| **Education** | hero, features, about, stats, testimonials, faq, cta, contact, footer | Indigo #6366F1 | Plus Jakarta Sans |
| **Services** | hero, features, about, testimonials, pricing, faq, contact, footer | Blue #2563EB | DM Sans |
| **Restaurant** | hero, gallery, products-featured, about, testimonials, contact, footer | Red/Orange #EF4444 | Playfair Display |
| **Retail** | hero, products-grid, features, testimonials, cta, contact, footer | Purple #8B5CF6 | Inter |
| **Creative** | hero, gallery, about, testimonials, cta, contact, footer | Violet #7C3AED | Space Grotesk |
| **Other** | hero, features, about, testimonials, faq, contact, footer | Blue #2563EB | DM Sans |

### 13.2 Template Prompt Enhancement

```typescript
// When user selects OR AI detects category, enhance the prompt:
function enhancePrompt(userPrompt: string, category: BusinessCategory): string {
  const template = CATEGORY_TEMPLATES[category]
  return `
    ${userPrompt}
    
    [CATEGORY CONTEXT]
    This is a ${category} business. Use industry-appropriate:
    - Terminology: ${template.terminology.join(', ')}
    - Suggested sections: ${template.defaultBlocks.join(', ')}
    - Color palette: ${template.colors}
    - Tone: ${template.tone}
  `
}
```

---

## 14. API CONTRACTS (AI)

### 14.1 AI Chat Builder — Generate Site

```typescript
// POST /api/ai/generate-site
// Content-Type: application/json
// Authorization: Bearer <JWT>
// Response: text/event-stream (SSE)

// Request:
{
  "prompt": "Shop thời trang nữ, tên Mira Boutique, bán váy và phụ kiện",
  "siteId": "site_abc123",       // Pre-created site record
  "language": "vi",               // Detected from prompt
  "category": "fashion"           // Optional, AI will detect if not provided
}

// SSE Response Events:
event: step
data: {"step":"extracting_info","label":"Phân tích yêu cầu...","progress":5}

event: step  
data: {"step":"choosing_theme","label":"Chọn giao diện...","progress":10}

event: block_complete
data: {"block":{"id":"blk_nav01","blockType":"navigation","variant":"simple","config":{...}}}

event: theme_set
data: {"theme":{"primaryColor":"#EC4899","fontHeading":"Plus Jakarta Sans",...}}

event: block_complete
data: {"block":{"id":"blk_hero01","blockType":"hero","variant":"centered","config":{...}}}

// ... more blocks ...

event: done
data: {"siteId":"site_abc123","totalBlocks":10,"generationTimeMs":45000}
```

### 14.2 AI Editor — Chat Edit

```typescript
// POST /api/ai/chat-edit
// Content-Type: application/json
// Authorization: Bearer <JWT>

// Request:
{
  "siteId": "site_abc123",
  "messages": [
    { "role": "user", "content": "Đổi màu chủ thành pastel mint" }
  ],
  "context": {
    "currentPageSlug": "home",
    "blocks": [/* current page blocks summary */],
    "theme": {/* current theme */}
  }
}

// Response:
{
  "message": "Tôi đã đổi màu chủ thành pastel mint (#A8E6CF). Text headings cũng được update cho phù hợp.",
  "changes": [
    { "type": "UPDATE_THEME", "data": { "primaryColor": "#A8E6CF", "secondaryColor": "#B2F5EA" } },
    { "type": "UPDATE_BLOCK", "blockId": "blk_hero01", "data": { "config": { "ctaColor": "#A8E6CF" } } }
  ],
  "suggestions": [
    "Đổi font heading cho phù hợp hơn",
    "Cập nhật ảnh nền cho hài hoà với sắc mint",
    "Xem trước trên mobile"
  ]
}
```

### 14.3 AI Inline Edit

```typescript
// POST /api/ai/inline-edit
// Content-Type: application/json
// Authorization: Bearer <JWT>

// Request:
{
  "siteId": "site_abc123",
  "blockId": "blk_hero01",
  "blockType": "hero",
  "currentContent": {
    "headline": "Welcome to our shop",
    "subtitle": "Best products for you",
    "ctaText": "Shop Now"
  },
  "instruction": "Viết lại tiêu đề bằng tiếng Việt, gợi cảm hơn"
}

// Response:
{
  "content": {
    "headline": "Khám Phá Vẻ Đẹp Từ Trong",
    "subtitle": "Bộ sưu tập thời trang cho phụ nữ hiện đại",
    "ctaText": "Khám Phá Ngay →"
  },
  "alternatives": [
    {
      "headline": "Phong Cách Riêng, Đẳng Cấp Riêng",
      "subtitle": "Thời trang cao cấp dành riêng cho bạn"
    },
    {
      "headline": "Nét Đẹp Tự Nhiên",
      "subtitle": "Trang phục tôn vinh vẻ đẹp phụ nữ Việt"
    }
  ]
}
```

### 14.4 AI SEO Analyze

```typescript
// POST /api/ai/seo-analyze
// Request: { "siteId": "site_abc123" }
// Response: SEOAnalysis type (see §5.1)
```

### 14.5 AI SEO Fix All  

```typescript
// POST /api/ai/seo-fix-all
// Content-Type: application/json → Response: text/event-stream (SSE)

// Request: { "siteId": "site_abc123" }

// SSE Events:
event: progress
data: {"total":12,"completed":0,"current":"Generating meta title for Home..."}

event: fix_applied
data: {"pageSlug":"home","field":"metaTitle","before":null,"after":"Mira Boutique - Thời Trang Nữ Cao Cấp"}

// ... more fixes ...

event: done
data: {"totalFixed":12,"scoreBefore":52,"scoreAfter":89}
```

---

## 15. ACCEPTANCE CRITERIA

### AC-001: AI Chat Builder — Happy Path

```gherkin
GIVEN user ở /builder/new (đã đăng nhập)
WHEN user nhập: "Shop thời trang online, tên Mira Boutique, bán váy và phụ kiện"
AND click "Tạo website" hoặc Enter
THEN AI bắt đầu stream response trong < 2 giây
AND progress bar hiện từng step: "Đang tạo header... Hero... Products..."
AND live preview bên phải cập nhật block-by-block theo realtime
AND toàn bộ site hoàn thành trong < 60 giây
AND minimum 8 blocks được generate (nav, hero, features, about, testimonials, faq, contact, footer)
AND theme phù hợp category (thời trang → pink/rose palette)
AND copy bằng ngôn ngữ user dùng (vi)
AND SEO meta title + description tự động generate
AND hiện 2 options: "Tinh chỉnh →" (→ /editor) và "Publish ngay"
AND draft tự động save vào DB
```

### AC-002: AI Chat Builder — Clarifying Questions

```gherkin
GIVEN user nhập prompt thiếu tên shop
WHEN AI không thể extract businessName
THEN AI hỏi: "Tên shop/website của bạn là gì?"
AND KHÔNG generate site cho đến khi có tên

GIVEN user chưa trả lời 2 questions
WHEN AI cần clarifying thêm  
THEN AI hỏi tối đa 2 câu total
AND sau 2 câu → generate luôn với reasonable assumptions
```

### AC-003: AI Editor — Chat Edit

```gherkin
GIVEN user ở /editor/:siteId
AND chat panel hiện ở trái (380px)
WHEN user nhập "Đổi màu chủ thành pastel mint"
AND gửi message
THEN AI stream response ngay
AND preview cập nhật realtime (màu đổi không cần refresh)
AND AI giải thích: "Tôi đã đổi màu primary thành #A8E6CF"
AND có nút "Hoàn tác" trong message đó
AND 3 suggestions xuất hiện bên dưới
```

### AC-004: AI Editor — Undo/Redo

```gherkin
GIVEN user vừa apply 1 AI change (đổi hero title)
WHEN nhấn Ctrl+Z  
THEN hero title revert về giá trị cũ
AND preview cập nhật ngay
AND change move sang redo stack

WHEN nhấn Ctrl+Y
THEN hero title quay lại giá trị mới (AI changed)
AND preview cập nhật ngay

GIVEN user đã undo 3 AI changes
WHEN user tạo change mới (bất kỳ)
THEN redo stack bị xóa hoàn toàn (redo history lost)
```

### AC-005: Inline Edit

```gherkin
GIVEN user hover vào hero block trong preview
WHEN hover
THEN blue outline (2px solid #2563EB) xuất hiện quanh block
AND floating button [✨ AI Edit] xuất hiện top-right

WHEN click [✨ AI Edit]
THEN popup xuất hiện với text input + quick actions
AND popup positioned adjacent to block (không che block)

WHEN user type "Viết lại ngắn gọn hơn" + click Apply
THEN loading spinner trên Apply button
AND AI trả về content mới + 2 alternatives
AND user thấy before/after comparison
AND click "Accept" → block cập nhật + animation + toast
```

### AC-006: Auto-save

```gherkin
GIVEN user đang edit site (AI hoặc manual)
WHEN 3 giây không có thay đổi mới
THEN auto-save triggers (PATCH to server)
AND "Đã lưu" text nhẹ xuất hiện gần Publish button
AND isDirty flag = false

GIVEN auto-save fails (network error)
WHEN save request returns error
THEN isDirty flag = true
AND banner xuất hiện: "Chưa lưu được. Kiểm tra kết nối."
AND retry sau 10 giây, tối đa 3 lần
```

### AC-007: Draft Recovery

```gherkin
GIVEN user đã generate site nhưng chưa publish
AND đóng tab / navigate away
WHEN user quay lại /builder/new  
THEN hiện dialog: "Bạn có bản nháp chưa hoàn thành"
AND 2 options: "Tiếp tục" | "Tạo mới"
AND "Tiếp tục" → load draft site trong editor
AND "Tạo mới" → confirm "Xóa bản nháp?" → fresh start
```

---

## 16. PERFORMANCE REQUIREMENTS

| Metric | Target | Measurement |
|--------|--------|-------------|
| AI response first byte | < 2 seconds | SSE first event |
| Full site generation | < 60 seconds (p95) | SSE done event |
| Chat edit response | < 5 seconds (p95) | Full response |
| Inline edit response | < 3 seconds (p95) | Full response |
| SEO analysis | < 10 seconds | Full scan |
| SEO fix-all | < 30 seconds (12 pages) | SSE done event |
| Preview update latency | < 200ms | postMessage → render |
| Auto-save latency | < 500ms | PATCH request |
| Undo/Redo latency | < 50ms | State change |
| Concurrent users (AI) | 50 simultaneous | Load test |

---

> **This spec is the single source of truth for AI Builder implementation.**  
> **Always reference this file when implementing any AI-related feature.**  
> **@AI_BUILDER_SPEC.md — đọc trước khi bắt đầu bất kỳ feature AI nào.**
