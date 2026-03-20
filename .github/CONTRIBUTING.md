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
- **⚠️ Link issue:** Bot tự thêm `Relates to #<số>`. KHÔNG dùng `Closes #N`.

### Link PR → Issue (bot tự làm!)

Story-sync tự tạo issues từ `docs/stories/`. Bot sẽ **tự động link** PR → Issue:

**Cách nhanh nhất (zero effort):** Đặt PR title có story ID:
```
feat(F01): [US-F01-03] AI template selection
→ Bot tự tìm issue #59 → tự sửa PR body: Relates to #59
```

**Nếu bot không match được:** Bot comment gợi ý danh sách issues → dev chọn 1 → edit PR.

**Keywords:** Dùng `Relates to #N` (⚠️ KHÔNG dùng `Closes #N`):
```
Relates to #123     ← Đúng: issue chờ QC test trước khi close
Closes #123         ← SAI: issue tự close, skip QA gate
```

**Tại sao KHÔNG dùng Closes?**
- Issue phải qua QA Testing trước khi Done
- QC test xong mới close issue → milestone % chính xác
- Nếu QC fail → issue trả về dev fix (không cần reopen)

### Issue Status Flow

```
Backlog → Review (UIUX+BA) → In Progress → Code Review → QA Testing → Done
              ↑                                              │
              │                  ↑                           │
              │                  └──── qa:failed ────────────┘
              └── review:rejected
```

### Branch Flow
```
feat/F05-editor ─→ PR vào staging ─→ review ─→ merge ─→ QA Testing ─→ QC close → Done
                                                           ↓
                                              main (release only)
```

---

## 2. Hướng dẫn theo Role

### PM
1. Tạo issue từ `docs/stories/` hoặc thủ công
2. Issue tự vào **Backlog**
3. Assign UIUX + BA để review spec/design
4. Theo dõi milestone progress

### UIUX Designer
1. Check issues ở **Backlog** được assign
2. Làm design → attach figma/wireframe vào issue
3. Khi xong → thêm label `status:ready`
4. Nếu spec chưa rõ → thêm label `review:rejected` + comment lý do

### BA
1. Check issues ở **Backlog** được assign
2. Verify requirements, acceptance criteria
3. Khi xong → thêm label `status:ready`
4. Nếu spec sai → thêm label `review:rejected` + comment lý do

### Dev
1. Pick issues ở **In Progress** (đã có label `status:ready`)
2. Tạo branch: `feature/F01-mô-tả` → code → commit → push
3. Tạo PR vào staging: title có `[US-F01-03]` → bot auto-link
4. Đợi review + CI pass → merge khi có label `ready-to-merge`
5. Nếu QC gắn `qa:failed` → check comment QC → fix → tạo PR mới

### QC (Quality Control)
1. Check issues ở **QA Testing** (có label `qa:pending`)
2. Test trên staging theo acceptance criteria trong issue
3. **Pass:** Close issue → status tự chuyển Done
4. **Fail:** Thêm label `qa:failed` + comment chi tiết lỗi
   - Hoặc tạo bug issue mới từ template "Bug Report (QA)"
5. Remove label `qa:pending`, thêm `qa:passed` hoặc `qa:failed`

### Reviewer
1. Check PRs được assign
2. Review code theo checklist (§2 bên dưới)
3. Approve → bot tự gắn `approved` + `ready-to-merge` (nếu CI pass)
4. Changes requested → author fix → re-review

---

## 3. PR Review Checklist

### Bắt buộc (không đạt = không merge)
- [ ] CI pass (Lint, Typecheck, Test, Build)
- [ ] Branch up-to-date với staging
- [ ] PR description đầy đủ template
- [ ] Title theo Conventional Commits
- [ ] Issue đã linked (`Relates to #N`)

### Nên kiểm tra
- [ ] Logic đúng với mô tả PR
- [ ] API/schema thay đổi có ghi trong PR
- [ ] Không có secret/credential trong diff
- [ ] Có test cho code mới

---

## 4. Trước khi Push

```bash
npm run lint          # ESLint
npm run typecheck     # TypeScript errors
npm run test          # Unit tests
npm run build         # Build check
```

**Tất cả phải pass** trước khi tạo PR.

---

## 5. CI Pipeline

```
Push/PR → Lint → Typecheck → Test → Build → ✅ Merge allowed
                                              ❌ Fix trước
```

Chi tiết: [.github/workflows/ci.yml](workflows/ci.yml)

---

## 6. Deploy Flow

| Branch | Deploy tới | Tự động? |
|--------|-----------|:---:|
| `staging` | Staging server | ✅ Auto |
| `main` | Production | 🔐 Manual approve |

Chi tiết: [DEPLOY.md](DEPLOY.md)

---

## 7. Quy tắc code

- **TypeScript:** Zero `any` — `tsc --noEmit` pass
- **Mobile First:** UI build ở 375px trước
- **SEO:** Storefront pages phải có meta title, description, JSON-LD
- **Bilingual:** AI content BM + EN
- **9-Point Checklist:** Loading state, Empty state, Error state, Form validation, Button states, Toast feedback, Auth redirect, Mobile 375px, TypeScript clean

Chi tiết: [SPEC.md](../SPEC.md) §13

---

## 8. Labels Reference

| Label | Ý nghĩa | Ai dùng |
|-------|---------|---------|
| `status:ready` | UIUX+BA approved → dev pick | UIUX/BA |
| `review:rejected` | Spec reject → trả về PM | UIUX/BA |
| `qa:pending` | Chờ QC test (auto khi PR merge) | Bot |
| `qa:passed` | QC test pass | QC |
| `qa:failed` | QC test fail → trả về dev | QC |
| `ready-to-merge` | PR approved + CI pass | Bot |
| `approved` | PR đã approve | Bot |
| `wave:X` | Thuộc Wave nào | Bot |
