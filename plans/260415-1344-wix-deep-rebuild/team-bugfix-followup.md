---
title: "Team — Fix 7 lỗi (social icons, avatar fallback, semantic, keys)"
description: "Reuse shared social-icons, deterministic initials color, semantic aria-label, stable keys"
status: done
priority: P2
effort: 3h
branch: chore/F01-remaining-plans
tags: [team, bugfix, a11y, shared-component]
created: 2026-04-15
completed: 2026-04-15
---

# Team — Fix 7 lỗi còn lại

## Bối cảnh
Audit tìm 7 lỗi team block: social link render text pill thay icon, InitialsAvatar 1 char cùng màu luôn, img onError fallback chưa có, thiếu semantic aria-label, keys dùng index không stable, list bio line-clamp mismatch grid, empty members im lặng không warn. Fix tất cả trong PR #641 + reuse shared social-icons.tsx từ footer.

## Phạm vi
Đụng `src/blocks/team/index.tsx`. Reuse `src/blocks/shared/social-icons.tsx` đã tạo trong footer PR #638. KHÔNG redesign 5 variants mới (defer Phase 05).

## Danh sách lỗi cần fix

### Lỗi D — Social link text pill (30 phút, P1)
**Vấn đề**: Social render `<a>{platform}</a>` text pill xấu, không giống team section hiện đại.
**Cách sửa**: Import `SocialIcon` từ `src/blocks/shared/social-icons.tsx`. Render `<SocialIcon platform={s.platform} />` trong `<a href={s.url} aria-label={\`${name} ${s.platform}\`}>`. Icon size `w-4 h-4`, container `w-9 h-9` (44px touch target khi padding).

---

### Lỗi A — SectionHeader sectionLabel + align prop (15 phút, P2)
**Cách sửa**: Extract shared `<SectionHeader sectionLabel={...} title={...} align="center" />` pattern để team variants dùng chung (không duplicate inline).

---

### Lỗi B — InitialsAvatar 1 char cùng màu (30 phút, P2)
**Vấn đề**: Member không có photo → avatar chỉ hiện 1 chữ cái + bg xám cố định → tất cả members nhìn giống nhau.
**Cách sửa**:
1. Extract 2 chars: `name.split(' ').map(w => w[0]).slice(0,2).join('')`
2. Deterministic color: hash name → hue 0-360 → `backgroundColor: hsl(${hue}, 65%, 85%)`, text `hsl(${hue}, 60%, 30%)`
3. Function `getInitialsColor(name: string)` pure, stable across renders.

---

### Lỗi C + 7T — img onError fallback (20 phút, P2)
**Cách sửa**: `<img>` gắn `onError={(e) => setImageError(true)}`. Nếu `imageError` → render `<InitialsAvatar />` thay thế. Track error state per-member bằng Set `failedImages`.

---

### Lỗi 8T — Semantic aria-label (15 phút, P2)
**Cách sửa**: Email `aria-label="Email ${name}"`, phone `aria-label="Call ${name}"`, social `aria-label="${name} on ${platform}"`, website `aria-label="Visit ${name} website"`.

---

### Lỗi 9T — Stable keys name-index (5 phút, P2)
**Vấn đề**: `key={index}` → nếu members re-order, React diff wrong.
**Cách sửa**: `key={\`${member.name}-${index}\`}` — vẫn dùng index nếu 2 member trùng tên, nhưng ổn định hơn nếu không trùng.

---

### Lỗi 10T — List bio line-clamp-3 sync grid (10 phút, P3)
**Cách sửa**: List variant bio dùng `line-clamp-3` giống grid → visually consistent khi switch variant.

---

### Lỗi 14T — Empty members dev console.warn (10 phút, P3)
**Cách sửa**: Đầu component `if (process.env.NODE_ENV === 'development' && members.length === 0) console.warn('[TeamBlock] No members provided')`. Render null hoặc placeholder state.

---

## Thứ tự làm

1. **Lỗi D** (30 phút) — import shared SocialIcon (critical cho visual)
2. **Lỗi B + C/7T** (50 phút) — avatar system (color hash + onError fallback)
3. **Lỗi A** (15 phút) — SectionHeader extract
4. **Lỗi 8T + 9T + 10T + 14T** (40 phút) — quick wins gom 1 commit

Tổng: **2.25 giờ**.

## Tiêu chí hoàn thành
- [x] SocialIcon component reuse từ footer shared module (confirm Decision 3 + 8)
- [x] Avatar initials 2 chars + deterministic hsl hue hash per-name
- [x] img onError → fallback to InitialsAvatar (no broken image icon)
- [x] aria-label semantic cho Email/Call/Visit/social
- [x] Keys `${name}-${index}` stable
- [x] List bio `line-clamp-3` consistent
- [x] Empty members dev warn
- [x] `tsc --noEmit` sạch

## Kết quả thực hiện (2026-04-15)
- **PR**: #641 (merged/review)
- **Commit**: f0a96bb8
- **Reuse**: `src/blocks/shared/social-icons.tsx` (tạo từ footer PR #638)
- **Confirmed**: Decision 3 (shared social-icons) + Decision 8 (team reuse)
- **Deferred**: 5 variants mới (cards-hover-reveal, bio-modal, horizontal-scroll, compact-row, org-chart) — Phase 05

## Rủi ro
- **Hash color**: nếu 2 members có chung hash (collision) → avatar giống nhau. Acceptable vì user khó nhận ra.
- **InitialsAvatar cùng component**: nếu footer hoặc cta cũng cần initials avatar sau này → extract ra `src/components/ui/initials-avatar.tsx` shared.
- **onError re-trigger**: mỗi render nếu `failedImages` Set reset → loop. Phải đặt Set state ngoài render.

## Câu hỏi còn bỏ ngỏ
1. 5 variants mới Phase 05: PM muốn prioritize variant nào? `cards-hover-reveal` + `bio-modal` hợp professional firms, `horizontal-scroll` + `compact-row` hợp SaaS.
2. Avatar có nên support `<svg>` logo thay photo không (cho co-founders team thích anonymous)?
3. Social icons: team có cần link GitHub/Dribbble/Behance không ngoài LinkedIn/Twitter?
