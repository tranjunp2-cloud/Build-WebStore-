# Code rules & cách check — Project rules + Copilot

> Tài liệu này trả lời: (1) Lỗi nhiều nơi trên Git thì xử lý thế nào? (2) Rule code / project setup ra sao? (3) GitHub Copilot bật nhưng không thấy chạy — cấu hình thế nào?

---

## 1. Lỗi trên Git (CI fail) — Ai fix, khi nào?

- **Chuẩn:** Mọi PR phải qua CI (Lint, Typecheck, Test, Build). **Chỉ merge khi CI pass.**
- **Nếu đang lỗi nhiều nơi:**
  - **Cách 1 (khuyến nghị):** Dev fix dần theo từng khu vực (vd. một PR fix toàn bộ lỗi TypeScript trong `src/`, một PR fix test/e2e). Merge vào **staging** trước, CI pass rồi mới release lên main.
  - **Cách 2:** Tạm thời exclude một số path khỏi typecheck/lint (vd. `tsconfig` exclude `e2e`, `src/__tests__`) để CI xanh, sau đó từng bước bật lại và fix (đã áp dụng một phần: exclude `.next`, `e2e`, `vitest.config`, `src/__tests__` trong typecheck).
- **Trách nhiệm:** Người tạo PR phải đảm bảo branch của mình pass CI (chạy `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build` trước khi push).

---

## 2. Code rules / Project rules — Ở đâu, check thế nào?

| Nội dung | Nơi quy định | Cách enforce |
|----------|--------------|---------------|
| **Git, PR, deploy** | [GIT_AND_CI_RULES.md](.github/GIT_AND_CI_RULES.md), [DEPLOY.md](.github/DEPLOY.md) | CI workflow + branch protection; dev đọc .github |
| **Mô tả PR** | [PULL_REQUEST_TEMPLATE.md](.github/PULL_REQUEST_TEMPLATE.md) | Quy ước team: điền đủ template; (optional) bot check description |
| **Product, API, 9-Point, BMAD** | [SPEC.md](../SPEC.md) | Review PR; checklist trong template |
| **Code style, TypeScript, ESLint** | `.eslintrc.json`, `tsconfig.json`, SPEC §13 | **CI:** `lint`, `typecheck`; (optional) **pre-commit:** Husky + lint-staged |

**Setup thêm (tùy chọn):**

- **Pre-commit:** Chạy lint/typecheck trên file staged trước khi commit (tránh push code lỗi):
  - Cài `lint-staged`, cấu hình trong `package.json` hoặc `.lintstagedrc`.
  - Thêm hook Husky `pre-commit` gọi `lint-staged`.
- **Branch protection:** Bắt buộc CI pass và 1 approval trước khi merge (đã nêu trong [GIT_AND_CI_RULES.md](.github/GIT_AND_CI_RULES.md)).

---

## 3. GitHub Copilot — Bật nhưng không thấy chạy

GitHub Copilot có nhiều dạng; thường team hay dùng **Copilot for Pull Requests** (tóm tắt PR, gợi ý mô tả).

### 3.1 Kiểm tra đã bật đúng chưa

| Bước | Việc |
|------|------|
| 1 | **Repo:** Settings → General → Features → xem có **Copilot** / **Copilot for Pull Requests** (hoặc tương tự) → bật nếu có. |
| 2 | **Tổ chức (Organization):** Nếu repo thuộc org, Copilot thường do admin bật. Vào **Organization → Settings → Code security and analysis** (hoặc **GitHub Copilot**) → kiểm tra đã bật cho org chưa, có gán cho repo này không. |
| 3 | **License:** Copilot for Pull Requests/Business cần license (GitHub Team/Enterprise hoặc Copilot subscription). Nếu không có, chỉ có Copilot trong IDE (VS Code, Cursor), không có “Copilot chạy trên PR” trên GitHub. |

### 3.2 Copilot “chạy” trên PR — Thể hiện ở đâu?

- **Copilot for Pull Requests:** Khi mở một PR, thường sẽ có:
  - **Tab "Conversation":** Có thể có block “Copilot” hoặc “Summary” (tóm tắt thay đổi).
  - **Sidebar hoặc comment:** Gợi ý mô tả PR, gợi ý review.
- Nếu **không thấy** bất kỳ mục nào liên quan Copilot trên trang PR:
  - Khả năng 1: Repo/org chưa được gán license Copilot for Pull Requests.
  - Khả năng 2: Tính năng tắt ở cấp org/repo (Settings → Features).
  - Khả năng 3: Đang dùng GitHub Free (không có Copilot for PR); chỉ có Copilot trong editor.

### 3.3 Nếu không dùng Copilot for PR

- **Rule & check:** Vẫn dùng bình thường qua **CI** (lint, typecheck, test, build) và **convention** (đọc [CONTRIBUTING.md](.github/CONTRIBUTING.md), [GIT_AND_CI_RULES.md](.github/GIT_AND_CI_RULES.md), điền [PULL_REQUEST_TEMPLATE.md](.github/PULL_REQUEST_TEMPLATE.md)).
- **Cursor / AI trong IDE:** Có thể dùng rule trong `.cursor/rules` (vd. `github.mdc`) để khi tạo/sửa PR vẫn bám đúng template và quy trình trong `.github`.

---

**Tóm tắt:** Lỗi trên Git do dev fix để CI pass; rule code/project nằm ở SPEC và `.github`, enforce qua CI và (tùy chọn) pre-commit; Copilot “chạy” trên GitHub PR cần bật đúng tính năng và license, nếu không thấy thì kiểm tra org/repo settings và license.
