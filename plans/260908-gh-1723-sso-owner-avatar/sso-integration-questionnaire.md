# SSO Integration Questionnaire — Owner Avatar Sync

> **Related:** GitHub Issue #1723 · F23 Personal Profile
> **Prepared:** 2026-09-08
> **Requested owner:** SSO Product/Integration team
> **Response status:** Pending

## Context and Confirmed Product Direction

Prime Web cần đồng bộ avatar của Store Owner từ SSO sang PWv2 theo mô hình:

- Owner avatar: SSO là source of truth.
- Staff avatar: PWv2 quản lý local.
- Owner không upload/override avatar trực tiếp tại PWv2.
- PWv2 dự kiến lưu cached copy để render Header/Profile nhanh và chịu được SSO outage. Caching permission là hard prerequisite của solution đã chọn; nếu SSO không cho phép, vui lòng nêu rõ để PO/BA quyết định lại solution.

Vui lòng trả lời bằng văn bản, cung cấp sample payload/API/event documentation và ghi rõ người xác nhận.

## A. Ownership and Availability

1. SSO có chính thức sở hữu và lưu avatar của Owner không?
2. Avatar có áp dụng cho toàn bộ Owner account hay chỉ một số account type/tenant?
3. Tên field canonical là gì: `avatar`, `avatar_url`, `picture`, `profile_image` hay field khác?
4. Field hiện có trong JWT/OIDC claim, Profile API, webhook/event hay chưa có Integration Contract?
5. Có environment nào chưa hỗ trợ avatar hoặc có khác biệt contract giữa Staging và Production không?

## B. Stable Identity Mapping

6. Immutable identifier nào mapping một SSO Owner với một PWv2 user?
7. SSO có cung cấp OIDC `sub`, `sso_user_id` hoặc identifier tương đương không?
8. Identifier có stable khi email, phone, company hoặc service package thay đổi không?
9. Một SSO user có thể quản lý nhiều company/service/tenant không? Nếu có, avatar thuộc user hay membership?
10. Xác nhận email không phải primary mapping key.

## C. Avatar Data Contract

11. Avatar được trả dưới dạng public URL, signed URL, Media ID hay binary stream?
12. Nếu là URL, URL có expire không? TTL là bao lâu?
13. URL cần Authorization header/cookie hoặc allowlist không?
14. PWv2 có được download, transform và lưu cached copy trong Media storage nội bộ không?
15. Allowed MIME types là gì?
16. Maximum file size và pixel dimensions là bao nhiêu?
17. SSO có chuẩn hóa crop 1:1, orientation và image quality không?
18. Có content moderation, malware scan hoặc file validation trước khi phát hành URL không?

**Proposed compatibility default:** JPEG/PNG, tối đa 2 MB, crop 1:1; PWv2 được phép lưu cached copy.

## D. Read and Change Delivery

19. PWv2 lấy current avatar qua endpoint nào?
20. Khi avatar thay đổi, SSO có phát webhook/event không?
21. Tên event và payload schema là gì?
22. SSO có explicit contract để PWv2 phân biệt `PRESENT`, `ABSENT` (không có/đã xóa) và `UNKNOWN` không? `null`, field omission và HTTP `404` mang nghĩa nào trong từng endpoint/event?
23. Event có `event_id`, `user_id`, `updated_at` và version/sequence để xử idempotency và out-of-order không?
24. SSO có gửi event khi avatar được thay thế nhưng URL không đổi không?
25. PWv2 có được gọi Profile API lúc Owner login để reconciliation không?

**Proposed delivery default:** webhook update/delete là primary; login-time Profile API reconciliation là fallback.

## E. Authentication and Security

26. Webhook/API authentication dùng HMAC signature, OAuth client credentials, Bearer token hay API key?
27. Có timestamp/nonce và tolerance window để chống replay attack không?
28. Secret/key rotation thực hiện như thế nào?
29. Có yêu cầu IP allowlist, mTLS hoặc network restriction không?
30. Scope/permission nào cho phép PWv2 đọc avatar?
31. Error response có thể chứa PII hoặc sensitive URL không? Có logging/redaction guideline không?
32. SSO có hạn chế data residency hoặc retention không? Khi SSO confirmed `ABSENT`, trong bao lâu PWv2 phải purge cached reference, stored object, transformed derivatives và CDN copies?

## F. Retry, SLA and Failure Semantics

33. SSO retry webhook bao nhiêu lần, theo schedule nào và khi nhận HTTP status nào?
34. Webhook delivery có at-least-once hay exactly-once semantics?
35. Rate limit và timeout của Profile API là bao nhiêu?
36. SSO có thể cam kết update/delete propagation p95 trong bao lâu?
37. Team có đồng ý target p95 ≤ 5 phút không?
38. Khi SSO tạm unavailable, PWv2 có được giữ last-known avatar không?
39. Làm sao phân biệt authenticated explicit `ABSENT` với temporary fetch failure, insufficient scope, field omission, invalid resource và uncontracted `null`/`404`?
40. Khi URL expired/broken, endpoint nào cho phép refresh?

**Proposed failure default:** transient/ambiguous response là `UNKNOWN` và giữ last-known avatar; chỉ authenticated `ABSENT` state mới purge cache và fallback về initials.

## G. Backfill, Testing and Operations

41. Owner hiện hữu sẽ được initial backfill bằng batch export, API scan hay cơ chế nào? Contract có cho phép xác nhận Owner không có SSO avatar để PWv2 retire legacy Owner-local avatar reference không?
42. SSO có thể cung cấp Staging endpoint và test credentials process không?
43. Vui lòng cung cấp sanitized sample cho:
    - Owner có avatar;
    - Owner không có avatar;
    - avatar update;
    - avatar delete;
    - duplicate event;
    - out-of-order event;
    - expired/broken URL;
    - unknown user.
44. Có sandbox account để BA/QA chạy cross-system UAT không?
45. Monitoring/dashboard nào chứng minh event delivery và SLA?
46. Ai là technical owner, product owner và incident escalation contact phía SSO?
47. Thời điểm sớm nhất SSO contract và Staging fixture có thể sẵn sàng là khi nào?

**Proposed backfill default:** one-time backfill cho Existing Owner; current SSO avatar thay legacy Owner-local avatar. Nếu SSO confirmed không có avatar, PWv2 retire legacy local reference theo approved retention rule và dùng initials. Account bị bỏ sót được reconciliation khi login.

## H. Required Safety Confirmation

48. SSO có thể cung cấp danh sách immutable identifier để identity preflight trước avatar backfill không? Với account thiếu, duplicate hoặc ambiguous mapping, owner nào chịu trách nhiệm resolve và SLA là bao lâu?
49. Vui lòng xác nhận canonical state table `PRESENT` / `ABSENT` / `UNKNOWN`, gồm từng HTTP status, field omission, `null`, permission error, expired URL và event type. Chỉ authenticated `ABSENT` mới được dùng làm destructive purge signal có đúng không?

## Must-answer Gate

Issue #1723 chưa được chuyển `Ready for Development` nếu chưa có câu trả lời cho các mục sau:

- [ ] SSO ownership và canonical avatar field.
- [ ] Immutable user identity mapping.
- [ ] Profile read channel và update/delete delivery mechanism.
- [ ] File/URL format, expiry và permission cho cached copy.
- [ ] Authentication, replay protection và retry semantics.
- [ ] Delete versus transient-failure distinction.
- [ ] Propagation SLA và reconciliation capability.
- [ ] Backfill method, Staging endpoint, fixtures và accountable owner.
- [ ] Identity preflight xử lý missing/duplicate/ambiguous mapping mà không fallback email.
- [ ] Canonical `PRESENT`/`ABSENT`/`UNKNOWN` table và destructive purge signal được xác nhận.
- [ ] Retention limit bao phủ cached reference, stored object, derivatives và CDN copies.

## Response Record

| Field | Response |
|---|---|
| SSO Product owner | Pending |
| SSO Technical owner | Pending |
| Contract/document link | Pending |
| Staging endpoint | Pending |
| Avatar field | Pending |
| Stable identity | Pending |
| Identity preflight exceptions | Pending |
| Canonical avatar state table | Pending |
| Delivery mechanism | Pending |
| Delete semantics | Pending |
| Authentication | Pending |
| Retry/SLA | Pending |
| Cache permission | Pending |
| Backfill method | Pending |
| Purge retention limit | Pending |
| Confirmed date/version | Pending |

## Sign-off

| Role | Name | Decision | Date |
|---|---|---|---|
| SSO Product/Integration owner | Pending | Pending | Pending |
| PWv2 PO/BA | Pending | Pending | Pending |
| PWv2 Tech Lead/SA | Pending | Pending | Pending |
| Security/Privacy | Pending | Pending | Pending |
| QA | Pending | Pending | Pending |
