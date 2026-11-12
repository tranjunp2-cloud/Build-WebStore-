# Tổng hợp quy trình & rule — Cho team cùng lập trình

> Tài liệu này tổng hợp **quy trình làm việc** và **các rule cần nắm** trong dự án. Mọi người đọc để hiểu chung, sau đó làm theo và tham chiếu chi tiết ở từng file trong `.github`.

---

## 1. Nguồn sự thật — Rule nằm ở đâu

**Một chuẩn, mọi nơi tuân theo:** toàn bộ rule Git, PR, CI/CD, deploy nằm trong thư mục **`.github`** (và SPEC.md cho product). Cursor, Antigravity, CI, dev local — **không** tạo rule riêng theo từng tool.

| Khi cần | Mở file |
|--------|---------|
| **Tổng quan** (bản đồ rule, điểm vào) | [.github/OVERVIEW.md](.github/OVERVIEW.md) |
| **Quy định chung, ai phải theo** | [.github/CONTRIBUTING.md](.github/CONTRIBUTING.md) |
| **Git, branch, commit, PR, CI** | [.github/GIT_AND_CI_RULES.md](.github/GIT_AND_CI_RULES.md) |
| **Deploy staging vs production** | [.github/DEPLOY.md](.github/DEPLOY.md) |
| **Template mô tả PR** (bắt buộc khi tạo PR) | [.github/PULL_REQUEST_TEMPLATE.md](.github/PULL_REQUEST_TEMPLATE.md) |
| **Review PR — checklist** | [.github/REVIEW_CHECKLIST.md](.github/REVIEW_CHECKLIST.md) |
| **Unit test — phạm vi, cách test đủ/đúng** | [.github/TEST_PLAN.md](.github/TEST_PLAN.md) |
| **Product, BMAD, 9-Point, API** | [SPEC.md](../SPEC.md) (root) |

---

## 2. Quy trình Git — Staging trước, main chỉ hotfix/release

### 2.1 Luồng nhánh

```
main          ← production (protected). Chỉ nhận PR từ staging (release) hoặc hotfix/*
staging       ← pre-production. Nhận PR từ feature/*, fix/*. Deploy staging khi push.
feature/*     ← tính năng mới (tạo từ main hoặc staging). PR vào staging only.
fix/*         ← sửa bug. PR vào staging only.
hotfix/*      ← sửa gấp production. Tạo từ main → PR vào main. Sau đó merge main → staging.
chore/*       ← deps, config, refactor (không đổi logic)
```

- **Feature / fix:** luôn tạo PR với **base = staging** (không PR thẳng vào main).
- **Main:** chỉ cập nhật qua (1) PR **staging → main** (release) hoặc (2) PR **hotfix/* → main**.

### 2.2 Đặt tên branch

Chuẩn: `type/[ticket-id-]mô-tả-ngắn` (chữ thường, từ cách nhau bằng `-`).

| Type    | Ví dụ |
|---------|--------|
| feature | `feature/PROJ-123-user-onboarding` |
| fix     | `fix/PROJ-456-login-redirect` |
| hotfix  | `hotfix/PROJ-789-payment-timeout` |
| chore   | `chore/deps-upgrade-nextjs` |

### 2.3 Commit — Conventional Commits (bắt buộc)

Format: **`type(scope): mô tả`**

Ví dụ:
- `feat(auth): add Google OAuth login`
- `fix(api): handle null response from payment gateway`
- `chore(deps): upgrade Next.js to 14.2`

Rule: dòng đầu ≤ 72 ký tự; dùng thể mệnh lệnh ("add", "fix"); có ticket ghi cuối: `(PROJ-123)`. Repo dùng **Commitlint + Husky** — commit sai format sẽ bị chặn.

---

## 3. Quy trình làm việc hàng ngày (tóm tắt)

| Bước | Việc |
|------|------|
| 1 | Lấy code mới: `git checkout main` → `git pull origin main` (hoặc `staging` nếu làm từ staging). |
| 2 | Tạo branch: `git checkout -b feature/PROJ-123-mô-tả` (hoặc fix/..., chore/...). |
| 3 | Code và commit: `git add .` → `git commit -m "type(scope): mô tả"`. |
| 4 | **Trước khi push:** `npm run verify` (husky `pre-push` tự chạy — không dùng `--no-verify`). |
| 5 | Push và tạo PR: `git push -u origin <branch>` → GitHub: Compare & pull request, **base = staging**, điền đủ template, assign reviewer. |
| 6 | Cập nhật branch với base: Nếu staging/main có commit mới → rebase/merge base vào branch → push lại. |
| 7 | Sau khi merge: Xóa branch (trên GitHub hoặc local). |

Chi tiết từng bước: [GIT_AND_CI_RULES.md §10](.github/GIT_AND_CI_RULES.md).

---

## 4. Pull Request — Yêu cầu trước khi merge

- **Title:** Theo Conventional Commits: `type(scope): mô tả`.
- **Description:** Điền đủ [template](.github/PULL_REQUEST_TEMPLATE.md): Story, Changes, Checklist, Test Steps (không để trống).
- **Review:** ≥ 1 approval.
- **CI:** Toàn bộ status check pass (lint, typecheck, test, build).
- **Branch:** Up to date với base (staging hoặc main), không conflict.

**Người review:** Xem [REVIEW_CHECKLIST.md](.github/REVIEW_CHECKLIST.md). Chỉ approve khi CI xanh và checklist thỏa; không approve "cho qua" khi CI đỏ.

---

## 5. CI — Giữ pipeline xanh

Workflow: [.github/workflows/ci.yml](.github/workflows/ci.yml). Trên PR, CI chỉ chạy phần liên quan file đã sửa (chi tiết: [GIT_AND_CI_RULES.md §5.1](GIT_AND_CI_RULES.md)); full test suite chạy khi PR vào `main` và sau khi merge vào `staging`.

Local trước khi push:

| Bước | Lệnh |
|------|------|
| 1 | `npm run lint` |
| 2 | `npm run typecheck` |
| 3 | `npm run test` |
| 4 | `npm run build` |

**Trách nhiệm dev:** hook `pre-commit` / `pre-push` chạy các bước trên tự động (chi tiết: [GIT_AND_CI_RULES.md §5.1](GIT_AND_CI_RULES.md)). Nếu CI vẫn đỏ → sửa trên branch rồi push lại.

---

## 6. Deploy — Staging vs Production

| Môi trường   | Nhánh   | Khi nào deploy |
|-------------|---------|-----------------|
| **Staging** | `staging` | Push/merge vào `staging` → workflow deploy staging (vd. DigitalOcean App Platform). |
| **Production** | `main` | Merge staging → main (release) hoặc hotfix → main → workflow deploy production. |

Chi tiết cấu hình, env, xử lý lỗi: [.github/DEPLOY.md](.github/DEPLOY.md).

---

## 7. Code & product rule (tóm tắt)

- **Trước khi code:** Đọc SPEC.md (user stories, API, data model).
- **Khi implement:** 6-Layer (SPEC §15), soft delete, multi-tenant, 3 states (loading/error/empty), form Zod + RHF.
- **Trước PR:** 9-Point Done (SPEC §13), lint/typecheck/test pass, PR description đủ template.
- **Test:** Logic dùng chung đặt trong `src/lib` hoặc `src/store`, test import từ đó — xem [TEST_PLAN.md](.github/TEST_PLAN.md).

---

## 8. Checklist nhanh cho từng vai trò

### Dev

- [ ] Đã đọc OVERVIEW.md và CONTRIBUTING.md.
- [ ] Branch/commit/PR theo GIT_AND_CI_RULES; feature/fix → PR vào **staging**.
- [ ] Trước push: chạy lint, typecheck, test, build.
- [ ] Mỗi PR điền đủ template (Story, Changes, Checklist, Test Steps).

### Reviewer

- [ ] Đã đọc REVIEW_CHECKLIST.md.
- [ ] Chỉ approve khi CI pass, branch up to date, PR description đủ.
- [ ] Không approve khi CI đỏ hoặc checklist thiếu.

### Mọi người

- [ ] Rule chung chỉ trong `.github` (và SPEC.md). Không tạo file rule riêng theo từng IDE/tool.
- [ ] Cursor / AI: khi tạo PR dùng đúng template; đọc rule từ `.github`.

---

## 9. Link nhanh

| Câu hỏi | File |
|--------|------|
| Tạo branch/commit/PR thế nào? | [GIT_AND_CI_RULES.md](.github/GIT_AND_CI_RULES.md) |
| Feature merge vào đâu? | [DEPLOY.md](.github/DEPLOY.md) — staging trước, main chỉ release/hotfix |
| Review PR cần check gì? | [REVIEW_CHECKLIST.md](.github/REVIEW_CHECKLIST.md) |
| Unit test viết thế nào cho đủ/đúng? | [TEST_PLAN.md](.github/TEST_PLAN.md) |
| Lỗi CI, rule code, Copilot? | [CODE_AND_RULES.md](.github/CODE_AND_RULES.md) |
| Bản đồ toàn bộ rule? | [OVERVIEW.md](.github/OVERVIEW.md) |

---

**Tóm tắt:** Cùng nhau lập trình theo **một bộ rule trong `.github`**: staging trước, commit/PR đúng chuẩn, CI pass trước khi merge, review theo checklist. Chi tiết từng mục xem đúng file trong bảng trên.
