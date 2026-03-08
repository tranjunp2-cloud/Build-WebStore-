# Đóng góp & Rule chung — Nguồn sự thật duy nhất

> **Mọi môi trường** (Cursor, Antigravity, CI, dev local, bất kỳ IDE/tool nào) **bắt buộc dùng chung** rule trong thư mục **`.github`**. Không tạo rule riêng theo từng nơi (vd. file guide riêng cho Cursor, rule riêng cho Antigravity). Một chuẩn, mọi nơi tuân theo.

---

## 1. Rule nằm ở đâu

| Nội dung | File / vị trí |
|----------|----------------|
| **Overview — code rules & project rules (điểm vào)** | [.github/OVERVIEW.md](.github/OVERVIEW.md) — một trang tổng quan, bản đồ + cách check |
| **Git, PR, CI/CD, conflict** | [.github/GIT_AND_CI_RULES.md](.github/GIT_AND_CI_RULES.md) |
| **Luồng deploy (staging vs prod)** | [.github/DEPLOY.md](.github/DEPLOY.md) |
| **Code rules, CI fix, Copilot** | [.github/CODE_AND_RULES.md](.github/CODE_AND_RULES.md) |
| **Đánh giá triển khai CI/CD** | [.github/CICD_IMPLEMENTATION_ASSESSMENT.md](.github/CICD_IMPLEMENTATION_ASSESSMENT.md) — so với workflow + analysis, lộ trình gợi ý |
| **Mô tả PR (template)** | [.github/PULL_REQUEST_TEMPLATE.md](.github/PULL_REQUEST_TEMPLATE.md) — khi tạo/sửa PR **bắt buộc** dùng đúng template này |
| **Product, BMAD, 9-Point, API, data model** | [SPEC.md](../SPEC.md) (root) |
| **Cursor:** tuân theo .github + dùng template khi tạo PR | [.cursor/rules/github.mdc](../.cursor/rules/github.mdc) |

Cập nhật rule → chỉ sửa trong `.github` (và SPEC.md cho product). Các file trong `docs/` chỉ tham chiếu hoặc mở rộng chi tiết, **không** là nguồn sự thật cho Git/PR.

---

## 2. Ai phải theo

- **Dev** (local, bất kỳ editor nào): branch, commit, PR theo [GIT_AND_CI_RULES.md](.github/GIT_AND_CI_RULES.md) và [PULL_REQUEST_TEMPLATE.md](.github/PULL_REQUEST_TEMPLATE.md). **Feature/fix:** tạo PR với **base = staging** (không PR vào main). Main chỉ cập nhật qua release (staging → main) hoặc hotfix.
- **Cursor / Antigravity / AI assistant**: đọc rule từ `.github` và SPEC.md; không tạo thêm file “guide” hoặc “standardization” riêng cho từng môi trường.
- **CI/CD**: pipeline chạy theo branch/commit/PR đã định nghĩa trong [GIT_AND_CI_RULES.md](.github/GIT_AND_CI_RULES.md).

---

## 2.1 Áp dụng theo từng môi trường (IDE / tool)

| Môi trường | Cách áp dụng | Ghi chú |
|------------|--------------|--------|
| **Cursor** | Tự động qua [.cursor/rules/github.mdc](../.cursor/rules/github.mdc) (alwaysApply). Khi tạo PR, Cursor đọc [PULL_REQUEST_TEMPLATE.md](.github/PULL_REQUEST_TEMPLATE.md) và điền theo template. | Có cơ chế rule built-in → **chắc chắn** áp dụng nếu rule file tồn tại. |
| **Antigravity / VS Code / JetBrains / IDE khác** | **Convention + process:** dev (và AI trong IDE đó) phải đọc `.github` và làm theo. Nếu IDE có cơ chế "rule" hoặc "instruction", cần **cấu hình trỏ đến** `.github/CONTRIBUTING.md` và `.github/GIT_AND_CI_RULES.md`. | Không có chuẩn chung như Cursor rules → **không đảm bảo** tự chạy đúng trừ khi team cấu hình tương đương hoặc tuân thủ thủ công. |
| **CI/CD (GitHub Actions, v.v.)** | Pipeline đọc branch/commit/PR; rule trong [GIT_AND_CI_RULES.md](.github/GIT_AND_CI_RULES.md). Có thể thêm job check PR description có đủ section (Story, Changes, Checklist, Test Steps) nếu cần. | Chạy đúng nếu workflow được viết theo đúng rule. |

**Kết luận:** Rule **một nguồn** trong `.github` là chuẩn cho mọi bên. **Cursor** áp dụng tự động nhờ `.cursor/rules/github.mdc`. **Các IDE khác** cần process (đọc .github) hoặc config riêng của IDE đó trỏ về .github thì mới "chạy đúng" tương đương.

---

## 3. Quy trình build tính năng (tóm tắt)

- **Trước khi code:** Đọc SPEC.md (user stories, API, data model); đảm bảo Readiness Gate 4/4 (SPEC §2.3) nếu có.
- **Khi implement:** 6-Layer (SPEC §15), soft delete, multi-tenant, 3 states (loading/error/empty), form Zod + RHF.
- **Trước PR:** 9-Point Done (SPEC §13), lint/typecheck/test pass, PR description điền đủ [template](.github/PULL_REQUEST_TEMPLATE.md).
- **Deploy / local:** Chỉ dùng Docker (theo rule repo); không hướng dẫn `npm run dev` trực tiếp cho người khác nếu đã quy định Docker.

Chi tiết product/UX/security: xem **SPEC.md**.

---

## 4. Không tạo file rule trùng / lệch chuẩn

- **Không** tạo file kiểu: `docs/PR_DESCRIPTION_xxx.md` (mô tả PR one-off), `docs/CURSOR_GUIDE_*.md`, `docs/ANTIGRAVITY_RULES.md`, v.v. cho từng môi trường.
- Mô tả PR: dùng [.github/PULL_REQUEST_TEMPLATE.md](.github/PULL_REQUEST_TEMPLATE.md) và điền trực tiếp khi tạo/sửa PR trên GitHub.
- Rule chung: chỉ trong `.github` (và SPEC.md). Mọi bên tham chiếu về đây.

---

**Tóm tắt:** Rule chung của Git, PR, CI và quy trình đóng góp nằm trong **`.github`**. Cursor, Antigravity và mọi bên đều dùng chung một bộ rule này.
