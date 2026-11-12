# User Stories: Studio Generation Recovery & Operations (F41)

> **Feature:** F41 — Studio Generation Recovery & Operations
> **Priority:** P1
> **Ref PRD:** [F41-studio-generation-recovery.md](../prd/F41-studio-generation-recovery.md)
> **Engineering contract:** [F41-generation-recovery-contract.md](../architecture/f41-generation-recovery-contract.md). Contract này là nguồn sự thật cho state, API, data, event, RBAC và privacy.

## US-F41-01: Capture end-to-end generation outcome

**Là Operations**, tôi muốn một generation phản ánh kết quả sau khi tạo site và pages xong để không thấy false success.

### Acceptance Criteria

```gherkin
GIVEN user submit form tạo website
WHEN generation kết thúc
THEN system lưu lifecycle, trace ID, user/site relation, frozen input snapshot và outcome của từng page
AND lifecycle chỉ terminal sau persistence site/page thực tế
AND outcome là succeeded, partial_failed hoặc failed
AND recoveryStatus được lưu độc lập với outcome để UI không suy luận action từ error text
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
AND child generation tạo isolated draft recovery site, không sửa hoặc xóa page của parent site
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
THEN user thấy thông báo thân thiện: thông tin đã được lưu, hãy thử lại sau hoặc liên hệ hỗ trợ
AND user không có CTA retry trực tiếp trong MVP; chỉ Super Admin được retry theo recovery policy
AND không thấy raw error, component name hoặc ticket nội bộ
```

## US-F41-07: Chẩn đoán sự cố generation có cấu trúc

**Là Tracker, QA hoặc Developer**, tôi muốn cùng đọc một bản chẩn đoán sự cố
nhất quán để biết lỗi gì, ở đâu, ảnh hưởng thế nào và bước xử lý nào là hợp lệ
mà không phải suy đoán từ mã lỗi hay lỗi thô.

### Acceptance Criteria

```gherkin
GIVEN generation kết thúc failed hoặc partial_failed
WHEN hệ thống ghi nhận lỗi
THEN mỗi lỗi lưu phase, loại/vị trí lỗi, mã chuẩn hoá, category, retryability,
     safe operator message và sanitized technical evidence
AND lỗi input có fieldKey, nhãn field tiếng Việt, validation rule và observed state
    đã allowlist, không lưu giá trị form nhạy cảm
AND lỗi page/component có page/component key hoặc ghi Unknown rõ ràng khi chưa capture

GIVEN Tracker mở generation detail có lỗi
WHEN detail được tải
THEN chỉ có một khối “Sự cố cần xử lý” làm nguồn sự thật cho lỗi, tác động,
     khả năng recovery, owner và next action
AND status/action được lấy từ server policy, không parse error text ở client
AND technical evidence chỉ hiện khi có evidence hữu ích và chỉ Super Admin xem được
AND dữ liệu legacy thiếu page/component được báo minh bạch, không bịa vị trí lỗi

GIVEN lỗi không thể recovery được được chuyển thành Issue & Feedback
WHEN ticket được tạo ở US-F41-05
THEN ticket nhận đúng incident snapshot đã sanitize, gồm affected scope,
     validation/page/component context, trace, retry lineage và evidence
AND không chứa input raw, prompt, token, header, stack trace hoặc PII ngoài allowlist
```
