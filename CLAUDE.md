# CLAUDE.md — ECH Webstore v2
> **Repo:** primeproduction/ech-prime-web-v2  
> **Stack:** Next.js 14 + NestJS 10 + PostgreSQL + Prisma + Redis + Claude AI  
> **Updated:** March 2026

---

## ⚡ Quick Start cho Agent

Trước khi làm bất kỳ task nào:
1. Đọc `SPEC.md` — tìm section liên quan đến task
2. Đọc thứ tự: **§6 (Story AC) → §8 (API) → §9 (Schema) → §10 (UX)**
3. Nếu SPEC chưa có → comment vào issue hỏi BA/SA, **không tự assume**
4. Verify 9-Point checklist trước khi tạo PR

---

## 🏗️ Tech Stack

```
Frontend:   Next.js 14 App Router · Tailwind CSS · shadcn/ui
            Zustand (builder state) · TanStack Query · React Hook Form + Zod
            Framer Motion · Tiptap (rich text) · Vercel AI SDK (SSE streaming)

Backend:    NestJS 10 · PostgreSQL · Prisma ORM
            Redis (cache + rate limit) · BullMQ (AI job queue) · Meilisearch

AI:         claude-sonnet-4-20250514 — model duy nhất được dùng
            Ideogram v2 (image generation) · Cloudinary AI (image processing)

Infra:      Vercel (FE) · Railway (BE) · Cloudflare CDN
            Sentry (errors) · PostHog (analytics) · Resend (email)
            GitHub Actions CI/CD
```

---

## ✅ 9-Point Done Checklist — BẮT BUỘC trước mỗi PR

Agent tự verify đủ 9 điểm. Thiếu 1 điểm → fix trước khi commit.

```
☐ 1. LOADING STATE    — Skeleton placeholder (không spinner đơn lẻ)
☐ 2. EMPTY STATE      — Icon + title + description + CTA button
☐ 3. ERROR STATE      — Toast đỏ + nút Retry (không silent fail)
☐ 4. FORM VALIDATION  — Zod inline dưới field (không alert popup)
☐ 5. BUTTON STATES    — disabled + spinner khi loading (không double submit)
☐ 6. TOAST FEEDBACK   — Mọi create/update/delete/publish đều có toast
☐ 7. AUTH REDIRECT    — 401 → /login?returnUrl=[current-path]
☐ 8. MOBILE 375px     — Layout không vỡ (bắt buộc test)
☐ 9. TYPESCRIPT CLEAN — Zero `any`, zero unused imports, tsc --noEmit pass
```

---

## 🔒 Hard Rules — KHÔNG BAO GIỜ vi phạm

### Soft Delete Only
```typescript
// ✅ ĐÚNG
await prisma.[model].update({
  where: { id },
  data: { deletedAt: new Date() }
})

// ❌ SAI — không bao giờ hard delete
await prisma.[model].delete({ where: { id } })
```

### Multi-tenant Filter
```typescript
// ✅ ĐÚNG — mọi query phải có storeId + deletedAt
prisma.product.findMany({
  where: { storeId, deletedAt: null }
})

// ❌ SAI — cross-tenant data leak
prisma.product.findMany({ where: { id } })
```

### API Response Format
```typescript
// ✅ Success — single
{ success: true, data: { ...item }, meta: { timestamp } }

// ✅ Success — list
{ success: true, data: [...], meta: { total, page, limit, totalPages } }

// ✅ Error
{ success: false, error: { code: 'PRODUCT_NOT_FOUND', message: '...', details: [], requestId } }

// Standard error codes:
// AUTH_REQUIRED 401 · FORBIDDEN 403 · NOT_FOUND 404
// VALIDATION_ERROR 422 · AI_RATE_LIMIT 429 · INTERNAL_ERROR 500
```

---

## 💻 Frontend Patterns

```typescript
// ✅ Data fetching — LUÔN TanStack Query
const { data, isLoading, isError } = useQuery({
  queryKey: ['products', storeId],
  queryFn: () => api.products.list(storeId)
})

// ✅ Mutation
const { mutate, isPending } = useMutation({
  mutationFn: api.products.create,
  onSuccess: () => { queryClient.invalidateQueries(['products']); toast.success('Đã tạo!') },
  onError: (err) => toast.error(err.message)
})

// ✅ Form — React Hook Form + Zod
const form = useForm<CreateProductInput>({
  resolver: zodResolver(createProductSchema)
})

// ✅ Image — Next.js Image component
import Image from 'next/image'
<Image src={url} alt={alt} width={400} height={400} />

// ✅ Button với loading state
<Button disabled={isPending}>
  {isPending ? <Spinner /> : 'Lưu'}
</Button>

// ❌ KHÔNG làm:
fetch('/api/...')           // → dùng TanStack Query
: any                       // → explicit type hoặc Prisma generated
<img src={...} />          // → Next.js <Image>
style={{ ... }}            // → Tailwind classes
```

---

## 🖥️ Backend Patterns

```typescript
// ✅ Module structure — LUÔN follow
src/modules/[feature]/
  ├── [feature].controller.ts   // HTTP only, không business logic
  ├── [feature].service.ts      // Business logic
  ├── [feature].repository.ts   // Prisma queries
  ├── dto/
  │   ├── create-[feature].dto.ts
  │   └── update-[feature].dto.ts
  └── [feature].module.ts

// ✅ Error với machine-readable code
throw new NotFoundException({
  code: 'PRODUCT_NOT_FOUND',
  message: 'Sản phẩm không tồn tại'
})

throw new HttpException({
  code: 'AI_RATE_LIMIT',
  message: 'Vượt giới hạn AI. Thử lại sau.'
}, 429)

// ✅ Soft delete pattern
async softDelete(id: string, storeId: string) {
  return this.prisma.[model].update({
    where: { id, storeId },
    data: { deletedAt: new Date() }
  })
}
```

---

## 🤖 AI Features Rules

```
Model: claude-sonnet-4-20250514 (không thay đổi model khác)

Rate limits — check Redis TRƯỚC khi call AI:
  Store generation:    3x / ngày / storeId
  AI chat messages:  100x / ngày / storeId
  Product description: 20x / ngày / storeId
  Image generation:   10x / giờ / storeId

Streaming: SSE — không block main thread
Queue: BullMQ cho heavy AI jobs (store generation, bulk product desc)
Error: Catch Anthropic 429/500 → throw user-friendly message → toast
```

---

## 🗺️ Navigation Rules

```
Register success     → auto-login → /onboarding         (KHÔNG /dashboard)
Onboarding done      → /builder/new                     (KHÔNG /dashboard)
Store generated      → /editor/:storeId
Delete action        → confirm modal → soft delete → undo toast 5s → hard delete
401 response         → redirect /login?returnUrl=[current-path]
403 response         → toast "Bạn không có quyền thực hiện thao tác này"
```

---

## 🧪 Test Requirements

```bash
# Chạy trước khi tạo PR — phải pass hết
npm run type-check      # tsc --noEmit — zero errors
npm run lint            # ESLint — zero warnings
npm run test            # Jest — > 70% coverage cho service layer
npm run test:e2e        # Playwright — critical paths pass
```

### E2E Critical Paths (P0 — phải pass)
```
☐ Register → AI Builder → Generate → Publish (< 5 phút)
☐ Add Product → Live on storefront
☐ Customer Checkout (Cart → FPX → Order confirm)
☐ AI Chat Editor — change content, verify preview update
```

---

## 🔄 BMAD Workflow (quy trình chuẩn ECH)

Agent phải follow flow này khi nhận task từ GitHub Issue:

```
1. Đọc Issue → tìm User Story ID (US-XXX)
2. Đọc SPEC.md §6 → tìm AC (Acceptance Criteria) của story đó
3. Kiểm tra SPEC.md §8 → xem API contract đã có chưa
4. Kiểm tra SPEC.md §9 → xem schema đã có chưa
5. Nếu thiếu → comment vào Issue, KHÔNG code tiếp
6. Implement đủ 6 layers (xem bên dưới)
7. Verify 9-Point checklist
8. Tạo PR với format chuẩn (xem bên dưới)
```

### 6-Layer Checklist mỗi feature
```
Layer 1 — UX:       Design approved · 3 states (loading/empty/error) · Mobile 375px
Layer 2 — API:      Endpoint trong §8 · Validation · Response format §14
Layer 3 — Data:     Prisma schema · Indexes · deletedAt · storeId
Layer 4 — Security: Auth guard · Rate limit · RBAC · Input sanitization
Layer 5 — Ops:      Sentry logging · BullMQ jobs · PostHog event tracked
Layer 6 — Business: Subscription check · Audit log · ECH ecosystem sync
```

---

## 📋 PR Description Format

```markdown
## Story
- Closes #[issue-number]
- Story: US-[ID] — [tên feature]

## Changes
- [Mô tả thay đổi chính]
- [API mới/thay đổi nếu có]
- [Schema thay đổi nếu có]

## 9-Point Checklist
- [ ] Loading State (Skeleton)
- [ ] Empty State (Icon + CTA)
- [ ] Error State (Toast + Retry)
- [ ] Form Validation (Zod)
- [ ] Button States (disabled + spinner)
- [ ] Toast Feedback
- [ ] Auth Redirect (401 → /login)
- [ ] Mobile 375px tested
- [ ] TypeScript clean (tsc --noEmit pass)

## Test Steps
1. [Cách reproduce/test feature]
2. [Expected result]

## BA Sign-off
- [ ] [Tên BA] đã review và approve
```

---

## 🚫 Anti-patterns — Agent phải flag ngay

| Sai | Đúng |
|-----|------|
| `prisma.[model].delete()` | `update({ data: { deletedAt: new Date() } })` |
| Query không có `storeId` | Luôn include tenant filter |
| `fetch('/api/...')` trong component | TanStack Query `useQuery` / `useMutation` |
| `: any` TypeScript | Explicit type hoặc Prisma generated type |
| Logic trong Controller | Move xuống Service layer |
| Prisma query trong Controller | Move xuống Repository |
| `<img src={...}>` | `<Image>` từ next/image |
| `style={{ ... }}` inline | Tailwind classes |
| Missing `disabled={isPending}` | Prevent double submit |

---

## 🎯 Parallel Agent Workflow (Claude Code)

Khi task có nhiều phần độc lập, dùng parallel agents:

```bash
# Ví dụ: Implement Wave 3 Builder UI
# Prompt cho Claude Code:

"Implement US-004 (AI Editor) theo SPEC.md.
Đọc §6 lấy AC, §8 lấy API contract.
Tạo 3 agents chạy song song:
- Agent 1: Backend AI chat endpoint (POST /ai/chat SSE)
- Agent 2: Frontend ChatPanel component
- Agent 3: Frontend LivePreview component + useEditorStore (Zustand)
Mỗi agent phải verify 9-Point checklist trước khi commit."
```

**Rule cho agents:**
- Mỗi agent đọc SPEC.md phần liên quan của mình
- Agents làm file độc lập nhau (không conflict)
- Agent nào xong trước thì commit nhánh riêng
- Orchestrator merge và chạy `tsc --noEmit` cuối cùng

---

*ECH Malaysia · Webstore v2 · SPEC-driven · BMAD-enhanced · March 2026*
