---
status: approved-design
date: 2026-09-14
scope: Studio User Generations recovery workflow
---

# Brainstorm: Generation Recovery Console

## Vấn đề

Màn `/studio/generations` hiện là log viewer: list, status cơ bản, detail drawer, raw snapshot, export và re-run tổng quát. Nó chưa giúp người trực trả lời nhanh user/site nào bị ảnh hưởng, website lỗi ở đâu, có thể xử lý ngay hay phải escalte Dev.

Mục tiêu được duyệt:

- Hiển thị toàn bộ user tạo website, phân biệt trạng thái thành công/lỗi/running.
- Ưu tiên các generation cần xử lý, không để tracker chìm trong success log.
- Detail cho biết website, user, input form, kết quả theo page/component, nguyên nhân lỗi và lịch sử recovery.
- User không thấy lỗi kỹ thuật; chỉ thấy đang hoàn thiện, hoàn tất hoặc thử lại.
- Lỗi không retry được tạo ticket có đủ context vào Issues & Feedback.

## Các phương án đã cân nhắc

| Phương án | Kết luận |
|---|---|
| Chỉ bổ sung detail/raw log | Không đủ actionability. Tracker vẫn phải tự hiểu lỗi. |
| Mọi lỗi chờ tracker bấm retry | Không scale; đội vận hành trở thành pipeline AI. |
| Auto-retry trước, queue chỉ hiện exception | Được chọn. User được cứu nhanh, tracker xử lý lỗi thật sự cần người. |
| Retry component ngay | Chưa chọn cho MVP. Capture hiện chưa giữ đủ context để retry an toàn. |
| Retry cả website trước | Được chọn cho MVP. Kế thừa pipeline có sẵn, semantically rõ và ít rủi ro hơn. |

## Quyết định

### 1. Recovery roadmap

```text
Phase 1: Retry toàn website
Phase 2: Retry page lỗi
Phase 3: Retry component độc lập
```

Phase 1 tạo generation mới từ structured input snapshot gốc và liên kết với run gốc. Không ghi đè generation/site lỗi. Chỉ auto-retry một lần đối với lỗi tạm thời; lỗi validation/schema/permission/database không được retry mù quáng.

### 2. Hai chế độ màn hình

```text
Needs Attention
  - retry thủ công được
  - retry thất bại
  - không retry được, cần Dev

All Generations
  - đang gen
  - đang tự khôi phục
  - hoàn tất
  - toàn bộ lịch sử
```

`Needs Attention` là default khi có exception. List sắp thứ tự: không retry được → retry được chưa xử lý → retry thất bại → đang retry → running quá lâu → success.

### 3. Action trên list

Mỗi row phải thể hiện user/site, tiến trình page, vị trí lỗi ngắn gọn, lỗi chuẩn hoá và action hợp lệ.

| Trạng thái | Action list |
|---|---|
| `needs_attention`, retry được | `Gen lại website` với confirm bắt buộc |
| `retrying` | Disabled, hiển thị tiến trình |
| `cannot_recover` | `Tạo ticket` |
| `ticket_created` | Mở linked Issue |
| `completed` | Xem detail |

Nút gen lại website tạo generation/site draft mới, giữ nguyên bản cũ để debug. Không thực hiện bằng cách parse prompt text hiển thị.

### 4. Detail là full-page, không phải modal

Target route: `/studio/generations/{generationId}`.

Thứ tự thông tin:

1. Website & user: preview/live link, site ID, user identity, generation time.
2. Input summary: 4–5 dòng form; `Xem form đầy đủ` mở full snapshot.
3. Kết quả: pages dự kiến/thành công/lỗi, component thành công/lỗi, mode/fallback.
4. Cần xử lý ngay: lỗi ưu tiên, cấp lỗi, retryability, retry history và action.
5. Page → component tree: status, lỗi và action theo scope.
6. Timeline: submit → validate → AI → persistence → recovery → terminal state.
7. Technical evidence: request ID, sanitized error, timing, raw output, chỉ mở khi debug.
8. Issue: ticket đang liên kết hoặc action tạo ticket.

### 5. Input form UX

Mặc định hiện tóm tắt: business name, industry, description, products/services, language. Nút `Xem form đầy đủ` mở extra instructions, reference URL, locale, form version, input hash và dữ liệu được lưu theo privacy policy.

### 6. User-facing UX

| Nội bộ | User thấy |
|---|---|
| Generation/retry đang chạy | `Đang hoàn thiện website của bạn…` |
| Hoàn tất | `Website của bạn đã sẵn sàng` |
| Không thể phục hồi | `Chưa thể hoàn tất. Thông tin của bạn đã được lưu, hãy thử lại.` |

Không expose raw error, component name, error code, issue hoặc hành động của tracker cho user.

## Dữ liệu cần có trước khi delivery

`ai_generation_records` là run summary. Cần mở rộng capture từ đầu request đến khi site/page persistence kết thúc, thay vì chỉ capture AI composition.

| Dữ liệu | Mục đích |
|---|---|
| Structured input snapshot + input version | Retry website chính xác, không parse prompt text. |
| Generation request/trace ID | Liên kết SSE, route log, events và recovery. |
| Site ID, preview/live URL | Tracker mở đúng website/user bị ảnh hưởng. |
| Final status: completed / partial success / failed | Phản ánh kết quả sau page persistence. |
| Page outcomes | Page dự kiến, page tạo thành công/lỗi, ID/slug/title. |
| Component outcomes, Phase 3 | Cơ sở retry component an toàn. |
| Normalized error code + phase + retryable | UI quyết định action đúng, không suy đoán. |
| Retry lineage/history | Ai retry, lúc nào, scope/kết quả nào. |

## Ticket escalation rule

Chỉ hiện/tự tạo ticket khi retry không hợp lệ hoặc đã thất bại. Ticket phải tự điền generation detail URL, user/site, site/page/component khi có, normalized error, failed phase, retry history, trace ID và sanitized evidence. Dedupe theo error signature để không tạo ticket trùng hàng loạt.

## Rủi ro

- Current capture đánh dấu success trước page persistence, làm UI có thể nói sai website thành công.
- Record capture hiện thiếu user/site relation ở một số path.
- `outputSnapshot` giới hạn 50KB, không thể là kho event/page/component chi tiết duy nhất.
- Re-run route hiện parse prompt phẳng và chỉ gọi generator, không phải website recovery an toàn.
- Route re-run đang có `maxDuration=300`, không phù hợp giới hạn Vercel Pro `<=60`; recovery nên queue/background job.

## Success metrics

- Tracker nhận diện user/site lỗi và action hợp lệ trong dưới 30 giây.
- 100% generation terminal có outcome chính xác: completed, partial success hoặc failed.
- 100% lỗi không retryable tạo được ticket với trace context đầy đủ.
- Không raw prompt/error nhạy cảm xuất hiện cho end user hoặc trong CSV.
- Không retry tạo ghi đè hay mất evidence của generation gốc.

## Bước kế tiếp

Tạo implementation plan theo phase, bao gồm schema/migration, capture instrumentation, recovery job/API, list/detail UX, issue handoff và E2E/API tests.
