# Studio User Generations — Đặc tả chức năng và QA

> **Trạng thái:** Bản nháp để thống nhất trước khi triển khai
> **Rà soát lần cuối:** 2026-09-11
> **Màn hình:** `/studio/generations` (chỉ Super Admin)
> **Design tham chiếu:** `docs/qa/Prime Web V2 - Studio template/page-generations.jsx`

## 1. Tổng quan

`User Generations` là màn vận hành nội bộ để theo dõi từng request AI generate. Super Admin dùng màn này để phát hiện lần chạy chậm/lỗi, xem prompt và bằng chứng block được sinh, export dữ liệu vận hành an toàn, hoặc chạy lại một lần generate website phù hợp để chẩn đoán.

Đây **không phải** AI Builder dành cho người dùng và không được cho tenant user truy cập.

## 2. Phạm vi

### MVP: triển khai trên data model hiện tại

- Danh sách phân trang `ai-generation-records`, mới nhất trước.
- Filter theo status, endpoint, category, thời gian và text được hỗ trợ.
- Tự refresh mỗi 10 giây, có nút Live/Pause và Refresh thủ công.
- KPI tóm tắt được tính trên cùng tập dữ liệu đang hiển thị.
- Panel chi tiết khi chọn row và drawer chi tiết đầy đủ: prompt, selected blocks, timeline, raw output, issues liên quan.
- Export CSV theo filter đang áp dụng, không chứa raw prompt.
- Re-run chỉ cho `site-generator` có prompt được lưu và không ở chế độ hashed.

### Để sau khi có data contract

Prototype còn thể hiện `user-editing`, `low-quality`, `abandoned`, phần trăm AI match, block confidence, template matching và lỗi cấp field. Không được hiển thị chúng như dữ liệu thật khi chưa có nguồn server-authoritative và schema được phê duyệt. Phải ẩn hoặc ghi rõ là chưa có dữ liệu; tuyệt đối không suy diễn từ field không liên quan.

## 3. Người dùng và phân quyền

| Đối tượng | Quyền truy cập |
|---|---|
| Khách chưa đăng nhập | Redirect/từ chối; không nhận page hoặc API data. |
| Tenant user, seller, admin thường | Từ chối; không nhận page hoặc API data. |
| Super Admin | Có thể xem list, xem chi tiết, export, mở issue liên quan và yêu cầu re-run khi đủ điều kiện. |

Tất cả route dưới `/api/admin/generations` phải dùng cùng Super Admin guard ở server. Chỉ chặn bằng UI/client-side là không đủ.

## 4. Nguồn dữ liệu và contract

| Nhu cầu | Nguồn hiện có |
|---|---|
| Record generation | Payload collection `ai-generation-records` |
| Danh sách | `GET /api/admin/generations` |
| Record đầy đủ | `GET /api/admin/generations/:id` |
| Export | `GET /api/admin/generations/export` |
| Re-run chẩn đoán | `POST /api/admin/generations/:id/rerun` |
| Quan hệ issue | `template-issues` thông qua issue embed hiện có |

Các field cần thiết cho MVP: `createdAt`, `site`, `user`, `endpoint`, `category`, `promptMode`, `promptHash`, `status`, `durationMs`, `costUsd`, `selectedBlocks`, `outputSnapshot`, `errorLog`, `fieldsTotal`, `fieldsFilled`, `fieldsEdited` và `completedAt`.

### Status model

Status được lưu trong MVP chỉ gồm:

| Giá trị lưu | Nhãn hiển thị | Ý nghĩa |
|---|---|---|
| `running` | Đang chạy | Request đã bắt đầu nhưng chưa ở trạng thái kết thúc. |
| `success` | Thành công | Request hoàn tất thành công. |
| `failed` | Thất bại | Request kết thúc lỗi; có thể có `errorLog`. |

Không được map status chỉ có trong prototype vào ba giá trị trên. Nếu Product duyệt status mới, phải bổ sung lifecycle/event schema và migration rõ ràng trước.

## 5. Hành vi màn hình

### 5.1 Danh sách và filter

Danh sách sort `createdAt DESC`, mặc định trang 1 và 50 row; cho phép request 10–100 row/trang.

- Status chips: `All`, `Running`, `Success`, `Failed`.
- Bộ chọn thời gian: `1h`, `24h`, `7d`, `All time`; phải gửi `dateFrom`/`dateTo` ISO thật, không chỉ là control trang trí.
- Filter category và endpoint dùng partial matching phía server.
- Search phải khớp với API contract mà UI công bố. API hiện chỉ search endpoint và category. Search user, raw prompt, template name hoặc generation ID cần API server mới đã được privacy review trước khi UI quảng cáo hỗ trợ.
- Đổi bất kỳ filter nào phải reset về trang 1.
- Empty result cần empty state rõ ràng; API lỗi cần error state có thể retry. Polling lỗi không được xoá danh sách thành công gần nhất.

### 5.2 Live update và độ mới dữ liệu

- Live bật mặc định, poll active query mỗi 10 giây.
- Pause dừng polling nhưng giữ nguyên records, filter và row đang chọn.
- Refresh thủ công fetch ngay và hiển thị loading feedback.
- UI hiển thị thời điểm fetch thành công gần nhất.
- Nếu record đang chọn biến mất sau filter/data refresh, xoá selection và hiện empty detail state.

### 5.3 KPI tóm tắt

Nhãn KPI phải ghi rõ mẫu tính là **records đang hiển thị**, trừ khi có aggregate endpoint riêng.

| KPI | Công thức |
|---|---|
| Hiển thị | `records.length / meta.totalDocs` |
| Success rate | `success / (success + failed) × 100`; hiện `—` nếu không có terminal record. Không tính `running`. |
| Running | `count(status = running)` trên response page hiện tại. |
| Failed | `count(status = failed)` trên response page hiện tại. |
| Thời gian generate trung bình | Trung bình `durationMs` của terminal record có duration; hiện `—` nếu không có. |

Các KPI `24h qua`, AI match, fill rate và override rate trong prototype chưa thuộc MVP khi chưa chốt định nghĩa và aggregate endpoint.

### 5.4 Hành vi row và detail

Chọn row sẽ highlight row và mở summary ở panel phải. Chọn lại row đó sẽ đóng summary. Summary phải có:

- user/site identity khi có, endpoint, category, status và timestamp;
- prompt mode và cách hiển thị prompt an toàn;
- duration, cost, số selected blocks; và
- tên selected block cùng action `Full detail`.

Drawer chi tiết đầy đủ fetch record theo ID và có bốn tab:

| Tab | Nội dung bắt buộc |
|---|---|
| Timeline | Event bắt đầu/kết thúc và `outputSnapshot.events` đã lưu, nếu có. |
| Blocks | Display name từ registry cho mỗi selected block; fallback an toàn nếu không tìm thấy block. |
| Issues | Các issue liên kết tường minh với generation; chỉ cho tạo/link issue nếu workflow issue hiện tại hỗ trợ relation đó. |
| Raw output | `outputSnapshot` được pretty print, có nút copy. |

Với record failed, chỉ render error log an toàn và có giới hạn độ dài. Không được đưa stack trace, token, request header, connection string hoặc dữ liệu cá nhân vào UI nếu chưa có server-side redaction.

### 5.5 Export và re-run

- Export dùng đúng các filter đang áp dụng mà API hỗ trợ và nhiều nhất 500 row.
- CSV không được có `promptText`; chỉ có `promptHash` và metadata. Escape CSV cell đúng cách.
- Re-run tạo một record mới, không bao giờ mutate record gốc.
- Chỉ bật Re-run khi `endpoint === site-generator`, `promptMode !== hashed` và có stored prompt text.
- Rate limit: 5 re-run/phút/Super Admin. Hiển thị lỗi 422/429/500 với thông báo có thể hành động.

## 6. Ràng buộc privacy và security

- `promptMode=full` chỉ được hiển thị stored prompt cho Super Admin.
- `promptMode=truncated` chỉ hiển thị giá trị truncated đã capture.
- `promptMode=hashed` không được hiển thị hoặc re-run từ prompt tái tạo; chỉ hiện hash prefix và giải thích.
- Không đưa raw prompt vào CSV, URL, browser log, analytics event hoặc client error telemetry.
- Detail và export API phải tự authorize, độc lập với page.
- Route re-run phải có `maxDuration <= 60` do giới hạn Vercel Pro. Giá trị hiện tại 300 giây phải giảm hoặc chuyển việc chạy sang async job trước release.

## 7. Khớp design và các khoảng trống đã biết

Layout mục tiêu là màn monitoring split list/detail trong design bundle: header/actions, KPI strip, filter bar, list bên trái, detail bên phải. Giữ hierarchy design, nhưng chỉ bind control vào dữ liệu được hỗ trợ.

| Kỳ vọng design/prototype | Quyết định delivery |
|---|---|
| Detail area phải hữu ích ngay | Bắt buộc trong MVP; chỉ empty khi chưa chọn row. |
| Selector 1h/24h/7d/all | Bắt buộc; phải trở thành date filter thật. |
| Search user/prompt/template/gen-id | Để sau, trừ khi API được mở rộng và privacy review. |
| Sáu lifecycle statuses | Để sau; lifecycle lưu hiện tại có ba status. |
| AI match, block confidence, field-level comparison | Để sau; chưa có data contract đáng tin cậy. |
| View user site / impersonate / fix block | Ngoài scope nếu chưa có workflow riêng, được authorize. |

## 8. Acceptance criteria

1. Super Admin mở được `/studio/generations`; người chưa đăng nhập hoặc không phải Super Admin không nhận được page/API data.
2. Trang list records mới nhất trước, có pagination và loading, empty, retryable-error state đúng.
3. Status, endpoint, category và date filters thay đổi server query; đổi filter reset về trang 1.
4. Live mode refresh active query mỗi 10 giây; Pause dừng refresh mà không mất selection/filter.
5. Công thức KPI tuân theo mục 5.3 và không khiến người dùng hiểu nhầm là aggregate all-time khi tính trên response page.
6. Chọn row hiện summary panel; `Full detail` tải detail cùng các tab Timeline, Blocks, Issues và Raw output.
7. Prompt và error hiển thị theo mục 6; CSV không bao giờ có raw prompt.
8. Export chỉ có record khớp active supported filters và không quá 500 row.
9. Record `site-generator` đủ điều kiện có thể re-run; case unsupported, hashed hoặc rate-limited bị từ chối có thông báo rõ, record gốc không bị mutate.
10. Chỉ số/status chỉ có trong prototype phải vắng mặt hoặc ghi rõ unavailable cho đến khi có server data contract.

## 9. QA cases

| ID | Auto | Ưu tiên | Phạm vi |
|---|---|---|---|
| TC-STUDIO-GEN-01 | [x] AUTO | Critical | Page/list/detail/export/re-run APIs từ chối user chưa đăng nhập và không phải Super Admin. |
| TC-STUDIO-GEN-02 | [x] AUTO | High | List API áp dụng từng filter được hỗ trợ, pagination bounds và thứ tự creation giảm dần. |
| TC-STUDIO-GEN-03 | [x] AUTO | High | Date-range controls tạo ISO bounds đúng và reset page về 1. |
| TC-STUDIO-GEN-04 | [x] AUTO | High | Live polling dùng active filters, pause đúng và giữ last good data khi poll lỗi. |
| TC-STUDIO-GEN-05 | [x] AUTO | High | KPI tính success rate không gồm `running` và xử lý duration rỗng. |
| TC-STUDIO-GEN-06 | [x] AUTO | High | Chọn row/mở full detail render state an toàn cho timeline, blocks, issues và raw output. |
| TC-STUDIO-GEN-07 | [x] AUTO | Critical | Hashed prompt không bao giờ được render/export/re-run; CSV loại raw prompt ở mọi mode. |
| TC-STUDIO-GEN-08 | [x] AUTO | Critical | Re-run chỉ nhận eligible site-generator record, viết record mới và giới hạn 5/phút. |
| TC-STUDIO-GEN-09 | [x] AUTO | High | Export giữ active supported filters, giới hạn 500 record và escape CSV field. |
| TC-STUDIO-GEN-10 | [x] AUTO | High | Browser E2E: Super Admin filter, chọn record, mở detail, pause/resume live feed và download export. |

Tuân theo `docs/TEST_CONVENTION.md`: test phải import hành vi source thật, theo AAA và có TC-ID trên. Browser flow nằm ở `tests/studio-generations.spec.ts`; API/component test nằm dưới `src/__tests__/` theo convention dự án.

## 10. Các quyết định Product còn mở

1. KPI tính trên page đang hiển thị, toàn bộ dữ liệu theo filter, hay aggregate global 24h? Bản spec này chọn page-local cho đến khi có aggregate endpoint.
2. Nguồn dữ liệu và công thức chuẩn cho AI match, prompt quality, block confidence, override rate, user editing và abandonment là gì?
3. Super Admin có được xem full user prompt không, và retention/redaction policy áp dụng thế nào?
4. Re-run chẩn đoán chạy synchronous hay queue job có job ID/progress? Giới hạn route 60 giây của Vercel nghiêng về queue job.

## Tham chiếu

- `docs/qa/Prime Web V2 - Studio template/page-generations.jsx`
- `docs/qa/Prime Web V2 - Studio template/monitoring-data.js`
- `src/collections/AiGenerationRecords.ts`
- `src/app/api/admin/generations/route.ts`
- `src/app/api/admin/generations/[id]/route.ts`
- `src/app/api/admin/generations/export/route.ts`
- `src/app/api/admin/generations/[id]/rerun/route.ts`
- `src/app/studio/generations/_components/generations-live-feed.tsx`
