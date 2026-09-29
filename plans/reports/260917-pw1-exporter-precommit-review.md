# Review trước commit — exporter classification 1.2.0

Ngày: 2026-09-17. Phạm vi: source classification/dispositions, cancellation evidence, manifest/version, artifact validation, reconciliation integration và test liên quan. Không review toàn bộ các thay đổi UI/schema khác đang có trong worktree; không commit, không sửa CSV/DB.

## Kết luận ban đầu: cần sửa validator trước commit (đã xử lý bên dưới)

### RV-01 — Ownership evidence chưa được kiểm tra quan hệ cha

Vị trí: `src/lib/migration/pw1-export/validate-artifact.ts:60` và schema metadata `artifact-schemas.ts`.

Validator chỉ kiểm `row.ownership.storeId === row.storeId` và field có retention rule mang disposition `retained-source`. Chưa kiểm parent có tồn tại/thuộc đúng Store; rule chỉ được kiểm regex, không đối chiếu tập rule đã định nghĩa; ownership thất bại chưa bắt buộc có diagnostic tương ứng.

Tái hiện bằng fixture thật được export qua pipeline:

1. Subscription nguồn ID 1 thuộc Store 1; report có parent `stores:1`.
2. Đổi `row.storeId` và `ownership.storeId` thành `2`, giữ parent `stores:1`; không sửa master/CSV.
3. Cập nhật hash mapping-report trong manifest.
4. `validate-only` vẫn trả `integrityStatus=valid`.

Root đã tái hiện độc lập tại `/tmp/pw1-root-review-efj4p56l/export`. Review độc lập còn xác nhận parent không tồn tại, rule ownership tùy ý, ownership lỗi không có diagnostic và retention rule `MASTER-NOT-A-REVIEWED-RULE` đều được chấp nhận.

Ảnh hưởng: validator không phát hiện report tự mâu thuẫn; code tiêu thụ ownership để lọc theo Store có thể loại sai blocker. Đây không phải bằng chứng artifact production hiện tại bị gán sai Store; importer hiện tại còn từ chối contract mới như đã ghi trong tracking.

Cần sửa:

- Kiểm tra shape và allowlist của từng ownership/retention rule.
- Resolve parent theo index report; xác minh parent tồn tại, ownership khớp, chuỗi không có cycle; áp dụng đúng ngoại lệ cho rule lỗi.
- Bắt buộc diagnostic global tương ứng khi ownership không xác minh được.
- Thêm regression cho các tình huống trên. Không chỉ kiểm hai storeId do cùng một row khai báo.

Verdict: Accept — cần sửa trước khi dùng kết quả validation làm bằng chứng tenant scoping. Không tách downgrade 1.1 thành finding vì đang có chủ đích hỗ trợ legacy; không ghi nhận bug generation/receipt khác khi chưa có bằng chứng.

## Kiểm chứng mới trong lượt review

- 32 test / 3 files pass: source-classification, identity, reconciliation-artifact.
- `npm run typecheck`: pass.
- `git diff --check`: pass cho tracked diff; không chứng nhận mọi file untracked.
- Existing tests chưa bao phủ RV-01.
- Có nhiều file UI/schema và toàn bộ exporter còn untracked: cần stage theo phạm vi; không dùng `git add .` cho commit riêng classification.

Review sử dụng skill `ck:code-review`; kiểm chứng source/fixture offline, không web hoặc DB writes.

## Review lại sau fix RV-01 — PASS

- `validate-classification.ts` kiểm parent table/identity, ownership của parent, rule hợp lệ, failure diagnostic global và cycle; các rule retention được ràng buộc với đúng bảng/field. Validator được gọi cả trước publish lẫn validate-only.
- Regression mới TC-F42-EXP-083 tái hiện report đã rehash nhưng sai tenant/parent/rule; tất cả bị từ chối. Thêm coverage cho nguồn orphan hợp lệ có blocker, parent chain đúng, diagnostic sai Store và giả global scope.
- Review độc lập bản sửa không có finding còn mở; 17 ca adversarial độc lập bị từ chối đúng.
- Workspace: 431 tests pass, TypeScript pass. Snapshot từ đúng Git index: **429 tests / 29 files pass**, TypeScript pass. Hai test UI/gallery được giữ ngoài commit exporter cùng thay đổi UI tương ứng.
- Artifact production `pw1-prod-20260917-classification-001` kiểm lại với validator mới: **integrityStatus=valid**, mappingStatus=needs_review, exit 2. Số Store/blocker không đổi. Không cần sửa hoặc export lại artifact vì fix chỉ siết kiểm tra evidence.
- Giới hạn còn giữ: đây là kiểm tra tính nhất quán trong artifact; không đọc lại CSV để xác thực từng FK/giá trị. Importer hiện tại chưa nhận contract mới. Không apply DB.
- Commit cần gồm exporter và helper/dependency/test mới vì các file này trước đó chưa được Git track; không gồm dữ liệu CSV/export hay thay đổi runtime UI/schema. Phạm vi lớn là phần exporter tích lũy, không chỉ số dòng fix RV-01.
