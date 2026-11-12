---
date: 2026-10-05
topic: f40-standalone-report
status: verified-pr-open
---

# F40 report — tách triển khai độc lập F42

## Context

Người dùng chỉ muốn đưa thay đổi F40 lên staging, không đưa chung nhánh F42. Nhánh làm việc ban đầu chứa thay đổi F42 nên không phù hợp để push nguyên nhánh.

## What happened

- Tách phần báo cáo F40 vào worktree riêng từ staging, giữ nguyên workspace ban đầu.
- Chuẩn bị nhánh/PR riêng chỉ có F40; PR cũ #1904 không được chỉnh sửa trong bước tách này.
- Thêm contract đọc cục bộ thay cho phụ thuộc mã producer F42; giữ version/registry hash để từ chối evidence không tương thích.
- Thêm readiness guard: schema F42 chưa sẵn sàng trả lỗi phụ thuộc `503`, không tự tạo schema, chạy importer hoặc công bố 0 website.
- Giữ UI báo cáo, tỷ lệ evidence và QC thủ công riêng biệt. Điều kiện đạt phải là 100% đủ phạm vi và 100% khớp, không phải ngưỡng 95% hay làm tròn lên 100%.

## Reflection

Tách được mã F40 không có nghĩa đã có dữ liệu F42. Nguồn chưa triển khai phải hiển thị đúng là chưa sẵn sàng; kết quả kiểm thử từ nhánh kết hợp không thay thế kiểm thử bản tách.

## Decisions

- Không ship schema, exporter/importer hoặc thay đổi nghiệp vụ F42 trong PR F40.
- Không dùng điểm heuristic/prototype staging cũ để thay bằng chứng migration thật.
- Runbook F42 được dẫn tới commit producer đã kiểm tra, không tạo liên kết local tới file không có trong bản tách.

## Next

Review cuối bản tách không còn blocker; test F35 không liên quan đã được loại khỏi phạm vi và lỗi image loader đã sửa. Kết quả kiểm thử bản tách:

- TypeScript đạt; 58/58 unit test đạt.
- TC12 trên trình duyệt thật với DB schema-only chưa có F42: đạt (6,2 giây).
- TC09 trên trình duyệt thật với DB hiện có, chỉ đọc qua ứng dụng bản tách tại port 3105: đạt (33,8 giây).
- Lint theo phạm vi file đã kiểm tra: 0 lỗi, 8 cảnh báo Hook; diff check đạt. Lần kiểm tra này chưa bao phủ entry page (xem CI follow-up).

Đã push nhánh `fix/F40-1907-standalone-report` và mở [PR #1919](https://github.com/primeproduction/ech-prime-web-v2/pull/1919) vào `staging`; head được xác nhận là `9157d2769`, commit implementation `597e31d6f`. PR chỉ thuộc phạm vi F40. Chưa merge hoặc xác nhận deployment; bước tiếp theo là review/CI của PR.

Sau khi F42 triển khai nguồn phù hợp, cần xác nhận lại dữ liệu thực và phạm vi nghiệm thu đầy đủ. Phân trang inventory toàn nguồn và recheck dữ liệu PW2 hiện tại vẫn là các hạng mục riêng, chưa được coi là hoàn tất.

## CI follow-up

CI run `37295649278` thất bại ở rule `@next/next/no-html-link-for-pages`, tại `src/app/studio/qa/migration-diff/page.tsx:23`. Scoped lint trước đó bỏ sót entry page. Đã thay anchor nội bộ bằng `next/link`, không đổi contract chức năng.

Lần chạy API/unit bổ sung phát hiện mock API ledger thiếu export mà field reader sử dụng. Đã thêm top-level mock/spies cho field reader/readiness và kiểm tra nhánh ledger không gọi hai phụ thuộc field này. Lệnh `npx vitest run src/__tests__/api/f40-migration-reconciliation-ledger-routes.test.ts src/__tests__/unit/qa` chạy lại đạt **31 file / 242 test** (exit 0).

Toàn bộ `npm run lint` và `npx tsc --noEmit` chạy lại sau cả sửa `next/link` và test mock đều đạt (exit 0; lint còn cảnh báo hiện có, không có lỗi). Kết quả CI remote sau push chưa được xác nhận.
