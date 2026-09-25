---
title: "Research tính khả thi importer JSON master PW1 → PW2"
date: 2026-09-16
researched_at: "2026-09-16T08:01:13Z"
status: researched
type: research-report
scope: "Master JSON, runner worktree, Payload 3.79.0, PostgreSQL local; chưa triển khai importer"
---

# Research tính khả thi importer JSON master PW1 → PW2

> **Cập nhật quyết định 2026-09-16:** [Kế hoạch local một ngày](../260916-1617-pw1-local-json-import/plan.md) thay thế các khuyến nghị cũ về bỏ credential recovery/enrollment, rollback mở rộng và lịch hai dev + QA trong báo cáo này. Theo yêu cầu mới nhất, dùng lại recovery password trong worktree qua sidecar mã hóa; giữ credential User hiện hữu; mặc định CREATE/verified REUSE/CONFLICT; tám giờ là ngân sách có điều kiện. Các bằng chứng source/DB bên dưới giữ lại để truy vết, không phải xác nhận importer mới đã triển khai.

## 0. Phạm vi người dùng đã chốt sau research

Cập nhật 2026-09-16:

- Các phần liên quan Page không nằm trong scope: không viết converter Page/component, không import Page/layout và không dùng các gap này để chặn migration. Giữ nguyên dữ liệu raw trong master; không sửa/xóa Page hiện hữu ở DB.
- Đích là **DB đã có sẵn**, không lấy DB trống làm giả định triển khai. Chưa xác nhận DB hiện hữu đó chính là local đã khảo sát hay một DB khác.
- Đường triển khai phải có đối chiếu baseline và reconciliation trước apply. Import hiện hữu không đồng nghĩa được overwrite mọi field, reset DB hoặc đổi credential.
- `--all` vẫn chỉ chọn các Store có trong master. Bỏ Page không loại bỏ Site, Media, commerce, User, subscription hoặc các điều kiện mapping tương ứng.

Thiết kế reconciliation đề xuất, chưa phải implementation:

| Trường hợp | Hành vi |
|---|---|
| Chưa có source claim/target; không collision | CREATE sau validate |
| Có mapping và target đúng projection master | REUSE/SKIP; kiểm chứng ownership và giữ rollback ownership gốc |
| Có mapping; field khác master | FIELD DIFF; chỉ UPDATE field đã được policy cho phép sau kiểm tra baseline |
| Target đã thay đổi từ baseline, identity mâu thuẫn hoặc collision không rõ nguồn | CONFLICT; không ghi đè hoặc nhận làm bản ghi của source |
| Page/component | OUT_OF_SCOPE; không làm fail Store chỉ vì nội dung Page |

Cập nhật dữ liệu hiện hữu cần before-image của field/quan hệ bị đổi, expected baseline/checksum kiểm tra trong transaction, audit action UPDATE và khôi phục có điều kiện. Schema action ledger cũ chưa có UPDATE; phải thiết kế mở rộng hoặc bảng audit bổ sung tương thích thay vì gán update thành CREATE. Dữ liệu nhạy cảm trong before-image phải được giới hạn, không đưa vào log/report thông thường. Giữ nguyên ID đích và các quan hệ PW2 hiện hữu ngoài scope.

Phải xác minh DB đích cụ thể trước khi dùng số liệu local dưới đây. Các ví dụ free/business và published/draft là conflict đã quan sát tại local, không phải quyết định tự động cập nhật. Chính sách đối với password, User identity/membership, Site publish/domain và gói phải được thể hiện rõ trong preview; không âm thầm áp dụng default runner cũ.

Lịch một ngày trong §10.2 là ước lượng trước khi chốt DB hiện hữu; cần thay phần chuẩn bị DB mới bằng baseline/reconciliation và tính thêm kiểm thử UPDATE, giữ quan hệ, rollback before-image. Bỏ Page giảm scope, nhưng không đủ để chứng nhận mọi Store sẽ hoàn tất trong một ngày.

## 1. Kết luận phục vụ quyết định

Đề xuất một entrypoint JSON riêng, tái sử dụng transaction/lease/claim/ledger của worktree sau khi tách contract Sprint 1. Không viết lại toàn bộ control plane, không đưa master qua mapper CSV cũ, không chọn một cách ghi cho mọi collection.

Writer nên có phạm vi rõ theo collection: Local API có migration guards khi cần validation/auth; adapter Payload cho ngoại lệ đã kiểm chứng như Media metadata không filename; SQL có tham số cho ledger và sửa timestamp có giới hạn trong cùng transaction. Adapter cho dữ liệu lịch sử như Orders là phương án cần so sánh trong rehearsal, không mở mặc định cho mọi collection khi validator còn thiếu.

**Chưa có căn cứ cam kết hoàn tất toàn bộ Store vận hành trong một ngày.** Có cơ sở đặt mục tiêu một ngày cho importer và rehearsal phạm vi đã khóa trên DB cô lập, nếu các kiểm chứng Media/Order/User/timestamp đạt sớm và có hai dev cùng QA. Phạm vi này chưa được người dùng duyệt; không tự loại Page hoặc chức năng để gọi là hoàn tất.

Phát hiện ảnh hưởng trực tiếp quyết định: DB local không trống. Có 1.125 run VERIFIED; Store 205 và 285 đã có foundation Sprint 1 v3. Tenant hiện là `free`, Site hiện là `published`; JSON mới là `business` và `draft`. Import mới vào DB trống và tiếp tục trên nền dữ liệu này là hai công việc khác nhau. Không tự overwrite, rollback hay reset dữ liệu hiện hữu.

## 2. Phạm vi, nguồn và giới hạn bằng chứng

### 2.1 Những gì đã kiểm tra

- Current checkout `/home/liam/data/ech-prime-web-v2`, HEAD `8ddb2b4e9`, có thay đổi chưa commit từ trước.
- Worktree thực tế `/home/liam/data/worktrees/ech-prime-web-v2-worktree-1`, HEAD `dff794979`, nhiều module migration và thay đổi collection chưa commit.
- [Master mapping](../../docs/migration/pw1-pw2-master-field-mapping.md), [JSON mẫu](../../docs/migration/stores-205-285-pw2-current-schema-collection-only.json), Sprint 1 và F42 architecture/QA.
- Runner, transaction, claims, lease, batch, verifier, rollback và các test liên quan ở worktree.
- Collection/hook hiện tại và mã thư viện Payload/PostgreSQL adapter đang cài, version Payload `3.79.0`.
- PostgreSQL local container `primeweb-db`, database `primeweb`, version `16.13`: truy vấn `BEGIN READ ONLY`; chỉ schema/index và thống kê/trạng thái nghiệp vụ cần đối chiếu.
- Tài liệu chính thức Payload và PostgreSQL 16, kiểm tra ngày 2026-09-16. Với behavior cụ thể, mã thư viện 3.79.0 được ưu tiên hơn tài liệu latest.
- Chạy 36 test mapping Product ở current checkout và 75 test unit chọn lọc ở worktree.

### 2.2 Chưa được chứng minh

- Chưa import JSON bằng writer mới; chưa có benchmark toàn bộ Store.
- Chưa chạy test integration có ghi DB/storage, chưa thử round-trip Media dưới config S3.
- Chưa xác định DB đích cuối cùng hoặc file master đầy đủ hơn bản hai Store.
- Trạng thái VERIFIED trong DB là ghi nhận của runner cũ, không phải chứng nhận độc lập master mới hay 20 collection.
- Không đọc/in giá trị credential hoặc dữ liệu cá nhân; không kiểm tra URL ảnh bằng download hàng loạt.
- Không sửa application code, schema hay business data trong lần research này.

### 2.3 Hash artifact khảo sát

```text
master mapping SHA-256:
62cd5561bff68111aacb55c857b8820647f6d55d9658ec136e46daab36dd9d26

JSON sample SHA-256:
2eb804387dc34561624597cb2f4aa21af38a00caeb9fb44a96b84734fbe0eacc
```

Master được sửa bởi hoạt động khác trong workspace khi research đang chạy: rule Product slug chuyển sang unique trong tenant, không tự đổi slug để né constraint PW2 toàn cục (hai dòng ở §5.2 và §18). Research đã đọc diff và cập nhật nhận định; hash trên là bản cuối lần kiểm tra. Hash lúc đầu là `6b0afa593e7db4e64109883820951687de2aecba55c976f09938aa60ee063fbc`. Agent research không sửa master.

## 3. Đính chính kết luận sơ bộ

1. **Runner có chống trùng xuyên run.** Unique active source claim đã có trong source và DB thực tế. Thiếu cơ chế nhận lại/skip kết quả cũ một cách chủ động khi chạy command mới, không phải hoàn toàn thiếu deduplication.
2. **Không thể gọi toàn bộ JSON là stale.** Tenant plan, User role/name, domain, commerce, Blog Lexical và một số timestamp đã được cập nhật; generator tương ứng vẫn có thể cũ. Không chạy lại generator lên master này một cách mù quáng.
3. **Media không nhất thiết cần thay toàn bộ upload pipeline.** Hook S3 chỉ dựng lại URL khi có filename. Master không có filename; adapter ghi metadata với filename NULL là đường khả thi từ đọc source, cần round-trip chứng minh.
4. **Local API không bảo toàn dữ liệu lịch sử tự động.** Order hooks có thể đổi Customer, paymentStatus và dữ liệu Customer; update thay updatedAt thành hiện tại.
5. **Một ngày là ước lượng có điều kiện**, không phải cam kết đã có bằng chứng runtime. CLI selector không phải nút thắt chính.

## 4. Độ sẵn sàng của 20 collection

Số lượng đo trực tiếp từ JSON 3.101.566 bytes. `Mapped` chỉ mô tả artifact, chưa chứng minh writer hoặc runtime.

| Collection | Store 205 | Store 285 | Nhận định và việc cần làm |
|---|---:|---:|---|
| tenants | 1 | 1 | Mapped business/active/pending; kiểm tra lifecycle evidence, slug/domain collision và plan |
| users | 6 | 1 | Role/name đã map; cần identity toàn hệ thống, membership, createdBy hai lượt và enrollment |
| sites | 1 | 1 | Draft + raw `pw1_source` + menus; tách raw khỏi write payload; createdAt/updatedAt đích còn thiếu |
| pages | 186 | 0 | Raw PW1, có lịch sử đã xóa; chưa phải Payload Pages; cần converter riêng hoặc disposition được duyệt |
| media | 325 | 0 | URL metadata; writer không upload, xác minh đọc/render và ownership |
| categories | 54 | 0 | Parent/tree/timestamps; validate độ sâu, slug theo tenant; status/order runtime còn gap |
| products | 209 | 0 | Schema hiện hành, EAV/arrays/variants đã map; resolve quan hệ, kiểm soát slug/hooks và timestamp |
| customers | 54 | 0 | Đã reconcile identity; giữ aggregate/timestamp, không để Order hook tính lại |
| discounts | 7 | 0 | Đã map, inactive có chủ đích; giữ đúng đơn vị tiền và counters |
| orders | 190 | 0 | Dữ liệu lịch sử đã reconcile; 229 item refs tới Product; chặn replay nghiệp vụ |
| discount_usage_history | 0 | 0 | Master xác minh rỗng cho hai mẫu; chưa chứng minh writer cho Store khác có usage |
| blog_categories | 2 | 0 | Mapped; global slug uniqueness cần preflight |
| blogs | 7 | 0 | Lexical đã chuyển; sáu upload refs bên trong content; writer resolve sâu, renderer còn gap |
| email-template-settings | 3 | 3 | Field/timestamp đã map; writer khả thi; không đồng nghĩa tương đương layout EN/MS |
| plan-subscriptions | 1 | 1 | Main PROFESSIONAL_NON_TM_USER phù hợp tier business; kiểm chứng lifecycle/registry |
| plan-subscription-usages | 1 | 0 | Staff limit used=5; giữ dữ liệu nguồn, không reset theo logic SSO |
| notifications | 0 | 0 | Nguồn bị cách ly, không suy không có lịch sử |
| subscribers | 0 | 0 | Nguồn chưa xác minh; không coi là source-empty |
| contact-submissions | 0 | 0 | Nguồn chưa xác minh |
| analytics | 0 | 0 | Nguồn chưa xác minh |

Kiểm tra 1.920 tham chiếu ở các vị trí relationship đã map: **không có ref không phân giải được trong artifact**. Bao gồm Site SEO ogImage, Product images/categories, Order items và Blog Lexical upload. Loại khỏi phép kiểm raw Pages, Site menus/pw1_source và khai báo `_ref`. Kết quả không chứng minh đúng ownership, ID DB hay runtime.

Store 205 có bốn staff suspended. Master có cảnh báo enforcement membership/viewer hiện chưa đầy đủ; ghi đúng enum không chứng minh tài khoản bị chặn đúng. Main subscription/owner lifecycle cũng cần source evidence ngoài việc thấy giá trị đã map.

Không mở rộng Product/Order schema để thêm Brand/SKU image: master đã chốt dùng schema hiện tại. Thiếu raw Media arrays là scope đã chốt, không phát sinh blocker mới từ việc đó.

Các anchor chính: [master raw boundary](../../docs/migration/pw1-pw2-master-field-mapping.md:114), [ownership](../../docs/migration/pw1-pw2-master-field-mapping.md:313), [Site timestamps](../../docs/migration/pw1-pw2-master-field-mapping.md:414), [raw Pages](../../docs/migration/pw1-pw2-master-field-mapping.md:428), [Media](../../docs/migration/pw1-pw2-master-field-mapping.md:568), [subscription](../../docs/migration/pw1-pw2-master-field-mapping.md:1084).

## 5. Hạ tầng worktree: giữ, sửa, thay

Các đường dẫn worktree trong phần này trỏ tới working tree đang có thay đổi chưa commit, không chỉ HEAD.

| Thành phần | Bằng chứng | Quyết định đề xuất |
|---|---|---|
| Transaction chung business + ledger | [transaction.ts:39](/home/liam/data/worktrees/ech-prime-web-v2-worktree-1/src/lib/migration/pw1-pw2/transaction.ts:39) | Giữ pattern, pin Payload 3.79.0 và test lỗi/rollback |
| Active source claims | [schema:261](/home/liam/data/worktrees/ech-prime-web-v2-worktree-1/scripts/pw1-migration-schema.js:261) | Giữ uniqueness; bổ sung lookup/reuse có verify |
| Active Store exclusivity | [schema:241](/home/liam/data/worktrees/ech-prime-web-v2-worktree-1/scripts/pw1-migration-schema.js:241) | Giữ phối hợp với lease/fencing |
| Lease/fence | [lease.ts:14](/home/liam/data/worktrees/ech-prime-web-v2-worktree-1/src/lib/migration/pw1-pw2/lease.ts:14), [runner:128](/home/liam/data/worktrees/ech-prime-web-v2-worktree-1/src/lib/migration/pw1-pw2/runner.ts:128) | Giữ nếu tiếp tục checkpoint từng entity |
| Run-local resume | [runner:209](/home/liam/data/worktrees/ech-prime-web-v2-worktree-1/src/lib/migration/pw1-pw2/runner.ts:209) | Sửa binding sang master hash và mapping version; không tạo claim thứ hai |
| Existing User protection | [runner:1061](/home/liam/data/worktrees/ech-prime-web-v2-worktree-1/src/lib/migration/pw1-pw2/runner.ts:1061) | Giữ nguyên tắc không sửa credential/membership tùy tiện; đối chiếu policy master |
| Branded migration context | [migration-context.ts](/home/liam/data/worktrees/ech-prime-web-v2-worktree-1/src/lib/migration/pw1-pw2/migration-context.ts) | Tái sử dụng capability nội bộ, mở rộng cho hook thực sự cần |
| CSV/preflight/credential | [preflight:533](/home/liam/data/worktrees/ech-prime-web-v2-worktree-1/src/lib/migration/pw1-pw2/preflight.ts:533), [runner:1197](/home/liam/data/worktrees/ech-prime-web-v2-worktree-1/src/lib/migration/pw1-pw2/runner.ts:1197) | Thay bằng JSON reader; không đọc/decrypt credential PW1 |
| Canonical defaults Sprint 1 v3 | [canonical.ts](/home/liam/data/worktrees/ech-prime-web-v2-worktree-1/src/lib/migration/pw1-pw2/contracts/canonical.ts) | Không áp dụng lên master đã map |
| Media S3 pipeline | [media.ts](/home/liam/data/worktrees/ech-prime-web-v2-worktree-1/src/lib/migration/pw1-pw2/media.ts) | Thay bằng external metadata writer; không tạo storage objects mới |
| Verify | [reconcile.ts:4](/home/liam/data/worktrees/ech-prime-web-v2-worktree-1/src/lib/migration/pw1-pw2/reconcile.ts:4) | Mở rộng projection/invariants/counts đủ phạm vi; cũ chỉ bốn collection |
| Rollback | [rollback.ts:72](/home/liam/data/worktrees/ech-prime-web-v2-worktree-1/src/lib/migration/pw1-pw2/rollback.ts:72) | Giữ nguyên tắc chỉ CREATE-owned, chống external edit; mở rộng dependency graph |
| Selector | [config.ts:302](/home/liam/data/worktrees/ech-prime-web-v2-worktree-1/src/lib/migration/pw1-pw2/config.ts:302) | Bổ sung one/list/range/all, sort/dedupe ổn định |

Transaction cũ theo **entity**, không phải toàn Store. Resume có ích vì Store có thể dở. Đổi sang whole-store transaction là thiết kế mới, chưa có đo thời gian/khóa/connection để bảo đảm phù hợp Store lớn.

Không cherry-pick HEAD rồi giả định đã lấy đủ hạ tầng: nhiều file runner/schema/test chưa tracked ở worktree. Cần inventory dependency và port có chọn lọc, giữ các thay đổi sẵn có của người dùng.

## 6. DB local đã có gì và ảnh hưởng tới importer

### 6.1 Quan sát READ ONLY

| Dữ kiện | Kết quả |
|---|---|
| PostgreSQL | 16.13 |
| Migration runs | VERIFIED 1.125 run/1.125 Store; ROLLED_BACK 67 run/57 Store |
| Store 205 | Một VERIFIED v3, hai ROLLED_BACK v1 |
| Store 285 | Một VERIFIED v3 |
| Foundation active claim 205 | Tenant 1, Site 1, User 6; Media CREATE 3 và SKIP 1 |
| Foundation active claim 285 | Tenant 1, Site 1, User 1 |
| Tenant đích 205/285 | plan=free; status=active; migrationStatus=migrated |
| Site đích 205/285 | published |
| JSON mới 205/285 | Tenant business; Site draft |
| Plan feature registry | Bảy plan, mỗi plan 20 feature; toàn bộ value hiện là YES |
| Media schema vật lý | tenant_id có; filename/url/source_url nullable |
| Users email | citext và unique lower(trim(email)) tồn tại |
| Legacy run schema | pw1_app_key_fingerprint NOT NULL; credential checksum nullable |

Đây là DB local khảo sát, chưa được người dùng xác nhận là DB import đích. Không suy ra staging/production giống nó.

### 6.2 Hành vi bắt buộc khi gặp dữ liệu cũ

- Resolve source identity qua claim thật; `_ref` master và `source_entity/source_id` cũ phải có adapter namespace rõ ràng. Không dùng email, URL hoặc slug làm bằng chứng sở hữu duy nhất.
- Cùng source key không đồng nghĩa nội dung cũ đúng master mới. Đối chiếu field projection và checksum hiện tại.
- Đích đúng dữ liệu mong muốn: có thể reuse khi xác minh dependency/ownership và ghi lại evidence; không chuyển quyền sở hữu rollback của row cũ sang run mới.
- Đích khác: báo conflict theo field. Không tự đổi free→business, published→draft hay thay membership để vượt preflight.
- Nếu cần nâng cấp foundation cũ: một chế độ reconciliation có before-image, field allowlist, guard chống sửa ngoài, dependency và rollback riêng. Đây là scope tăng thêm, không gộp vào skip/retry.
- Không giải quyết bằng `ON CONFLICT DO NOTHING`: câu lệnh chỉ bỏ insert bị trùng, không chứng minh bản ghi cũ tương đương. [PostgreSQL 16 INSERT](https://www.postgresql.org/docs/16/sql-insert.html).

### 6.3 Schema migration phải tương thích thực tế

Current checkout không chứa module DDL ledger như worktree, nhưng DB local đã được cài. Cần đưa DDL/version assertions vào đường `scripts/db-setup.js` có thể tái tạo ở DB mới.

JSON profile không dùng PW1_APP_KEY, trong khi cột fingerprint legacy NOT NULL. Phải thiết kế chuyển đổi schema/profile rõ ràng, giữ lịch sử cũ; không yêu cầu credential không còn trong contract hoặc bịa fingerprint. `CREATE TABLE IF NOT EXISTS` đơn thuần không nâng cấp bảng đã tồn tại; cần ALTER tương ứng và cập nhật assertion/schema tests. Không DROP TABLE.

## 7. So sánh các đường ghi

| Đường ghi | Lợi ích | Rủi ro/chi phí | Vai trò đề xuất |
|---|---|---|---|
| Payload Local API | Field validation/auth và cấu trúc collection | Hooks sửa lịch sử, side effects, update timestamp | Dùng khi guards đã kiểm chứng; đặc biệt auth mới |
| Payload DB adapter | Tự ghi arrays/groups/relationships theo schema; không replay hooks | Bỏ qua access/validation/defaults/auth; phụ thuộc adapter; update aggregate cần thận trọng | Media metadata và ngoại lệ có validator; đánh giá lịch sử Orders qua rehearsal |
| Raw SQL toàn bộ | Kiểm soát ghi chính xác, có thể batch | Tự viết mọi bảng con/relations/auth; rủi ro drift cao | Không chọn cho toàn importer |
| Kết hợp theo collection | Giữ lợi ích validation, xử lý ngoại lệ rõ ràng | Cần registry writer và verifier riêng | **Khuyến nghị** |

Adapter không đồng nghĩa SQL viết tay: [drizzle create](../../node_modules/@payloadcms/drizzle/dist/create.js:8) gọi upsertRow với flattenedFields; [upsertRow](../../node_modules/@payloadcms/drizzle/dist/upsertRow/index.js:15) chuyển scalar/array/block/relationship. Nó cũng không đồng nghĩa Local API an toàn hơn tự động: application validation bị bỏ qua. Comment upsertRow cảnh báo replace toàn row; không dùng partial aggregate update lên dữ liệu có sẵn nếu chưa chứng minh semantics.

Không chọn adapter-only cho tất cả collection chỉ để kịp một ngày: hiện chưa có validator đầy đủ để thay mọi kiểm tra nghiệp vụ/field của Payload. Product validator có thể tái dùng, không đại diện cho 20 collection.

### 7.1 Media: đường metadata không filename

- [Media config](../../src/collections/Media.ts:117) không bật filesRequiredOnCreate=false; Local API create bình thường cần file. [Payload Uploads](https://payloadcms.com/docs/upload/overview) xác nhận default này.
- Master yêu cầu không tải/upload và không bịa filename/MIME/kích thước.
- Adapter/SQL có thể ghi url/sourceUrl và filename NULL theo schema thực tế, bỏ qua upload create pipeline. Writer phải validate alt, URL, source ownership và ref.
- [S3 afterRead](../../node_modules/@payloadcms/plugin-cloud-storage/dist/hooks/afterRead.js:5) chỉ tính lại URL khi có filename; [core URL helper](../../node_modules/payload/dist/uploads/generateFilePathOrURL.js:12) giữ URL ngoài nếu khác serverURL.
- Vì vậy không bắt buộc sửa URL hook chỉ để hỗ trợ bản ghi mới không filename. Đây là khả năng từ source, **chưa phải kết quả runtime**. Cần kiểm tra actual serverURL, đọc S3-enabled, populate relationship và render ảnh.
- Không áp dụng suy luận này cho Media cũ có filename: S3 hooks có thể sinh URL khác, không reuse theo URL đơn thuần.
- `skipCloudStorage` chỉ chặn upload hook, không chặn mọi URL hook.
- Cột media.tenant_id hiện hữu không tạo tenant access control trong [Media.ts](../../src/collections/Media.ts:144). Import metadata và cho phép tenant quản lý Media là hai gate riêng.

### 7.2 Orders và Product: bảo toàn dữ liệu đã map

- [auto-link-customer](../../src/collections/orders-hooks/auto-link-customer.ts:42) suy lại Customer từ phone, có thể set null dù JSON đã có customer ref.
- Hook này tạo/cập nhật Customer không truyền req chung; [sync-customer-snapshot](../../src/collections/orders-hooks/sync-customer-snapshot.ts:58) cũng ghi Customer và latestOrderAt, có thể để đơn cũ nhập sau ghi đè snapshot.
- [payment-status hook](../../src/collections/orders-hooks/update-payment-status.ts:26) đổi trạng thái thanh toán; [Orders](../../src/collections/Orders.ts:43) phát ORDER_NEW notification.
- [Products](../../src/collections/Products.ts:15) có slug normalization/suffix; afterChange có SEO/SSO và low-stock behavior. Phải phân biệt validation cần giữ với side effects cần bỏ qua.
- Master cập nhật trong phiên này yêu cầu Product slug unique theo tenant và không tự rewrite để né collision toàn cục. Source Products.ts vẫn unique toàn cục; READ ONLY xác minh DB local còn `products_slug_idx UNIQUE(slug)`. Helper preflight Product cũng vẫn kiểm tra slug toàn cục. Đây là blocker khi các tenant trùng slug. Đổi writer không giải quyết được unique index; sửa uniqueness cần schema migration và audit query consumer riêng, không tự gộp vào importer một ngày.
- Đường Local API cần private migration context được các hook cụ thể nhận diện. Đường adapter tránh các hook nhưng writer phải validate đầy đủ money/enum/FK/tenant/array/snapshot trước khi ghi.
- Không remap Customer hoặc tính lại tiền trong importer để khớp hook hiện hành; master là dữ liệu nghiệp vụ đầu vào đã duyệt.

### 7.3 Timestamp và transaction

- Create của adapter chỉ tự đặt createdAt khi thiếu; supplied timestamp có đường đi tới DB. Chưa có test round-trip mới xác nhận cho mọi collection.
- [Payload update](../../node_modules/payload/dist/collections/operations/utilities/update.js:245) gán updatedAt bằng hiện tại. Update lượt hai để gắn createdBy/relations có thể phá timestamp nguồn.
- Ngoại lệ thích hợp: update relationship qua Local API rồi restore timestamp bằng SQL giới hạn cùng transaction; hoặc adapter writer đã kiểm chứng cho bước đó. Không restore ở transaction khác sau khi ledger đã commit.
- [Worktree transaction helper](/home/liam/data/worktrees/ech-prime-web-v2-worktree-1/src/lib/migration/pw1-pw2/transaction.ts:39) đăng ký Drizzle transaction vào Payload sessions để business rows và ledger commit cùng nhau.
- Installed [commitTransaction](../../node_modules/@payloadcms/drizzle/dist/transactions/commitTransaction.js:12) catch resolve failure rồi reject mà không rethrow; helper hiện dùng Drizzle callback để tránh dựa vào đường commit đó.
- [getTransaction](../../node_modules/@payloadcms/drizzle/dist/utilities/getTransaction.js:6) fallback sang DB thường nếu session không còn. Phải truyền req và await mọi DB write; không để thao tác chạy sau khi callback kết thúc. [Payload Transactions](https://payloadcms.com/docs/database/transactions) mô tả cùng yêu cầu truyền req.

### 7.4 User và enrollment

- [registerLocalStrategy](../../node_modules/payload/dist/auth/strategies/local/register.js:35) tìm email toàn hệ thống; create bình thường yêu cầu password và tự tạo hash/salt.
- Không đưa legacy hash/password vào master hoặc khôi phục qua CSV; [Sprint 1 hiện hành](../../SPRINT_1_MIGRATION_PLAN.md:27) đã bỏ credential recovery PW1.
- Cần policy tạo identity PW2 chưa kích hoạt/enrollment, kiểm soát đăng nhập và reset; không gửi email/OTP trong rehearsal.
- Password ngẫu nhiên không lưu nếu cần để tạo auth row là chi tiết có thể đánh giá, không tự chứng minh khóa được mọi luồng login/SSO/reset.
- Email giống nhau không đủ xác nhận cùng người; không overwrite password/membership của account tồn tại. Bốn staff suspended trong fixture cần test quyền thực tế trước activation.

## 8. Giao diện CLI tối thiểu đề xuất

Chưa triển khai các lệnh sau:

```bash
npm run migrate:pw1:import -- --file ./master.json --store 205 --dry-run
npm run migrate:pw1:import -- --file ./master.json --range 205-285 --dry-run
npm run migrate:pw1:import -- --file ./master.json --stores 205,231,285 --dry-run
npm run migrate:pw1:import -- --file ./master.json --all --dry-run
npm run migrate:pw1:import -- --file ./master.json --store 205 --apply
npm run migrate:pw1:import -- --resume <run-id>
```

- Exactly one selector. Range inclusive, chỉ lấy Store tồn tại trong master; ID explicit không có thì error. Sort/dedupe deterministic.
- `--all` là tất cả Store trong file, không tự đọc thêm source DB/CSV. File hiện tại chỉ có hai Store.
- Input nghiệp vụ là master JSON và contract mapping. Report/hash/preview được sinh bởi tool; không bắt người vận hành tạo một master thứ hai.
- Source namespace, mapping version và target identity phải có trong metadata/cấu hình có kiểm chứng; không suy từ đường dẫn file hoặc `_ref` đơn lẻ.
- Dry-run kiểm tra DB READ ONLY, không tạo business data, không upload/gửi thông báo. Khởi tạo Payload phải tắt schema auto-push; [config](../../src/payload.config.ts:77) mặc định bật push trong local development.
- Apply ràng buộc hash artifact/phiên bản writer/schema/selector và baseline target đã kiểm tra; kiểm tra lại trước ghi. Schema setup là bước riêng có version.
- Retry cùng nguồn và writer: resume đúng run/checkpoint hoặc reuse đã verify; nguồn/contract đổi thì conflict/replan, không mù quáng skip.
- Mặc định concurrency=1. Không cần queue, dashboard hay hệ thống phân tán mới.
- Báo cáo theo Store/collection/disposition. Unknown collection/key không tự được Payload nhận; raw không được spread vào create data.
- Store còn required blocker hoặc raw chưa xử lý không được báo complete. Với batch, báo kết quả toàn bộ và exit code lỗi nếu có Store không đạt; chính sách tiếp tục sau lỗi phải rõ.

## 9. Validation đã chạy

### 9.1 Current checkout

```bash
npm test -- src/__tests__/unit/migration/pw2-product-migration.test.ts
```

Kết quả: **1 file, 36 tests passed**; Vitest reported duration 886ms. Kiểm tra pure mapping/preflight, không phải DB import.

### 9.2 Worktree

```bash
./node_modules/.bin/vitest run \
  src/__tests__/unit/migration/pw1-lifecycle-safety.test.ts \
  src/__tests__/unit/migration/pw1-security.test.ts \
  src/__tests__/unit/migration/pw1-transforms.test.ts \
  src/__tests__/unit/migration/pw1-credentials.test.ts \
  src/__tests__/unit/migration/pw1-batch.test.ts --no-cache
```

Kết quả: **5 files, 75 tests passed**, duration 1.40s. Lifecycle 26, security 11, transforms 17, credentials 4, batch 17. DB/storage mocked; fixtures tạm trong /tmp. Credential tests pass chỉ là bằng chứng logic cũ, không khuyến nghị đưa credential recovery sang importer mới.

### 9.3 Test chưa chạy

Worktree `pw1-full-cycle.test.ts` gated bởi F42_FULL_CYCLE_TEST; schema integration gated bởi F42_DATABASE_URI. Các test có ghi DB/storage không chạy trong research. **111 unit tests pass không chứng nhận JSON import, rollback thật, S3 round-trip hay thời gian toàn batch.**

## 10. Phạm vi một ngày và điều kiện chốt

### 10.1 Bốn kiểm chứng ưu tiên trước khi cam kết phạm vi

1. **Media**: ghi metadata không filename, đọc/populate/render đúng URL dưới S3-enabled; zero upload; rollback row và ledger cùng nhau.
2. **Order**: giữ Customer ref, money/payment/status/timestamps; không thêm Customer/notification; lỗi giữa chừng rollback business+ledger.
3. **User**: account mới, email đã tồn tại và membership nhiều Store; không đổi credential hoặc cấp quyền ngoài policy; suspended được chặn trước activation.
4. **Product + timestamps**: giữ slug/variants/stock và thời gian nguồn; không auto-SEO/SSO; lượt update quan hệ không làm mất lịch sử; replay không tăng row count.

Đây là công việc implementation/rehearsal sau khi thiết kế được duyệt, chưa thực hiện trong research.

### 10.2 Ước lượng một ngày có điều kiện

Giả định hai dev + một QA, DB cô lập đã chuẩn bị, JSON và write scope đã khóa. Lịch là ngân sách đề xuất, không phải kết quả đo:

| Giờ | Công việc | Gate |
|---|---|---|
| 0–1 | Chốt DB mới/existing; readiness/disposition; nguồn namespace và contract | Không còn hiểu khác nhau về raw và dữ liệu vận hành |
| 1–3 | Dev A CLI/claims/ledger; Dev B Media/Order/User/timestamp proofs; QA chuẩn bị đối soát | Bốn đường quan trọng đạt hoặc điều chỉnh phạm vi/thời gian |
| 3–5 | Hoàn thiện writer theo dependency, artifact whitelist và verifier | Không còn collection có dữ liệu nhưng bị bỏ qua âm thầm |
| 5–7 | Store 285 rồi Store 205; lỗi chủ động, resume, replay, đối soát | Zero duplicate, đúng field/quan hệ, zero side effects |
| 7–8 | Sửa lỗi, báo cáo còn thiếu, runbook; đo throughput | Chỉ công bố đạt đúng scope đã verify |

Một dev: không có cơ sở nhận đủ writer và integrated rehearsal mọi dữ liệu trong tám giờ. Existing-DB reconciliation, Page converter và functional parity làm tăng scope; không xếp ngầm vào cuối ngày.

Không đưa production cutover vào cam kết một ngày khi chưa biết số Store thực, tổng record, dung lượng, DB đích và thời gian chạy đo được. Ước lượng throughput sau rehearsal phải dùng Store đại diện về kích thước và quan hệ; Store 285 gần rỗng không đại diện commerce.

### 10.3 Điều kiện nghiệm thu

- Selector đúng và repeatable; hash/namespace/target bind đúng.
- Đối soát field/relations/timestamps/units, không chỉ count.
- Zero duplicate khi replay; resume không bỏ mất entity đã commit hoặc nhận nhầm row cũ.
- Claim và business write atomic; giữ nguyên rollback ownership của baseline cũ.
- Không email/notification/SSO/DNS/storage mutation ngoài scope.
- Raw/quarantine/unknown/verified-empty được phân biệt; chưa có converter không báo migrated.
- Runtime gaps như Page render, Blog render, membership enforcement, domain routing/payment được báo riêng; không dùng DB success thay chứng nhận vận hành.

## 11. Quyết định tiếp theo và câu hỏi còn mở

1. **DB đích**: DB mới/cô lập hay tiếp tục local có foundation? Đây là quyết định làm thay đổi thiết kế nhiều nhất.
2. **Artifact đầy đủ**: dùng mẫu 205/285 hay master khác? Hai file hiện tại không chứng minh nguồn mọi Store.
3. **Định nghĩa một ngày**: importer rehearsal có scope, hay toàn Store vận hành/production?
4. **Page/raw và gap runtime**: cần chuyển hoạt động ngay hay bảo toàn và báo disposition? Chưa mặc định phương án nào được duyệt.
5. **Nhân lực**: lịch trên giả định hai dev và một QA.
6. **Enrollment và existing identity**: chốt policy tương thích master trước writer User; không tái dùng credential pipeline cũ.

Khuyến nghị kỹ thuật đã có cơ sở: command JSON riêng + tái sử dụng control plane + writer chọn theo collection + verifier master-specific. Phần còn cần khóa trước plan thực thi là DB baseline và scope nghiệm thu; không cần xây thêm framework migration tổng quát.

## 12. Tài liệu chính thức tham khảo

- [Payload Local API](https://payloadcms.com/docs/local-api/overview): Local API chạy trực tiếp trong Node, context và overrideAccess; không bỏ mọi hook.
- [Payload Transactions](https://payloadcms.com/docs/database/transactions): req/transactionID và rủi ro async không await.
- [Payload Uploads](https://payloadcms.com/docs/upload/overview): filesRequiredOnCreate mặc định true.
- [Payload Database](https://payloadcms.com/docs/database/overview): ranh giới database adapter; hành vi cụ thể đối chiếu mã 3.79.0 cục bộ.
- [PostgreSQL 16 INSERT](https://www.postgresql.org/docs/16/sql-insert.html): unique constraint và ON CONFLICT không tự xác nhận tương đương nghiệp vụ.
