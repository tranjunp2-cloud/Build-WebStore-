# Review checklist — Kiểm soát chất lượng trước khi merge

> Dùng khi review PR vào `staging` hoặc `main`. Mục đích: **không merge code mới là lỗi**, phát hiện sớm qua review + CI.

---

## 1. Điều kiện bắt buộc (không đạt thì không approve)

- [ ] **CI đã pass** (Lint, typecheck, test, build — xanh trên PR). Nếu đỏ → yêu cầu author sửa, không approve.
- [ ] **Branch up to date** với base (staging hoặc main). Nếu GitHub báo "out of date" → yêu cầu author rebase/merge base.
- [ ] **PR description** đã điền đủ [template](.github/PULL_REQUEST_TEMPLATE.md): Story, Changes, Checklist, Test Steps (không để trống hoặc mặc định).
- [ ] **Title** theo Conventional Commits: `type(scope): mô tả` (vd. `feat(auth): add OAuth`).

---

## 2. Nội dung review (nên kiểm tra)

- [ ] **Logic / behavior:** Thay đổi đúng với mô tả trong PR; không có thay đổi “ngầm” không nêu trong description.
- [ ] **API / contract:** Nếu có endpoint hoặc schema mới/sửa → có ghi trong PR; breaking change được đánh dấu và mô tả.
- [ ] **Security:** Không thấy secret/credential trong diff; input có validate/sanitize (form, API).
- [ ] **Test:** Có thêm/sửa test cho code mới (nếu áp dụng được); Test Steps trong PR có thể chạy theo để verify.

---

## 3. Sau khi review

- **Approve** chỉ khi: (1) Điều kiện bắt buộc §1 thỏa, (2) Đã xem diff và §2 không có vấn đề nghiêm trọng.
- **Request changes** nếu: CI đỏ, thiếu mô tả, hoặc cần sửa logic/security/test. Ghi rõ comment để author sửa.
- **Không approve “cho qua”** khi CI đỏ hoặc checklist §1 chưa đủ — merge khi đó dễ gây lỗi trên staging/main.

---

## 4. Link liên quan

- Quy tắc Git & CI: [GIT_AND_CI_RULES.md](.github/GIT_AND_CI_RULES.md)  
- Luồng review và kiểm soát: [GIT_AND_CI_RULES.md §5.2](.github/GIT_AND_CI_RULES.md#52-luồng-review-và-kiểm-soát--giữ-ổn-định-code)  
- PR template: [PULL_REQUEST_TEMPLATE.md](.github/PULL_REQUEST_TEMPLATE.md)
