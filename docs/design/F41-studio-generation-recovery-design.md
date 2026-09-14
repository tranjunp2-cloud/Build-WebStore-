# F41 Studio Generation Recovery — UI/UX Specification

## Wireframe tương tác

Mở [F41-studio-generation-recovery-wireframes.html](F41-studio-generation-recovery-wireframes.html) trong trình duyệt để review luồng listing/detail, input mở rộng và xác nhận `Gen lại website`. Đây là artefact để Product, Design, QA và Dev thống nhất trước khi implement; toàn bộ data trong wireframe là dữ liệu mẫu.

| Màn | Mục đích review |
|---|---|
| Needs Attention | Nhìn ra user/site/lỗi cần xử lý, ưu tiên và action hợp lệ ngay từ listing. |
| All Generations | Tra cứu history, không để success che mất exception. |
| Generation Detail | Context debug đầy đủ theo hierarchy: user/site → input → kết quả → recovery → evidence. |
| Confirm retry | Chặn thao tác vô tình; nói rõ phạm vi retry website và giữ parent evidence. |

## Mục tiêu UX

Tracker phải biết trong vài giây: user/site nào bị ảnh hưởng, lỗi ở đâu, action hợp lệ là gì. End user không thấy technical failure.

## Information architecture

```text
/studio/generations
  ├─ Needs Attention
  └─ All Generations

/studio/generations/{generationId}
  └─ Full-page Generation Detail
```

## 1. Needs Attention

- Default khi có exception.
- KPI: Need action, Retrying, Cannot recover, Completed, Running.
- Row phải có: user + site, page result `4/5`, affected page/error summary, status, retry/ticket action.
- Sort: cannot recover → retryable → retry failed → retrying → stale running.

| Status | Màu | Hành động |
|---|---|---|
| Đang gen | Blue | Không action |
| Đang tự khôi phục | Blue/pulse | Disabled progress |
| Cần xử lý | Amber | `Gen lại website` |
| Không thể khôi phục | Red | `Tạo ticket Dev` |
| Đã tạo ticket | Purple/neutral | `Mở ticket` |
| Hoàn tất | Green | `Xem detail` |

`Gen lại website` luôn mở confirm: dùng lại thông tin form gốc, tạo run mới và giữ bản lỗi để debug.

## 2. All Generations

- Giữ table/list hiện có, filter theo status/time/user/site/generation ID.
- Success rows không cạnh tranh visual với exception.
- Mỗi row lỗi có error summary, page progress và action hợp lệ; không chỉ pill `failed`.

## 3. Generation Detail

Không dùng modal 720px cho debug surface. Dùng full page với URL shareable.

### Header

- Back to previous queue, Generation ID, copy link.
- Website preview/live link, Open user, status, primary recovery/ticket action.

### Section thứ tự

1. **Website & User:** site name/IDs, preview/live links, user name/email/ID, submitted/terminal time.
2. **Input user:** mặc định 4–5 dòng: business, industry, description, products/services, language. `Xem form đầy đủ` mở extra instructions, reference URL, locale, form version/hash.
3. **Kết quả:** page planned/succeeded/failed, component count khi có, mode/fallback.
4. **Cần xử lý ngay:** affected scope, normalized code, friendly operator explanation, retryability, retry history, CTA.
5. **Pages:** tree `page → component`; chỉ show component detail khi captured. Unknown phải được ghi Unknown.
6. **Timeline:** submit → validate → AI → site/page persistence → recovery → terminal.
7. **Technical evidence:** collapsed by default; request/trace ID, sanitized error, timings, bounded raw snapshot.
8. **Issue:** existing issue hoặc Create ticket Dev.

## Error presentation

```text
Products / Gallery
IMAGE_GENERATION_TIMEOUT
AI không lấy được media trong thời gian cho phép.
Auto-retry đã thất bại 1/1 · Có thể retry website
[Gen lại website]
```

Không dùng raw stack trace làm primary copy. Không hiển thị action retry nếu backend không trả policy hợp lệ.

## End-user copy

| Internal state | Copy user thấy |
|---|---|
| Running/retrying | Đang hoàn thiện website của bạn… |
| Completed | Website của bạn đã sẵn sàng. |
| Cannot recover | Chưa thể hoàn tất. Thông tin của bạn đã được lưu, hãy thử lại. |
