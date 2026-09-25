# Review trước commit — exporter PW1, 2026-09-24

Phạm vi: thay đổi local trên `feat/pw1-master-json-exporter`, HEAD `464030ea7`, contract 1.10.5. Review ban đầu chỉ đọc; sau đó đã sửa theo yêu cầu của người dùng. Chưa commit, push hoặc ghi DB. Đã đọc quy định `.github`, PR #1896 và issue #1885; quyết định mới của người yêu cầu trong hội thoại được dùng để đối chiếu policy.

## Cập nhật sau sửa — 24/09/2026

Ba finding bên dưới đã được xử lý ở code/tài liệu local:

- SKU: resolver kiểm tra từng target field, đặt trước các mã SKU gốc của sibling và tránh cả mã suffix/indexed suffix đã có. Regression `TC-F42-EXP-100` giữ đủ Product 200 và ba variant, chọn `ABC-P200-2` khi `ABC-P200` và `ABC-P200-1` đã thuộc sibling; có case khác hoa/thường.
- Domain receipt: validator yêu cầu đúng một receipt cho mỗi Site emitted, kiểm tra source/Store/target path và tập field mapped, từ chối thiếu/lặp receipt. Regression `TC-F42-EXP-113` bao phủ duplicate receipt, hai dòng nguồn cùng Store, thiếu receipt, Site không emit, field thiếu/lặp/chưa mapped/không hợp lệ và compatibility contract cũ. Guard được đối chiếu với importer `source-domain-proof.ts`.
- README: đã sửa exit 0 thành export/validation thành công, vẫn có thể `partial`; `not_verified` không chứng nhận DB readiness. Exit 2 chỉ mô tả contract lịch sử.

Review độc lập của vùng sửa chưa phát hiện thêm lỗi P1/P2. Bằng chứng red/green do các lượt sửa ghi nhận: hai case SKU mới fail trước sửa, sau sửa suite liên quan 113 tests / 6 files PASS; bảy mutation domain mới fail trước sửa, sau sửa focused suite 84 tests / 4 files PASS. Suite mở rộng sau sửa: 691 tests / 48 files PASS, log `/tmp/pw1-fix-domain-tests.log`. Không cộng các lượt test có giao nhau thành tổng test mới. Kiểm tra cuối sau sửa: **13.012 tests PASS, 3 skipped; 826 files PASS, 1 skipped**, TypeScript/lint/build/diff check PASS. Lượt đầu có 2 timer errors `window is not defined` từ editor publish-flow ngoài diff; lượt chạy riêng exporter + editor đạt 801 tests PASS, rồi full rerun PASS không lỗi nền. Không sửa editor hoặc bỏ qua lỗi test. Logs: `/tmp/pw1-fix-all-tests.log`, `/tmp/pw1-fix-focused-tests.log`, `/tmp/pw1-fix-all-tests-rerun.log`, `/tmp/pw1-fix-{types,lint,build}.log`. Đã cập nhật và đọc lại xác minh issue #1885 / PR #1896 trên GitHub; PR vẫn Draft, mô tả tách HEAD 1.8.0 đã push và local 1.10.5 chưa commit. Chưa chạy lại full PROD export trong lượt sửa này.

## Findings ban đầu — đã xử lý local

### P2 — Resolver SKU tạo conflict rồi loại Product hợp lệ

- Vị trí: `src/lib/migration/pw1-export/mappers/catalog.ts:375`, điều kiện tương tự ở dòng 384.
- Fixture: Product 100 có SKU `ABC`; Product 200 có hai variant hợp lệ, tuple khác nhau, SKU `ABC` và `ABC-P200`.
- Resolver đổi SKU đầu của Product 200 thành `ABC-P200`, rồi chấp nhận SKU thứ hai vì map mã đã dùng chỉ phân biệt Product ID, không phân biệt variant.
- Kết quả: toàn Product 200 bị loại với `SOURCE_ENTITY_EXCLUDED / DUPLICATE_PRODUCT_SKU`.
- Đây là conflict do mapper tạo ra, không thuộc chấp thuận bỏ record nguồn không hợp lệ.
- Cần kiểm tra uniqueness giữa các target variant, tránh đụng mã sibling và thêm regression test.
- Đã chạy tái hiện: `/tmp/pw1-review-sku-repro.ts`.

### P2 — Exporter nhận domain receipt lặp nhưng importer từ chối

- Vị trí: `src/lib/migration/pw1-export/validate-classification.ts:67`.
- Nhân đôi contribution `MASTER-4.1-SOURCE-SITE-DOMAIN` trong report fixture, cập nhật hash report trong manifest.
- `validateArtifact()` vẫn trả `integrityStatus=valid`, exit 0; importer đọc cùng report trả `SOURCE_SITE_DOMAIN_EVIDENCE_INVALID`.
- Cần kiểm tra đúng một domain receipt cho mỗi Store emitted và đồng bộ ràng buộc với importer; thêm mutation regression.
- Đã chạy tái hiện: `/tmp/pw1-review-domain-proof.ts`, `/tmp/pw1-review-import-domain.ts`.
- Đây là gap validator; không phải bằng chứng artifact PROD hiện tại có receipt lặp.

### P2 — Hướng dẫn exit code gây hiểu nhầm mapping đã đầy đủ

- Vị trí: `configs/migration/README.md:99`.
- Tài liệu nói exit 0 nghĩa là mapping complete, exit 2 nghĩa là cần review. Contract hiện tại cho phép exit 0 với `dataStatus=partial`, `importStatus=not_verified`.
- Cần sửa hướng dẫn hiện hành; chỉ giữ exit 2 khi mô tả artifact lịch sử có contract đó.

## Điểm cần đồng bộ khi chuẩn bị PR

- PR #1896 đã mô tả multipart, raw settings, domain PW1 và fixes local 1.10.5, đồng thời ghi rõ code GitHub vẫn là HEAD 1.8.0.
- Issue #1885 đã cập nhật các quyết định mới về owner, exclusions, slug/SKU, multipart, raw settings và domain PW1; giữ acceptance mở, không thu hẹp AC theo lỗi implementation.
- Local ref `origin/staging` có 36 commit chưa nằm trong HEAD nhánh; chưa fetch để chứng nhận trạng thái remote mới nhất.
- Diff tracked đã vượt 500 dòng, còn nhiều file mới chưa tracked. Nên chia nhóm commit có thể review, giữ contract/schema/validator và test đồng bộ. Không stage toàn bộ báo cáo dữ liệu nguồn bằng `git add .` mà chưa chọn phạm vi.

## Trường hợp không kết luận là lỗi policy

`allowUnresolvedBlogMedia=true` kết hợp `excludeInvalidBlogs=true` loại cả Blog có thumbnail không hợp lệ, dù bật riêng policy media vẫn giữ Blog. Fixture `/tmp/pw1-review-blog-repro.ts` đã xác nhận. Do quyết định sau cùng cho phép bỏ Blog không hợp lệ, chưa coi đây là vi phạm chắc chắn; test hiện tại chưa bao phủ tổ hợp hai policy PROD này.

## Kiểm chứng trước sửa (checkpoint review ban đầu)

- Exporter: 757/757 tests, 55 files PASS.
- Toàn repo: 12.998 tests PASS, 3 skipped; 826 files PASS, 1 skipped.
- TypeScript PASS; lint PASS, còn warnings ngoài phạm vi exporter; `git diff --check` PASS.
- Chưa thấy lỗi cụ thể ở giới hạn multipart 300 Store/dưới 200 MB, bảo toàn raw model_settings hoặc lựa chọn domain PW1 hiện tại.
- Không thay collections/schema DB, không thêm env runtime trong diff được review.
- `npm run build` PASS (exit 0): compile thành công, tạo đủ 112 trang tĩnh và hoàn tất build traces.
- Log tại `/tmp/pw1-precommit-{tests,all-tests,types,lint,build}.log`.
- Không chạy lại full PROD export hoặc import DB trong lượt review này. Evidence PROD trước đó không được tính là một lần chạy mới.
