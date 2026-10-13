# Phase 04 — API đọc an toàn và read model thống nhất

## Bối cảnh

**Owner:** F40 backend + F42 contract owner + Security. **Trạng thái:** Đang thực hiện một phần; mới có source coverage và lọc field evidence hiện hữu. Có thể dựng DTO và kiểm lỗi từ contract Phase 01; chỉ nghiệm thu real mode sau Phase 02–03 và ledger adapter staging. API hiện có `GET /api/qa/migration-reconciliation?view=fields` và ledger provider; mở rộng có version thay vì tạo một nguồn tính toán thứ hai trong UI.

## Hợp đồng đề xuất

Giữ một endpoint được bảo vệ với các view tách semantics: `source_coverage`, `commerce_summary`, `commerce_records`, `commerce_fields` (tên cuối chốt ở Phase 01). `source_coverage` nhận numeric Store ID + snapshot/source binding, **không yêu cầu child run**. Ba view import nhận numeric Store ID + child UUID VERIFIED + generation hoặc mặc định latest verified có version/snapshot trả về; sai run/Store phải fail closed. Query `entity`, `status`, `disposition`, `cursor`, `limit` được Zod kiểm strict; `limit` bounded, thứ tự keyset ổn định. Trả `nextCursor`, total/summary scope, `evidenceState`, provenance và denominator basis; không nhận batch ID làm run ID.

DTO phải phân biệt record status, field status, export disposition, target-only anomaly, exception, import-time result và current drift. Values chỉ theo allowlist và display policy đã duyệt; Super Admin được xem ID và Customer display nếu generation F42 đã lưu theo quyết định cập nhật trong `decisions.md`. Không suy diễn giá trị còn thiếu từ fingerprint hoặc PW1 live; không trả raw JSON, fingerprint/HMAC, credential, token, HTML hoặc SQL. Giữ route `force-dynamic`, `maxDuration <= 60`, Super Admin, tenant/Store/source/target binding và log an toàn.

## Việc thực hiện

1. Tạo/điều chỉnh các reader server-side cho source coverage, per-entity summary, record page và field page; đọc generation/snapshot/ledger đã ràng buộc, không join tùy tiện theo tên/SKU/email. `migration_entity_map` chỉ cấp identity; giá trị field phải từ evidence generation tương ứng.
2. Tính summary tại DB/producer và kiểm consistency trước trả API. Không tự cộng 2.349 field ở browser để suy toàn nguồn. Ràng buộc `catalogVersion`/generation/digest vào cursor hoặc response; đổi run/generation giữa các trang phải yêu cầu reload, không trộn hai phiên bản.
3. Xử lý trạng thái `partial/unavailable`: thiếu sidecar, generation BUILDING, run chưa VERIFIED, sai registry hash/contract, thiếu schema hoặc target drift chưa chạy. Không fallback run cũ, synthetic/demo, catalog mock hoặc zero thành công.
4. Index/query plan: đo Store có nhiều record và scope toàn catalog; tránh N+1, trả tối đa một trang bounded; thử timeout và concurrent refresh. Chỉ thêm index qua migration additive khi đo chứng minh cần.
5. Kiểm response bằng allowlist field và canary secret, bảo đảm chỉ Super Admin thấy Customer display đã được producer F42 ghi nhận và duyệt, còn lỗi không in URI/CSV path/snapshot private. Nếu thêm env mới, dùng placeholder trong `.env.staging.example` và `.env.production.example`.

## File dự kiến

| Thao tác | File | Mục đích |
| --- | --- | --- |
| Sửa | `src/app/api/qa/migration-reconciliation/route.ts` | View/query Zod, auth, lỗi typed và version |
| Sửa | `src/lib/admin/qa/f42-field-evidence-reader.ts` | Summary/record/field theo run và generation, không latest mơ hồ trong pagination |
| Sửa | `src/lib/admin/qa/f42-ledger-evidence-provider.ts`, `migration-reconciliation.ts` | Join identity/issue đúng run và sanitizer |
| Tạo | `src/lib/admin/qa/f42-source-coverage-reader.ts` | Reader Store nguồn có/không có child run |
| Sửa | `src/lib/admin/qa/f42-reader-contract.ts`, `f42-source-contract.ts` | DTO/version/schema readiness |

## Kiểm chứng và điều kiện ra phase

- 400 input sai; 401/403 không có quyền; 404 run không thuộc Store; 409 version/cursor conflict; 503 source/generation chưa sẵn sàng. Không lộ chéo Store/tenant/namespace.
- Một request chỉ đọc đúng snapshot/generation đã pin; không pha source coverage snapshot A với run của snapshot B. Thay run/filter nhanh hoặc refresh giữa pages không trả bản ghi cũ vào UI.
- Summary/rows/cursor nhất quán, thời gian truy vấn nằm trong ngân sách Vercel Pro và không có N+1.
- API read-only, không gọi importer, quét PW1 live hoặc ghi verdict; browser chỉ nhận giá trị an toàn.
