---
name: git-flow
description: Git workflow — staging-first, 1 US = 1 branch = 1 PR, conventional commits, PR template rules
paths:
  - ".github/**"
  - "commitlint.config.js"
  - ".husky/**"
---

# Git Flow

**Merge thẳng staging.** Không dùng feature branch cha.

```
feat/F01-01-generate-site → PR → staging → QA test → Done
feat/F01-02-store-setup   → PR → staging → QA test → Done
feat/F08-01-product-crud  → PR → staging → QA test → Done
→ Tất cả pass → PR staging → main (release v1.0)
```

- 1 User Story = 1 branch = 1 PR vào staging
- Branch naming: `feat/FXX-YY-mô-tả` (ví dụ: `feat/F01-01-generate-site`)
- PR title: `feat(F01): [US-F01-01] mô tả` → bot auto-link issue
- Dùng `Relates to #N` (KHÔNG dùng `Closes #N` — issue phải qua QA trước khi close)

Chi tiết: `.github/GIT_AND_CI_RULES.md` + `.github/CONTRIBUTING.md`

## PR Rules (BẮT BUỘC khi tạo PR)

Khi tạo PR, PHẢI dùng đúng template `.github/pull_request_template.md`. Format:

```markdown
## Story
- **Relates to:** #N (KHÔNG dùng Closes)
- **Ticket / Story ID:** US-FXX-YY
- **Mô tả ngắn:** 1-2 câu

## Changes
- [x] Thay đổi 1
- [x] Thay đổi 2

**API / Contract thay đổi:**
- [x] Breaking change: Không

## Checklist
- [x] **9-Point Done**: Loading, Empty, Error, Mobile 375px, TypeScript clean
- [x] **TypeScript / lint:** tsc --noEmit pass
- [x] **Test:** test cases đã thêm/sửa
- [x] **Security:** không commit secret, input validated

## Test Steps
1. Bước verify cụ thể
2. Happy path + edge case

## Ghi chú
- Files mới, deploy notes, docs
```

**Rules:**
- PR title: `type(scope): lowercase description` (max 72 chars)
- type: `feat` | `fix` | `chore` | `docs` | `test` | `refactor` | `perf`
- KHÔNG viết hoa chữ đầu subject (commitlint sẽ chặn)
- LUÔN có `Relates to #N` — KHÔNG dùng `Closes #N`
- Review checklist chi tiết: `.github/REVIEW_CHECKLIST.md`

## Commit Rules

```
feat(auth): add google oauth login
fix(api): handle null response from payment gateway
chore(deps): upgrade next.js to 14.2
```

- Max 72 chars subject line
- Lowercase, imperative mood
- Co-authored footer tự động — không cần thêm
- Nếu commitlint fail → sửa subject, KHÔNG dùng `--no-verify`
- Commitlint config: `commitlint.config.js` (hard-gated via husky commit-msg hook)
