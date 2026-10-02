# Phase 10 — Truy vết toàn bộ F40 migration test và QC cutover

**Owner:** QC lead + F40; F42 chịu field evidence, các owner Content/Media/SSO/Visual chịu test tương ứng. **Estimate:** audit gap trước, sau đó ước lượng theo owner; không cộng vào 27–45 dev-days của Phase 01–07. **Dependency:** cùng revision staging QC và run/fixture Phase 07; Page/Block Phase 08 nếu claim full F40. **Deliverable:** execution matrix từng TC/AC với PASS/FAIL/NOT_RUN/BLOCKED, evidence URL/log an toàn, owner và quyết định gate.

## Baseline cần khóa trước test

1. Ghi commit F42/F40, schema/contract/registry versions, staging URL, Source Store ID số, child UUID VERIFIED, generation ID/digest, fixture type và source snapshot. Với các test không dùng child run, ghi rõ nguồn/runner riêng.
2. Đối chiếu [`TEST_PLAN_MIGRATION_PW1_PW2.md`](../../docs/qa/TEST_PLAN_MIGRATION_PW1_PW2.md) với [`F40-qa-control-center.md`](../../docs/qa/F40-qa-control-center.md) và AC trong [`F40-qa-control-center-stories.md`](../../docs/stories/F40-qa-control-center-stories.md). Test plan dùng mốc **2.000 Store**, trong khi QA F42 đã ghi các rehearsal ledger lớn hơn; QC phải khóa dataset/count thực tế và giải thích chênh lệch trước TC-MIG.02. Không dùng `scan_batch` canned count làm proof.
3. Mỗi PASS cần expected/actual, command hoặc browser/manual evidence, timestamp, owner và revision. Test cũ `[x] AUTO` chứng minh có test code, chưa chứng minh PASS trên staging hiện tại. Synthetic fixture chỉ chứng minh comparator/UI; importer fixture thật chứng minh real run.

## Matrix bắt buộc

| QC case / AC | Proof phải thu trên staging | Owner / kết luận nếu thiếu |
| --- | --- | --- |
| TC-MIG.01 PW1 read-only | Quyền MySQL PW1 chỉ SELECT, thử lệnh ghi bị chặn; nếu F40 chỉ dùng bound artifact, ghi rõ connector legacy nào còn chạy và audit read-only ở đó | PW1 DBA/F40; NOT_RUN nếu không có môi trường/credential test được duyệt |
| TC-MIG.02 batch scan và phân loại Store | Quét dataset được QC khóa, total/Pass/Warning/Fail đối chiếu DB và source inventory; scan job có pagination, timeout/retry, audit. Bỏ canned 2.000 và `approve_pass` stub | F40/QC; BLOCKED nếu baseline hoặc real scan chưa có |
| TC-MIG.03 Product/Variant | Product/SKU identity, size/color/capacity, Brand ID, name/slug, giá, stock theo SKU/location; kiểm P0 không mất variant/sai đơn giá trên sample QC và coverage toàn scope | F42/F40/QC; field unsupported/unverified không được tính match |
| TC-MIG.04 RichText table và TC-MIG.06 UTF-8 | So source/target content an toàn, bảng 3 cột giữ cấu trúc Lexical, không mojibake; browser/manual sample có nguồn thật | Content/F40; ngoài Commerce evidence, BLOCKED nếu chỉ có demo |
| TC-MIG.05 media HTTP 200 | Banner/Product media identity, alt/dimensions và URL live check có timestamp, 100% theo mẫu số được ký | Media/F40; count/identity evidence không thay HTTP probe |
| TC-MIG.07–08 visual/mobile | 9 canonical themes, swipe/overlay, desktop và 375px trên storefront thật; manual sign-off và screenshot theo template/Store | Visual/F40/QC; component registry hay iframe 200 không là visual pass |
| TC-MIG.09 Merchant SSO | Login/redirect/dashboard và dữ liệu sau cutover trên staging-safe path; ghi thời gian theo AC và account fixture đã che | SSO owner/QC; không suy từ migration identity |
| TC-MIG.10 QC Pass chặn P0 | Thử approve khi P0 OPEN phải bị từ chối; khi đủ điều kiện mới có persisted decision, actor/time/audit; không dùng success stub | F40/QC; BLOCKED nếu workflow chưa có gate thật |
| Test plan SEO 301 và parity/cutover | Kiểm redirect cũ→mới, chuẩn parity ≥99% với mẫu số/exclusions được ký, 0 P0 và các gate media/theme/SSO | SEO/QC; quyết định cutover riêng, không tự động từ generation complete |

## AC của F40 inspector cần giữ khi tích hợp

- **US-F40-11 AC-1/1a/2:** bảy nhóm Products, Variants, Banners, RichText, Menus, Categories, Shop Settings; grid field PW1/PW2; lọc theo page owner và entity shared xuất hiện trên từng page; remediation chỉ là hướng dẫn được review, không thực thi script từ UI. Nếu nguồn F42 chỉ cover Commerce/Settings, giữ provider F40 khác cho nhóm còn lại và ghi `source`/coverage của từng tab.
- **TC-F40-11-07–10:** `Chỉ Lỗi` dựa trên field; Product nhiều SKU có identity riêng; meaningful match khác `matched_empty`, stale value không match; demo `SITE-0001` chỉ dùng cho UI fixture. Target-only/orphan là anomaly F40-11 riêng ngoài sáu status F42.
- **US-F40-13 / TC-F40-13-07–08:** approved Page/Block crosswalk và on-demand live runner phải xác nhận đúng PW2 layout block, không lộ customer data. Phase 08 là implementation gate.
- **US-F40-14 / TC-F40-14-01–03:** không đoán match từ SKU/email/order code; Super Admin mở Commerce/Settings, filter từ real run và demo có nhãn; adapter versioned. Test mới cho field evidence cần TC-ID riêng theo `docs/TEST_CONVENTION.md`.
- **US-F40-09/10/12:** batch dashboard, Media/RichText audit, visual slider/mobile là gate độc lập; kiểm regression trên staging cùng revision sau khi tích hợp API F42.

## Mẫu số và quyết định QC

QC ký **hai mẫu số** trước khi chạy: source sidecar chụp selected CSV trước lọc (kể cả phần exporter không emit) và emitted importExpected (chỉ phần phải nạp PW2). Parity `match/importExpected` chỉ mô tả fidelity của phần emitted; báo riêng tỷ lệ/đếm source → emitted và approved policy exclusions. Báo thêm `match/eligible`, meaningful match, `unsupported`, `unverified`, target-only và exception count; không loại unsupported/unverified ngầm để đạt 99%. QC không cần CSV; nếu artifact cũ thiếu cả CSV và sidecar đáng tin cậy thì full-source field integrity là BLOCKED dù emitted-run parity đẹp. TC-MIG.03 còn yêu cầu không mất biến thể/giá sai ở dữ liệu P0, nên aggregate ≥99% không thể miễn P0. Không có data source, runner hoặc expected baseline thì ghi BLOCKED/NOT_RUN cùng owner và hành động cần làm.

## Done khi

- Matrix có một dòng cho từng TC-MIG.01–10 và từng AC/TC F40 liên quan, kèm proof hoặc gap/owner. TC mới theo QA convention được thêm trước implementation; Playwright kiểm real browser flow cho route/page mới.
- QC đã chạy lại trên staging revision được bàn giao; old mock/demo, PR merged, `[x] AUTO` hay synthetic comparator không được ghi thành PASS của Store thật.
- Chỉ kết luận **F40 migration test đầy đủ/cutover ready** khi không còn gate bắt buộc ở trạng thái FAIL/NOT_RUN/BLOCKED, 0 P0, parity/media/theme/SSO theo policy được ký và manual sign-off đủ. Nếu chưa đạt, handoff Phase 09 chỉ tuyên bố Commerce/Settings field evidence ready trong phạm vi đã chứng minh.
