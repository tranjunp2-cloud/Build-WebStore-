# 🎯 PrimeWeb — Project Alignment & Timeline

> **Mục đích:** File này là nguồn sự thật cho toàn team.
> Mọi task, PR, design phải align với file này.
> **Cập nhật bởi:** Tech Lead | **Review:** Mỗi sprint planning

---

## North Star

> **"SME owner tạo website live trong 5 phút bằng AI"**

Mọi feature, mọi task phải phục vụ mục tiêu này.
Nếu 1 task không trực tiếp hoặc gián tiếp hỗ trợ mục tiêu → **đừng làm**.

---

## Timeline — April 2026 Launch

```
Tuần 1-2 (Mar 12-25)    Sprint 0: Foundation
                         ├── Backend APIs hoàn thiện
                         ├── CI/CD green
                         ├── Test infra ready
                         └── Designer bắt đầu Figma

Tuần 3-4 (Mar 26-Apr 8)  Sprint 1: Core Features
                         ├── F01 AI Chat Builder (polish)
                         ├── F05 AI Editor (rebuild)
                         ├── F06 Onboarding + Language (build)
                         └── F08 Publish Flow (build)

Tuần 5-6 (Apr 9-22)      Sprint 2: Commerce + MY Market
                         ├── F09 Products + Halal cert (polish)
                         ├── F11 Orders + WhatsApp (build)
                         ├── F10 Storefront + Trust signals (polish)
                         ├── F12 SEO Dashboard
                         ├── F16 Payment Gateway (FPX)
                         └── F17 Shipping (flat rate by state)

Tuần 7 (Apr 23-30)       Sprint 3: Polish & Launch
                         ├── Bug fixes
                         ├── Performance (Lighthouse > 90)
                         ├── Security audit
                         └── 🚀 Launch
```

---

## Feature Priority (updated 13/3/2026)

| Priority | Feature | Lý do |
|:---:|---------|-------|
| 🔴 1 | **F01 AI Chat Builder** | USP #1 — core giá trị product |
| 🔴 2 | **F05 AI Editor** | User dùng sau khi generate |
| 🔴 3 | **F06 Onboarding** + Language | First impression + BM/EN selection |
| 🔴 4 | **F08 Publish Flow** | Không có thì site không live dc |
| 🟡 5 | **F09 Products** + Halal | Commerce + trust signal MY |
| 🟡 6 | **F10 Storefront** + Trust signals | WhatsApp, SSM footer, language switcher |
| 🟡 7 | **F11 Orders** + WhatsApp notify | Revenue flow + MY communication |
| 🟡 8 | **F12 SEO Dashboard** | Growth, MY keywords |
| 🟡 9 | **F16 Payment Gateway** 🇲🇾 | FPX (Wave 6) — most trusted in MY |
| 🟡 10 | **F17 Shipping** 🇲🇾 | Flat rate by state (Wave 6) |
| ⚪ 11 | **F07 Templates** | Fallback nếu AI không ok |
| ⚪ 12 | **F13-F15** | Nice-to-have for launch |

---

## Quy tắc Alignment

### 0. Stories-First Rule (BẮT BUỘC) 🔴

```
⚠️ RULE: Stories TRƯỚC, PRD SAU — KHÔNG BAO GIỜ NGƯỢC LẠI.

1. Viết / cập nhật User Story (docs/stories/F{XX}-stories.md) trước
2. PO approve story → mới tạo / update PRD
3. PRD chỉ được expand chi tiết kỹ thuật (API, Data Model, Component)
   → PRD KHÔNG được tự tạo scope mới (FR mới không có story cover)
4. Mọi FR trong PRD PHẢI có cột Story Ref với ID hợp lệ
5. Story ID format: US-F{XX}-{NN} (VD: US-F01-01, US-F02-03)
   KHÔNG dùng: US-001, US-AUTH-02, US-10A

Template stories: docs/stories/STORY_TEMPLATE.md
Index tổng hợp: docs/stories/user-stories-p0.md
```

### 1. Trước khi code bất kỳ feature nào
```
☐ Feature có trong bảng priority ở trên?
☐ User Story tồn tại? (docs/stories/F{XX}-stories.md) — PHẢI CÓ TRƯỚC
☐ PRD approved? (docs/prd/F{XX}.md) — viết SAU khi story done
     └── PRD Section 0 (Story Traceability) có đủ story refs?
     └── PRD Section 7 (FR) có cột Story Ref không trống?
☐ Architecture doc? (docs/architecture/F{XX}.md)
☐ Figma link? (docs/design/DESIGN_WORKFLOW.md)
→ 5/5 = GO. < 5/5 = STOP, hoàn thiện docs trước.
```

### 2. Trước khi tạo PR
```
☐ PR liên quan tới feature nào? (ghi F{XX} trong title)
☐ Đã pass 9-Point Checklist? (SPEC.md §13)
☐ Có unit test?
☐ TypeScript clean? (npm run typecheck)
☐ PR target staging (KHÔNG phải main)?
```

### 3. Khi có thay đổi PRD/Design
```
1. Nếu thay đổi scope → update Story trước → sau đó update PRD
2. Nếu chỉ thay đổi kỹ thuật (API, component) → cập nhật PRD trực tiếp
3. Thông báo team trong standup
4. Review task nào bị ảnh hưởng
5. Sprint 0 tasks (backend) → KHÔNG bị ảnh hưởng
6. Sprint 1+ tasks (UI) → re-estimate nếu cần
```

### 4. Khi phân task cho member
```
1. Nhìn bảng Priority ở trên → feature nào trước?
2. Check BMAD Gate → feature đó có đủ docs? (stories → PRD → architecture)
3. Assign task → ghi rõ DoD (Definition of Done) theo Story ID
4. Review theo DoD → PASS/FAIL, không subjective
```

---

## Decision Authority

| Quyết định | Ai quyết |
|-----------|---------|
| Feature priority thay đổi | CEO/Product Owner |
| Tech stack thay đổi | Tech Lead (anh) |
| Design approval | Tech Lead (anh) |
| PRD approval | Tech Lead (anh) |
| PR merge | Tech Lead hoặc Squad Lead |
| Bug severity | QC Lead + Tech Lead |

---

## Sprint 0 — Tasks (Tuần 1-2, không cần Design)

> Đã **audit code thật 13/3/2026** — chỉ liệt kê task PHẢI VIẾT CODE.
> 📋 **Chi tiết (files, steps, code mẫu):** [SPRINT0_DETAIL.md](SPRINT0_DETAIL.md)

### 🔧 Dev (10 tasks)

| # | Task | Việc làm thật | DoD | Ngày |
|---|------|--------------|-----|:----:|
| D1 | Auth Check 12 routes | Viết `getAuthUser()` + apply 12 routes thiếu auth | 12 routes trả 401 khi no-cookie | 2 |
| D2 | Zod Validation 16 routes | Viết Zod schema cho mỗi POST route | Body rỗng `{}` → 400 (không 500) | 2 |
| D3 | Stripe Webhook | Viết handler `checkout.session.completed` + stock decrement | `stripe trigger` → Order created | 3 |
| D4 | Seed Script | Viết `scripts/seed.ts` (1 user, 1 site, 5 products, 3 orders) | `npm run db:seed` → data in admin | 1 |
| D5 | Rate Limit | Viết middleware rate limit cho `/api/ai/*` | Gọi lần 11 → 429 | 1 |
| D6 | Sitemap | Viết `/sites/[slug]/sitemap.xml` route | `curl sitemap.xml` → valid XML | 0.5 |
| D7 | Email Templates | Viết 3 HTML templates (welcome, order, status) | Email delivered in Resend | 1.5 |
| D8 | 🇲🇾 Halal Cert Field | Thêm halalCertified + halalCertImage + weight vào Products | Payload admin hiển toggle + upload | 0.5 |
| D9 | 🇲🇾 WhatsApp/SSM Fields | Thêm whatsappNumber + ssmNumber + address vào Tenants | Payload admin hiển fields | 0.5 |
| D10 | 🇲🇾 Shipping + Locale | Thêm shippingConfig group + locale vào Sites | Payload admin hiển config | 0.5 |

### 🧪 QC (3 tasks)

| # | Task | Việc làm thật | DoD | Ngày |
|---|------|--------------|-----|:----:|
| Q1 | API Route Tests | Viết tests cho 16 routes (≥2 tests/route) | ≥32 tests pass | 3 |
| Q2 | E2E Tests | Viết 3 Playwright tests (auth, builder, products) | `npm run test:e2e` pass | 2 |
| Q3 | Test Plans | Viết test plan docs cho 5 features | 5 files, ≥5 cases mỗi file | 2 |

### 🚀 DevOps (4 tasks)

| # | Task | Việc làm thật | DoD | Ngày |
|---|------|--------------|-----|:----:|
| O1 | CI Fix | Verify + fix ci.yml (4 steps) | Push → CI green | 1 |
| O2 | Sentry | Install + config Sentry Next.js | Error → Sentry < 1 phút | 1 |
| O3 | Preview Deploy | Viết GitHub Action preview per PR | PR → bot comment preview URL | 2 |
| O4 | Docker Optimize | Multi-stage build, prune | Image < 500MB | 1 |

### 📅 Phân bổ 2 tuần

**Tuần 1:**

| Ai | Tasks | Mục tiêu |
|----|-------|----------|
| Dev 1 | D1, D2 | Tất cả API routes có auth + validation |
| Dev 2 | D3 | Stripe webhook hoạt động |
| Dev 3 | D4, D5, D8-D10 | Seed data + Rate limit + MY collection fields |
| QC | Q1 | API route tests |
| DevOps | O1, O2 | CI green + Sentry monitoring |

**Tuần 2:**

| Ai | Tasks | Mục tiêu |
|----|-------|----------|
| Dev 1 | D6, D7 | Sitemap + Email templates |
| Dev 2-3 | Bắt đầu Sprint 1 nếu design ready | — |
| QC | Q2, Q3 | E2E tests + Test plans |
| DevOps | O3, O4 | Preview deploy + Docker optimize |

---

## Nguồn sự thật (Source of Truth)

| Câu hỏi | Xem file nào |
|---------|-------------|
| Product vision, rules | `SPEC.md` |
| Feature nào cần build? | `SPEC.md §20 Feature Registry` |
| **User Stories (source of truth cho scope)** | **`docs/stories/user-stories-p0.md`** |
| Story format chuẩn | `docs/stories/STORY_TEMPLATE.md` |
| Feature cần gì để build? | `docs/prd/`, `docs/stories/`, `docs/architecture/` |
| PRD format chuẩn | `docs/prd/PRD_TEMPLATE.md` |
| Design workflow + Figma links | `docs/design/DESIGN_WORKFLOW.md` |
| Quyết định đã chốt? | `docs/decisions/decisions-log.md` |
| Git rules, PR template | `.github/CONTRIBUTING.md` |
| Sprint 0 tasks | Bảng ở trên ☝️ |

> ⚠️ **Thứ tự ưu tiên khi conflict:** Stories > PRD > Architecture > Code
