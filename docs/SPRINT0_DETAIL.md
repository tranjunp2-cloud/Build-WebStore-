# Sprint 0 — Chi tiết Tasks (Audit 13 Mar 2026)

> **Đã audit code thật.** Chỉ liệt kê task CẦN VIẾT CODE — không có task "chạy lệnh check".
> **Tóm tắt:** [PROJECT_ALIGNMENT.md](PROJECT_ALIGNMENT.md)

---

## Thực trạng codebase hiện tại

| Có rồi ✅ | Thiếu / Chưa đủ ❌ |
|-----------|-------------------|
| 10 Payload collections (fields đầy đủ) | 0/16 API routes có Zod validation |
| 16 API routes (code thật, 30-418 dòng) | 12/16 routes KHÔNG có auth check |
| 93 unit tests pass | Không có seed script |
| TypeScript clean (0 errors) | Không có rate limit |
| Editor UI (4 components) | Không có Stripe webhook |
| Dashboard (6 pages) | Không có sitemap.xml |
| Storefront (5 pages) | Không có Sentry monitoring |
| Onboarding page tồn tại | Không có Redis |
| Email lib cơ bản (Resend) | Resend chưa có templates |
| Multi-tenant middleware | Không có preview deploy |
| Currency MYR, SST 6% in checkout layout | ❌ Products không có Halal cert field |
| | ❌ Storefront không có WhatsApp button |
| | ❌ Không có shipping config/rates |
| | ❌ Onboarding không có language selection |
| | ❌ Storefront không có language switcher |
| | ❌ Tenant không có SSM/WhatsApp fields |

---

## 🔧 Dev Tasks

### D1 — Thêm Auth Check cho 12 API routes (VIẾT CODE)

| | |
|---|---|
| **Thực trạng** | Chỉ 4/16 routes có auth. 12 routes bất kỳ ai cũng gọi được |
| **Việc làm** | Viết auth middleware + apply cho 12 routes còn lại |
| **Thời gian** | 2 ngày |

**Routes cần thêm auth (đã check, KHÔNG có):**
```
src/app/api/products/generate-description/route.ts
src/app/api/ai/rewrite-text/route.ts
src/app/api/ai/edit-block/route.ts
src/app/api/templates/seed/route.ts
src/app/api/templates/list/route.ts
src/app/api/templates/preview/route.ts
src/app/api/preview/[siteId]/route.ts
src/app/api/orders/create/route.ts
src/app/api/seo/fix/route.ts
src/app/api/seo/analyze/route.ts
src/app/api/analytics/track/route.ts
src/app/api/ai/apply-template/route.ts  (có 2 checks nhưng chưa đủ)
```

**Cụ thể phải viết:**
1. Tạo `src/lib/auth/getUser.ts`:
```typescript
import { getPayload } from 'payload'
import config from '@payload-config'
import { cookies } from 'next/headers'

export async function getAuthUser() {
  const payload = await getPayload({ config })
  const cookieStore = await cookies()
  const token = cookieStore.get('payload-token')?.value
  if (!token) return null

  try {
    const { user } = await payload.auth({ headers: new Headers({ Authorization: `JWT ${token}` }) })
    return user
  } catch { return null }
}
```

2. Mở từng route ở trên → thêm đầu handler:
```typescript
const user = await getAuthUser()
if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
```

**DoD:** `curl` tất cả 12 routes không có cookie → nhận `401` (không phải `200` hay `500`)

---

### D2 — Thêm Zod Validation cho 16 API routes (VIẾT CODE)

| | |
|---|---|
| **Thực trạng** | 0/16 routes có Zod validation. Zod đã có trong package.json nhưng chỉ dùng trong blocks config |
| **Việc làm** | Viết Zod schema cho request body mỗi POST/PATCH route |
| **Thời gian** | 2 ngày |

**Cụ thể phải viết cho mỗi route:**

| Route | Schema cần tạo |
|-------|---------------|
| `/api/ai/generate-site` | `{ prompt: z.string().min(1).max(500) }` |
| `/api/ai/edit-block` | `{ siteId: z.string(), blockId: z.string(), instruction: z.string().min(1) }` |
| `/api/ai/rewrite-text` | `{ text: z.string(), instruction: z.string() }` |
| `/api/ai/apply-template` | `{ siteId: z.string(), templateId: z.string() }` |
| `/api/products/generate-description` | `{ name: z.string(), price: z.number(), category: z.string().optional() }` |
| `/api/sites/[siteId]/save` | `{ blocks: z.array(z.any()), updatedAt: z.string() }` |
| `/api/orders/create` | `{ siteId: z.string(), items: z.array(...), customer: z.object({...}) }` |
| `/api/seo/analyze` | `{ siteId: z.string() }` |
| `/api/seo/fix` | `{ siteId: z.string(), issues: z.array(z.string()) }` |

**Pattern cho mỗi route:**
```typescript
import { z } from 'zod'

const schema = z.object({ prompt: z.string().min(1).max(500) })

export async function POST(req: Request) {
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  // dùng parsed.data thay vì body
}
```

**DoD:** Gửi body rỗng `{}` tới bất kỳ POST route → nhận `400` + validation error (không phải `500`)

---

### D3 — Viết Stripe Webhook handler (VIẾT TỪ ĐẦU)

| | |
|---|---|
| **Thực trạng** | Package `stripe` đã installed. Collections Orders/Subscriptions có. Nhưng KHÔNG có webhook endpoint |
| **Việc làm** | Viết endpoint + handler cho 3 Stripe events |
| **Thời gian** | 3 ngày |

**Files tạo mới:**
- `src/app/api/webhooks/stripe/route.ts`

**Phải viết:**
```typescript
import Stripe from 'stripe'
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function POST(req: Request) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')!

  // 1. Verify webhook signature
  const event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)

  // 2. Handle events:
  switch (event.type) {
    case 'checkout.session.completed':
      // → Tạo Order trong Payload CMS
      // → Giảm stock Products
      // → Gửi email confirmation (sendEmail)
    case 'payment_intent.payment_failed':
      // → Update order status = 'payment_failed'
    case 'customer.subscription.updated':
      // → Update Subscription status trong Payload
  }
}
```

**DoD:**
```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
stripe trigger checkout.session.completed
# → Payload admin: new Order created
```

---

### D4 — Viết Seed Script (VIẾT TỪ ĐẦU)

| | |
|---|---|
| **Thực trạng** | Không tồn tại. Dev phải tự tạo data bằng tay |
| **Việc làm** | Viết script tạo sample data |
| **Thời gian** | 1 ngày |

**File tạo mới:** `scripts/seed.ts`

**Phải viết:**
```typescript
import { getPayload } from 'payload'
import config from '@payload-config'

async function seed() {
  const payload = await getPayload({ config })

  // 1. Tạo user
  const user = await payload.create({ collection: 'users', data: {
    email: 'demo@primeweb.app', password: 'password123'
  }})

  // 2. Tạo tenant + site
  const tenant = await payload.create({ collection: 'tenants', data: { name: 'Demo Store', owner: user.id }})
  const site = await payload.create({ collection: 'sites', data: {
    name: 'Kedai Demo', slug: 'kedai-demo', tenant: tenant.id, status: 'published',
    blocks: [/* hero, about, products, contact blocks */]
  }})

  // 3. Tạo 5 products
  const products = [
    { name: 'Baju Kurung Pink', price: 189, stock: 50 },
    { name: 'Tudung Bawal Basic', price: 35, stock: 100 },
    { name: 'Telekung Premium', price: 250, stock: 30 },
    { name: 'Beg Tangan Kulit', price: 120, stock: 40 },
    { name: 'Kasut Perempuan', price: 89, stock: 60 },
  ]
  for (const p of products) {
    await payload.create({ collection: 'products', data: { ...p, site: site.id, tenant: tenant.id, status: 'active', currency: 'MYR' }})
  }

  // 4. Tạo 3 orders (trạng thái khác nhau)
  // new, processing, completed

  console.log('✅ Seeded: 1 user, 1 site, 5 products, 3 orders')
}
seed()
```

Thêm vào `package.json`:
```json
"db:seed": "tsx scripts/seed.ts"
```

**DoD:** `npm run db:seed` → thấy data trong Payload admin

---

### D5 — Viết Rate Limit middleware (VIẾT TỪ ĐẦU)

| | |
|---|---|
| **Thực trạng** | Không tồn tại. Bất kỳ ai cũng gọi AI API vô hạn |
| **Việc làm** | Viết in-memory rate limiter cho `/api/ai/*` routes |
| **Thời gian** | 1 ngày |

**File tạo mới:** `src/lib/rateLimit.ts`

**Phải viết:**
```typescript
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

export function checkRateLimit(userId: string, limit = 10, windowMs = 3600000): { allowed: boolean; remaining: number } {
  const now = Date.now()
  const entry = rateLimitMap.get(userId)

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + windowMs })
    return { allowed: true, remaining: limit - 1 }
  }

  if (entry.count >= limit) {
    return { allowed: false, remaining: 0 }
  }

  entry.count++
  return { allowed: true, remaining: limit - entry.count }
}
```

Apply trong mỗi `/api/ai/*` route:
```typescript
const rateCheck = checkRateLimit(user.id)
if (!rateCheck.allowed) {
  return Response.json({ error: 'Bạn đã dùng hết lượt. Thử lại sau.' }, { status: 429 })
}
```

**DoD:** Gọi AI API 11 lần liên tục → lần 11 nhận `429`

---

### D6 — Viết Sitemap Generator (VIẾT TỪ ĐẦU)

| | |
|---|---|
| **Thực trạng** | Không tồn tại. Published sites không có sitemap SEO |
| **Việc làm** | Viết dynamic sitemap route cho mỗi tenant site |
| **Thời gian** | 0.5 ngày |

**File tạo mới:** `src/app/sites/[slug]/sitemap.xml/route.ts`

**Phải viết:**
```typescript
export async function GET(req: Request, { params }: { params: { slug: string } }) {
  const payload = await getPayload({ config })
  const site = await payload.find({ collection: 'sites', where: { slug: { equals: params.slug }, status: { equals: 'published' } } })
  if (!site.docs.length) return new Response('Not found', { status: 404 })

  const pages = await payload.find({ collection: 'pages', where: { site: { equals: site.docs[0].id } } })

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
  <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    ${pages.docs.map(p => `<url><loc>https://${params.slug}.primeweb.app/${p.slug}</loc><lastmod>${p.updatedAt}</lastmod></url>`).join('')}
  </urlset>`

  return new Response(xml, { headers: { 'Content-Type': 'application/xml' } })
}
```

**DoD:** `curl http://localhost:3000/sites/kedai-demo/sitemap.xml` → valid XML

---

### D7 — Viết Email Templates (VIẾT CODE)

| | |
|---|---|
| **Thực trạng** | `src/lib/email/send.ts` có (helper gửi email). Nhưng KHÔNG CÓ templates |
| **Việc làm** | Viết 3 HTML email templates |
| **Thời gian** | 1.5 ngày |

**Files tạo mới:**
- `src/lib/email/templates/welcome.ts` — HTML template welcome
- `src/lib/email/templates/order-confirmation.ts` — HTML template order
- `src/lib/email/templates/order-status.ts` — HTML template status update

**Mỗi template export function:**
```typescript
export function welcomeEmail(userName: string): { subject: string; html: string } {
  return {
    subject: 'Chào mừng đến PrimeWeb! 🎉',
    html: `<div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;">
      <h1>Xin chào ${userName}!</h1>
      <p>Bạn đã sẵn sàng tạo website đầu tiên...</p>
      <a href="..." style="background:#1a3b6b;color:white;padding:12px 24px;border-radius:8px;">Bắt đầu ngay</a>
    </div>`
  }
}
```

**DoD:** Gọi `sendEmail(welcomeEmail('Nhan'))` → check Resend dashboard → email delivered

---

## 🧪 QC Tasks

### Q1 — Viết API Route Tests (VIẾT TỪ ĐẦU)

| | |
|---|---|
| **Thực trạng** | 93 tests có nhưng KHÔNG CÓ API test nào. Tất cả là unit test cho stores/utils |
| **Việc làm** | Viết integration tests cho 16 API routes |
| **Thời gian** | 3 ngày |

**Files tạo mới:** `src/__tests__/api/` — 1 file per route group:
- `ai.test.ts` (generate-site, edit-block, rewrite-text, apply-template)
- `sites.test.ts` (publish, save, editor-data)
- `products.test.ts` (generate-description)
- `orders.test.ts` (create)
- `seo.test.ts` (analyze, fix)
- `templates.test.ts` (list, preview, seed)

**Mỗi route cần ≥2 tests:**
```typescript
describe('POST /api/ai/generate-site', () => {
  it('returns 401 without auth token', async () => { ... })
  it('returns 400 with empty prompt', async () => { ... })
  it('returns streaming response with valid prompt', async () => { ... })
})
```

**DoD:** `npm run test src/__tests__/api/` → ≥32 tests pass (16 routes × 2 tests)

---

### Q2 — Viết E2E Test: Auth + Core Flows (VIẾT TỪ ĐẦU)

| | |
|---|---|
| **Thực trạng** | Playwright config có nhưng KHÔNG CÓ test file nào |
| **Việc làm** | Viết E2E tests cho critical user flows |
| **Thời gian** | 2 ngày |

**Files tạo mới:**
- `tests/auth.spec.ts` — Login → dashboard
- `tests/builder.spec.ts` — Open editor → type prompt → see preview
- `tests/products.spec.ts` — Dashboard → products → create product

**DoD:** `npm run test:e2e` → ≥3 test files pass

---

### Q3 — Viết Test Plan Files (VIẾT DOCS)

| | |
|---|---|
| **Thực trạng** | `docs/qa/` folder trống hoặc không tồn tại |
| **Việc làm** | Viết test plan cho 5 features chính dựa trên stories (Gherkin AC) |
| **Thời gian** | 2 ngày |

**Files tạo mới:**
- `docs/qa/F01-test-plan.md` — AI Chat Builder
- `docs/qa/F05-test-plan.md` — AI Editor
- `docs/qa/F09-test-plan.md` — Products CRUD
- `docs/qa/F11-test-plan.md` — Orders
- `docs/qa/F12-test-plan.md` — SEO Dashboard

**Mỗi file:** ≥5 test cases dạng: Scenario / Steps / Expected Result / Priority

**DoD:** 5 files tồn tại, mỗi file ≥5 cases

---

## 🚀 DevOps Tasks

### O1 — Fix CI Pipeline (VIẾT CODE)

| | |
|---|---|
| **Thực trạng** | `ci.yml` tồn tại nhưng cần verify chạy đúng 4 steps |
| **Việc làm** | Verify + fix CI: lint → typecheck → test → build |
| **Thời gian** | 1 ngày |

**File:** `.github/workflows/ci.yml`

**DoD:** Push branch → CI runs 4 steps → all green

---

### O2 — Setup Sentry Error Monitoring (VIẾT TỪ ĐẦU)

| | |
|---|---|
| **Thực trạng** | Không có Sentry. Nếu production lỗi → không ai biết |
| **Việc làm** | Install + config Sentry cho Next.js |
| **Thời gian** | 1 ngày |

**Phải viết:**
```bash
npx @sentry/wizard@latest -i nextjs
```
Wizard tự tạo: `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`

Thêm env: `SENTRY_DSN=https://xxx@sentry.io/yyy`

**DoD:** Throw error trong API route → check Sentry dashboard → error appears < 1 phút

---

### O3 — Setup Preview Deploy cho PR (VIẾT TỪ ĐẦU)

| | |
|---|---|
| **Thực trạng** | Không có. Reviewer phải tự chạy local để test PR |
| **Việc làm** | Viết GitHub Action tạo preview URL cho mỗi PR |
| **Thời gian** | 2 ngày |

**File tạo mới:** `.github/workflows/preview.yml`

**DoD:** Tạo PR → bot comment preview URL → click vào thấy app chạy

---

### O4 — Docker Image Optimize (VIẾT CODE)

| | |
|---|---|
| **Thực trạng** | Dockerfile tồn tại nhưng chưa check image size |
| **Việc làm** | Multi-stage build, prune deps, optimize layers |
| **Thời gian** | 1 ngày |

**DoD:** `docker build -t primeweb .` → `docker images primeweb` → < 500MB

---

## 🇲🇾 MY Market Tasks (Sprint 0 — chuẩn bị cho Sprint 2)

> Tasks này chuẩn bị collection fields và components cho MY market features.
> Không cần design — chỉ backend/collection changes.

### D8 — Thêm Halal Cert field vào Products collection (VIẾT CODE)

| | |
|---|---|
| **Thực trạng** | Products collection không có field Halal. Ref: F09 AC-7 |
| **Việc làm** | Thêm fields vào `src/collections/Products.ts` |
| **Thời gian** | 0.5 ngày |

**Thêm vào Products collection:**
```typescript
// Trong fields array:
{
  name: 'halalCertified',
  type: 'checkbox',
  defaultValue: false,
  admin: { description: 'Toggle to mark product as Halal Certified (JAKIM)' },
},
{
  name: 'halalCertImage',
  type: 'upload',
  relationTo: 'media',
  admin: {
    condition: (data) => data.halalCertified,
    description: 'Upload JAKIM Halal certificate image',
  },
},
{
  name: 'weight',
  type: 'number',
  min: 0,
  admin: { description: 'Product weight in grams (for shipping calculation)' },
},
```

**DoD:** `npm run db:push` → Products form in Payload admin shows Halal toggle + upload + weight field

---

### D9 — Thêm WhatsApp + SSM fields vào Tenants collection (VIẾT CODE)

| | |
|---|---|
| **Thực trạng** | Tenants collection không có WhatsApp/SSM fields. Ref: F10 AC-11, AC-12 |
| **Việc làm** | Thêm fields vào `src/collections/Tenants.ts` |
| **Thời gian** | 0.5 ngày |

**Thêm vào Tenants collection:**
```typescript
{
  name: 'whatsappNumber',
  type: 'text',
  admin: { description: 'WhatsApp number with country code, e.g. 60123456789' },
},
{
  name: 'ssmNumber',
  type: 'text',
  admin: { description: 'SSM Registration Number (Suruhanjaya Syarikat Malaysia)' },
},
{
  name: 'businessAddress',
  type: 'textarea',
  admin: { description: 'Physical business address for trust signals' },
},
```

**DoD:** Tenants form in Payload admin → fill WhatsApp + SSM → save → query returns fields

---

### D10 — Thêm Shipping Config + Locale vào Sites collection (VIẾT CODE)

| | |
|---|---|
| **Thực trạng** | Sites collection không có shipping config hay locale. Ref: F17 §8, F06 AC-1 |
| **Việc làm** | Thêm shippingConfig group + locale vào `src/collections/Sites.ts` |
| **Thời gian** | 0.5 ngày |

**Thêm vào Sites collection:**
```typescript
{
  name: 'locale',
  type: 'select',
  options: [
    { label: 'Bahasa Melayu', value: 'bm' },
    { label: 'English', value: 'en' },
  ],
  defaultValue: 'bm',
},
{
  name: 'shippingConfig',
  type: 'group',
  fields: [
    { name: 'westRate', type: 'number', defaultValue: 800, admin: { description: 'Semenanjung rate in sen (800 = RM 8)' } },
    { name: 'eastRate', type: 'number', defaultValue: 1500, admin: { description: 'Sabah/Sarawak rate in sen (1500 = RM 15)' } },
    { name: 'freeAbove', type: 'number', admin: { description: 'Free shipping above X sen (null = no free shipping)' } },
  ],
},
```

**DoD:** Sites form in Payload admin → locale dropdown (BM/EN) + shipping rates → save → query returns fields

---

## 📊 Tóm tắt

| Bản cũ | Bản mới (13/3/2026) |
|--------|---------|
| 37 tasks (nhiều task giả) | **17 tasks (tất cả viết code thật)** |
| Không có MY market tasks | +3 tasks: Halal field, WhatsApp/SSM fields, Shipping config |
| D1 "Fix TS errors" (đã pass) | ❌ Xóa |
| D3 "API audit" (mơ hồ) | → D1 Auth Check + D2 Zod (cụ thể từng file) |
| D8,D9,D10,D11 "hoàn thiện" (đã có code) | ❌ Xóa — code đã có, cần test thôi → Q1 |
| Tasks Q1-Q10 chung chung | → 3 tasks cụ thể: API tests, E2E, Test plans |
| Tasks O1-O10 nhiều giả | → 4 tasks thật: CI fix, Sentry, Preview, Docker |
