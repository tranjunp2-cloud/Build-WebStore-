## Story

- **Closes:** #
- **Ticket / Story ID (nếu có):** US-F20-04
- **Mô tả ngắn:** Cập nhật tài liệu PRD cho F20 (Help Center) bổ sung các yêu cầu Responsive Navigation & Lightbox Zoom trên Mobile, đồng thời thêm hướng dẫn cấu hình GitNexus.

---

## Changes

- [x] Thay đổi 1: Bổ sung FR-06 và AC-5, AC-6 cho US-F20-04 trong tài liệu `F20-help-center.md`
- [x] Thay đổi 2: Thêm file hướng dẫn `AGENTS.md` và `CLAUDE.md`, thêm `.gitnexus` vào `.gitignore`
- [x] Thay đổi 3: Cập nhật timeline sprint trong `PROJECT_ALIGNMENT.md`

**API / Contract thay đổi (nếu có):**

- [ ] Endpoint / schema mới hoặc sửa: Không có
- [ ] Breaking change: Không

---

## Checklist

- [ ] **9-Point Done** (SPEC §13): Loading (skeleton), Empty, Error, Form validation, Button states, Toast, Auth redirect, Mobile 375px, TypeScript clean
- [ ] **TypeScript / lint:** `tsc --noEmit` và `eslint` pass (hoặc tương đương)
- [ ] **Test:** Đã thêm/sửa test liên quan (nếu có); test steps bên dưới đã điền
- [ ] **Security:** Không commit secret/credential; input đã validate/sanitize
- [x] **Branch:** Đã cập nhật với base (merge/rebase `staging`); không conflict

---

## Test Steps

1. Mở file `docs/prd/F20-help-center.md` kiểm tra ACs mới đọc hiểu tốt.
2. Kiểm tra log merge từ staging không có conflict.

---

## Ghi chú (tùy chọn)

- **Tài liệu:** Đã cập nhật spec tài liệu liên quan đến F20 và file align dự án chung.
