# Git & CI/CD Rules — Chuẩn cho team SaaS

> **Nguồn sự thật duy nhất** cho quy tắc Git, CI/CD và setup. Mọi môi trường (Cursor, Antigravity, CI, dev local) **bắt buộc dùng chung** file này và [CONTRIBUTING.md](.github/CONTRIBUTING.md).

---

## Phần A — Rule (quy tắc)

### 1. Git workflow (branch strategy)

Áp dụng **GitHub Flow** với **staging bắt buộc** (team chỉ vào staging trước; main chỉ qua hotfix hoặc release):

```
main          ← production (protected). Chỉ nhận PR từ staging (release) hoặc hotfix/*
staging       ← pre-production. Nhận PR từ feature/*, fix/*. Deploy staging khi push.
feature/*     ← tính năng mới (tạo từ main hoặc staging). PR vào staging only.
fix/*         ← sửa bug. PR vào staging only.
hotfix/*      ← sửa gấp production. Tạo từ main → PR vào main. Sau đó merge main → staging.
chore/*       ← deps, config, refactor (không đổi logic)
docs/*        ← chỉ tài liệu
```

- **main**: chỉ cập nhật qua (1) PR **staging → main** (khi release) hoặc (2) PR **hotfix/* → main**. Không merge feature/fix trực tiếp vào main.
- **staging**: nhánh team merge hàng ngày. Feature/fix → PR vào **staging** → QA/demo → khi ổn định mới tạo PR staging → main.
- **feature/fix**: luôn tạo PR với **base = staging** (không PR vào main).
- **hotfix**: ngoại lệ — PR vào main, merge xong nên merge main vào staging để đồng bộ.

Chi tiết luồng deploy: [.github/DEPLOY.md](.github/DEPLOY.md). Đánh giá triển khai CI/CD (so workflow + analysis): [.github/CICD_IMPLEMENTATION_ASSESSMENT.md](.github/CICD_IMPLEMENTATION_ASSESSMENT.md).

**Không dùng:** GitFlow (develop/release) trừ khi cần hỗ trợ nhiều phiên bản production.

---

### 2. Branch naming

**Chuẩn:** `type/[ticket-id-]mô-tả-ngắn`  
- Chữ thường, từ cách nhau bằng dấu gạch ngang `-`.  
- Không dấu cách, ký tự đặc biệt (trừ `-`).

| Type     | Ví dụ |
|----------|--------|
| feature  | `feature/PROJ-123-user-onboarding` |
| fix      | `fix/PROJ-456-login-redirect` |
| hotfix   | `hotfix/PROJ-789-payment-timeout` |
| chore    | `chore/deps-upgrade-nextjs` |
| docs     | `docs/api-spec-auth` |

**CI/CD:** Pipeline có thể trigger job theo prefix (`feature/*` → test + build, `main` → deploy production).

---

### 3. Conventional Commits (bắt buộc cho CI/CD)

**Format:** `type(scope): description`

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

#### 3.1 Type (ảnh hưởng version & changelog)

| Type     | Mô tả           | Version bump (semantic-release) |
|----------|-----------------|----------------------------------|
| feat     | Tính năng mới   | MINOR (1.0.0 → 1.1.0)          |
| fix      | Sửa bug         | PATCH (1.0.0 → 1.0.1)           |
| docs     | Chỉ tài liệu    | — (không release)              |
| style    | Format, không đổi logic | —                        |
| refactor | Refactor, không đổi behavior | —                    |
| perf     | Cải thiện hiệu năng | PATCH (tùy cấu hình)        |
| test     | Thêm/sửa test   | —                               |
| build    | Build, deps, tooling | —                           |
| ci       | CI/CD config     | —                               |
| chore    | Việc lặt vặt (deps, config) | —                        |

**Breaking change:** Thêm footer `BREAKING CHANGE: mô tả` hoặc type `feat!`/`fix!` → MAJOR (1.0.0 → 2.0.0).

#### 3.2 Ví dụ

```
feat(auth): add Google OAuth login
fix(api): handle null response from payment gateway
fix!: remove deprecated /v1/users endpoint
docs(readme): update Docker setup
chore(deps): upgrade Next.js to 14.2
```

#### 3.3 Rule

- Dòng đầu ≤ 72 ký tự.  
- Dùng thể mệnh lệnh: "add", "fix", "update" (không "added", "fixes").  
- Có ticket thì ghi cuối: `feat(auth): add OAuth (PROJ-123)`.

Repo dùng **Commitlint + Husky** để chặn commit không đúng format (chạy khi `git commit`).

---

### 4. Pull Request (PR)

#### 4.1 Yêu cầu trước khi merge

- **Title:** Theo Conventional Commits (type(scope): description).  
- **Description:** Điền đủ [template](.github/PULL_REQUEST_TEMPLATE.md) (Story, Changes, Checklist, Test steps).  
- **Review:** ≥ 1 approval.  
- **CI:** Toàn bộ status check pass (lint, typecheck, test, build).  
- **Branch:** Cập nhật với base (rebase hoặc merge base vào branch).

#### 4.2 PR template

Template nằm tại [.github/PULL_REQUEST_TEMPLATE.md](.github/PULL_REQUEST_TEMPLATE.md). Mỗi PR phải điền đủ Story, Changes, Checklist, Test Steps.

---

### 5. Branch protection (GitHub)

**main (và staging nếu dùng):**

- Require pull request before merging.  
- Require approval: ít nhất 1.  
- Require status checks to pass (CI jobs: lint, typecheck, test, build).  
- Require branch to be up to date before merging (hoặc dùng Merge Queue).  
- Restrict force push / delete (chỉ maintainer nếu cần).  
- Optional: Require linear history (squash hoặc rebase).

**CI status checks cần có:** `lint`, `typecheck`, `test`, `build`.

---

### 6. CI/CD pipeline (gợi ý)

| Event / Branch   | Chạy gì |
|------------------|---------|
| PR vào `staging` (từ feature/*, fix/*) | Lint, typecheck, test, build |
| Push `staging`   | Build → deploy staging |
| PR vào `main` (từ staging hoặc hotfix/*) | Lint, typecheck, test, build |
| Push `main`      | Build → deploy production |

**Quy ước:** Feature/fix chỉ merge vào **staging**. Main chỉ nhận merge từ **staging** (release) hoặc **hotfix/***. Chi tiết: [.github/DEPLOY.md](.github/DEPLOY.md).

**Version (semantic-release):** Chạy trên `main`; đọc commit → `feat` = MINOR, `fix` = PATCH, `BREAKING CHANGE` = MAJOR → tag, changelog, GitHub Release.

---

### 7. Tóm tắt cho team

| Việc            | Chuẩn |
|-----------------|--------|
| Tạo branch      | `feature/PROJ-123-mô-tả` hoặc `fix/...`, `chore/...` |
| Commit          | `type(scope): mô tả` (Conventional Commits) |
| Trước khi PR    | 9-Point Done, lint/typecheck/test pass |
| PR              | Title đúng convention, description đủ template, đợi approval + CI xanh |
| Merge           | Squash hoặc rebase tùy quy định; merge khi đủ điều kiện |

---

## Phần B — Setup (một lần)

### 8. Setup trên GitHub (Admin/owner)

#### 8.1 Branch protection cho `main`

1. Repo → **Settings** → **Branches** → Add rule (hoặc sửa rule cho `main`).
2. **Branch name pattern:** `main`.
3. Bật: **Require a pull request** (1 approval), **Require status checks to pass**, **Require branch to be up to date**, **Do not allow bypassing**.
4. Tắt: **Allow force pushes**, **Allow deletions**.  
5. Save.

**Lưu ý:** "Require status checks" bật sau khi đã có GitHub Actions (chọn tên job: lint, build, …).

#### 8.2 PR template

Đã có sẵn tại [.github/PULL_REQUEST_TEMPLATE.md](.github/PULL_REQUEST_TEMPLATE.md). Mỗi lần tạo PR, description tự điền theo template.

---

### 9. Setup trên máy (mỗi dev, một lần)

#### 9.1 Git global

```bash
git config --global user.name "Tên của bạn"
git config --global user.email "email@company.com"
git config --global init.defaultBranch main
git config --global core.autocrlf input
```

Kiểm tra: `git config --global --list`.

#### 9.2 Clone và cài dependency

```bash
git clone https://github.com/primeproduction/ech-prime-web-v2.git
cd ech-prime-web-v2
npm install
```

Script **`prepare`** đã cấu hình Husky — sau `npm install`, hook **commit-msg** tự gắn. Mọi `git commit` sẽ chạy Commitlint; message sai format sẽ bị chặn.

**Kiểm tra Commitlint:**

```bash
echo "feat(auth): add login" | npx commitlint
# Không in gì = pass
echo "wrong message" | npx commitlint
# Báo lỗi
```

#### 9.3 File cấu hình trong repo (đã có sẵn)

| File | Mục đích |
|------|----------|
| `commitlint.config.js` | Rule Conventional Commits (type, scope, subject, độ dài) |
| `.husky/commit-msg` | Hook chạy Commitlint khi commit |

Chỉnh rule commit: sửa `commitlint.config.js`. Hook: `.husky/commit-msg`.

---

## Phần C — Quy trình hàng ngày

### 10. Các bước làm việc

**Bước 1 — Lấy code mới**

```bash
git checkout main
git pull origin main
```

**Bước 2 — Tạo branch**

```bash
git checkout -b feature/PROJ-123-user-onboarding
# hoặc fix/..., hotfix/..., chore/...
```

**Bước 3 — Code và commit**

```bash
git add .
git commit -m "feat(auth): add Google OAuth login (PROJ-123)"
```

Nếu message sai format, Commitlint báo lỗi. Không dùng `--no-verify` trừ khi lead đồng ý.

**Bước 4 — Push và tạo PR**

```bash
git push -u origin feature/PROJ-123-user-onboarding
```

Trên GitHub: Compare & pull request → điền template → assign reviewer.

**Bước 5 — Cập nhật branch với main (khi main có commit mới)**

```bash
git checkout main && git pull origin main
git checkout feature/PROJ-123-landing-page
git rebase main
# hoặc git merge main
git push origin feature/PROJ-123-landing-page
```

**Bước 6 — Sau khi merge PR**

Xóa branch (trên GitHub hoặc `git branch -d ...` và `git push origin --delete ...`).

---

### 11. Checklist nhanh

| Bước | Lệnh / Việc |
|------|-------------|
| Lấy code mới | `git checkout main` → `git pull origin main` |
| Tạo branch | `git checkout -b feature/PROJ-xxx-mô-tả` |
| Commit | `git add .` → `git commit -m "type(scope): mô tả"` |
| Push | `git push -u origin <branch>` |
| PR | GitHub: New PR, điền template, assign reviewer |
| Cập nhật main | `git rebase main` hoặc `git merge main` trên branch |
| Sau merge | Xóa branch (local + remote) |

---

## Phần D — Giải quyết conflict (merge / rebase)

**Nguyên tắc:** Ưu tiên **cấu trúc trên base (main)**; nội dung từ branch feature **tích hợp vào** cấu trúc đó, không xóa code mới trên main để giữ bản branch.

- Khi conflict: đọc kỹ cả hai bên; nếu main có refactor/cấu trúc mới (vd. i18n, component mới), **giữ cấu trúc main** và port thay đổi của branch vào.
- Không dùng “giữ toàn bộ bên mình” khi main đã có thay đổi quan trọng (kiến trúc, routing, i18n, …).

**Quy trình gợi ý:** Merge/rebase main vào branch → mở file conflict → giữ phần base (main), chèn/chỉnh phần feature cho khớp → test → commit resolve.

---

## Phần E — Xử lý lỗi

| Lỗi | Cách xử lý |
|-----|------------|
| Commitlint báo "subject may not be empty" | Message phải có dạng `type(scope): mô tả`, không để trống. |
| Commitlint báo "type must be one of ..." | Dùng đúng type: feat, fix, docs, style, refactor, perf, test, build, ci, chore. |
| Hook không chạy (commit vẫn qua) | Chạy `npm run prepare`; kiểm tra `.husky/commit-msg` có quyền execute (`chmod +x`). |
| Push bị từ chối (branch protected) | Không push trực tiếp lên `main`. Tạo branch → PR → merge. |
| CI fail trên PR | Xem tab Checks, sửa lint/typecheck/test theo báo lỗi, commit lại và push. |

---

## Tham chiếu

- [Conventional Commits](https://www.conventionalcommits.org/)
- [GitHub Flow](https://docs.github.com/en/get-started/quickstart/github-flow)
- [semantic-release](https://github.com/semantic-release/semantic-release)
- [Commitlint](https://commitlint.js.org/)
- [Husky](https://typicode.github.io/husky/)
- Nội bộ: [CONTRIBUTING.md](.github/CONTRIBUTING.md), [SPEC.md](../SPEC.md) (9-Point, API, schema).
