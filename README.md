# 🌐 ECH PrimeWeb v2 — AI-Powered Website Builder

> **AI-first SaaS Website Builder cho SME** — tạo website chuyên nghiệp trong 5 phút bằng chat với AI.

---

## ⚡ Quick Start (Docker)

```bash
# Clone & chạy
git clone https://github.com/primeproduction/ech-prime-web-v2.git
cd ech-prime-web-v2
cp .env.example .env.local

# Chạy dev server (App + PostgreSQL + MinIO)
docker compose up -d

# Xem log
docker compose logs -f app
```

**Mở browser:** http://localhost:3005

| URL | Trang |
|-----|-------|
| `localhost:3005` | Marketing Homepage |
| `localhost:3005/admin` | Payload CMS Admin |
| `localhost:3005/dashboard` | Dashboard |
| `localhost:3005/builder/new` | AI Chat Builder |
| `localhost:3005/editor/:siteId` | AI Editor |
| `localhost:9001` | MinIO Console (Storage) |

---

## 🏗️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router) |
| CMS | Payload CMS 3.14+ |
| Database | PostgreSQL 16 |
| Styling | Tailwind CSS + shadcn/ui |
| AI | OpenAI GPT-4o + DALL-E 3 |
| Storage | MinIO (S3-compatible) |
| Payments | Stripe |
| Deploy | Docker + Cloudflare |

---

## 📁 Project Structure

```
ech-prime-web-v2/
├── .cursor/rules/         # AI coding rules (BMAD + 9-Point Checklist)
├── src/
│   ├── app/
│   │   ├── (frontend)/    # Marketing + Onboarding
│   │   ├── (dashboard)/   # Dashboard (with sidebar)
│   │   ├── (builder)/     # AI Chat Builder (full-screen)
│   │   ├── (editor)/      # AI Visual Editor (3-panel split)
│   │   ├── (payload)/     # Payload CMS Admin + API
│   │   └── sites/[slug]/  # Published tenant sites (SSR)
│   ├── collections/       # Payload CMS collections (7 total)
│   ├── components/        # React components
│   ├── lib/               # Utilities (AI config, Stripe, S3)
│   └── payload.config.ts  # Payload CMS configuration
├── SPEC.md                # Product Spec v3.0 (BMAD — Source of Truth)
├── docker-compose.yml     # Dev environment
├── Dockerfile.dev         # Dev Docker image
└── Dockerfile             # Production Docker image
```

---

## 🔄 BMAD Workflow

Mọi feature mới phải theo quy trình:

```
DISCOVERY → PLANNING → BUILD → MEASURE
                ↓
         Readiness Gate (4/4 PASS trước khi code)
```

### Readiness Gate Checklist
- [ ] User Stories có AC rõ ràng (GIVEN/WHEN/THEN)?
- [ ] UI mockup owner đã duyệt?
- [ ] API contracts documented trong SPEC.md?
- [ ] Dependencies resolved (API keys, DB schema, Docker)?

> **< 4/4 PASS → KHÔNG CODE.** Chi tiết: xem `SPEC.md §2`.

---

## 📋 Build Progress

| Wave | Nội dung | Status |
|------|---------|--------|
| **Wave 1** | Foundation — Next.js + Payload + Docker + 8 Blocks | ✅ Done |
| **Wave 2** | BMAD Planning — User Stories + UI Mockups + Gate | 🔄 Current |
| **Wave 3** | AI Core — Chat Builder + Editor + Preview | ⏳ Next |
| **Wave 4** | Commerce — Products + Cart + Checkout + SEO | ⏳ |
| **Wave 5** | Polish — Tests + Performance + Launch | ⏳ |

---

## 🧩 Payload CMS Collections

| Collection | Purpose |
|-----------|---------|
| `tenants` | SaaS customers (multi-tenant isolation) |
| `users` | Users with roles (owner/editor/viewer) |
| `sites` | Website config (theme, SEO, AI context) |
| `pages` | Pages with layout blocks |
| `media` | Uploaded images/videos |
| `templates` | Pre-built website templates |
| `subscriptions` | Stripe billing |

---

## 🐳 Docker Commands

```bash
# Chạy dev server
docker compose up -d

# Rebuild (khi thêm package mới)
docker compose build && docker compose up -d

# Xem log
docker compose logs -f app

# Tắt
docker compose down

# Reset DB (xóa data, chạy lại từ đầu)
docker compose down -v && docker compose up -d
```

---

## 📖 Key Documents

| File | Mô tả |
|------|-------|
| `SPEC.md` | **Source of Truth** — 19 sections, BMAD-enhanced |
| `.cursor/rules/always.mdc` | Core rules: BMAD + 9-Point + Docker |
| `.cursor/rules/frontend.mdc` | Frontend patterns: Server/Client, TanStack Query |
| `.cursor/rules/ai-features.mdc` | AI rules: Rate limits, prompt engineering |
| `.cursor/rules/cms-blocks.mdc` | Block architecture: config/component/editor |

---

## 🔐 Environment Variables

Copy `.env.example` → `.env.local` và điền:

```bash
DATABASE_URI=          # PostgreSQL connection (auto in Docker)
PAYLOAD_SECRET=        # Payload CMS secret (min 32 chars)
OPENAI_API_KEY=        # OpenAI API key (GPT-4o + DALL-E)
STRIPE_SECRET_KEY=     # Stripe secret key
```

> ⚠️ **KHÔNG commit `.env.local`** — nó đã có trong `.gitignore`.

---

## 👥 Team

| Role | Responsibilities |
|------|-----------------|
| **Product** | Review SPEC.md, approve UI mockups, Readiness Gate |
| **Frontend** | Next.js + Tailwind, follow `.cursor/rules/frontend.mdc` |
| **AI/Backend** | Payload CMS, AI endpoints, follow `.cursor/rules/ai-features.mdc` |
| **Design** | v0.app mockups → owner approve → Frontend implement |

---

> Built with ❤️ by Prime Production × Antigravity
