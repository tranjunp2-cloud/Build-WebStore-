# F41 Studio Generation Recovery — QA Plan

> **Story source:** [F41 stories](../stories/F41-studio-generation-recovery-stories.md) · **UX source:** [F41 design](../design/F41-studio-generation-recovery-design.md)
> **Mục tiêu:** giảm rủi ro sai trạng thái generation, retry nhầm/nhân bản website, lộ dữ liệu form và ticket thiếu evidence.

## 1. Scope, rủi ro và nguyên tắc

| Rủi ro cần chặn | Hậu quả | Cách test bắt buộc |
|---|---|---|
| Đánh dấu success trước khi persist site/page | Tracker bỏ sót user chưa có website hoàn chỉnh | Test terminal state ở từng phase và partial failure. |
| Retry ghi đè parent hoặc tạo nhiều child | Mất evidence / tiêu quota / nhiều website trùng | Test lineage bất biến, idempotency key và 2 request đồng thời. |
| Retry lỗi không an toàn | Lặp vô hạn hoặc chạy lỗi contract | Test allowlist/policy ở backend, UI chỉ render action từ policy. |
| Listing che khuất exception | Người trực xử lý chậm | Test queue/order/filter với record success lẫn lỗi. |
| Lộ prompt, stack trace, PII | Rủi ro bảo mật và trải nghiệm user xấu | Test redaction ở API, CSV, UI end-user và ticket. |
| Ticket trùng hoặc thiếu context | Dev không tái hiện được lỗi | Test dedupe signature + payload evidence tối thiểu. |

**Nguyên tắc QA:** không gọi AI provider thật trong unit/API test; inject fixture/adapter deterministic. Không dùng production user, email, URL hay prompt thật. Không cố ý tạo website rác trên staging ngoài test tenant được chỉ định.

## 2. Test data / fixtures trước khi chạy

| Fixture | Trạng thái / dữ liệu tối thiểu | Dùng cho |
|---|---|---|
| `F41-success` | 5/5 pages persisted, live URL có sẵn | history, quyền, không có recovery action |
| `F41-partial-retryable` | 4/5 persisted; `Products/Gallery`; `IMAGE_GENERATION_TIMEOUT`; structured input + trace | queue, detail, retry toàn website |
| `F41-nonretryable` | 2/4 persisted; `INVALID_TEMPLATE_CONTRACT`; policy `ticket_only` | no-retry, ticket, friendly copy |
| `F41-retrying` | parent immutable + child `running`; retry attempt 1/1 | disable retry, timeline, queue priority |
| `F41-retry-failed` | child terminal failed; same normalized signature | ticket escalation / dedupe |
| `F41-stale-running` | running quá ngưỡng policy | queue ordering, monitor state |

Mỗi fixture có tenant, Super Admin, non-admin và end-user riêng. Dọn fixture bằng ID prefix `e2e-f41-` sau test. Ảnh/media dùng stub object storage; không gửi email, không tạo ticket external thật.

## 3. Coverage theo User Story / Acceptance Criteria

| Story | AC trọng yếu | Test cases |
|---|---|---|
| US-F41-01 | Lưu terminal state sau persistence, page/component result và evidence bounded | 02–05 |
| US-F41-02 | Needs Attention mặc định, exception ưu tiên | 06–08, 17 |
| US-F41-03 | Retry toàn website an toàn, có confirm và lineage | 09–13, 18–19 |
| US-F41-04 | Detail có user/site/input/result/timeline/evidence rõ ràng | 14–16, 20 |
| US-F41-05 | Ticket có context, dedupe | 21–23 |
| US-F41-06 | End user chỉ thấy thông điệp thân thiện | 24–25 |

## 4. Automated test cases

| ID | Auto | Level | Severity | Arrange / Act / Assert |
|---|---|---|---|---|
| TC-F41-01 | [x] AUTO | API | Critical | **A:** anonymous, end-user, admin và Super Admin. **A:** gọi list/detail/retry/ticket endpoints. **A:** chỉ Super Admin được phép; không leak tồn tại record cho role khác. |
| TC-F41-02 | [x] AUTO | Service | Critical | **A:** compose AI success nhưng `site persistence` fail. **A:** finalize run. **A:** status không phải success; failure phase/timing/evidence được lưu. |
| TC-F41-03 | [x] AUTO | Service | Critical | **A:** pages 1–4 persist, page 5 fail. **A:** finalize. **A:** `partial_failed`, counts 4/5, affected page/code tồn tại; không tự suy đoán component khi không capture được. |
| TC-F41-04 | [x] AUTO | Service | High | **A:** success, partial, failed records. **A:** serialize detail. **A:** unavailable là `Unknown`/null có nghĩa, snapshot bounded và trace sanitize. |
| TC-F41-05 | [x] AUTO | Migration | Critical | **A:** schema fields F41. **A:** chạy `scripts/db-setup.js --migrate-only` hai lần trên DB trống. **A:** idempotent, không `DROP TABLE`, array/group migration theo AGENTS.md. |
| TC-F41-06 | [x] AUTO | API | High | **A:** six fixtures. **A:** query Needs Attention. **A:** actionable/stale records order `cannot recover → retryable → retry failed → retrying → stale`; success không chen lên đầu. |
| TC-F41-07 | [x] AUTO | API | High | **A:** filter status/time/user/site/generation ID. **A:** combine filters + pagination. **A:** stable results, count đúng, không bỏ record relation missing. |
| TC-F41-08 | [x] AUTO | Component | Medium | **A:** retryable/ticket-only/running policies. **A:** render row. **A:** đúng badge, page progress và một action hợp lệ; UI không tự quyết retryability. |
| TC-F41-09 | [x] AUTO | API | Critical | **A:** partial-retryable. **A:** retry cùng idempotency key. **A:** tạo child bằng structured input; parent/site/evidence không overwrite; response có child ID + `retrying`. |
| TC-F41-10 | [x] AUTO | API | Critical | **A:** ticket-only, running, success parent. **A:** retry. **A:** 4xx domain error; không enqueue job, không tạo child/site. |
| TC-F41-11 | [x] AUTO | API | Critical | **A:** hai retry request song song. **A:** await cả hai. **A:** tối đa một child active; request còn lại nhận canonical child/conflict an toàn. |
| TC-F41-12 | [x] AUTO | Service | High | **A:** child retry success / fail. **A:** finalize child. **A:** parent immutable; timeline/retry history đúng; retry fail ticket-eligible theo policy. |
| TC-F41-13 | [x] AUTO | Component | High | **A:** retryable row. **A:** click retry → cancel / confirm. **A:** cancel không gọi API; confirm gọi một lần, disable CTA và show `Đang gen lại`. |
| TC-F41-14 | [x] AUTO | API | High | **A:** partial fixture. **A:** get detail. **A:** site/user/link/input/page result/error/policy/timeline cùng record. |
| TC-F41-15 | [x] AUTO | Component | Medium | **A:** form 8 fields. **A:** render detail, toggle full input. **A:** default 4–5 field; mở/đóng không mất content. |
| TC-F41-16 | [x] AUTO | Component | Medium | **A:** captured/unknown component data. **A:** render tree. **A:** component chỉ hiện khi captured; unknown nói rõ, không bịa. |
| TC-F41-17 | [x] AUTO | E2E | High | **A:** Super Admin + exception/success. **A:** mở `/studio/generations`. **A:** Needs Attention default và row lỗi có user/site/page/error/action trước success. |
| TC-F41-18 | [x] AUTO | E2E | Critical | **A:** retryable fixture. **A:** listing → confirm retry. **A:** child xuất hiện `running/retrying`; parent vẫn mở detail được. |
| TC-F41-19 | [x] AUTO | E2E | High | **A:** retryable fixture. **A:** detail → retry. **A:** cùng guardrail/API như listing; không có hai CTA active sau confirm. |
| TC-F41-20 | [x] AUTO | E2E | High | **A:** partial fixture. **A:** mở full-page URL. **A:** URL shareable; header links, input toggle, result/pages/timeline/evidence collapse hoạt động. |
| TC-F41-21 | [x] AUTO | API | Critical | **A:** ticket-eligible failure. **A:** create ticket. **A:** ticket có generation/trace/code/page/retry history đã sanitize, link về Issue & Feedback. |
| TC-F41-22 | [x] AUTO | API | High | **A:** create ticket hai lần cùng active signature. **A:** submit lần hai. **A:** trả ticket hiện hữu, không duplicate; signature khác tạo ticket mới. |
| TC-F41-23 | [x] AUTO | E2E | High | **A:** nonretryable. **A:** listing/detail → create ticket. **A:** không retry; CTA thành `Mở ticket` và link đúng. |
| TC-F41-24 | [x] AUTO | API + E2E | Critical | **A:** prompt chứa email/secret-like string + raw stack trace. **A:** end-user status + CSV. **A:** chỉ friendly copy; không prompt, raw error, trace, admin link. |
| TC-F41-25 | [x] AUTO | Regression | High | **A:** generic `site-generator` re-run. **A:** access F41. **A:** không bypass policy/flatten prompt; chỉ F41 retry endpoint. |

## 5. Manual staging gates

| ID | Severity | Procedure | Pass criteria |
|---|---|---|---|
| TC-F41-M01 | Critical | Test tenant: trigger transient allowlist failure, theo dõi SSE/job tới terminal. | Auto retry tối đa 1; terminal chỉ sau persistence; trace/count/link nhất quán. |
| TC-F41-M02 | Critical | Trigger `ticket_only` failure. | Không retry loop; 1 ticket evidence đủ debug nhưng không prompt/raw stack; end user chỉ copy thân thiện. |
| TC-F41-M03 | Critical | Retry từ listing/detail, double-click và hai browser session. | Một child active tối đa; UI rõ ràng, parent không bị sửa. |
| TC-F41-M04 | High | Operations review queue với ≥20 records hỗn hợp. | Nhận ra user, website, page/component lỗi, next action trong ≤10 giây/row. |
| TC-F41-M05 | High | Engineering review detail. | Preview/live/user/input/error/timing đủ tái hiện; Unknown minh bạch; evidence đóng mặc định. |
| TC-F41-M06 | High | Responsive/accessibility smoke 1440, 1024, 768, 375 px; keyboard-only. | CTA không mất; focus rõ; dialog focus/escape đúng; màu không là tín hiệu duy nhất. |
| TC-F41-M07 | Medium | Export/filter/pagination với mixed tenant. | Scope tenant/quyền đúng, export không leak, filter ổn định. |

## 6. Thứ tự chạy và release gate

1. Chạy migration idempotency test trước API/E2E.
2. Chạy service/API fixtures, sau đó Playwright `tests/f41-studio-generation-recovery.spec.ts`.
3. Chạy TC-F41-M01 đến M07 trên staging test tenant; QA lưu generation ID/ticket URL vào PR.
4. Rerun regression `/studio/generations`, `/api/admin/generations`, site generation và Issue & Feedback.

**Block release nếu:** thất bại Critical; có hơn một child retry active; parent evidence thay đổi; raw prompt/error xuất hiện outside admin-safe detail; ticket duplicate; terminal state không phản ánh persistence; hoặc migration không idempotent.

## 7. Quy ước implementation test

- Tuân thủ `docs/TEST_CONVENTION.md`, mapping TC-ID, AAA; mock ở đầu file và test import từ source, không re-implement logic.
- E2E đặt tại `tests/f41-studio-generation-recovery.spec.ts`; cover role, list, retry listing/detail, ticket, privacy.
- Pure policy/normalizer/serializer có unit test tại `src/__tests__/unit/`; orchestration qua integration/E2E.
- Route/page/schema/env mới phải qua P0/P1 trong `AGENTS.md`: E2E, `db-setup.js`, example env, `maxDuration <= 60`.
