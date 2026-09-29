# Đối chiếu kế hoạch và tài liệu hiện hữu

## Phạm vi rà soát

Rà 117 file `plans/*/plan.md` ngày 2026-09-16, đọc metadata và nội dung các plan liên quan. Không có plan directory F42/PW1 JSON importer đang mở. Báo cáo hai ngày ở `plans/reports/260915-1102-pw1-pw2-migration-two-day-plan.md` là đề xuất cũ, không phải dependency thực thi.

## Quan hệ với các plan khác

| Plan | Liên quan | Kết luận |
|---|---|---|
| [F33 Discount CMS](../../260529-1135-f33-discount-cms/plan.md) | Collection discounts/usage, db-setup | Dùng schema/code thực tế đã có. Không chờ hoàn thành toàn plan CMS cũ; preflight phải xác minh schema đích. Không thay checkout. |
| [F08 Category integrity](../../260710-1625-f08-category-integrity/plan.md) | Categories, uniqueness, db-setup | Các phase backend ghi đã done; phần pending chủ yếu storefront. Không phụ thuộc page/storefront. Không nhầm uniqueness Category với Product. |
| [SSO PW2 implementation](../../260611-1521-sso-pw2-implementation/plan.md) | Users/Tenants/PlanSubscriptions/credential utility | Tái sử dụng code thực đã có, không chờ toàn bộ endpoints/ETL cũ. Không chạy song song ETL subscription cũ trên cùng Store trong rehearsal. |
| [F19 Vercel domain](../../260413-1500-f19-vercel-domain-verify-rewrite/plan.md) | Sites/domain | Không provision hoặc activate domain; không có dependency cho import local. |

Chỉ overlap file/schema không chứng minh quan hệ blocks/blockedBy. Plan mới để cả hai danh sách rỗng. Không sửa metadata dependency các plan cũ vì không có quan hệ chờ output được xác lập. Người triển khai cần phối hợp khi sửa `scripts/db-setup.js`, Users/Tenants và collection hooks; bảo toàn thay đổi đang có.

## Thứ tự ưu tiên tài liệu

1. Yêu cầu mới nhất và thiết kế local được người dùng đồng ý trong hội thoại.
2. Plan local này và contract đã khóa tại Phase 1.
3. Master mapping/JSON cho dữ liệu nghiệp vụ, với các mâu thuẫn được ghi thành blocker.
4. Source thực tế và schema/index DB đích để xác minh khả năng ghi.
5. Research/plan Sprint cũ là bằng chứng lịch sử, không tự ghi đè quyết định mới.

Các đoạn trong báo cáo feasibility cũ đề nghị bỏ credential recovery, dùng enrollment hoặc yêu cầu hai dev + QA không còn là quyết định cho plan này. Plan hiện tại tái sử dụng recovery theo yêu cầu người dùng, giữ password của User tồn tại, và coi tám giờ là ngân sách có điều kiện. Tài liệu F42 QA vẫn mô tả một số luồng enrollment khác: chỉ tái sử dụng TC đúng semantics, không tuyên bố coverage thay thế.

## Giới hạn công cụ

`ck` CLI không có; tạo Markdown theo template skill. `docs/development-rules.md` không tồn tại; áp dụng AGENTS.md người dùng cung cấp và `docs/TEST_CONVENTION.md`. Không có TaskCreate/TaskUpdate; checkbox trong phase là danh sách công việc bền vững. Không có thao tác DB hoặc thay đổi application code trong bước lập plan.

Đã gọi script set-active-plan của repo; CK_SESSION_ID không được thiết lập nên active-plan state không persist. Dùng đường dẫn tuyệt đối plan.md khi handoff.
