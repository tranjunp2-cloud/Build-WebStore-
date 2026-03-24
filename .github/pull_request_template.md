## Story

- **Closes:** #<!-- ⚠️ BẮT BUỘC: Điền issue number! VD: Closes #123. Bot sẽ warn nếu thiếu. -->
- **Mô tả ngắn:** [1–2 câu: feature/fix này làm gì, cho ai]

<!-- 💡 Cách tìm issue number:
     1. Vào tab Issues → tìm user story liên quan
     2. Copy số issue (VD: #123)
     3. Điền ở trên: Closes #123
     Keyword hợp lệ: Closes, Fixes, Resolves (GitHub tự đóng issue khi PR merged)
     Nếu PR không liên quan issue nào (chore/docs), bỏ trống — bot sẽ skip check.
-->

---

## Changes

- [ ] Thay đổi 1: [mô tả ngắn]
- [ ] Thay đổi 2: [mô tả ngắn]
- [ ] (Thêm/xóa dòng theo thực tế; liệt kê file/area chính: API, UI, schema, config, …)

**API / Contract thay đổi (nếu có):**

- [ ] Endpoint / schema mới hoặc sửa: [tên hoặc path]
- [ ] Breaking change: [Có / Không — nếu có thì ghi rõ]

---

## Checklist

- [ ] **9-Point Done** (SPEC §13): Loading (skeleton), Empty, Error, Form validation, Button states, Toast, Auth redirect, Mobile 375px, TypeScript clean
- [ ] **TypeScript / lint:** `tsc --noEmit` và `eslint` pass (hoặc tương đương)
- [ ] **Test:** Đã thêm/sửa test liên quan (nếu có); test steps bên dưới đã điền
- [ ] **Security:** Không commit secret/credential; input đã validate/sanitize
- [ ] **Branch:** Đã cập nhật với base (merge/rebase `main`); không conflict

---

## Test Steps

1. [Bước kiểm tra 1 — mô tả cụ thể]
2. [Bước kiểm tra 2]
3. [Bước kiểm tra 3 — happy path + edge case nếu cần]

*(Điền theo feature/fix; reviewer có thể chạy theo để verify.)*

---

## Ghi chú (tùy chọn)

- **Screenshot / recording (nếu có):** [link hoặc mô tả]
- **Deploy / env:** [yêu cầu env biến mới, migration, … nếu có]
- **Tài liệu:** [Đã cập nhật README / SPEC / doc nào]
