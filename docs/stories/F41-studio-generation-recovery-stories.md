# User Stories: Studio Generation Recovery & Operations (F41)

> **Feature:** F41 — Studio Generation Recovery & Operations
> **Priority:** P1
> **Ref PRD:** [F41-studio-generation-recovery.md](../prd/F41-studio-generation-recovery.md)

## US-F41-01: Capture end-to-end generation outcome

**Là Operations**, tôi muốn một generation phản ánh kết quả sau khi tạo site và pages xong để không thấy false success.

### Acceptance Criteria

```gherkin
GIVEN user submit form tạo website
WHEN generation kết thúc
THEN system lưu run status, trace ID, user/site relation, input snapshot và outcome của từng page
AND status là completed, partial_success hoặc failed theo kết quả persistence thực tế
```

## US-F41-02: Prioritize generation cần xử lý

**Là Tracker**, tôi muốn mở Needs Attention để thấy generation cần hành động trước success logs.

### Acceptance Criteria

```gherkin
GIVEN có generation needs_attention hoặc cannot_recover
WHEN tôi mở Studio Generations
THEN Needs Attention là view mặc định
AND mỗi row hiện user, website, page progress, lỗi ngắn gọn và action hợp lệ
```

## US-F41-03: Retry website an toàn

**Là Tracker**, tôi muốn gen lại website cho user từ list hoặc detail để khôi phục lỗi transient nhanh.

### Acceptance Criteria

```gherkin
GIVEN generation có retryable=true
WHEN tôi chọn Gen lại website và xác nhận
THEN system tạo generation mới từ structured input snapshot
AND liên kết generation mới với generation gốc
AND không overwrite website/run lỗi
AND row hiển thị Đang gen lại cho đến terminal outcome
```

## US-F41-04: Xem đầy đủ context để debug

**Là Tracker/Developer**, tôi muốn mở một generation detail để biết website, user, form input, page nào lỗi và lỗi gì.

### Acceptance Criteria

```gherkin
GIVEN tôi mở generation detail
WHEN data được tải
THEN tôi thấy preview/live URL, user identity, input summary và nút Xem form đầy đủ
AND tôi thấy số page dự kiến/thành công/lỗi, page tree, timeline, retry history và safe technical evidence
```

## US-F41-05: Escalate lỗi không recovery được

**Là Tracker**, tôi muốn tạo ticket Dev từ lỗi không retry được để Dev nhận đủ context ngay.

### Acceptance Criteria

```gherkin
GIVEN generation cannot_recover hoặc retry đã thất bại
WHEN tôi chọn Tạo ticket Dev
THEN Issue & Feedback nhận generation/site/user/page/error/trace/retry evidence an toàn
AND cùng error signature không tạo issue trùng
AND generation hiển thị link tới issue đã tạo
```

## US-F41-06: Bảo vệ trải nghiệm end user

**Là End user**, tôi muốn biết website đang được hoàn thiện mà không phải đọc lỗi kỹ thuật.

### Acceptance Criteria

```gherkin
GIVEN generation đang chạy hoặc recovery đang chạy
WHEN user xem màn tạo website
THEN user thấy trạng thái Đang hoàn thiện website của bạn

GIVEN recovery không thành công
WHEN generation đạt terminal failure
THEN user thấy thông báo thân thiện và lựa chọn thử lại
AND không thấy raw error, component name hoặc ticket nội bộ
```
