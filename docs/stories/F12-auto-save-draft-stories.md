# User Stories: Auto-Save & Draft (F12)

> **Feature:** F12 — Auto-Save & Draft
> **Wave:** 3 | **Priority:** P0 | **Ref PRD:** [F12-auto-save-draft.md](../prd/F12-auto-save-draft.md)

---

## US-F12-01: Auto-Save debounce 3s

**Wave 3** | **P0** | **S** | **Status:** Ready

### Story

```
As a   site owner đang edit website
I want mọi thay đổi được tự động lưu lại sau khi tôi dừng thao tác 3 giây
So that tôi không bao giờ mất dữ liệu nếu lỡ đóng tab
```

### Acceptance Criteria

#### AC-1: Auto-save Trigger
```gherkin
GIVEN user đang chỉnh sửa trong Editor
WHEN  họ thay đổi content/layout và dừng thao tác (debounce 3s)
THEN  hệ thống tự động trigger API save
  AND Editor status chuyển thành "Saving..."
  AND sau khi thành công, chuyển thành "Saved just now"
```

#### AC-2: Manual Save Override
```gherkin
GIVEN user đang chỉnh sửa (isDirty = true)
WHEN  bấm tổ hợp phím Ctrl+S / Cmd+S
THEN  hệ thống lưu ngay lập tức (override debounce)
  AND hiển thị toast "Saved!"
```

### Definition of Done
- [ ] Auto-save chạy ngầm không gián đoạn thao tác người dùng.

---

## US-F12-02: Draft Recovery

**Wave 3** | **P0** | **M** | **Status:** Ready

### Story

```
As a   site owner
I want khi quay lại Editor, hệ thống giữ nguyên những bản nháp (draft) chưa publish
So that tôi có thể tiếp tục công việc đang dang dở
```

### Acceptance Criteria

#### AC-1: Load Unsaved Draft
```gherkin
GIVEN user có thao tác chưa Publish (đã auto-save)
WHEN  user tắt trình duyệt và mở lại màn hình Editor
THEN  website hiển thị lại bản nháp (draft) mới nhất
  AND trạng thái là Draft, khác biệt với Published Site
```

### Definition of Done
- [ ] Database fetch đúng bản `isDraft = true` mới nhất.
