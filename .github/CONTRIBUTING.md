# Đóng góp & Rule chung

> **Một chuẩn, mọi nơi tuân theo.**

---

## 1. Git Rules

### Branch Naming
```
feat/F{XX}-tên-feature    # Feature mới
fix/mô-tả-bug             # Bug fix
chore/mô-tả               # Cleanup, CI, docs
```

### Commit Convention
```
feat(F{XX}): mô tả ngắn
fix(F{XX}): mô tả bug
chore: mô tả
```

### PR Rules
- PR **luôn vào `staging`** — KHÔNG vào `main`
- Title: `type(scope): mô tả` (Conventional Commits)
- Điền đủ [PR Template](pull_request_template.md)
- CI phải xanh (lint + typecheck + test + build) mới merge

### Branch Flow
```
feat/F05-editor ─→ PR vào staging ─→ review ─→ merge ─→ staging deploy
                                                           ↓
                                              main (release only)
```

---

## 2. PR Review Checklist

### Bắt buộc (không đạt = không merge)
- [ ] CI pass (Lint, Typecheck, Test, Build)
- [ ] Branch up-to-date với staging
- [ ] PR description đầy đủ template
- [ ] Title theo Conventional Commits

### Nên kiểm tra
- [ ] Logic đúng với mô tả PR
- [ ] API/schema thay đổi có ghi trong PR
- [ ] Không có secret/credential trong diff
- [ ] Có test cho code mới

---

## 3. Trước khi Push

```bash
npm run lint          # ESLint
npm run typecheck     # TypeScript errors
npm run test          # Unit tests
npm run build         # Build check
```

**Tất cả phải pass** trước khi tạo PR.

---

## 4. CI Pipeline

```
Push/PR → Lint → Typecheck → Test → Build → ✅ Merge allowed
                                              ❌ Fix trước
```

Chi tiết: [.github/workflows/ci.yml](workflows/ci.yml)

---

## 5. Deploy Flow

| Branch | Deploy tới | Tự động? |
|--------|-----------|:---:|
| `staging` | Staging server | ✅ Auto |
| `main` | Production | 🔐 Manual approve |

Chi tiết: [DEPLOY.md](DEPLOY.md)

---

## 6. Quy tắc code

- **TypeScript:** Zero `any` — `tsc --noEmit` pass
- **Mobile First:** UI build ở 375px trước
- **SEO:** Storefront pages phải có meta title, description, JSON-LD
- **Bilingual:** AI content BM + EN
- **9-Point Checklist:** Loading state, Empty state, Error state, Form validation, Button states, Toast feedback, Auth redirect, Mobile 375px, TypeScript clean

Chi tiết: [SPEC.md](../SPEC.md) §13
