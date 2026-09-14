---
owner: Product + Engineering + Operations
status: draft-pending-approval
plan: ../../plans/260914-f41-studio-generation-recovery/plan.md
created: 2026-09-14
---

# PRD — F41 Studio Generation Recovery & Operations

## 1. Vấn đề

Studio User Generations hiện là log viewer. Người trực phải tự lọc record lỗi, không biết website/user nào bị ảnh hưởng, lỗi nằm ở page/component nào, và không có flow recovery hoặc escalation có evidence đầy đủ.

## 2. Mục tiêu sản phẩm

Tại Studio, Super Admin theo dõi toàn bộ lần tạo website AI, ưu tiên exception cần xử lý, retry website an toàn từ input gốc, và tạo Issue & Feedback có đầy đủ bằng chứng khi không thể phục hồi.

End user không thấy lỗi kỹ thuật. Họ chỉ thấy: đang hoàn thiện, đã sẵn sàng, hoặc chưa thể hoàn tất và có thể thử lại.

## 3. Người dùng và Jobs-to-be-done

| Người dùng | Khi | Muốn | Để |
|---|---|---|---|
| Tracker/Operations | Có generation lỗi | Biết đúng user/site/lỗi/action trong vài giây | Khôi phục user kịp thời |
| Developer | Nhận lỗi không recovery được | Có trace, input context, phase/error/retry history | Debug không phải hỏi lại Ops |
| End user | Website đang được tạo | Nhận trạng thái rõ, không thấy lỗi nội bộ | Tin tưởng và tiếp tục sử dụng |

## 4. Phạm vi MVP

### Trong phạm vi

- `Needs Attention` và `All Generations` trong `/studio/generations`.
- Final run status chính xác sau site/page persistence: `completed`, `partial_success`, `failed`, `retrying`, `needs_attention`, `cannot_recover`, `ticket_created`.
- Structured input snapshot, generation trace ID, site/user identity, site preview/live link, page outcomes và normalized error/retryability.
- Tracker có thể tạo **một retry website mới** từ input snapshot gốc; run/site lỗi không bị ghi đè.
- Detail full-page có website/user, input summary/full form, result, page tree, timeline, recovery history, technical evidence và issue handoff.
- Lỗi không retry được hoặc retry thất bại có action tạo Issue & Feedback với context tự điền và dedupe theo error signature.
- User-facing status an toàn, không raw error/PII kỹ thuật.

### Ngoài phạm vi MVP

- Retry page hoặc retry component. Đây là phase sau, chỉ làm khi per-page/component context đã được capture và validate.
- Theo dõi hành vi user sau khi website generate xong: editor, publish, abandon, analytics.
- Hiển thị raw prompt/error cho end user hoặc export raw prompt qua CSV.
- Tự đóng issue hoặc tự sửa code.

## 5. Quy tắc nghiệp vụ

1. Mỗi retry website là generation mới, có `parentGeneration`/retry lineage và không overwrite run cũ.
2. Chỉ lỗi có policy `retryable` mới được retry. Validation/schema/permission/database migration không retry mù quáng.
3. Auto-retry tối đa một lần với lỗi transient đã allowlist; sau đó đưa vào Needs Attention hoặc Issue.
4. Needs Attention mặc định khi có exception; thứ tự: cannot recover → retryable → retry failed → retrying → running quá lâu.
5. Ticket chỉ được tạo sau retry không hợp lệ/thất bại, có dedupe signature và chứa safe evidence.
6. Super Admin là role duy nhất được xem full input, retry hoặc tạo ticket.
7. UI phải nói rõ page/component lỗi khi data có; nếu không có evidence, hiển thị `Không xác định` thay vì suy đoán.

## 6. Chỉ số thành công MVP

| Chỉ số | Mục tiêu sau pilot 4 tuần |
|---|---:|
| Tracker xác định user/site/action hợp lệ | ≤ 30 giây/generation |
| Terminal generation có outcome chính xác | 100% |
| Issue có trace context an toàn, đầy đủ | 100% |
| Retry làm mất evidence/run gốc | 0 |
| Raw prompt/error xuất hiện cho end user/CSV | 0 |

## 7. Phụ thuộc và rủi ro

- `AiGenerationRecords` hiện capture AI composition trước khi page persistence xong, nên cần thay đổi orchestration capture.
- `outputSnapshot` có cap 50KB, không thể là event store duy nhất.
- Re-run hiện parse prompt phẳng và không tạo website recovery hoàn chỉnh; cần thay bằng structured snapshot + async job.
- Vercel Pro giới hạn route `maxDuration <= 60`; retry phải qua queue/background job hoặc response nhanh có job ID.

## 8. Acceptance Criteria tổng quát

- Super Admin thấy tất cả generation và queue exception ưu tiên.
- Mỗi generation terminal thể hiện đúng outcome site/page sau persistence.
- Tracker retry website từ list/detail bằng confirm; retry tạo run mới và thấy tiến trình/kết quả.
- Detail cung cấp website link, user identity, input summary/full form, page outcomes, timeline và error evidence.
- Không retry được hoặc retry thất bại tạo/mở Issue & Feedback có safe context và không duplicate.
- End user chỉ nhận trạng thái thân thiện, không nhận lỗi kỹ thuật.
