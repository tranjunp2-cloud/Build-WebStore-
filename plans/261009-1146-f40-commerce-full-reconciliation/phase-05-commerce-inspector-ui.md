# Phase 05 — Màn Commerce phục vụ điều tra

## Bối cảnh

**Owner:** F40 frontend + QA/Product. **Trạng thái:** Đang thực hiện một phần; đã có hai khối evidence cơ bản và lọc entity/status, chưa đủ inspector đầy đủ. Gate: DTO Phase 04; browser nghiệm thu cần fixture thật từ Phase 02–03. Giữ `Soi CSDL 1-to-1` theo trang và tab Settings hiện có; thay nội dung Commerce store-wide một cách rõ nguồn/mẫu số.

## Bố cục và hành vi

1. **Ngữ cảnh trên cùng:** tên Store và Source Store ID, site PW2, child run VERIFIED, snapshot as-of, generation/digest/version, thời điểm verify và kiểm PW2 hiện tại. Batch ID nhãn riêng. Lựa chọn run lịch sử nếu contract hỗ trợ; mặc định latest verified. Thiếu source coverage hay drift phải có nhãn riêng, không làm cả tab biến thành zero.
2. **Hai khối số liệu:** (A) `Nguồn PW1 đã chọn trước lọc` với records/fields và emitted/retained/excluded/unresolved/blocked; (B) `Phần cần import` với expected/checked/match/mismatch/missing/duplicate/unsupported/unverified/outsideComparison/target-only. Cùng hiển thị `khớp / đã kiểm tra` và `khớp / kỳ vọng`, giải thích mẫu số. Không dùng màu xanh/100% để ngụ ý Commerce Pass khi coverage chưa đủ.
3. **Các tab thực thể:** Tổng quan, Products/SKU, Orders, Discounts, Customers. Mỗi tab có count PW1/PW2 và sáu status; Orders thêm số lượng và tiền theo status/date window. Lọc status, disposition, attention, tìm kiếm an toàn, phân trang server. `Chỉ lỗi` kiểm field attention dù rollup record là match.
4. **Chi tiết record/field:** source→target crosswalk, line items/SKU/relations, PW1/PW2 values đã lưu trong evidence cho Super Admin, field key/path, rule/transform, unit/currency/timezone, reason, source snapshot và target read time, exception. Customer PII chỉ hiện nếu generation F42 có display tương ứng; field rỗng/absent/không được lưu phải khác nhãn. Hướng khắc phục cho Dev là nội dung đã review/link artifact an toàn, không SQL thực thi tùy ý.
5. **Kết luận và việc còn lại:** `Có lỗi`, `Chưa đủ bằng chứng`, `Đủ bằng chứng để QC` kèm scope, reason, owner, next action. Website QC verdict tách riêng; nút website QC hiện hữu không nhận Commerce-ready như một checklist tự động. Full cutover gate có nhãn riêng.

## Trạng thái lỗi/phụ thuộc

- Schema F42 thiếu: unavailable/503, không hiển thị tổng giả hoặc dữ liệu demo.
- Có source coverage nhưng không có child run: vẫn xem được lý do bị loại/chặn; phần import fidelity báo không áp dụng/chưa có run, không đếm 0 match.
- Có run nhưng thiếu generation/sidecar/rule: hiện partial/BLOCKED, nói rõ lớp bằng chứng thiếu.
- Drift chưa chạy: `PW2 hiện tại chưa được kiểm tra`, không biến import-time match thành current match.
- Đổi Store/run/tab/filter nhanh: hủy request cũ, giữ cùng version; không hiển thị response stale. Desktop và 375px đọc được bảng/chi tiết; bàn phím và screen reader nhận trạng thái/filter rõ.

## File dự kiến

| Thao tác | File | Mục đích |
| --- | --- | --- |
| Sửa | `src/app/studio/qa/migration-diff/MigrationDiffClient.tsx` | Ngữ cảnh, tab Commerce, refresh/version state |
| Sửa | `src/app/studio/qa/migration-diff/FieldEvidencePanel.tsx` | Hai mẫu số, entity/status filters, provenance |
| Sửa | `src/app/studio/qa/migration-diff/ReconciliationInspector.tsx` | Record/field detail thống nhất, tránh lặp số liệu ledger với field |
| Tạo nếu cần | Component nhỏ trong `src/app/studio/qa/migration-diff/` | Source coverage, entity summary, attention list; không nhân đôi fetch/logic |

## Kiểm chứng và điều kiện ra phase

- Tester từ Store #52 tương tự ảnh có thể đọc ngay `1.758/2.349 đã kiểm tra`, `1.758/1.758 khớp trong phần đã kiểm tra`, 591 chưa kết luận, nguồn trước lọc và Order/Product counts; không suy 100% toàn Commerce.
- Bấm một Product nhiều SKU hoặc Order nhiều item mở đúng record/field và reason; lọc mismatch/unsupported/unverified cho kết quả/total nhất quán qua pages.
- Store không emit, thiếu sidecar, run cũ, API lỗi, long value/PII, mobile 375px và keyboard flow đều có trạng thái rõ; không fallback demo.
- Không làm hỏng tab Settings, `Soi CSDL 1-to-1` page-scoped, so sánh block/website và QC website hiện có.
