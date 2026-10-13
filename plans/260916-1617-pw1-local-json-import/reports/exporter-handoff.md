# Bàn giao exporter worktree-2 → importer

## Bằng chứng source ngày 2026-09-16

Worktree-2: `feat/pw1-master-json-exporter`, có implementation chưa commit tại `scripts/data/export-pw1-master.ts`, `src/lib/migration/pw1-export/`, contract/runbook/QA exporter. Chỉ đọc source/tài liệu trong lượt tạo issue; không chạy lại tests/export, không đọc hoặc đăng record thật.

- [Exporter #1885](https://github.com/primeproduction/ech-prime-web-v2/issues/1885): hoàn thiện script hiện hữu và nghiệm thu artifact.
- [Importer #1886](https://github.com/primeproduction/ech-prime-web-v2/issues/1886): local DB import theo kế hoạch này.
- #1828 là research mapping; #1827 là foundation CSV; #1871 là website/pages. Không thay thế scope các issue cũ.

## Điều chỉnh contract trước implementation

1. Consumer nhận export directory: master.json, master-manifest.json, mapping-report.json/csv, store-summary.json/csv. Hash/validate manifest cuối; thiếu publication marker thì reject. Import prepare tạo import manifest riêng, bind export hashes và sidecar credentials. Không sửa manifest exporter.
2. `importReady=false` luôn là semantics exporter, không phải cờ phải chuyển true. Importer lập readiness riêng từ source/target/selected scope. Artifact needs_review mặc định block apply; phạm vi Page/component đã loại hoặc exclusion được duyệt chỉ được xử lý qua disposition cụ thể. Required/global/unknown diagnostics vẫn block; no_store_blockers không bỏ qua global report.
3. Exporter chạy toàn nguồn chọn, không có Store selector. Importer --all chọn emitted Stores nhưng báo source/emitted/blocked/excluded; không gọi đó là toàn bộ PW1 hoặc quên Store bị chặn.
4. Runbook lịch sử ghi master khoảng565MB và report khoảng636MB; không dùng full-file UTF8 string/JSON.parse. Reuse/port strict streaming reader hoặc cơ chế tương đương; giới hạn per-Store/index/RAM. Hash và validate trên immutable snapshot, kiểm tra drift khi đọc lại; phải preflight đủ trước business writes. Reader hiện hữu còn giữ object graph, không suy bounded memory chỉ từ chữ streaming.
5. Master mapping pin trùng checksum62cd5561...9d26. Artifact cũ dưới mapping trước đó phải được export mới/đối chiếu, không sửa bytes/hash để ép tương thích. Product tenant-scope và target global index vẫn là gate riêng.
6. Exporter tuyệt đối không đưa password/hash/key_string vào master/report. Credential packaging vẫn thuộc importer prepare với input private và source/snapshot identity trùng artifact.

## Kiểm chứng bổ sung

- Export artifact thật → prepare → import preflight mà không copy/remap JSON bằng tay.
- Missing manifest, bad hash, contract version cũ, needs_review/global diagnostic, blocked Store selector đều fail rõ trước write.
- Large artifact/resource gate có evidence, không lấy mẫu3MB làm proof file565MB.
- Không kéo scope xử lý/render Pages vào importer. Full-source nghiệm thu exporter khác selected-scope DB nghiệm thu importer.

Các thay đổi này là yêu cầu tích hợp được đưa vào hai issue; chưa được triển khai hoặc kiểm chứng runtime. Ngân sách8h local vẫn có điều kiện; kích thước nguồn/gap mới không được giải quyết bằng bỏ gate an toàn.
