---
title: "Kế hoạch import PW1 JSON trên local"
date: 2026-09-16
status: in_progress
plan: ../../plans/260916-1617-pw1-local-json-import/plan.md
---

# Kế hoạch import PW1 JSON trên local

## Bối cảnh

Người dùng đã đồng ý hướng thiết kế local-first và yêu cầu lập kế hoạch kỹ để import master JSON đã mapping vào DB hiện có. Kế hoạch triển khai giữ trạng thái `pending`; đồng ý thiết kế không đồng nghĩa đã duyệt toàn bộ chi tiết kế hoạch.

## Công việc trong phiên

Đối chiếu mapping, source hiện tại và runner Sprint 1 trong worktree; rà soát khả năng tái sử dụng transaction, ledger, credential recovery và các tình huống lỗi. Tham khảo [nghiên cứu khả thi](../../plans/reports/260916-1501-pw1-json-import-feasibility-research.md) và [kịch bản lỗi](../../plans/reports/260916-1556-pw1-local-import-failure-scenarios.md). Phiên lập kế hoạch không triển khai code ứng dụng hoặc ghi DB.

## Nhận xét

Runner cũ có claim chống trùng xuyên run, nhưng không tự giải quyết mọi trường hợp REUSE từ master mới. Rủi ro chính nằm ở quan hệ, danh tính nguồn, credential và kết quả commit không xác định; cú pháp chọn store chỉ là phần nhỏ. Không thể dùng kết quả kiểm tra Sprint 1 để khẳng định master mới đã import đúng.

## Quyết định

- Ngân sách mục tiêu 8 giờ có điều kiện: dữ liệu vượt preflight, phạm vi đóng băng và rehearsal đạt; không cam kết mọi store hoàn tất trong ngày bất kể lỗi dữ liệu.
- Chỉ CREATE, REUSE sau xác minh hoặc CONFLICT. Không update tùy ý dữ liệu đang tồn tại và không hứa rollback tổng quát.
- Giữ tương thích danh tính nguồn và active claim cũ; không đổi namespace để né trùng. Ledger DB là căn cứ resume, phải đối soát trước retry khi mất xác nhận commit.
- Credential nguồn nằm trong sidecar mã hóa, khóa ngoài repo; phục hồi có kiểm chứng, không dùng password mặc định. Credential user PW2 đã tồn tại giữ nguyên.
- Rehearsal trên bản sao DB local; loại Pages khỏi phạm vi, hoãn Vercel. Báo cáo thành công phải nêu rõ phạm vi đã xác minh.

## Tiếp theo

Hoàn thiện [kế hoạch pending](../../plans/260916-1617-pw1-local-json-import/plan.md), tiêu chí dừng và bằng chứng nghiệm thu từng phase. Khi triển khai, xác nhận profile ledger, dữ liệu nguồn bất biến và target trước canary; chỉ mở rộng selector sau khi kiểm tra replay/resume trên DB copy đạt.

## Cập nhật sau khi được phép triển khai

Đã triển khai CLI local, streaming artifact/credential sidecar, writer và ledger dùng chung claims legacy. Schema trên clone chạy hai lần đạt; 7 kiểm tra Runtime/DB đạt gồm fencing, rollback parent+child, finalize ownership, REUSE dependency và active legacy conflict. Synthetic15collections chạy qua CLI; chưa chứng nhận master thật hoặc toàn bộ fault matrix. DB nguồn không bị sửa. Giữ gate clone-only, CREATE/verified REUSE/CONFLICT; Vercel/live vẫn ngoài phạm vi.

Bổ sung evidence: Runtime/writeEntity commit thật rồi wrapper giả lập ECONNRESET trả exit5; replay cùng batch giữ nguyên1tenant/1operation. Chỉ chứng minh post-commit reconciliation qua instrumentation, không gọi đây là TCP fault test. Fixture chỉ nằm trong clone.

Final rehearsal:2Stores/17entities/15collections, forward-pass2, SIGINT boundary/resume và REUSE17 đạt;63tests/7files, typecheck PASS. Evidence `/tmp/pw1-cli-rehearsal-1789555092780`; DB harness `/tmp/pw1-ledger-runtime-audit.ts`, ACK harness `/tmp/pw1-simulated-ack-audit.ts`. Actual master apply NOT_RUN; SIGKILL giữa entity/TCP ACK loss thật chưa kiểm chứng.
