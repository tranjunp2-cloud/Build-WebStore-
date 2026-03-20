# Đóng góp & Rule chung

> **Một chuẩn, mọi nơi tuân theo.**

---

## 1. Git Rules

### Branch Naming
```
feature/F01-ai-builder     # Feature mới (FXX = feature code, bot dùng để auto-link issue)
feat/F07-template-gallery  # Cũng OK — bot nhận FXX từ tên branch
fix/F01-login-redirect     # Bug fix
chore/deps-upgrade         # Cleanup, CI, docs (bot skip check issue)
```

### Commit Convention
```
feat(F01): add AI template selection
fix(F01): handle null response in builder
chore: upgrade Next.js to 15.1
```

### PR Rules
- PR **luôn vào `staging`** — KHÔNG vào `main`
- Title: `type(scope): mô tả` (Conventional Commits)
- Điền đủ [PR Template](pull_request_template.md)
- CI phải xanh (lint + typecheck + test + build) mới merge
- **⚠️ BẮT BUỘC link issue:** Thêm `Closes #<số>` trong PR description

### Link PR → Issue (bot tự làm!)

Story-sync tự tạo issues từ `docs/stories/`. Bot sẽ **tự động link** PR → Issue:

**Cách nhanh nhất (zero effort):** Đặt PR title có story ID:
```
feat(F01): [US-F01-03] AI template selection
→ Bot tự tìm issue #59 → tự sửa PR body: Closes #59
```

**Nếu bot không match được:** Bot comment gợi ý danh sách issues → dev chọn 1 → edit PR.

**Keywords hợp lệ** (GitHub tự đóng issue khi PR merged):
```
Closes #123     Fixes #123     Resolves #123
```

**Tại sao quan trọng?**
- Tránh tạo ticket trùng
- Auto-close issue khi merge → board tự cập nhật
- Tracking progress chính xác theo milestone

Chi tiết: [GIT_AND_CI_RULES.md](GIT_AND_CI_RULES.md) §4.3

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
