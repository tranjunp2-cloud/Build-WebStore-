# Overview — Code rules & Project rules

> **Một trang** tổng quan: rule code / rule project nằm ở đâu, check thế nào, ai theo. Team mới vào đọc file này trước, sau đó đi sâu theo từng link.

---

## 1. Bản đồ nhanh

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  OVERVIEW (file này)                                                        │
│  → Code rules + project rules: ở đâu, enforce thế nào                       │
└─────────────────────────────────────────────────────────────────────────────┘
          │
          ├── Git, PR, branch, commit, conflict
          │   → [GIT_AND_CI_RULES.md](GIT_AND_CI_RULES.md)
          │
          ├── Deploy: staging vs production, flow
          │   → [DEPLOY.md](DEPLOY.md)
          │
          ├── Lỗi CI, rule check, Copilot
          │   → [CODE_AND_RULES.md](CODE_AND_RULES.md)
          │
          ├── Đánh giá triển khai CI/CD (so workflow + analysis)
          │   → [CICD_IMPLEMENTATION_ASSESSMENT.md](CICD_IMPLEMENTATION_ASSESSMENT.md)
          │
          ├── Quy định chung, ai phải theo
          │   → [CONTRIBUTING.md](CONTRIBUTING.md)
          │
          ├── Template mô tả PR
          │   → [PULL_REQUEST_TEMPLATE.md](PULL_REQUEST_TEMPLATE.md)
          │
          └── Product, BMAD, 9-Point, API
              → [SPEC.md](../SPEC.md) (root)
```

---

## 2. Code rules — Ở đâu, check thế nào?

| Loại rule | Nơi quy định | Cách enforce |
|-----------|--------------|--------------|
| **Git** (branch, commit, PR) | [GIT_AND_CI_RULES.md](GIT_AND_CI_RULES.md) | Branch protection, Commitlint + Husky, review |
| **Deploy** (staging trước, main chỉ hotfix/release) | [DEPLOY.md](DEPLOY.md) | Quy ước team, base branch khi tạo PR |
| **Mô tả PR** | [PULL_REQUEST_TEMPLATE.md](PULL_REQUEST_TEMPLATE.md) | Điền đủ template khi tạo/sửa PR |
| **Code style, TypeScript** | `.eslintrc.json`, `tsconfig.json` | **CI:** `lint`, `typecheck` (mỗi PR/push) |
| **Product, API, 9-Point, BMAD** | [SPEC.md](../SPEC.md) | Review PR, checklist trong template |

**CI đang chạy:** Lint → Typecheck → Test → Build (xem [.github/workflows/ci.yml](.github/workflows/ci.yml)). Chỉ merge khi CI pass.

**Tùy chọn:** Pre-commit (Husky + lint-staged) để chạy lint/typecheck trước khi commit — chi tiết [CODE_AND_RULES.md](CODE_AND_RULES.md).

---

## 3. Project rules — Ai theo, tool nào dùng?

| Đối tượng | Phải làm gì |
|-----------|-------------|
| **Dev** | Branch/commit/PR theo GIT_AND_CI_RULES; feature/fix → PR vào **staging**; điền đủ PULL_REQUEST_TEMPLATE; chạy lint/typecheck/test trước khi push. |
| **Cursor / AI trong IDE** | Đọc rule từ `.github` và SPEC; khi tạo PR dùng đúng template (vd. qua `.cursor/rules/github.mdc`). |
| **CI/CD** | Workflow chạy theo GIT_AND_CI_RULES; không tạo rule riêng ngoài `.github`. |

Chi tiết: [CONTRIBUTING.md](CONTRIBUTING.md).

---

## 4. Khi cần tra nhanh

| Câu hỏi | Xem file |
|---------|----------|
| Lỗi CI nhiều nơi, ai fix? | [CODE_AND_RULES.md](CODE_AND_RULES.md) §1 |
| Rule code / project setup ra sao? | [CODE_AND_RULES.md](CODE_AND_RULES.md) §2 |
| Copilot bật nhưng không thấy chạy? | [CODE_AND_RULES.md](CODE_AND_RULES.md) §3 |
| Tạo branch/commit/PR thế nào? | [GIT_AND_CI_RULES.md](GIT_AND_CI_RULES.md) |
| Feature merge vào đâu? Staging hay main? | [DEPLOY.md](DEPLOY.md) |
| Deploy/build nên dùng AWS, DigitalOcean hay BytePlus? | [DEPLOY.md](DEPLOY.md) §5 — Build trên GitHub; deploy chọn 1 provider (DO đơn giản, BytePlus tốt cho VN/ĐNA, AWS nếu đã dùng) |
| So sánh với tài liệu CI/CD workflow/analysis? | [CICD_IMPLEMENTATION_ASSESSMENT.md](CICD_IMPLEMENTATION_ASSESSMENT.md) |
| **Có setup tiếp theo mô hình CI/CD đó được không? Đề xuất?** | [CICD_IMPLEMENTATION_ASSESSMENT.md](CICD_IMPLEMENTATION_ASSESSMENT.md) §5–§6 — Có; ưu tiên deploy thật + Lark, Cursor Automations/canary sau |

---

**Tóm tắt:** Mọi code rule và project rule tham chiếu từ **`.github`** (và SPEC cho product). Enforce qua **CI** (lint, typecheck, test, build) và **quy ước** (branch, PR template, staging-only). Overview này là điểm vào; chi tiết từng mục xem đúng file trong bảng trên.
