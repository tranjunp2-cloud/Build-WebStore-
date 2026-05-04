---
title: "Validation Decisions — 8 architecture quyết định cho wix-deep-rebuild"
description: "Single source of truth cho 8 architecture decisions confirmed 2026-04-15"
status: final
priority: P0
effort: reference-only
branch: chore/F01-remaining-plans
tags: [validation, decisions, architecture, reference]
created: 2026-04-15
---

# Validation Decisions — 2026-04-15

Sau khi audit 15 blocks (184 bugs tổng), 8 architecture decisions được confirm qua interview với PM. File này là **single source of truth** cho cook + review. Mọi PR liên quan wix-deep-rebuild phải reference đúng quyết định ở đây.

---

## Decision 1 — Contact form submit API + Collection

**Chọn**: Create new `/api/contact-submit` endpoint + Payload collection `ContactSubmissions` (không dùng 3rd party form service).

**Lý do**:
- Giữ data on-premise, không phụ thuộc Formspree/Typeform (cost + GDPR).
- Reuse Payload admin UI để xem submissions — không phải build dashboard riêng.
- Consistent với pattern newsletter (đã có Subscribers collection).

**Chi tiết**:
- Route: `src/app/api/contact-submit/route.ts` POST JSON body `{ name, email, phone?, message, siteId }`
- Validation: Zod schema shared `src/lib/validations/contact.ts` (client + server dùng chung)
- Storage: `payload.create({ collection: 'contact-submissions', data })`
- Migration: `contact_submissions` table trong `scripts/db-setup.js`
- Future: thêm lark webhook notify admin khi có submission mới

**Status**: ✅ IMPLEMENTED PR #636 (commit ed4dd8a3)

---

## Decision 2 — Newsletter popup trigger

**Chọn**: Timer 30s sau page mount + localStorage 7-day dismiss memory (không scroll % trigger, không exit-intent).

**Lý do**:
- Timer 30s = user đã đọc đủ nội dung, nhưng chưa quá muộn để conversion
- Scroll trigger phức tạp, tốn listener
- Exit-intent chỉ work desktop, không mobile
- 7-day dismiss balance: không nag user nhưng cũng không bỏ conversion hoàn toàn

**Chi tiết**:
- Key localStorage: `newsletter-dismissed-${siteId}` = timestamp `Date.now()`
- Check: nếu `Date.now() - stored < 7*24*60*60*1000` → skip mount timer
- Dismiss triggers: Escape key, backdrop click, X button close, submit success
- Native `<dialog>` element + `showModal()` (real a11y focus trap)

**Status**: ✅ IMPLEMENTED PR #637 (commit a6fbc712)

---

## Decision 3 — TikTok icon (và platform không có trong Lucide)

**Chọn**: Inline SVG trong shared module `src/blocks/shared/social-icons.tsx`. Component `<SocialIcon platform="tiktok" />` pick từ registry map.

**Lý do**:
- `lucide-react` không có TikTok icon, fallback Globe gây confusion
- Inline SVG no runtime cost, no extra dep
- Shared module → footer + team (và future contact social) reuse 1 chỗ → bảo trì 1 điểm

**Chi tiết**:
- File: `src/blocks/shared/social-icons.tsx`
- Export: `SocialIcon` component + `SOCIAL_ICON_MAP` registry
- Fallback: nếu platform không có → render Lucide `Link` icon thay letter ugly
- Icons initial: tiktok, instagram, facebook, twitter/x, linkedin, youtube, github (sau này thêm khi cần)

**Status**: ✅ IMPLEMENTED PR #638 (footer, commit 46d43b69) + confirmed PR #641 (team reuse, commit f0a96bb8)

---

## Decision 4 — FAQ answer Lexical support

**Chọn**: FAQ `answer` field accept both `string | JSONContent`, runtime type check. KHÔNG cần SQL migration.

**Lý do**:
- Lexical JSONContent là object → lưu JSONB column đã support sẵn
- Giữ backward compat với string (legacy records)
- Runtime check: `typeof answer === 'string'` → render plain, else → `<RichText>`

**Chi tiết**:
- Schema: `z.union([z.string(), z.any()])` trong FAQConfigSchema
- Render helper: `isLexicalJSON(val)` check có `root` key → render RichText, else plain
- Fallback safe cho cả 2 type

**Status**: PENDING — FAQ block PR chưa cook (sẽ track trong `faq-bugfix-followup.md` sau)

---

## Decision 5 — CTA variant rename `floating` → `card` + new `floating-sticky`

**Chọn**: Rename + migration SQL + thêm variant mới `floating-sticky` thật sự fixed position.

**Lý do**:
- Variant hiện tại "floating" chỉ là card elevated — không thực sự float. Tên sai = future bug.
- Thật sự cần variant fixed scroll CTA cho conversion (Wix, Framer đều có).
- Migration SQL update existing records → zero-downtime.

**Chi tiết**:
- Rename: `'floating'` → `'card'` trong enum config
- Migration: `UPDATE pages_blocks_cta SET variant = 'card' WHERE variant = 'floating'`
- New `floating-sticky`:
  - `position: fixed bottom-4 right-4` desktop, `bottom-4 left-4 right-4` mobile
  - Scroll trigger: show khi scroll > 30% viewport height
  - Dismissible: X button → localStorage 7-day
  - z-index 40 (dưới modal z-50)

**Status**: ✅ IMPLEMENTED PR #640 (commit e520bdb6)

---

## Decision 6 — Features card styles

**Chọn**: 8 distinct Wix-inspired card styles: bordered, filled, glass, shadow, neumorphic, outlined-accent, underline-only, stacked-paper.

**Lý do**:
- Features block hiện tại chỉ có 1-2 card style → không đủ variety cho 30 templates
- Wix templates có 8+ distinct look cho features cards
- Tương ứng personality: minimal (underline-only, bordered), bold (neumorphic, stacked-paper), modern (glass, shadow), classic (filled, outlined-accent)

**Chi tiết**:
- Config: `cardStyle: z.enum([...8 styles])`
- Mỗi style tương ứng 1 CSS module / Tailwind class preset
- Template-composer `rotateStructuralVariants` pick style theo category DNA

**Status**: PENDING — chưa cook (sẽ track trong `features-bugfix-followup.md` sau)

---

## Decision 7 — Newsletter compliance (double opt-in, GDPR, unsubscribe)

**Chọn**: **REVERTED**. Scope quá lớn cho 1 PR. PR #637 chỉ fix UI. Backend compliance defer sang PR riêng sau.

**Lý do revert**:
- Double opt-in cần: Subscribers schema alter (add `status: pending/confirmed`), confirm token column, `/api/subscribe/confirm` route, SES confirm email template
- GDPR consent: checkbox UI + legal copy + consent timestamp column
- Unsubscribe: token generation, `/unsubscribe` public route, one-click unsub
- Tổng effort ~2-3 ngày, không fit vào PR UI fix
- Scope riêng thì có thể kết hợp với email compliance audit toàn diện (OTP + transactional + marketing)

**Chi tiết defer**:
- Track trong plan mới `plans/260415-newsletter-compliance/` (sẽ tạo khi priority)
- Dependencies: tới lịch launch 15/04 phải clarify compliance requirement với legal
- Hiện tại newsletter PR #637 chỉ UI: real dialog, rate limit handling, variantColor inverse

**Status**: ⛔ REVERTED — backend scope defer; UI-only implemented PR #637

---

## Decision 8 — Team social icons reuse shared module

**Chọn**: Team block reuse `src/blocks/shared/social-icons.tsx` từ Decision 3 (không duplicate code trong team block).

**Lý do**:
- DRY — 1 nơi bảo trì TikTok SVG + mapping
- Consistent visual: footer + team social icons cùng style + size
- Easy thêm platform mới: thêm 1 chỗ, apply cả 2 blocks

**Chi tiết**:
- Import: `import { SocialIcon } from '@/blocks/shared/social-icons'`
- Render: `<SocialIcon platform={s.platform} className="w-4 h-4" />`
- Container a11y: `aria-label={\`${memberName} on ${platform}\`}`

**Status**: ✅ IMPLEMENTED PR #641 (commit f0a96bb8)

---

## Cross-cutting notes

### Pattern: "shared module first"
Decision 3 + 8 xác lập pattern — khi cần component/logic dùng ở > 1 block → tạo `src/blocks/shared/` ngay từ đầu. Tránh duplicate rồi refactor sau.

### Pattern: "breaking change + migration SQL"
Decision 5 cho thấy có thể rename field mà không lose data → migration trong `scripts/db-setup.js`. Pattern áp dụng tương lai khi cần rename variant/field.

### Pattern: "defer backend compliance khỏi UI fix"
Decision 7 revert → bài học: audit UI + audit compliance là 2 scope khác nhau. Merge vào 1 PR gây bloat. Future: tách rõ từ lúc plan.

### Pattern: "dev console.warn cho config thiếu"
Nhiều block (about, team, contact) thêm `process.env.NODE_ENV === 'development' && console.warn(...)` khi config rỗng → dev debug fast, prod silent.

---

## Open issues

1. **Decision 4 (FAQ Lexical)** — chưa implement, chờ FAQ block cook PR
2. **Decision 6 (Features 8 card styles)** — chưa implement, cần PM confirm priority cho v1.0 vs Phase 05
3. **Decision 7 reverted** — cần plan riêng `plans/260415-newsletter-compliance/` + decision từ legal về compliance level
4. **Post-launch audit**: sau khi 6 PRs (contact/newsletter/footer/cta/team/about) land staging, cần regression test full flow gen site → confirm không block nào bị side-effect
5. **Shared module expansion**: ngoài social-icons, có candidate nào khác cần extract? (initials-avatar, section-header, rich-text-wrapper...)
