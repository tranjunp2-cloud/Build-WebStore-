# Context mới nhất — 2026-09-15

Phần này thay thế trạng thái cũ bên dưới. Branch vẫn là `levietducprime/research-f35-spike-f35-11-nghi-n-c-u-t-i-t-o-web`. User yêu cầu lưu context và commit/push; chưa yêu cầu merge hoặc triển khai production.

## Việc tiếp theo: footer AI (đã điều tra, CHƯA sửa)

- User thấy footer các site gần như giống nhau dù migrate qua AI. DB của 30 site: 28 `simple`, 1 `centered-stack`, 1 `dark-gradient`.
- Footer global dùng chung giữa các page của cùng site là chủ ý. Vấn đề là lựa chọn giữa các site thiếu đa dạng/phù hợp nội dung.
- `src/lib/migration/pw1-native-ai.ts`: schema/prompt chỉ mở simple/centered-stack/dark-gradient, bỏ sót minimal có trong footerMeta. User prompt chỉ có site name và page components, KHÔNG gửi source.site.footer/navigation cho AI chọn layout.
- Hướng đã giải thích: truyền đủ nội dung footer, dùng danh sách variant native hiện có; để AI chọn phù hợp nội dung, không random chỉ để khác nhau. User đồng ý rồi yêu cầu bàn giao trước. Chưa implement hướng này.

## Trạng thái migrate hiện tại

- 30/30 store completed kèm warnings sau nhiều lượt retry, không phải một lượt full đều thành công.
- Tất cả 30 site đã publish trên LOCAL theo yêu cầu test; kiểm tra anonymous homepage HTTP 200 đủ 30. Không publish production.
- Link: `http://localhost:3000/sites/pw1-{storeId}`. `/preview/{siteId}` không phải link anonymous.
- Store IDs: 205,1047,1127,1111,1044,1042,1041,1036,1033,1004,1023,986,963,959,957,949,627,602,645,253,655,416,185,567,18,743,939,495,257,546.
- Input riêng ngoài Git: `~/Downloads/stores-205-285-pw2-current-schema-collection-only(1).json`, 30 bundles. Full PW1 source archives và reports: `~/Work/pw1-exports/reconstruction/`. Các file này/DB/storage không đi theo git push; máy khác cần bản copy riêng hoặc export lại.
- DB local localhost:5433/primeweb, Docker primeweb-db; PW1 snapshot chỉ đọc. Backup trước reset gần nhất `/tmp/pw1-before-full-30-rerun-20260915.dump`.
- Lượt full gần nhất d1c65e1a-252c-45a8-a5f5-203dbe1cbfb8: 22 success / 8 fail / 0 skip, 58.209s chưa tính reset. Retry các fix sau đó đạt 30. Không dùng số này làm cam kết throughput 1350 store.

## Những thay đổi trong lần commit này

- P0/P1 batch reliability: DB ledger/report JSON/CSV, retry classification, limits/readiness, receipt/recovery, rollback website write, cleanup media lỗi sau khi drain batch. Xem `docs/migration/pw1-website-cli.md` và `plans/260914-pw1-batch-reliability/plan.md`.
- Một lệnh npx/CLI, Promise pool trong process, mặc định 2 tối đa 5. AI/media chuẩn bị song song; ghi website tuần tự, cùng source account tuần tự. Không external worker.
- Fix transaction PG: pin connection vì nhiều bản pg làm Drizzle nhận nhầm Pool. Regression integration scripts trong scripts/tests; không chạy trên shared/production DB.
- User yêu cầu bỏ host allowlist: đã bỏ, giữ HTTPS/no credentials/custom port, redirect:error, timeout30s/10MiB. ICO dùng MIME set và uploader chung PW2, filename .ico. Store185 đã pass và favicon HTTP200.
- Banner store18: nút status=0 thì bỏ qua mode/default và URL CTA; không đọc object từ mảng rỗng khi disabled. Giữ ảnh/banner. Đã retry pass.
- URL page: ưu tiên trường url nguồn thay vì slug cũ. Store257 trước đó 3 URL khác nhau nhưng slug đều new-page-1; đã pass.
- Cùng store trùng URL: DB CÓ unique index pages_site_slug_uniq (site_id,slug) WHERE deleted_at IS NULL. Không bỏ index. Giữ đủ page ID; trang đầu giữ route, trang trùng gán suffix -pw1-PAGE_ID tránh collision. Chỉ một homepage. Page-ID links được remap, URL links nguyên gốc không đoán page. routeChanges/warnings ghi lại URL gốc và mới. User sẽ tự xóa trang dư. 1036/986 giữ 8 page nguồn mỗi store +404, đã pass.
- Storefront 404 subpages: migration lưu bare slug nhưng route tìm leading slash. Owner và cached visitor lookup nhận cả hai; cache key v2 để tránh cache miss cũ. Store253 E2E thật click cả3 menu rồi reload anonymous HTTP200. Test ở tests/pw1-migrated-page-routes.spec.ts cần fixture local published253; đã chạy Chrome installed bằng config tạm (đã bỏ).

## Validation và giới hạn

- Lượt tổng unit gần đây 149 tests pass trước fix disabled CTA; sau đó thêm CTA regression, suite collection5 tests pass. TypeScript pass sau các thay đổi. Real migration và read-back đã dùng để xác nhận ICO, duplicate pages, CTA.
- Chạy lại toàn bộ tests migration + tsc trước commit bàn giao để ghi số mới nhất trong phản hồi.
- Known warnings còn nguyên: BE products/blog import riêng, source mapping chưa xác minh, một số CTA/filter/search chưa hỗ trợ. Completed không có nghĩa đã đạt toàn bộ parity PW1.
- Không đưa secret, token, account password, full dump hoặc input khách hàng vào Git.

---

## Lịch sử bàn giao trước (có thông tin đã cũ)

# Context bàn giao — PW1 migration & Rich text PW2

Cập nhật: 2026-09-11. Đây là bản tóm tắt context để tiếp tục trên máy khác, không phải transcript nguyên văn. Đọc file này trước khi sửa code tiếp.

## Điểm tiếp tục

- Branch: `levietducprime/research-f35-spike-f35-11-nghi-n-c-u-t-i-t-o-web`.
- Commit implementation mới nhất tại thời điểm viết: `dd3c66dc0` — `feat(f35): support pw1 collection imports and inline rich text editing` (35 files).
- Commit trước đó: `5d46971d9` — migration CLI batch.
- Người dùng đã yêu cầu commit/push tất cả thay đổi và bàn giao context để làm ở nhà. Không có yêu cầu merge, publish hay migrate production.
- Việc cuối cùng đã làm: ẩn nút Media, thu gọn ô font 140px/cỡ chữ 64px, thêm border và nền trắng cho ô Site font. Đã commit trong `dd3c66dc0`.

## Ý định và quyết định đã chốt

1. Migrate theo **store**, không theo từng user. Một user có thể có nhiều store.
2. Đầu vào **một file JSON chứa một array**; một script đọc và xử lý tất cả. Không sinh nhiều file JSON trung gian cho từng user/store. Mục tiêu tương lai hơn 1.300 users, chưa nghiệm thu quy mô production.
3. SQL dump PW1 đã restore trong Docker trên máy làm việc. Extract/convert SQL → JSON là bước riêng bên ngoài migration script.
4. Script phải gọi flow **generate website thật** của PW2 và lưu vào account đích, không chỉ xuất website JSON, không truyền sẵn `generatedResult`.
5. Giữ nội dung/cấu trúc component PW1, dùng block native PW2, có thể làm đẹp theo PW2; không cố dựng lại pixel-perfect website cũ.
6. Filter page/component/banner bị disabled/deleted. Bỏ menu trỏ page đã xóa, promote children hợp lệ.
7. Product listing dùng Products Grid lấy DB PW2. Blog listing dùng Blog List lấy DB PW2. DB trống thì block trống, không bịa data hoặc lấy snapshot làm product/blog giả.
8. BE import commerce/blog riêng. Brand CTA tạm bỏ; giữ ảnh/tên brand, chưa làm link. Category CTA vẫn cần map sang category đích (chưa xong).
9. Cart/order tracking phải bật tính năng native. Header search và một số filter/sort vẫn pending.
10. Không commit credentials hoặc dump dữ liệu khách hàng vào repo.

## Flow migrate hiện tại

Lệnh:

```sh
npm run migrate:pw1 -- /path/to/input.json --dry-run
npm run migrate:pw1 -- /path/to/input.json
npm run migrate:pw1 -- /path/to/input.json --rerun
```

- Lệnh không cần arg env/account/site/output/apply. Đọc `.env.local`/`.env`; biến môi trường đã có được ưu tiên.
- Mặc định apply; dry-run không gọi AI/ghi DB. `--rerun` regenerate store đã hoàn tất, kể cả input không đổi. Chỉ replacement draft site.
- Ledger DB giữ mapping/progress/retry, skip completed input không đổi; xử lý tuần tự; lock chống batch đồng thời.
- File đầu vào hỗ trợ cả compact website array và **BE collection-bundle array mới**.
- Luồng: CLI → parse/validate toàn bộ array → `runPw1Batch` → adapter → native blueprint → `applyPw1Website` → shared `generateSiteService` → native AI design + deterministic binder → import media/persist pages.
- Không import products/orders/blog bodies; không publish site. Generate/page replacement không phải một transaction hoàn chỉnh; retry có thể trùng media.

Mapping chính:

| PW1 | PW2 |
|---|---|
| Hero banner | Hero; nhiều slide dùng slideshow, không tách mỗi slide thành block |
| Small banner | Carousel images/cards |
| Category listing | Một Carousel cards |
| Product listing | Products Grid, data DB PW2 |
| Article listing | Blog List, data DB PW2 |
| Rich text | Block slug `custom-html`, tên UI **Rich text**; một số embed được script tách thành Video |

File code chính:

- `scripts/migrate-pw1.ts`: CLI duy nhất.
- `src/lib/migration/pw1-collection-input.ts`: adapter BE export mới, tự đọc domain/menu/nested component/model_settings/banners/shortlists.
- `src/lib/migration/pw2-website-input.ts`: adapter compact input.
- `src/lib/migration/pw1-batch-input.ts`, `pw1-batch.ts`: validate/hash, provision account/tenant/site, ledger và orchestration.
- `src/lib/migration/pw1-contract.ts`, `pw1-native-ai.ts`: contract/blueprint, chọn native block và bind nội dung.
- `src/lib/migration/pw1-media.ts`, `pw1-apply.ts`: media, backup/ownership, shared generation.
- `src/lib/ai/generate-site-service.ts`: service dùng chung API và CLI.
- `scripts/sql/pw1-migration-batch.sql`, `scripts/db-setup.js`: ledger/schema.
- `docs/migration/pw1-website-cli.md`: mô tả CLI chi tiết.

Giữ các block legacy `rich-text`, `content-cards` và Hero sourceLayout vì DB cũ còn dùng. Không xóa chúng nhầm với Rich text mới.

## Data và môi trường máy làm việc — KHÔNG đi theo git

Máy làm việc đã dùng:

- Input BE mới nhất: `~/Downloads/stores-205-285-pw2-current-schema-collection-only(1).json`. Tên vẫn có 285 nhưng người dùng đã xóa store 285; bản kiểm tra chỉ còn **205**.
- Compact input cũ: `~/Work/pw1-exports/reconstruction/amelina.website-input.v1.json`.
- Website PW1 đối chiếu: `https://amelina.web.dev.ecommercehub.my/`.
- Mapping DB local đã dùng: source store 205 → user 1847, tenant 1821, site 3659; owner `amelina@yopmail.com`.
- Preview/editor local: `/preview/3659`, `/editor/3659` trên localhost:3000.
- Batch BE cuối cùng thành công trước đợt sửa Rich text: 9 content pages + 404, locale MS; có runtime pages/filter components được bỏ hoặc báo pending.
- Export/log/screenshot thường nằm ở `~/Work/pw1-exports/reconstruction/`; các script Playwright kiểm tra gần đây nằm ở `/tmp/`. **Không giả định chúng tồn tại trên máy ở nhà.**
- Có account thử thứ hai `amelina2@yopmail.com`; không dùng nó để suy ra mapping store chính.

Để tái hiện ở nhà, cần chuyển file input và cấu hình `.env.local` qua kênh riêng, và truy cập/copy DB, object storage tương ứng. Git không mang DB, Docker volumes, media hay secret. **Không giả định ID 3659/1847/1821 có cùng ý nghĩa ở DB khác.** Không dùng production env để thử script. Kiểm tra dry-run và DB đích trước khi apply.

Source PW1 dùng đối chiếu nằm ngoài repo PW2:

- `~/Work/primeweb-cms-frontend/src/components/WebBuilder/Page/Edit/EditConfigRichText.vue`
- `~/Work/primeweb-cms-frontend/src/components/Editor/VCKEditor.vue`
- `~/Work/primeweb-cms-frontend/src/utils/ckeditor.js`
- `~/Work/primeweb-frontend-v2/src/assets/style/ckeditor.less`

Nếu cần nghiên cứu tiếp ở nhà thì cần checkout hai repo PW1 tương ứng. Source local chưa được xác nhận là đúng revision đang deploy production.

## Hero / Carousel đã sửa

- Hero slideshow có Next/Prev cùng style Carousel.
- Ratio Hero slideshow thống nhất 16:9, không đổi chiều cao theo từng slide có/không có text.
- Autoplay vẫn **5 giây**. Next/Prev/dot reset đủ 5 giây, kể cả bấm dot đang active. Không tự đổi thành 3 giây: đó chỉ là ví dụ của người dùng.
- Khoảng cách tâm dot giảm từ 52px xuống 24px; hit area 24×44px. Carousel đã đồng bộ dot.
- Chưa có UI cấu hình animation/timing/add-slide hoàn chỉnh như PW1; xem component gap report.

## Rich text hiện tại: Tiptap, không phải CKEditor

Lịch sử quyết định UX:

- Ban đầu dùng CKEditor trong modal, sau đó inline rồi floating; người dùng không hài lòng modal, khung to, nút Apply/Cancel lớn, block nhảy chiều cao.
- Đã chuyển sang **Tiptap** để tùy biến UI và không có badge. Không chuyển ngược CKEditor hoặc ẩn badge CKEditor bằng CSS.
- Rich text giữ slug/schema `custom-html` + trường `html`, chỉ đổi tên UI để dữ liệu cũ vẫn dùng được; không đổi schema DB.
- Bấm nội dung để sửa. Không có dòng “Edit rich text inline”, không có modal, không có hàng nút Apply/Cancel.
- Toolbar hiển thị **toàn bộ tool**, ghim đầu block, full width; màn hình hẹp xuống hàng. Không dùng More tools.
- Giữ viền xanh 2px và block action bar (kéo/nhân bản/AI/xóa). Có offset bar để tránh đè toolbar.
- Giữ nội dung readonly đến `onReady` để tránh nháy trắng; test từng thấy 14 frames trắng, sau fix 0.
- Click ngoài áp dụng thay đổi; Esc hủy phiên sửa; Undo qua editor store. Khi chưa thay đổi, không serialize lại vô ích.
- **Media toolbar hiện đã ẩn theo yêu cầu**, nhưng extension/sanitizer giữ media có sẵn. Video mới nên dùng native Video block.

Files:

- `src/components/editor/RichTextBlockEditor.tsx`: Tiptap + full toolbar + upload + edit lifecycle.
- `rich-text-block-editor.css`: UI và nodeview CSS.
- `rich-text-image.ts`: inline/left-wrap/right-wrap/standalone; spacing, resize, alt, caption, percent width; ResizableNodeView riêng.
- `rich-text-extensions.ts`: giữ wrapper/class/style và caption nguồn.
- `normalize-pw1-rich-html.ts`: chuẩn hóa CKEditor figure/image-inline, caption có định dạng và percent width; bỏ figure.media rỗng.
- `rich-text-media.ts`: media atom/nodeview. Placeholder “Embedded media” đã bị bỏ, node media không có preview không hiện chữ đó nữa.
- `rich-text-colors.ts`: màu HSL/RGB/named → hex cho picker.
- `src/blocks/custom-html/html-safety.ts`: sanitize dùng chung editor/renderer; media provider allowlist; không cho srcdoc/iframe tùy ý.
- `src/blocks/custom-html/index.tsx`, `rich-text-content.css`: renderer, active border và preserve readonly lúc loading.
- `src/components/editor/PreviewFrame.tsx`: message lifecycle, update store + UPDATE_BLOCK_DATA về iframe; active Rich text index riêng với selected/hover.
- `SettingsPanel.tsx`, `BlockLibraryPanel.tsx`, block registry/meta, add-section: tên và hỗ trợ thêm block.

Tính năng đã thêm:

- Heading, bold/italic/underline/strike/code, list, alignment, link, quote, undo/redo.
- Font PW1 gồm Tahoma, font hiện tại; cỡ tùy ý px/em/rem/% và presets 9/11/13/17/19/21…; picker chuẩn hóa HSL/RGB.
- Ảnh upload/URL, resize, alt, spacing, 4 layout. **Không có text tự chảy cả 4 phía quanh ảnh giữa**; CKEditor 5 cũng không có mode này mặc định.
- Caption toggle/edit. Caption HTML nguồn giữ định dạng đến khi sửa qua ô text caption (lúc đó thay bằng plain text người dùng nhập).
- Giữ ảnh width %, kéo resize chuyển sang px.
- Table thêm/xóa row/column, merge/split/delete.
- Typography extension cho text transformations; các class text-tiny/small/big/huge.
- Media support khi đọc dữ liệu: YouTube, Vimeo, SoundCloud player, Dailymotion embed, Spotify embed; code chèn file HTTPS video/audio vẫn có nhưng nút Media bị ẩn. Không khẳng định mọi provider PW1 được hỗ trợ.

Tiptap đã có trong package.json từ commit `095d71e43` ngày 2026-04-03, tác giả tgiangk1. Phiên này thêm extension table/text-align/text-style/typography 3.22.1. CKEditor còn phục vụ blog editor khác nên không gỡ dependency bừa.

## Kiểm chứng và vấn đề còn mở

Kiểm tra ngay trước commit dd3c66dc0:

```sh
npx tsc --noEmit
npx vitest run src/__tests__/unit/editor/rich-text-tiptap.test.ts src/__tests__/unit/migration src/__tests__/unit/blocks/all-block-schemas.test.ts src/__tests__/unit/lib/ai/add-section.test.ts src/__tests__/unit/lib/ai/add-section-locale.test.ts
```

Kết quả: TypeScript pass, **414 tests / 14 files pass**. Rich text có 11 ca riêng, gồm HTML round-trip, 4 image layouts, formatted caption, width %, trusted media/sanitize và màu. Đã có kiểm tra UI thủ công qua Playwright cho typing/bold/table/cancel, image layout, font/size/code/media/caption; không phải full E2E regression production.

**Vấn đề đang mở quan trọng:** `/api/sites/3659/pages` trả HTTP 500 trong nhiều lần test UI local; panel Pages hiện “No pages found”. Chưa điều tra root cause. Không được xem thông báo “Saved” hoặc UI cập nhật là bằng chứng lưu DB đã nghiệm thu. Phần kiểm tra apply/undo và HTML round-trip trước đây không thay thế kiểm chứng lưu → reload từ DB. Nếu tiếp tục nghiệm thu, ưu tiên kiểm tra API này và database schema/log trước.

Các phần migrate còn pending: category CTA map sang DB đích, filter/sort/product-selection semantics, header search, mapping tới site BE đã provision sẵn, load test batch production. Brand CTA và blog import đã được người dùng chủ động hoãn/giao BE, không tự mở rộng lại.

Các báo cáo:

- `docs/migration/pw1-rich-text-parity-audit.md`: đối chiếu source PW1, có mục cập nhật implementation cuối file. Các bảng thiếu sót đầu file là trạng thái trước bổ sung, **không đọc chúng như trạng thái mới nhất**.
- `docs/migration/pw1-pw2-banner-gap-report.md`: report 6 component và editor settings trước đợt Rich text mới; nhiều nhận xét Custom HTML chưa có editor đã lỗi thời.
- Không tuyên bố “100% tương đương PW1” chỉ dựa số nút hoặc unit tests. Chưa kiểm tra toàn bộ dữ liệu production/provider/HTML đặc biệt.

## Gợi ý câu mở phiên trên máy ở nhà

> Đọc `docs/migration/SESSION-HANDOFF.md` trên branch hiện tại, kiểm tra trạng thái repo/môi trường rồi tiếp tục phần PW1 migration và Rich text Tiptap từ commit dd3c66dc0. Đừng migrate lại hay sửa dữ liệu trước khi xác định DB đích.

Lưu ý phối hợp: người dùng thích làm trực tiếp, sửa nhỏ rồi quan sát UI, không hỏi lại quyền cho thay đổi đã được yêu cầu. Đọc screenshot cẩn thận; “full toolbar” nghĩa hiển thị đủ công cụ, không chỉ kéo rộng thanh vẫn có More tools. Không tự merge/publish/gửi thông báo hoặc mang mật khẩu vào tài liệu bàn giao.
