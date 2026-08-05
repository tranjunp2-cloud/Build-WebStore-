---
owner: QA Lead + Engineering Lead
status: draft-pending-approval
plan: ../../plans/260805-qa-control-center/plan.md
created: 2026-08-05
---

# PRD — F40 QA Control Center

## 1. Vấn đề

Tester hiện phải ghép thủ công issue, PR, thay đổi code, test file, kết quả CI và bug report. Chạy cả dự án vừa chậm vừa làm nghẽn QC, trong khi chạy một test đơn lẻ không cho biết còn dependency nào bị ảnh hưởng.

## 2. Mục tiêu sản phẩm

Tại `/studio/qa`, tester quan sát **sức khỏe toàn bộ CMS**, nhận kết quả test tự động sau khi PR được deploy lên QC và chỉ chạy/retest thủ công những target có rủi ro. Mỗi pack trả về automated result, manual checklist, evidence, coverage gap và finding để tester review trước khi chủ động tạo GitHub ticket.

`/studio/qa` chỉ là workspace nội bộ để điều phối QA trong MVP; **Studio admin không nằm trong product surface cần test**. Target catalog chỉ cover CMS seller, Editor/Builder, public storefront, checkout và các platform integration phục vụ CMS.

### Chỉ số thành công MVP

| Chỉ số | Mục tiêu sau pilot 4 tuần |
|---|---:|
| Thời gian chọn và khởi tạo pack | ≤ 3 thao tác, ≤ 1 phút |
| Target pilot có pack hợp lệ | 3/3 |
| Run có summary được ingest | ≥ 95% |
| Run lỗi do fixture conflict | < 5% |
| Finding có trace PR/test/evidence | 100% |
| PR deploy QC có impact snapshot hoặc coverage gap | 100% |
| Tester tự chạy lại full regression hằng ngày | 0 lần mặc định |

## 3. Người dùng và Jobs-to-be-done

| Người dùng | Khi | Muốn | Để |
|---|---|---|---|
| Tester | Dev bàn giao một màn hình/flow | Chạy đúng regression pack | Không bỏ sót API/function/dependency liên quan |
| QA lead | Chuẩn bị release | Xem coverage gap, block và finding | Đưa quyết định dựa trên evidence |
| Developer | Nhận bug | Trace về PR/SHA/TC-ID/evidence | Sửa và verify nhanh |
| BA/UX | Thay đổi AC hoặc UX flow | Thấy impact đến test pack | Cập nhật scope/test trước khi release |

## 4. Phạm vi MVP

### Trong phạm vi

- Studio route `/studio/qa` chỉ cho super-admin trong MVP.
- Project Health hiển thị toàn bộ 67 target CMS ngay từ MVP, grouped theo domain và trạng thái Healthy/Watch/Needs attention/Critical/Unknown.
- Target registry cho `screen`, `user_flow`, `feature`; mỗi target luôn công khai mức coverage: automated, partial, manual-only hoặc unknown.
- Sau deploy QC, tự tạo change-impact và tự chạy Smoke pack đã map; Regression rộng chỉ chạy theo lịch/release hoặc khi QA chủ động chọn.
- Kết quả UI/E2E, API/unit, manual, visual/quality, health/performance khi pack khai báo.
- Change impact từ PR/SHA sang target/test pack; `coverage_gap` rõ ràng khi chưa map.
- Project Health, Feature Health Detail, QA Inbox và finding lifecycle; GitHub ticket chỉ tạo sau hành động xác nhận của tester.

### Ngoài phạm vi MVP

- Chạy full-project bằng nút mặc định, chạy command tự do từ browser, test trên production.
- Tự tạo/đóng bug, tự approve release, thay thế GitHub Actions/Sentry/Studio Issues.
- Lưu raw log, cookie, request body, PII, screenshot/trace nhạy cảm vào Payload.
- Role tester riêng trước khi có RBAC policy và acceptance test.
- Kiểm thử tính năng Studio admin (templates, blocks, packs, generations, Studio analytics/settings) như target product.

## 5. Nguyên tắc nghiệp vụ

1. Một run luôn gắn `targetId`, `packId`, `packVersion`, profile, environment và SHA.
2. `passed` chỉ áp dụng cho test thực sự chạy và pass. `skipped`, `blocked`, `unmapped`, `manual_pending` không được hiển thị là pass.
3. Health không được suy diễn chỉ từ lần test pass gần nhất. Nó kết hợp test outcome, open finding, coverage, flakiness, change risk và độ mới của lần chạy.
4. `Healthy` chỉ hiển thị khi không có finding nghiêm trọng, run cần thiết pass và coverage đạt ngưỡng; dữ liệu thiếu là `Unknown`, không phải xanh.
5. Visual diff hoặc test fail chỉ tạo finding nội bộ; tester review expected/actual/evidence trước khi tạo GitHub ticket.
6. Target chỉ chạy trên QC environment đã được phép; performance/full regression là release-only activity.
7. Test pack có precondition, fixture lease, dependency và cleanup contract; không chạy nếu không thỏa.
8. Mọi finding phải có fingerprint, owner/status và safe evidence; việc tạo GitHub ticket luôn do người dùng xác nhận.

## 6. User stories và Acceptance Criteria

### US-QA-01 — Nhận kết quả tự động sau deploy QC

**Là tester**, tôi muốn Studio tự chạy smoke pack liên quan sau khi PR được deploy QC để không phải lặp lại regression thủ công.

```gherkin
GIVEN một PR đã deploy thành công lên QC với SHA xác định được
WHEN changed paths được resolve qua coverage map
THEN hệ thống tạo impact snapshot và tự dispatch Smoke pack cho target đã map
AND path chưa map tạo coverage gap trong QA Inbox, không tự coi là covered

GIVEN Smoke pack không có fixture/capacity hợp lệ
WHEN dispatcher đánh giá precondition
THEN run được ghi blocked với lý do và không làm bẩn QC data
```

### US-QA-02 — Xem Project Health và QA Inbox

**Là tester**, tôi muốn nhìn tổng quan feature nào khỏe, cần theo dõi hoặc đang lỗi để ưu tiên đúng việc trong ngày.

```gherkin
GIVEN tôi mở `/studio/qa`
WHEN dữ liệu health được tải
THEN tôi thấy QA Inbox ưu tiên Critical, Needs attention, Watch và coverage gap
AND Project Health nhóm target theo CMS domain với last run, coverage, open finding và change risk

GIVEN một target thiếu dữ liệu hoặc chưa có pack
WHEN health được tính
THEN target hiển thị Unknown, không hiển thị Healthy
```

### US-QA-03 — Xem Feature Health Detail và evidence

**Là tester**, tôi muốn mở một feature để biết chính xác scenario nào lỗi và cần retest gì.

```gherkin
GIVEN target Product Grid có test variant fail
WHEN tôi mở Feature Health Detail
THEN tôi thấy TC-ID, fixture, expected/actual, run/PR/SHA, screenshot hoặc trace an toàn và action retest
AND finding được phân loại product, infrastructure, flaky hoặc blocked

GIVEN visual comparison vượt threshold
WHEN tôi xem finding
THEN tôi thấy baseline/current/diff để xác nhận thay đổi hợp lệ hay là UI regression
```

### US-QA-04 — Chọn target và chạy/retest pack

**Là tester**, tôi muốn tìm màn hình/flow/feature và xem trước test sẽ chạy để không khởi tạo workload không cần thiết.

```gherkin
GIVEN tôi là super-admin và QC đang khả dụng
WHEN tôi chọn một target đang active và profile Smoke hoặc Regression
THEN tôi thấy TC-ID, loại test, manual checklist, precondition, fixture, ước lượng thời gian và environment
AND tôi chỉ có thể xác nhận khi mọi precondition/capacity đều hợp lệ

GIVEN target chưa có pack hoặc pack đã deprecated
WHEN tôi mở target
THEN hệ thống hiển thị coverage gap và không cho chạy một command tùy ý
```

### US-QA-05 — Nhận gợi ý impact từ PR

```gherkin
GIVEN một PR có head/base SHA và changed path hợp lệ
WHEN change-impact snapshot được tạo
THEN tester thấy target/test pack liên quan, mức độ tin cậy và path chưa map
AND snapshot không đổi khi PR được cập nhật; commit mới tạo snapshot mới
```

### US-QA-06 — Theo dõi run và kết quả

```gherkin
GIVEN tester đã dispatch một pack
WHEN GitHub/QC đang xử lý
THEN Studio hiển thị queued/running, vị trí queue hoặc lý do capacity blocked
WHEN run hoàn tất, fail, cancel hoặc timeout
THEN Studio hiển thị summary, TC-ID, evidence an toàn và status phân loại
```

### US-QA-07 — Triage và verify bug

```gherkin
GIVEN một test result fail
WHEN tester review và tạo finding hoặc GitHub ticket
THEN finding lưu fingerprint, status, owner, run/PR/TC-ID/evidence và không tạo duplicate cho cùng lỗi đã biết
AND GitHub ticket không được tạo tự động bởi test runner
WHEN developer sửa lỗi và tester chạy lại cùng target pack
THEN finding được verify-fix hoặc reopen theo kết quả mới
```

### US-QA-08 — Bảo mật và vận hành

```gherkin
GIVEN người dùng không có QA capability
WHEN truy cập page hoặc API QA
THEN hệ thống từ chối và không lộ run, artifact hay GitHub credential
GIVEN GitHub delivery bị sai chữ ký, quá hạn hoặc replay
WHEN endpoint ingestion nhận payload
THEN hệ thống từ chối write và ghi audit metadata an toàn
```

## 7. Quyết định chờ duyệt

| Quyết định | Đề xuất MVP | Owner duyệt |
|---|---|---|
| Quyền sử dụng | Super-admin-only; QA Lead: Ary – Phạm Thị Thảo Ngân | Engineering Lead + QA Lead |
| Phạm vi Project Health | Tất cả 67 target CMS; Studio admin loại trừ | QA Lead |
| Nhóm kiểm chứng automation đầu tiên | Product Grid variants, Order payment verification, Checkout payment | QA Lead |
| Môi trường chạy tự động | Staging/QC, tuyệt đối không production | QA Lead + Engineering Lead |
| Kết nối GitHub runtime | GitHub App/token server-side riêng; MCP chỉ phục vụ phiên làm việc của trợ lý | Engineering Lead |
| QC capacity | 1 Regression + 2 Smoke runs; fixture lease bắt buộc | DevOps/Engineering Lead |
| Retention summary | 90 ngày; raw artifact theo policy GitHub hiện có | Engineering Lead |
| Release gate | Advisory trong pilot; override phải audit | QA Lead + Engineering Lead |

## 8. Rollout

MVP đưa toàn bộ 67 target CMS lên Project Health với coverage và trạng thái trung thực. Trong 2 tuần đầu, kiểm chứng automation sau deploy QC trên Product Grid variants, Order payment verification và Checkout payment; quan sát dispatch, queue time, flake, false-positive visual diff và ingestion. Sau đó mở rộng automation theo risk tier, không phải mở rộng catalog.

## 9. Story source of truth

Backlog delivery, Acceptance Criteria và Definition of Done theo từng đơn vị PR nằm tại [`F40-qa-control-center-stories.md`](../stories/F40-qa-control-center-stories.md). Mỗi `US-F40-xx` tương ứng đúng một GitHub Issue, branch và PR vào `staging`.
