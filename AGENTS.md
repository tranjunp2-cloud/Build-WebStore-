# ECH Webstore v2 — Copilot Agent Instructions

> Đây là hướng dẫn cho GitHub Copilot Coding Agent và Code Review.
> Agent phải đọc và tuân theo toàn bộ instructions này trước khi làm bất kỳ task nào.

---

## 📌 Source of Truth

- `SPEC.md` ở root repo = nguồn sự thật duy nhất
- Đọc theo thứ tự: **§6 (Story AC) → §8 (API) → §9 (Schema) → §10 (UX Rules)**
- Nếu SPEC.md chưa có thông tin → comment vào Issue để hỏi BA/SA, KHÔNG tự assume

---

## 🏗️ Tech Stack

```
Frontend:  Next.js 14 App Router · Tailwind CSS · shadcn/ui · Zustand · TanStack Query · React Hook Form + Zod
Backend:   NestJS 10 · PostgreSQL · Prisma ORM · Redis · BullMQ
AI:        Anthropic Claude claude-sonnet-4-20250514 (SSE streaming) · Ideogram v2 (images)
Infra:     Vercel (FE) · Railway (BE) · Cloudflare CDN · Sentry · PostHog
```

---

## ✅ 9-Point Done Checklist — MANDATORY trước mỗi PR

Agent PHẢI verify đủ 9 điểm. Nếu không pass → fix trước khi tạo PR.

```
☐ 1. LOADING STATE    — Skeleton placeholder (không dùng spinner đơn lẻ cho data)
☐ 2. EMPTY STATE      — Icon + title + description + CTA button (không blank screen)
☐ 3. ERROR STATE      — Toast đỏ + nút Thử lại / Retry (không silent fail)
☐ 4. FORM VALIDATION  — Zod inline dưới field (không alert popup)
☐ 5. BUTTON STATES    — disabled + spinner khi loading (không double submit)
☐ 6. TOAST FEEDBACK   — Mọi action create/update/delete đều có toast
☐ 7. AUTH REDIRECT    — 401 response → /login?returnUrl=[current-path]
☐ 8. MOBILE 375px     — Layout không vỡ trên iPhone SE
☐ 9. TYPESCRIPT CLEAN — Zero `any`, zero unused imports, `tsc --noEmit` pass
```

---

## 🔒 Data Rules — KHÔNG được vi phạm

```
SOFT DELETE ONLY:
  ✅ await prisma.[model].update({ where: { id }, data: { deletedAt: new Date() } })
  ❌ await prisma.[model].delete({ where: { id } })

MULTI-TENANT — mọi query PHẢI có tenant filter:
  ✅ prisma.product.findMany({ where: { storeId, deletedAt: null } })
  ❌ prisma.product.findMany({ where: { id } })   // thiếu storeId

API RESPONSE FORMAT — mọi endpoint phải follow:
  Success: { success: true, data: {...}, meta: { timestamp } }
  Error:   { success: false, error: { code, message, details, requestId } }
```

---

## 💻 Code Patterns

### Frontend
```typescript
// ✅ Data fetching — LUÔN dùng TanStack Query
const { data, isLoading, isError } = useQuery({ queryKey: [...], queryFn: ... })

// ❌ KHÔNG fetch() trực tiếp trong component
const data = await fetch('/api/...')   // WRONG

// ✅ Form — LUÔN React Hook Form + Zod
const form = useForm<T>({ resolver: zodResolver(schema) })

// ✅ Image — LUÔN Next.js Image
import Image from 'next/image'
<Image src={url} alt={alt} width={400} height={400} />
// ❌ KHÔNG dùng <img> tag
```

### Backend
```typescript
// ✅ NestJS module structure
src/modules/[feature]/
  ├── [feature].controller.ts   // HTTP layer only — no business logic
  ├── [feature].service.ts      // Business logic
  ├── [feature].repository.ts  // Prisma queries
  ├── dto/create-[feature].dto.ts
  └── [feature].module.ts

// ✅ Error throwing — luôn có machine-readable code
throw new NotFoundException({ code: 'PRODUCT_NOT_FOUND', message: '...' })
throw new HttpException({ code: 'AI_RATE_LIMIT', message: '...' }, 429)
```

---

## 🤖 AI Features Rules

```
Rate limits (check bằng Redis TRƯỚC khi call AI):
  Store generation:    3x / ngày / storeId
  Product description: 20x / ngày / storeId
  Image generation:   10x / giờ / storeId
  Chat messages:     100x / ngày / storeId

AI model: claude-sonnet-4-20250514  (LUÔN dùng model này, không thay đổi)
Streaming: SSE — không block main thread
Error handling: Catch Anthropic 429/500 → throw user-friendly error → toast
```

---

## 🗺️ Navigation Rules

```
Register success    → auto-login → /onboarding         (KHÔNG /login)
Onboarding done     → /builder/new                     (KHÔNG /dashboard)
Delete action       → confirm modal → soft delete → undo toast 5s
401 response        → redirect /login?returnUrl=[path]
403 response        → toast "Không có quyền" hoặc /403 page
```

---

## 🚫 Anti-patterns — KHÔNG được dùng

```
❌ fetch('/api/...')           → ✅ useQuery / useMutation (TanStack Query)
❌ : any                       → ✅ Explicit type hoặc Prisma generated type
❌ prisma.[model].delete()     → ✅ update({ data: { deletedAt: new Date() } })
❌ Query không có storeId      → ✅ Luôn include tenant filter
❌ Logic trong component       → ✅ Extract ra custom hook
❌ <img> tag                   → ✅ Next.js <Image>
❌ Inline style=""             → ✅ Tailwind classes
❌ Missing loading state       → ✅ <Skeleton> component
❌ Button không disable khi loading → ✅ disabled={isPending}
```

---

## 🧪 Test Requirements

```
Unit tests (Jest):     > 70% coverage cho service layer
E2E tests (Playwright): Critical paths bắt buộc — auth flow, AI generation, checkout
Load test (k6):        AI endpoints + checkout — 500 concurrent users

Trước khi tạo PR:
  npm run type-check   # phải PASS
  npm run test         # phải GREEN
  npm run lint         # phải CLEAN
```

---

## 📋 Khi nhận Issue từ Copilot Coding Agent

1. Đọc SPEC.md §6 tìm User Story tương ứng — verify AC (Acceptance Criteria)
2. Check API contract trong §8 — nếu chưa có → comment hỏi trước khi code
3. Implement đủ 6 layers: UX → API → Data → Security → Ops → Business
4. Verify 9-Point Done Checklist
5. Tạo PR với description: Story ID + gì đã làm + gì đã test
6. Tag BA để demo sign-off trước khi merge

---

*ECH Malaysia · Webstore v2 · SPEC.md-driven development*
