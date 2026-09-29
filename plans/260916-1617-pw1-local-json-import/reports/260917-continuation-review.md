---
title: "Review kế hoạch tiếp nối: contract, actor và rehearsal"
date: 2026-09-17
status: resolved
scope: "Read-only plan review; không code/test/DB"
---

# Review kế hoạch tiếp nối

Đã đọc plan, continuation-decisions và phases04–06; đối chiếu schema/ledger hiện hữu. Không triển khai code hoặc truy vấn DB. Kết quả re-review: **không còn Critical/High mở**. H1 và M1 bên dưới đã được xử lý trong plan; giữ mô tả để truy vết. Thiết kế actor sửa trong phiên đã giải quyết claim namespace/ownership/race; profilev2 đã có gate migration bắt buộc.

## H1 — Resolved: quy tắc phục hồi partial run

**Vị trí:** phase04 “Hợp đồng có phiên bản”, phase05 resolver rule14; đối chiếu continuation-decisions “Handoff và tính bất biến”.

Phase04 cho “replan/new batch hoặc dùng đúng writer cũ” khi đổi code/contract; phase05 cho REPLAN/new batch khi binding drift. Quyết định gốc yêu cầu restore disposable clone sau partial commit. Run mới trên clone còn partial data sẽ đụng active claims/runs; binary cũ cũng không mặc nhiên tương thích schema vừa migrate.

**Sửa:** Phân biệt trước business write (được preflight/new batch) và sau partial commit (giữ evidence, dừng writer, restore clone từ baseline rồi new batch). Chỉ resume binary cũ nếu **toàn bộ** source/binding/code/schema/target vẫn đúng; không lấy binary cũ làm cách bỏ schema drift. Không nâng version tại chỗ hoặc clear claims. Thêm reference này vào rule14.

## M1 — Resolved: actor dependency closure

Chỉ yêu cầu target bindings cho external `users.createdBy` edges thực sự ghi bởi selected business Users. Toàn source actor chain vẫn phải validate integrity/provenance; ancestor không trực tiếp được ghi không cần target provisioning/binding. Nếu không tách hai closure, Store hợp lệ có thể bị chặn vì ancestor không liên quan. Không mở ngoại lệ sang Blog.author/membership/relationship khác.

## Thiết kế actor tối thiểu đã xác nhận

- Schema hiện hữu cho phép `action=SKIP`, `state=SKIPPED`, `claim_active=true`; active-source unique vẫn là `(source_system,source_instance_id,source_entity,source_id)` — `scripts/pw1-migration-schema.js:265` và index phía sau.
- Không có active owner: primitive mới `bindExternalActor` ghi non-owning active SKIP vào child run Store thật đầu tiên tiêu thụ; `scope=external_reference`, `ownsBusinessRow=false`. Mapping ownership không phải quyền sở hữu User.
- Có owner: consumer inactive SKIP + `depends_on_entity_map_id`, không chuyển claim/password/role/membership. Same child/source dedupe vì run-source unique.
- Advisory lock actor + ordered claim/target locks; shared unique index xử lý race với legacy runner không dùng advisory lock. Unique conflict phải rollback/re-read winner; không overwrite target identity.
- `recordEntity` hiện chỉ CREATE hoặc inactive REUSE cần owner; không giả primitive này đã hỗ trợ external binding. `findClaim` trả consumer Store của owner không phải tenant ownership của global actor. Ngoại lệ phải nằm trong actor resolver, không nới business User store guard.
- Đối soát minimal identity/provenance và target tồn tại; không hash lastLogin/volatile fields rồi coi cập nhật bình thường là identity drift. Actor operations/counts tách khỏi business account creates.

## Các gate được giữ đúng

Diagnostics không blanket-ignore: typed Page exclusion, exact approved policy evidence, target gates riêng, unknown/global required vẫn block. Raw source severity/count không bị rewrite thành READY. Missing keys, missing target actor và provisioning chưa duyệt là stop condition rõ.

Profilev2 cần schema CHECK + ledger dispatch hỗ trợ, giữ legacy/v1 và binding immutable; phase05 đã bổ sung checklist này. Các test phải gồm old/new/unknown profiles, cùng actor qua hai Store, duplicate operation trong một child, race với legacy claim, target deleted/drift, và unchanged credentials/roles/memberships.

Ngân sách2+3+3h được ghi là continuation timebox có điều kiện, không phải bảo đảm toàn2918Stores. Phases06 phân biệt structural/selected/full-source evidence; không dùng synthetic hoặc parser benchmark thay real business acceptance. Không có bằng chứng mới nào được đánh PASS từ lần review này.

## Next

Đã đọc lại phase04 contract, phase05 rules6/14 và phase06 prerequisite. Trước write cho replan; sau partial commit với binding/code/schema đổi bắt buộc restore disposable clone baseline rồi new batch; resume chỉ khi toàn bộ binding vẫn khớp. Rule6 tách source-chain validation khỏi target binding cho direct selected createdBy edges; unreferenced ancestor có test riêng. H1/M1 resolved. Có thể chuyển sang implementation theo các gate; kết luận này không chứng nhận code/DB hoặc actual-source QA chưa chạy.
