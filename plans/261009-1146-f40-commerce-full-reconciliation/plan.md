---
title: "F40 Commerce — đối soát toàn nguồn PW1 đến QC"
description: "Hoàn thiện độ phủ nguồn trước lọc, độ đúng sau import và kết luận Commerce có bằng chứng cho từng Store."
status: in_progress
priority: P0
effort: "Chốt lại sau Phase 01; phụ thuộc F42 source coverage, comparator và staging QC"
issue: 1839
branch: per-deliverable
tags: [feature, f40, f42, migration, commerce, backend, frontend, qa]
blockedBy: []
blocks: []
created: 2026-10-09
---

# F40 Commerce — đối soát toàn nguồn PW1 đến QC

## Tổng quan

Triển khai [thiết kế ba tầng đã duyệt](../reports/261009-1052-f40-commerce-reconciliation-design.md): **nguồn PW1 đã chọn trước lọc → độ đúng phần cần import → kết luận Commerce riêng**. Màn Commerce phải giúp QC tìm được record/field sai, hiểu rule và phạm vi bằng chứng, thấy phần chưa xác minh và biết có đủ điều kiện để *đưa sang QC* hay không. Không tự cấp Website QC Pass hoặc cutover.

[Các quyết định triển khai mặc định](decisions.md) đã chốt cho phạm vi, mẫu số, field, rule, gate, bảo mật, API và nghiệm thu; Phase 01 chuyển các quyết định này thành ma trận field/version và xác minh với artifact thật. Chữ ký nghiệm thu của QC/Product/Finance/Security vẫn phải được ghi riêng.

Phạm vi là **toàn bộ lịch sử Commerce của Source Store ID dạng số**: Product/SKU, Order, Discount, Customer. Settings của US-F40-14 tiếp tục trong [kế hoạch F40-14](../260910-commerce-settings-migration-reconciliation/plan.md), không được tuyên bố hoàn thành bởi kế hoạch Commerce này. Inspector bảy nhóm theo trang của US-F40-11 và các gate media/render/visual/SSO phải được giữ và kiểm hồi quy riêng.

## Quyết định phạm vi và quan hệ kế hoạch

- **Giữ nguyên phạm vi đã duyệt**, không thu về UI-only. Dùng lại F42 sidecar/generation và F40 reader, ledger provider, inspector; không viết comparator thứ hai trong browser.
- [F42 field evidence](../260930-f42-f40-field-evidence/plan.md) là nguồn producer/schema/rule; Phase 01–07 và handoff Phase 09 là gate của các phase dữ liệu thật bên dưới. [Ledger adapter](../260930-f40-f42-ledger-evidence-adapter/plan.md) cung cấp identity/issue; Phase 04 staging của nó là gate tích hợp. Contract, kiểm kê và thiết kế API có thể bắt đầu trước các gate đó nên không khóa toàn plan bằng `blockedBy`.
- Kế hoạch này là chương trình phối hợp, không phải phạm vi một PR. `#1839` là issue F40-14 được tham chiếu, không gán mặc định cho PR producer F42. Phần Commerce thay phần thực thi Commerce của F40-14; Settings và điều kiện kết thúc toàn story vẫn theo kế hoạch cũ. Mỗi deliverable F42/F40 có US, branch và PR riêng vào staging theo **1 US = 1 branch = 1 PR**, ghi `Relates to #N` đúng issue của deliverable; không gom sáu phase vào một PR.
- Mốc PRD 2.000 Store và parity ≥99% là mục tiêu lịch sử; phải khóa inventory/mẫu số thực tế với QC trước khi dùng làm tiêu chí nghiệm thu. Không dùng số quét giả, fixture synthetic hoặc `[x] AUTO` như bằng chứng PASS staging.

## Các phase

| Phase | Kết quả | Trạng thái | Phụ thuộc chính |
| --- | --- | --- | --- |
| 01 | [Khóa contract, inventory và chính sách QC](phase-01-contract-inventory-policy.md) | Đang thực hiện | Có thể bắt đầu ngay |
| 02 | [Chứng minh độ phủ toàn nguồn PW1](phase-02-source-coverage.md) | Đang thực hiện một phần | 01; F42 sidecar/schema/source audit |
| 03 | [Hoàn thiện độ đúng Commerce và drift](phase-03-commerce-fidelity.md) | Pending | 01–02; F42 comparator/target proof |
| 04 | [API đọc an toàn và read model thống nhất](phase-04-protected-read-api.md) | Đang thực hiện một phần | Contract 01; dữ liệu thật từ 02–03; ledger adapter |
| 05 | [Màn Commerce phục vụ điều tra](phase-05-commerce-inspector-ui.md) | Đang thực hiện một phần | DTO 04; fixture thật trước nghiệm thu |
| 06 | [Kiểm thử, staging và gate QC](phase-06-qa-staging-rollout.md) | Đang bổ sung test; staging chưa chạy | 01–05; F42/ledger staging handoff |

## Tiến độ triển khai — 2026-10-09

- Đã bổ sung lát cắt F40 đọc `source_coverage` từ F42 sidecar đã `COMPLETE`, ràng buộc namespace và Store, có tổng record/field theo disposition, số field bị che, unattributed và ngoài QC registry. API Super Admin nhận Store ID số và snapshot ID tùy chọn; UI Commerce hiển thị tầng nguồn riêng với field evidence, provenance và trạng thái thiếu bằng chứng. Các test API/unit và Playwright liên quan đã được thêm; kết quả chạy và staging PASS phải ghi riêng trong ma trận nghiệm thu.
- Chưa hoàn thành Phase 01: chưa có ma trận **mọi** source table.field → disposition/target/rule/owner đã ký, chính sách `importExpected` xác nhận với artifact thật, mẫu số snapshot toàn catalog, hay chữ ký Product/Finance/QC/Security.
- Chưa hoàn thành Phase 02: reader hiện chỉ diễn giải sidecar đã tồn tại; chưa có kiểm chứng producer theo từng selected CSV, partition record/field và tổng snapshot độc lập, Store không emit, hash/tamper/replay và toàn bộ source trước lọc trên staging. `state: complete` của sidecar không tự chứng minh các gate này.
- Phase 03 chưa triển khai trong lát cắt này: `importExpected`, record/entity rollup, field matrix/comparator còn thiếu, Order aggregate, target-only anomaly và phép đọc PW2 hiện tại/target drift đều còn mở. Tỷ lệ field evidence hiện hữu dùng registry QC, không đại diện toàn bộ Commerce.
- Phase 04–05 mới có `source_coverage`, lọc entity/status và hai khối chứng cứ cơ bản. Còn thiếu read model record/field và summary theo `importExpected`, cursor/version ổn định, chi tiết quan hệ Product/SKU/Order, kết luận Commerce có policy, remediation đã review và các trạng thái lỗi đầy đủ.
- Phase 06 **chưa PASS**: cần chạy test, artifact thật trên một staging revision, kiểm kê toàn catalog, security/performance review, đối chiếu expected/actual và chữ ký QC. Test fixture hoặc test bị skip không thay được nghiệm thu này.

## Truy vết và điều kiện hoàn thành

[Ma trận yêu cầu → output → phép kiểm](requirements-traceability.md) và [mẫu kết quả thực thi](execution-evidence-template.md) là checklist bắt buộc. Mỗi dòng cần trạng thái `PASS/FAIL/NOT_RUN/BLOCKED`, expected/actual, revision, Store/run/snapshot/generation, thời điểm, owner và link bằng chứng an toàn trên **cùng staging revision**. Không đóng plan chỉ vì code/test tồn tại.

Hoàn thành khi hai mẫu số đối chiếu đúng, mọi field kỳ vọng có đúng một trong sáu trạng thái, các nhóm Commerce có drill-down và tổng hợp Order, API bảo mật, browser flow dữ liệu thật PASS, gap/ngoại lệ có owner, và QC xác nhận trạng thái Commerce riêng. Full F40 cutover tiếp tục theo TC-MIG.01–10/Phase 10; Settings còn là luồng riêng.

## Rủi ro chặn nghiệm thu

- Artifact cũ thiếu sidecar/CSV trước lọc: full-source proof `BLOCKED`, không dựng lại từ mapping report.
- Rule Product/Finance/QC chưa ký hoặc PW2 không có field tương đương: giữ `unsupported/unverified`, không nâng thành khớp.
- Chưa có target drift read: chỉ kết luận độ đúng tại thời điểm importer verify; current PW2 để `Chưa kiểm tra`.
- Thiếu schema hoặc run thật staging: API/UI báo unavailable, không fallback demo hoặc 0 giả.

## Handoff triển khai

Tiếp tục Phase 01 song song hoàn thiện các lát cắt Phase 02/04/05 đã bắt đầu. Không nâng trạng thái phase lên Done trước khi đạt điều kiện ra phase và ghi bằng chứng thực thi. Dùng tài liệu phase tương ứng làm đầu vào cho từng PR nhỏ.
