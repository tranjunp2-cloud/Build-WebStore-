# Phase 06 — Kiểm thử, staging và gate QC

## Bối cảnh

**Owner:** QC lead + F42 + F40 + Security + operator staging. **Trạng thái:** Đang bổ sung test; staging và gate QC chưa thực hiện. Gate: Phase 01–05, F42 Phase 07/09 staging handoff và ledger adapter Phase 04. Đây là xác nhận phạm vi Commerce; full F40 cutover vẫn theo F42 Phase 10 và các owner Media/Content/Visual/SSO.

## Chuẩn bị staging

1. Ghi F42/F40 commit SHA, schema/registry/contract version, target environment/DB guard, Source Store ID số, child UUID VERIFIED, snapshot ID/as-of/sidecar SHA, generation ID/digest và fixture type. Batch ID ghi riêng. Chỉ chạy với DB/Store được operator cho phép; seed/reset phải giới hạn marker và chứng minh không chạm dữ liệu ngoài fixture.
2. Kiểm schema additive qua `scripts/db-setup.js --migrate-only` trong build path phù hợp; chạy lại lần hai trên clone/staging-safe path. Kiểm index/query plan, authorization và timeout. Không DROP, không tự migrate production từ màn F40.
3. Chạy một real artifact xuyên suốt selected CSV → exporter/sidecar → validator → importer child VERIFIED → ingest/build → F40 API/UI trên cùng snapshot. Synthetic fixture kiểm sáu trạng thái và ca lỗi nhưng không làm bằng chứng Store thật.
4. Sau fixture xuyên suốt, chạy **kiểm kê tự động trên toàn catalog Store thuộc phạm vi đã ký**: mỗi Store có source coverage state và nếu cần import thì có đúng child run/generation hợp lệ hoặc reason `BLOCKED/NOT_RUN`; đối chiếu tổng Store với F42 ledger, không chỉ suy từ một Store mẫu. Lấy mẫu rủi ro cao (nhiều SKU/order, no-emit, partial, thiếu sidecar, PII) để QC điều tra thủ công. Ghi số Store đủ bằng chứng/chưa đủ/có lỗi và danh sách owner theo revision; chưa có phép quét toàn catalog thì không tuyên bố rollout hoàn tất.

## Kế hoạch kiểm thử

- **Pure unit:** tỷ lệ và mẫu số, status/reason, rule money/stock/time/null/empty, policy Commerce-ready. Import logic từ source; AAA; TC-ID trong tên/comment; `vi.mock()` ở đầu file theo `docs/TEST_CONVENTION.md`.
- **DB integration/API:** sidecar hash/count, summary sáu trạng thái, Store không emit, missing/duplicate proof, drift sau verify, idempotent/replay, query cursor và 400/401/403/404/409/503; canary PII/secret và cross-Store. Dùng clone hoặc transaction/temp tables có rollback; không sửa shared customer DB để thử negative case.
- **Playwright thật:** Super Admin mở Store/run, xem hai mẫu số, lọc entity/status/disposition, phân trang, mở Product/SKU và Order detail, thử unavailable/partial/stale, đổi run nhanh, mobile 375px; không mock API response trong test nghiệm thu. Nếu cần test DB fixture, dùng DB cô lập và guard; test skip không tính PASS.
- **Regression:** TC-F40-14-01–04, TC-F40-MIG-LIVE-08, US-F40-11 AC page scope, tab Settings, website/visual/QC tách biệt. Test mới cho route/page phải nằm trong `tests/*.spec.ts`; mapping TC-ID trong `docs/qa/F40-qa-control-center.md` trước khi tạo test.

## Ma trận nghiệm thu và quyết định

Điền [ma trận yêu cầu](requirements-traceability.md) theo [mẫu kết quả thực thi](execution-evidence-template.md) với `PASS/FAIL/NOT_RUN/BLOCKED`, expected/actual, actor/owner, timestamp, revision và bằng chứng an toàn cho từng ID/Store. QC/Product/Finance ký required fields, **mọi field exclusion/gap**, P0, money/status/stock policy. Không đóng Commerce nếu source coverage, importExpected hay bất kỳ field bắt buộc nào còn không chứng minh được mà chưa có ngoại lệ được duyệt. `Issue mở = 0` và `match/checked = 100%` không đủ để Pass. US-F40-11 AC-2 giữ `BLOCKED` tới khi exact remediation artifact đáp ứng AC hoặc thay đổi AC được phê duyệt; không đóng F40-11 từ hướng dẫn chung.

Commerce-ready chỉ cho biết **đủ bằng chứng Commerce để QC xem xét**; không tự lưu Website QC Pass, không bật DNS/cutover. Full cutover cần ma trận TC-MIG.01–10, SEO 301, media, 9 theme/visual/mobile, SSO, P0 = 0, parity theo mẫu số ký và manual sign-off trên cùng staging revision. US-F40-14 Settings chưa hoàn thành vẫn theo kế hoạch riêng.

## Rollout và phục hồi

- Triển khai F42 schema/producer trước; xác minh revision/contract trên staging; bật F40 reader/UI sau khi readiness PASS. Thiếu schema hoặc nguồn → 503/unavailable, không fallback mock.
- Nếu count/digest/tenant binding/privacy fail: tắt read feature hoặc trả unavailable; giữ evidence bất biến và audit log. Không xóa bảng hay sửa lịch sử đã commit. Sau fix tạo generation/target check mới, chạy lại matrix.
- Không dùng `approve_pass`/`scan_batch` prototype của `/api/qa/migration-diff` làm nguồn nghiệm thu; hành động giả phải bị vô hiệu trong live mode hoặc gắn nhãn rõ theo Phase 10.

## Điều kiện hoàn thành

- Một Store thật trên staging qua toàn tuyến có proof và UI đúng; Store không emit/thiếu nguồn và synthetic negative cases không bị diễn giải sai.
- Security và Performance review đạt; E2E browser thật, API/DB integration, schema lần hai và regression liên quan PASS. Mọi test bị skip ghi NOT_RUN.
- QC ký ma trận Commerce, danh sách gap/owner và quyết định phạm vi; các gate full F40/cutover vẫn được báo riêng.
