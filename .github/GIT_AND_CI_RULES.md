# Git & CI/CD Rules — Chuẩn cho team SaaS

> **Nguồn sự thật duy nhất** cho quy tắc Git, CI/CD và setup. Mọi môi trường (Cursor, Antigravity, CI, dev local) **bắt buộc dùng chung** file này và [CONTRIBUTING.md](.github/CONTRIBUTING.md). **Tổng quan code/project rules:** [.github/OVERVIEW.md](.github/OVERVIEW.md).

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

**Chuẩn:** `type/FXX-mô-tả-ngắn`
- `FXX` = Feature code (F01, F02, ...) — **quan trọng** để bot auto-link PR → Issue.
- Chữ thường, từ cách nhau bằng dấu gạch ngang `-`.
- Không dấu cách, ký tự đặc biệt (trừ `-`).

| Type     | Ví dụ |
|----------|--------|
| feature  | `feature/F01-ai-builder` |
| feat     | `feat/F07-template-gallery` |
| fix      | `fix/F01-login-redirect` |
| hotfix   | `hotfix/F13-payment-timeout` |
| chore    | `chore/deps-upgrade-nextjs` |
| docs     | `docs/api-spec-auth` |

**CI/CD:** Pipeline trigger theo prefix (`feature/*` → test + build, `main` → deploy production).
**Bot:** Branch có `FXX` → bot tự tìm issues matching để auto-link (xem §4.3).

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

- **Title:** Theo Conventional Commits. Nên có story ID: `feat(F01): [US-F01-03] AI template selection`
- **Description:** Điền đủ [template](.github/PULL_REQUEST_TEMPLATE.md) (Story, Changes, Checklist, Test steps).
- **Issue link:** `Relates to #<số>` trong PR description (**bắt buộc** cho feature/fix). ⚠️ KHÔNG dùng `Closes #`.
- **Review:** ≥ 1 approval.
- **CI:** Toàn bộ status check pass (lint, typecheck, test, build).
- **Branch:** Cập nhật với base (rebase hoặc merge base vào branch).

#### 4.2 PR template

Template nằm tại [.github/PULL_REQUEST_TEMPLATE.md](.github/PULL_REQUEST_TEMPLATE.md). Mỗi PR phải điền đủ Story, Changes, Checklist, Test Steps.

#### 4.3 PR → Issue auto-link (bot tự làm)

Story-sync workflow tạo GitHub Issues từ `docs/stories/`. Mỗi PR feature/fix **phải** link với issue tương ứng. Bot sẽ **tự động xử lý** theo thứ tự ưu tiên:

**Ưu tiên 1 — Từ PR title (chính xác nhất, zero effort):**
```
PR title: "feat(F01): [US-F01-03] AI template selection"
→ Bot tìm issue có [US-F01-03] trong title
→ Tìm thấy #59 → TỰ SỬA PR body: Relates to #59
→ Comment: "🔗 Auto-linked to #59"
```
**Dev không cần làm gì** nếu title có `[US-FXXX-YY]`.

**Ưu tiên 2 — Từ branch name (1 issue match):**
```
Branch: feature/F01-ai-builder (chỉ còn 1 open issue cho F01)
→ Bot tự link issue đó
```

**Ưu tiên 3 — Từ branch name (nhiều issues):**
```
Branch: feature/F01-ai-builder (5 open issues cho F01)
→ Bot comment gợi ý danh sách issues
→ Dev chọn 1 → edit PR description thêm "Relates to #<số>"
```

**Skip:** Branches `chore/*`, `docs/*`, `refactor/*` — bot không check.

**Keywords:** Dùng `Relates to #N` (⚠️ KHÔNG dùng `Closes #N`):
```
Relates to #123     ← Đúng: issue KHÔNG tự close, chờ QC test
Closes #123         ← SAI: issue tự close khi merge, skip QA
```

> **Tip cho dev:** Cách nhanh nhất = đặt PR title theo format `type(FXX): [US-FXX-YY] mô tả` — bot lo phần còn lại.

---

#### 4.4 Issue Lifecycle — Quy trình chi tiết từ tạo đến Done

> **7 trạng thái trên Board.** Bot tự chuyển status theo automation. Team chỉ cần thao tác đúng role.

**Tổng quan flow:**

```
📋 Backlog → 🔍 Review → 🔨 In Progress → 👀 Code Review → 🧪 QA Testing → ✅ Done
      ↑                                          ↑                │
      │                                          │                │
      └── rejected               🔄 Re-Open ←── qa:failed ───────┘
                                 (dev fix → PR → merge → QA Testing lại)
```

| Status | Ai | Trigger | Hành động |
|--------|-----|---------|-----------|
| **📋 Backlog** | PM | Issue mới tạo (auto) | PM viết story → Bot tạo issue → PM assign UIUX+BA |
| **🔍 Review** | UIUX + BA | PM assign (thủ công) | UIUX design, BA verify AC. Approve → `status:ready` |
| **🔨 In Progress** | Dev | Label `status:ready` (auto) | Dev tạo branch, code theo AC + design |
| **🔄 Re-Open** | Dev | QA fail → `qa:failed` label (auto) | Dev fix bug, tạo PR mới |
| **👀 Code Review** | Reviewer | PR opened + linked issue (auto) | Review code → approve hoặc request changes |
| **🧪 QA Testing** | QC | PR merged to staging (auto) | QC test trên staging theo AC |
| **✅ Done** | QC | QC close issue (thủ công) | Milestone % tăng |

---

##### Bước 1 → 2: PM tạo issue, UIUX+BA review

```
PM viết story (docs/stories/*.md)
  ↓
Push lên staging → Story Sync tạo Issue → Backlog
  ↓
PM assign UIUX + BA để review
  ↓
  ├── ✅ Approve → thêm label `status:ready` → issue tự chuyển In Progress
  └── ❌ Reject → thêm label `review:rejected` + comment lý do → issue về Backlog
```

---

##### Bước 3 → 4: Dev code → PR → Code Review → Merge

```
Dev pick issue (In Progress, có label status:ready)
  ↓
Tạo branch: feature/FXX-mô-tả
  ↓
Code theo AC + design trong issue
  ↓
Chạy local: npm run lint && npm run typecheck && npm run test && npm run build
  ↓
Push + tạo PR vào staging (title: feat(FXX): [US-FXX-YY] mô tả)
  ↓
Bot auto-link PR → Issue, issue status → Code Review
  ↓
CI chạy: Lint → Typecheck → Test → Build
  ↓
  ├── ✅ CI pass + Reviewer approve → bot gắn `ready-to-merge` → Merge PR
  └── ❌ CI fail / Changes requested → Dev fix → push lại → chạy lại CI
```

---

##### Bước 5: QA Testing → Done hoặc trả về Dev

```
PR merged → staging auto-deploy
  ↓
Bot tự: gắn label `qa:pending` + chuyển board "QA Testing"
  ↓
🔔 Lark thông báo QC: "🧪 QA Ready — Issue #98 chờ test"
  ↓
QC mở Issue #98 → đọc AC → test trên staging
  ↓
  ├── ✅ Pass → QC close issue → Done ✅ (milestone % tăng)
  │
  └── ❌ Fail → QC gắn label `qa:failed` + comment mô tả bug
        ↓
      Bot tự: tạo bug report template + chuyển board "Re-Open" + assign dev
        ↓
      🔔 Lark thông báo Dev: "🔴 QA Failed — #98 — @dev fix"
        ↓
      Dev fix → tạo PR mới → merge → lại vào QA Testing → loop
```

---

##### QC report bug ở đâu? Issue cũ hay tạo mới?

**🅰️ Bug liên quan AC (phần lớn trường hợp) → Report trên ISSUE CŨ:**

```
Issue #98 đang ở QA Testing
  ↓
QC gắn label `qa:failed` trên issue #98
  ↓
Bot tự tạo comment bug report template (pre-filled issue info, dev name, AC)
  ↓
QC điền thêm: mô tả lỗi, steps to reproduce, screenshot
  ↓
Dev nhận Lark thông báo → mở issue #98 → đọc bug comment → fix → PR mới
  ↓
PR merge → issue #98 tự về QA Testing → QC test lại
```

> **Ưu điểm:** 1 issue = 1 feature, track history xuyên suốt, đếm bounce rate chính xác.

**🅱️ Bug hoàn toàn khác scope AC → Tạo ISSUE MỚI:**

```
QC tạo issue mới từ template "Bug Report (QA)"
  ↓
Ghi rõ: Related to #98 (link issue gốc)
  ↓
Issue mới vào Backlog → assign dev → In Progress → ...flow bình thường
```

> **Dùng khi nào:** Bug không nằm trong AC gốc (ví dụ: phát hiện lỗi page khác khi test).

**⚡ Tóm tắt:** Bug thuộc AC → `qa:failed` trên issue cũ. Bug ngoài AC → tạo issue mới.

---

##### UIUX/BA Reject → PM chỉnh spec

```
UIUX/BA thêm label `review:rejected` + comment lý do
  ↓
Bot auto: status → "Backlog", notify PM qua Lark
  ↓
PM chỉnh spec → assign lại UIUX+BA → review lại
```

---

##### Lark Notifications (tự động)

| Khi nào | Ai nhận | Nội dung |
|---------|---------|----------|
| PR merged → staging | **QC** | 🧪 QA Ready — Issue #N chờ test (link QA board) |
| QA failed | **Dev** | 🔴 QA Failed — #N — @dev fix (link issue + bug report) |
| PR approved | **Dev** | ✅ Ready to merge (link PR) |
| Changes requested | **Dev** | ⚠️ Review feedback (link PR) |
| Stale issue >3 ngày | **Team** | ⏰ Nhắc update progress |
| CI fail | **Team** | ❌ CI failed (link run) |

**Milestone % = issues Done / Total.** Chỉ tăng khi QC close issue (không tăng khi PR merge).

---

#### 4.5 Labels quan trọng

| Label | Màu | Ai dùng | Ý nghĩa |
|-------|-----|---------|---------|
| `status:ready` | 🟢 | UIUX/BA | Spec + design approved, dev pick được |
| `review:rejected` | 🔴 | UIUX/BA | Spec chưa OK, trả về PM chỉnh |
| `qa:pending` | 🟡 | Bot | Chờ QC test (auto khi PR merge) |
| `qa:passed` | 🟢 | QC | QC test pass |
| `qa:failed` | 🔴 | QC | QC test fail, trả về dev fix |
| `ready-to-merge` | 🟣 | Bot | PR approved + CI pass |
| `approved` | 🟢 | Bot | PR đã được reviewer approve |
| `wave:X` | 🔵 | Bot | Thuộc Wave nào (auto trên PR) |

---

#### 4.6 Automation tổng kết

| Trigger | Bot tự làm | Workflow |
|---------|-----------|----------|
| Story file thay đổi | Tạo/update GitHub Issues | story-sync.yml |
| Issue mới tạo | Gắn vào Board → Backlog | issue-lifecycle.yml |
| Label `status:ready` | Status → In Progress | issue-lifecycle.yml |
| Label `review:rejected` | Status → Backlog, notify PM | issue-lifecycle.yml |
| PR opened + linked issue | Status → Code Review | issue-lifecycle.yml |
| PR approved + CI pass | Gắn `approved` + `ready-to-merge` | pr-lifecycle.yml |
| PR merged | Status → QA Testing, label `qa:pending`, **Lark → QC** | pr-lifecycle.yml |
| PR merged → staging | Auto-deploy staging | ci.yml |
| Label `qa:failed` | Status → **Re-Open**, assign dev, bug template, **Lark → Dev** | issue-lifecycle.yml |
| Issue closed | Status → Done | issue-lifecycle.yml |

---

#### 4.7 Checklist nhanh theo Role

| Role | Việc chính | Thao tác |
|------|-----------|----------|
| **PM** | Tạo issue | Viết story → push → assign UIUX+BA review |
| **UIUX** | Review design | Check Backlog → design → label `status:ready` hoặc `review:rejected` |
| **BA** | Review spec | Check Backlog → verify AC → label `status:ready` hoặc `review:rejected` |
| **Dev** | Code feature | Pick In Progress → branch `feature/FXX-*` → PR → fix nếu `qa:failed` |
| **Reviewer** | Review code | Review PR → approve → bot gắn `ready-to-merge` |
| **QC** | Test trên staging | Check QA Testing → test theo AC → close (pass) hoặc `qa:failed` + comment (fail) |

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

#### 5.1 CI flow — thứ tự bước và giữ CI xanh

Workflow file: [.github/workflows/ci.yml](.github/workflows/ci.yml). Chạy trên mọi **push** và **pull_request** vào nhánh `main`, `staging`.

| Bước | Lệnh | Ghi chú |
|------|------|--------|
| 1 | `npm run lint` | ESLint (next lint) — chỉ **errors** fail; warnings in ra nhưng không fail. |
| 2 | `npm run typecheck` | `tsc --noEmit` — kiểm tra type toàn bộ `src/`. |
| 3 | `npm run test` | `vitest run` — unit test. |
| 4 | `npm run build` | Next.js build (script đã gắn `NODE_OPTIONS='--require ./node-polyfill.js'` để tránh lỗi khi collect page data). |

**Giữ CI xanh:** Trước khi push hoặc tạo PR, chạy local lần lượt: `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`. Chỉ push khi cả 4 bước pass. Nếu CI fail, sửa trên branch (fix lint/type/test/build) rồi push lại.

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
| Tạo branch      | `feature/F01-mô-tả` hoặc `fix/F01-...`, `chore/...` |
| Commit          | `type(FXX): mô tả` (Conventional Commits) |
| Trước khi PR    | 9-Point Done, lint/typecheck/test pass |
| PR title        | `feat(F01): [US-F01-03] mô tả` — bot tự link issue |
| PR description  | Điền template + `Relates to #<số>` (bot tự điền nếu title có story ID) |
| Merge           | Squash hoặc rebase; merge khi approval + CI xanh + label `ready-to-merge` |
| Sau merge       | Issue → QA Testing (auto). QC test → close issue khi pass |

**⚠️ Lưu ý:** KHÔNG dùng `Closes #N` — issue chỉ close khi QC test pass.

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
git checkout -b feature/F01-ai-builder
# hoặc feat/F07-template-gallery, fix/F01-login-bug, chore/deps-upgrade
```
Branch name **nên có FXX** (feature code) — bot dùng để auto-link issue.

**Bước 3 — Code và commit**

```bash
git add .
git commit -m "feat(F01): add AI template selection"
```

Nếu message sai format, Commitlint báo lỗi. Không dùng `--no-verify` trừ khi lead đồng ý.

**Bước 4 — Push và tạo PR**

```bash
git push -u origin feature/F01-ai-builder
```

Trên GitHub: Compare & pull request:
1. **Title:** `feat(F01): [US-F01-03] AI template selection` — có `[US-F01-03]` để bot auto-link
2. **Description:** Điền template — bot tự điền `Relates to #<số>` nếu match
3. Assign reviewer → đợi CI + approval → merge khi có `ready-to-merge`

> Bot sẽ auto-link issue nếu title có story ID. Nếu không match, bot comment gợi ý issues để chọn.

**Bước 5 — Cập nhật branch với staging (khi staging có commit mới)**

```bash
git checkout staging && git pull origin staging
git checkout feature/F01-ai-builder
git rebase staging
# hoặc git merge staging
git push origin feature/F01-ai-builder
```

**Bước 6 — Sau khi merge PR**

Issue tự chuyển **QA Testing**. QC test trên staging → pass thì close issue → **Done**. Xóa branch.

---

### 11. Checklist nhanh

| Bước | Lệnh / Việc |
|------|-------------|
| Lấy code mới | `git checkout staging` → `git pull origin staging` |
| Tạo branch | `git checkout -b feature/F01-mô-tả` (có FXX!) |
| Commit | `git add .` → `git commit -m "feat(F01): mô tả"` |
| Push | `git push -u origin <branch>` |
| PR title | `feat(F01): [US-F01-03] mô tả` (bot tự link issue) |
| PR | GitHub: New PR → staging, điền template, assign reviewer |
| Cập nhật staging | `git rebase staging` hoặc `git merge staging` trên branch |
| Sau merge | Xóa branch. Issue chuyển QA Testing (auto). Chờ QC test. |

**Flow hoàn chỉnh cho mỗi role:**

| Role | Việc | Cách làm |
|------|------|----------|
| **PM** | Tạo issue | Tạo issue → Backlog → assign UIUX/BA review |
| **UIUX** | Review design | Check issue → làm design → thêm label `status:ready` khi xong |
| **BA** | Review spec | Check issue → verify requirements → thêm label `status:ready` |
| **Dev** | Code | Pick issue "In Progress" → code → push → tạo PR |
| **Reviewer** | Review code | Review PR → approve → bot gắn `ready-to-merge` |
| **QC** | Test | Test trên staging → pass: close issue → fail: label `qa:failed` |

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

## §6 Testing Pipeline

### CI/CD Flow — từ PR tới QC

```
PR created
  → CI: Lint → Typecheck → Unit Test → Build
  → Reviewer approve → Merge staging
  → Deploy staging (DO App Platform)
  → Smoke Test (30s): health check + page loads
  → E2E Tests (3-5 min): Java Playwright tự động
  → QC Manual UAT: UX/visual check
  → Pass → Done / Fail → Re-Open
```

### Board Status (7 cột)

| Status | Ai làm | Trigger |
|--------|--------|---------|
| 📋 Backlog | PM | Issue tạo mới |
| 🔍 Review | UIUX + BA | PM chuyển |
| 🔨 In Progress | Dev | Dev assign |
| 👀 Code Review | Reviewer | Dev tạo PR |
| 🧪 QA Testing | QC | PR merged (bot tự chuyển) |
| 🔄 Re-Open | Dev | QC gắn `qa:failed` (bot tự chuyển) |
| ✅ Done | — | QC close issue |

### QA Flow chi tiết

```
PR merged → Bot gắn qa:pending + chuyển "QA Testing"
  → Lark notify QC: "🧪 Issue #N chờ test"

QC test trên staging:
  ├── ✅ Pass → QC gắn qa:passed → close issue → Done
  └── ❌ Fail → QC gắn qa:failed
       → Bot chuyển "Re-Open" + tạo bug template
       → Lark notify Dev: "🔴 QA Failed — @dev fix"
       → Dev fix → PR mới → merge → lại "QA Testing" (loop)
```

### Lark Notifications

| Event | Ai nhận | Nội dung |
|-------|---------|----------|
| PR merged | QC | 🧪 QA Ready — Issue #N chờ test |
| qa:failed | Dev | 🔴 QA Failed — @dev fix #N |
| Smoke fail | Team | 🔴 Staging down after deploy |
| E2E pass | QC | ✅ E2E passed — bắt đầu UAT |
| E2E fail | Dev | ❌ E2E failed — xem report |

---

## §7 Monitoring & Logs

### Betterstack — Logs realtime cho staging

Team dev xem logs staging **không cần** truy cập DigitalOcean. Dùng Betterstack:

| Công cụ | Link | Mục đích |
|---------|------|----------|
| **Live tail** | [telemetry.betterstack.com](https://telemetry.betterstack.com/team/t518152/tail) | Xem logs realtime |
| **Uptime monitor** | [uptime.betterstack.com](https://uptime.betterstack.com) | Check staging up/down |

**Cách dùng Live tail:**
1. Mở link Live tail ở trên (cần được invite — hỏi PM/DevOps)
2. Chọn source: `ech-prime-web-v2-staging`
3. Search: gõ keyword (VD: `Error`, `500`, `ECONNREFUSED`)
4. Filter: click vào log line → filter theo field

**Khi nào dùng:**
- Deploy staging xong → QC/Dev vào test → thấy lỗi → mở Live tail search error
- Staging down → check Uptime monitor → xem alert
- Debug API 500 → search endpoint path trong Live tail

**Invite team:**
PM/DevOps invite qua Betterstack → Settings → Team → Invite (dùng email công ty).

---

## §7 Testing Pipeline (Best Practice)

### Testing Pyramid

```
         ╱╲
        ╱  ╲        Manual UAT (QC)
       ╱ QC ╲       → UX, visual, edge cases
      ╱──────╲
     ╱  E2E   ╲     E2E Tests (Java Playwright)
    ╱──────────╲    → Critical user flows trên staging
   ╱Integration ╲   Integration Tests (API routes)
  ╱──────────────╲  → Test API endpoints (mock DB)
 ╱   Unit Tests   ╲ Unit Tests (Vitest)
╱──────────────────╲→ Logic, utils, components
```

### CI Pipeline — Full flow

```
PR created
  ↓
CI Gate (TRƯỚC merge):
  ├── Lint (ESLint)
  ├── Typecheck (tsc --noEmit)
  ├── Unit + Integration Tests (Vitest, coverage ≥ 40%)
  └── Build check (Next.js build)
  ↓ (all pass + reviewer approve)
Merge → Deploy staging (DigitalOcean)
  ↓
Smoke Test (30s):
  ├── /api/health?deep=1 → DB connected? Memory OK?
  ├── / → HTTP 200?
  ├── /login → HTTP 200?
  └── /register → HTTP 200?
  ↓ (pass)
E2E Tests (3-5 min — Java Playwright):
  ├── Login → create site → products CRUD → orders
  └── Parse results → upload report artifact
  ↓
Lark Notifications:
  ├── 🔴 Smoke fail → "Staging may be down" (Dev + DevOps)
  ├── ❌ E2E fail → "X/Y tests failed" (Dev)
  └── ✅ E2E pass → "QC bắt đầu UAT" (QC)
```

### Lark notifications mỗi stage

| Event | Ai nhận | Message |
|-------|---------|---------|
| CI fail (PR) | Dev | "❌ CI failed — lint/test/build" |
| Deploy staging success | Team | "🚀 Staging deployed — commit abc" |
| Smoke test fail | Dev + DevOps | "🔴 Staging down after deploy" |
| E2E tests pass | QC | "✅ E2E passed — QC bắt đầu UAT" |
| E2E tests fail | Dev | "❌ E2E 12/15 failed — fix trước QC test" |
| QA failed (manual) | Dev | "🔴 QA Failed — #98 — @dev fix" |
| Issue closed (QA pass) | PM | Board → Done, milestone % tăng |

---

## §8 Database Schema & Migration Rules

### Payload CMS Column Naming Convention

Payload 3.14 Drizzle ORM dùng **2 convention khác nhau** tùy field type:

| Payload Field Type | Table Pattern | id | order | parent_id | Extra |
|---|---|---|---|---|---|
| `type: 'array'` | `{collection}_{field}` | **varchar** (UUID) | **_order** (underscore) | **_parent_id** (underscore) | **_uuid** varchar |
| `type: 'select' + hasMany` | `{collection}_{field}` | **serial** (int) | **order** (NO underscore) | **parent_id** (NO underscore) | value varchar |
| `type: 'group'` | same table | — | — | — | `{group}_{field}` prefix |
| `type: 'relationship'` | same table | — | — | — | `{field}_id` integer |

### Khi thay đổi collection (thêm/sửa/xóa field)

1. Thêm migration vào `scripts/db-setup.js` MIGRATIONS array
2. **Tuân theo naming convention** ở bảng trên — CI sẽ chặn nếu sai
3. Dùng `CREATE TABLE IF NOT EXISTS` — **KHÔNG dùng DROP TABLE**
4. Array table id phải là `varchar` (UUID) — **KHÔNG dùng serial**
5. Test local trước PR: `node scripts/check-migrations.js origin/staging`

### Ví dụ đúng

```javascript
// Array field: type 'array' → underscore prefix, varchar id
{
  name: 'users_tenants.create_table',
  sql: `CREATE TABLE IF NOT EXISTS users_tenants (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
    _order integer NOT NULL DEFAULT 0,
    _parent_id integer NOT NULL,
    _uuid varchar NOT NULL DEFAULT gen_random_uuid()::text,
    tenant_id integer, role varchar DEFAULT 'viewer');`,
},

// Select hasMany: type 'select' + hasMany → NO underscore, serial id
// (Payload tự tạo qua pushDevSchema — thường không cần manual migration)

// Simple column addition:
{
  name: 'tenants.whatsapp_number',
  sql: `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS whatsapp_number varchar;`,
},
```

### CI Enforcement

`scripts/check-migrations.js` chạy trên mọi PR → chặn merge nếu:
- ❌ Collection thêm field mới nhưng thiếu migration
- ❌ Array table dùng `serial` id thay vì `varchar`
- ❌ Array table dùng `parent_id` thay vì `_parent_id`
- ❌ Có `DROP TABLE` trong migrations

---

## Tham chiếu

- [Conventional Commits](https://www.conventionalcommits.org/)
- [GitHub Flow](https://docs.github.com/en/get-started/quickstart/github-flow)
- [semantic-release](https://github.com/semantic-release/semantic-release)
- [Commitlint](https://commitlint.js.org/)
- [Husky](https://typicode.github.io/husky/)
- Nội bộ: [CONTRIBUTING.md](.github/CONTRIBUTING.md), [SPEC.md](../SPEC.md) (9-Point, API, schema).
