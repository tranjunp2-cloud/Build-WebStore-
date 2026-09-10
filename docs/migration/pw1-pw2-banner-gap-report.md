# Báo cáo: Khoảng trống component khi migrate PW1 → PW2

Ngày: 10/09/2026

> Cập nhật triển khai: flow native migrate hiện đã cố định Category listing thành Carousel `cards`, không còn cho AI chọn Portfolio Grid. Các nhận định lựa chọn hai block bên dưới mô tả trạng thái trước thay đổi này. Binding DB/category URL vẫn là phần việc còn lại.

## Tóm tắt cho quản lý

Phạm vi: flow migrate sử dụng block native PW2, đối chiếu dữ liệu Amelina. Chưa đánh giá toàn bộ store PW1 production.

| Loại nguồn | Block PW2 | Hiện trạng chính | Ưu tiên xử lý |
| --- | --- | --- | --- |
| Hero | Hero; nhiều slide dùng Slideshow | Giữ cấu trúc/nội dung slide; chưa giữ autoplay và thời gian chuyển nguồn. | Sửa hành vi chuyển slide, bổ sung trước/sau; sau đó hoàn thiện ảnh thuần và editor. |
| Small banner | Carousel | Đã giữ autoplay/timing và có điều hướng; kiểm tra local xác nhận chế độ tự chạy/thủ công. | Sửa link/CTA và quy tắc chọn variant; sau đó hoàn thiện crop, alt và dữ liệu ảnh thiếu. |
| Category listing | Portfolio Grid / Carousel cards | Danh sách tĩnh từ input; link còn trỏ PW1, chưa bind category PW2. | Map category ID/URL và xác định nguồn dữ liệu danh mục. |
| Product listing | Products Grid | Đọc DB theo site; chưa giữ fixed selection, stock rule, sort và filter nguồn. | Hoàn thiện quy tắc truy vấn và liên kết bộ lọc. |
| Article listing | Blog List | Đọc bài published theo tenant; chưa giữ selection/category/sort nguồn. | Hoàn thiện truy vấn từng listing và phân trang trang Articles. |
| Rich text | Custom HTML + Video khi có embed được hỗ trợ | Giữ HTML nhưng chưa bảo toàn spacing, CSS editor nguồn và media/link nội bộ. | Map spacing, chuẩn hóa định dạng, import ảnh trong HTML và hoàn thiện editor. |

Đề xuất làm từng nhóm: bảo toàn chức năng → hoàn thiện hiển thị → hoàn thiện editor và trải nghiệm thao tác. Các đề xuất bên dưới chưa được triển khai trong đợt lập báo cáo.

## 1. Hero PW1 → Hero PW2

Ngày: 10/09/2026
Phạm vi: Flow migrate dùng block native PW2, đối chiếu với input store Amelina. Đây là đánh giá từ code và cấu hình đầu vào; chưa phải kiểm thử toàn bộ Hero của PW1 production.

### Kết luận

PW2 đã hỗ trợ một Hero chứa nhiều slide và giữ ảnh, nội dung, CTA riêng cho từng slide. Tuy nhiên, flow migrate chưa bảo toàn đầy đủ hành vi chuyển slide và cách hiển thị banner ảnh thuần của PW1.

Ví dụ cụ thể: Hero `3371` trên trang Home của Amelina có `autoplay: false` và `intervalMs: 3000`. Flow native hiện tại không truyền các thiết lập này vào Hero đầu ra; renderer Slideshow tự chuyển mỗi 5 giây khi có nhiều slide. Vì vậy, banner cấu hình chuyển thủ công ở PW1 lại tự chạy ở PW2.

### Các hạng mục cần xử lý

| Ưu tiên | Hạng mục | Hiện trạng | Ảnh hưởng | Đề xuất |
| --- | --- | --- | --- | --- |
| 1 | Manual / autoplay | Input đã có `autoplay`; mapper Hero không truyền tiếp. Native Slideshow luôn tự chạy khi có nhiều slide. | Hành vi website mới khác cấu hình website cũ. | Bổ sung cấu hình native Hero, truyền từ input và chỉ tạo timer khi autoplay bật. |
| 1 | Thời gian chuyển slide | Input đã có `intervalMs`; native Slideshow cố định 5 giây. | Banner tự chạy không theo thời gian đã cấu hình ở PW1. | Map thời gian từ input và sử dụng trong renderer; giữ mặc định tương thích cho website PW2 cũ. |
| 1 | Điều hướng trước/sau | Native Slideshow có chấm chọn slide, chưa có nút trước/sau. | Chế độ thủ công còn hạn chế thao tác. | Bổ sung nút trước/sau dùng được bằng chuột, chạm và bàn phím. |
| 2 | Banner chỉ có ảnh | Đã hiển thị được ảnh không kèm nội dung, nhưng vẫn áp overlay và kích thước mặc định PW2. | Ảnh có thể bị tối hoặc crop mất nội dung thiết kế sẵn. | Có chế độ ảnh thuần rõ ràng; cấu hình overlay, tỉ lệ/chiều cao và cách fit ảnh. |
| 2 | Responsive và crop | Slideshow dùng background cover/center và chiều cao theo viewport; chưa có cấu hình tương ứng trong input Hero hiện tại. | Khó kiểm soát phần ảnh bị cắt trên desktop/mobile. | Xác định quy tắc responsive; bổ sung cấu hình fit/vị trí ảnh khi cần. Chỉ map giá trị PW1 khi có dữ liệu xác thực. |
| 3 | Chỉnh sửa từng slide | Schema đã có `slides`, nhưng `heroMeta.editableFields` chưa khai báo trường này. | Chưa thể coi trải nghiệm quản lý slide trong editor là hoàn chỉnh. | Rà soát và hoàn thiện thao tác thêm, xóa, sắp xếp, sửa ảnh/nội dung/CTA từng slide; kiểm tra lưu và mở lại. |

Các mục điều hướng và responsive là đề xuất hoàn thiện khả năng tương thích, không phải khẳng định mọi store PW1 đều có cùng cấu hình đó.

### Phần đã hỗ trợ

- Một component Hero nhiều ảnh được map thành một Hero Slideshow, không tách mỗi slide thành một block.
- Mỗi slide có ảnh, headline, subheadline và CTA riêng.
- Hero một slide có thể dùng các variant Hero native PW2.
- Banner có `size: small` hiện được map sang Carousel, nằm ngoài phạm vi chỉnh Hero của báo cáo này.

### Kế hoạch đề xuất

1. **Đợt 1 — Đúng hành vi:** hoàn thiện autoplay, thời gian chuyển và điều hướng thủ công.
2. **Đợt 2 — Đúng cách hiển thị:** hoàn thiện banner ảnh thuần, overlay và responsive/crop.
3. **Đợt 3 — Dễ vận hành:** hoàn thiện quản lý slide trong editor.

Triển khai trong Hero chuẩn của PW2 để dùng chung cho website mới và website migrate. Nhánh `sourceLayout` thử nghiệm đã có manual/timing và nút trước/sau, nhưng flow native hiện tại không sử dụng nhánh này; không thể coi đó là hỗ trợ sẵn trong native Slideshow.

Nếu bổ sung trường lưu trữ, cần cập nhật đồng bộ schema, mapper, renderer, editor và migration DB tương ứng, bao gồm dữ liệu version của page.

### Tiêu chí nghiệm thu đề xuất

- `autoplay: false`: slide không tự chuyển; điều hướng thủ công hoạt động.
- `autoplay: true`: slide chuyển theo `intervalMs` trong input.
- Hero một slide không chạy timer và không hiển thị điều hướng thừa.
- Đúng số lượng và thứ tự slide; ảnh, nội dung, CTA không bị mất hoặc tự thêm.
- Banner ảnh thuần không bị làm tối ngoài cấu hình; cách crop được kiểm tra trên desktop/mobile.
- Cấu hình slide lưu và mở lại trong editor không bị mất.
- Website PW2 cũ không có trường mới vẫn hoạt động theo mặc định tương thích.

### Căn cứ kiểm tra

- `src/blocks/hero/config.ts`: schema Hero/slide và danh sách trường chỉnh sửa.
- `src/blocks/hero/variants/slideshow.tsx`: timer 5 giây, chấm điều hướng, overlay và chiều cao mặc định.
- `src/lib/migration/pw1-native-ai.ts`: bước bind nội dung nguồn sang Hero native.
- `src/blocks/hero/variants/source-layout.tsx`: nhánh thử nghiệm, không được flow native hiện tại sử dụng.
- Input đối chiếu: `amelina.website-input.v1.json`, Hero Home `3371`.

Báo cáo này ghi nhận hiện trạng và đề xuất; các hạng mục trên chưa được triển khai trong lượt lập báo cáo.

## 2. Small banner PW1 → Carousel PW2

Ngày: 10/09/2026
Phạm vi: Flow migrate native PW2, đối chiếu code và input Amelina; không đại diện cho toàn bộ cấu hình PW1 production.

### Kết luận

Small banner (`size: small`) được map thành một Carousel PW2 chứa các slide theo đúng thứ tự. Khác với Hero Slideshow hiện tại, Carousel đã nhận và sử dụng cấu hình autoplay, thời gian chuyển, đồng thời có nút trước/sau và chấm chọn slide.

Các khoảng trống chính nằm ở link/CTA, quy tắc chọn variant, tỉ lệ ảnh và khả năng giữ nguyên dữ liệu ảnh. Chưa cần tạo block mới để giải quyết các vấn đề này.

### Dữ liệu đối chiếu

| Component trên Home Amelina | Số slide | Cấu hình PW1 trong input | Mapping hiện tại |
| --- | --- | --- | --- |
| `3184` | 3 | `size: small`, `autoplay: true`, `intervalMs: 3000` | Một Carousel, autoplay bật, `interval: 3000` |
| `17401` | 2 | `size: small`, `autoplay: false`, `intervalMs: 3000` | Một Carousel, chuyển thủ công |

Cả hai component mẫu đều chỉ có ảnh; headline, description và CTA trống. Vì vậy, các khoảng trống CTA dưới đây được xác định từ code, không phải lỗi CTA đã tái hiện trên dữ liệu Amelina.

### Phần đã hỗ trợ

- Giữ một component nguồn thành một Carousel, không tách từng slide thành block riêng.
- Giữ số lượng/thứ tự ảnh khi input hợp lệ và media được import thành công.
- Mapper truyền `autoplay` và đổi `intervalMs` thành `interval`; renderer đọc cả hai trường.
- Có nút trước/sau và chấm chọn slide; có tên truy cập cho các nút.
- Khi chỉ có một slide, không chạy timer và không hiện điều hướng thừa.
- Schema và danh sách trường editor đã có `items`, `autoplay`, `interval`. Chưa kiểm thử đầy đủ thao tác chỉnh sửa, lưu và mở lại editor trong đợt đánh giá này.

### Kiểm tra trình duyệt local

Đã kiểm tra Home tại `http://localhost:3000/preview/3659`: HTTP 200, không ghi nhận lỗi JavaScript. Carousel đầu có ba ảnh và tự chuyển slide trong khoảng quan sát; Carousel thứ hai có hai ảnh, giữ nguyên slide trong khoảng quan sát khoảng 5 giây và chuyển sang slide 2 khi bấm Next. Thời gian 3 giây được xác nhận từ input và đường truyền config trong code, chưa đo độ chính xác timer bằng kiểm thử thời gian chuyên biệt. Lớp dev indicator Next.js được vô hiệu hóa bắt pointer trong phiên kiểm tra để không che nút.

### Các hạng mục cần xử lý

| Ưu tiên | Hạng mục | Hiện trạng | Ảnh hưởng | Đề xuất |
| --- | --- | --- | --- | --- |
| 1 | Link ở variant `images` | Mapper có ghi CTA URL vào `item.linkUrl`, nhưng renderer `images` không sử dụng link này. | Với banner có CTA, người dùng không thể bấm đến đích từ ảnh/CTA như dữ liệu đã yêu cầu. | Bổ sung hành vi link hoặc CTA rõ ràng; chọn theo ngữ nghĩa nguồn, không chỉ theo hình thức. |
| 1 | Giữ cấu trúc CTA | Mapper ghép nhãn CTA vào description; Carousel không có trường nút CTA riêng. Nhánh `cards` biến cả card thành link và luôn mở tab mới. | CTA trở thành văn bản mô tả hoặc thao tác toàn card; chưa bảo toàn cách tương tác. | Giữ riêng label/URL của CTA; quy định rõ link toàn ảnh, nút CTA và cách mở đích. Không suy diễn target nguồn khi input không có. |
| 1 | Chọn variant có xét chức năng | AI hiện được chọn `images` hoặc `cards` cho mọi small banner, kể cả banner có CTA. | Chất lượng tương tác phụ thuộc variant được AI chọn; `images` có thể làm mất khả năng bấm link. | Ràng buộc variant theo nội dung/chức năng; ưu tiên `images` cho banner ảnh thuần. |
| 2 | Tỉ lệ và crop ảnh | `images` cố định 16:9; `cards` cố định 16:10; cả hai dùng cover. `size: small` chỉ quyết định chọn Carousel. | Có thể cắt chữ/hình thiết kế trong ảnh và không giữ chiều cao banner mong muốn. | Bổ sung tỉ lệ/chiều cao, fit và vị trí ảnh khi cần. Cần thêm dữ liệu kích thước nguồn hoặc đối chiếu trực quan trước khi kết luận mức lệch PW1. |
| 2 | Khung hiển thị | Carousel dùng container, bo góc và khoảng cách theo thiết kế PW2; cards có vùng nội dung phía dưới dù nội dung trống. | Banner ảnh thuần có thể xuất hiện phần đệm không cần thiết hoặc mang hình thức card. | Định nghĩa chế độ banner ảnh thuần, kiểm soát vùng nội dung trống; vẫn cho phép dùng phong cách PW2. |
| 2 | Alt của ảnh | Mapper giữ `image.alt`, nhưng renderer sử dụng title hoặc chuỗi mặc định thay vì đọc alt đó. | Mất mô tả ảnh nguồn trong HTML, ảnh hưởng khả năng truy cập. | Ưu tiên alt đã map; xác định fallback phù hợp khi không có alt. |
| 2 | Thiếu dữ liệu ảnh | Renderer có thể lấy ảnh mẫu khi item thiếu URL hoặc danh sách rỗng. | Có nguy cơ hiển thị nội dung không thuộc website nguồn nếu dữ liệu thiếu lọt đến renderer. | Với luồng migrate, báo lỗi/empty state có chủ đích thay vì tự thay ảnh nguồn bằng ảnh mẫu. Đây là rủi ro code, chưa xảy ra trên mẫu đang đối chiếu. |
| 3 | Trải nghiệm thao tác | Có nút điều hướng; chưa thấy xử lý swipe hoặc pause khi hover/focus trong Carousel. | Trải nghiệm mobile và đọc nội dung khi autoplay còn hạn chế. | Cân nhắc swipe, pause và reduced-motion; là cải tiến UX, chưa xác nhận đây là yêu cầu tương ứng từ PW1. |

### Kế hoạch đề xuất

1. **Đợt 1 — Bảo toàn chức năng:** sửa link/CTA và ràng buộc lựa chọn variant; giữ logic autoplay/timing đang hoạt động.
2. **Đợt 2 — Bảo toàn hiển thị:** hoàn thiện banner ảnh thuần, tỉ lệ/crop, alt và chính sách ảnh thiếu.
3. **Đợt 3 — Hoàn thiện vận hành:** kiểm thử editor và bổ sung tương tác mobile/accessibility theo phạm vi thống nhất.

Nếu bổ sung trường lưu trữ, cập nhật đồng bộ schema, mapper, renderer, editor và migration DB/page version tương ứng.

### Tiêu chí nghiệm thu đề xuất

- Component `3184` giữ ba slide và tự chuyển theo cấu hình 3 giây.
- Component `17401` giữ hai slide, không tự chuyển; nút trước/sau và chấm điều hướng hoạt động.
- Một slide không có timer/điều hướng thừa.
- Banner có link/CTA vẫn bấm được đúng đích ở variant được chọn; không biến nhãn nút thành mô tả.
- Ảnh và thứ tự nguồn được giữ; không tự chèn ảnh mẫu khi dữ liệu thiếu.
- Alt nguồn xuất hiện đúng trong HTML khi được cung cấp.
- Banner ảnh thuần không có vùng nội dung rỗng không cần thiết; crop được kiểm tra trên desktop/mobile.
- Sửa, sắp xếp, lưu và mở lại item trong editor không làm mất cấu hình.

### Căn cứ

- `src/lib/migration/pw2-website-input.ts`: chuyển config nguồn sang contract.
- `src/lib/migration/pw1-native-ai.ts`: lựa chọn variant và bind banner thành Carousel.
- `src/blocks/carousel/config.ts`: schema và danh sách trường editor.
- `src/blocks/carousel/index.tsx`: timer, điều hướng, link, ảnh và bố cục thực tế.
- Input `amelina.website-input.v1.json`: component `3184` và `17401`.

Đợt này là kiểm tra và lập báo cáo, chưa sửa implementation Carousel hoặc chạy generate lại.


## 3. Category listing PW1 → Portfolio Grid / Carousel cards

### Hiện trạng và dữ liệu mẫu

Amelina có ba component: Home `17402`, `4906`; Products `3191`. Mỗi component có ba item. Các item có thể trỏ tới cả danh mục bài viết và danh mục sản phẩm. Input chứa tên, ảnh, source ID, URL và CTA label của từng item.

Mapper giữ danh sách này như nội dung tĩnh, cho AI chọn Portfolio Grid hoặc Carousel cards. Đây chưa phải category listing đọc danh mục từ DB PW2.

| Ưu tiên | Khoảng trống | Ảnh hưởng / đề xuất |
| --- | --- | --- |
| 1 | Link vẫn là URL PW1 như `/products?category=32956`, `/articles?category=305`. | Bấm danh mục quay về website cũ. Cần map category ID/slug theo đúng loại danh mục và đúng site/tenant, rồi dựng URL PW2. Không chỉ thay hostname vì tham số/ID khác nhau. |
| 1 | Chưa có binding danh mục PW2. | Danh sách không tự cập nhật khi danh mục PW2 đổi tên/ảnh/trạng thái. Cần xác định chế độ danh mục lấy DB hoặc danh sách chọn sẵn có liên kết ID PW2. |
| 1 | Chưa có loại danh mục rõ ràng trong mỗi item; loại đích hiện nằm trong URL. | Cần chuẩn hóa product category / blog category trong input trước khi map; không gán nhầm ID giữa hai collection. |
| 2 | Autoplay/timing nguồn chưa truyền qua nhánh category; Carousel bị đặt `autoplay: false`. | Mẫu Amelina đang manual nên không lộ sai khác, nhưng config auto ở store khác sẽ không được giữ. Cần truyền config nếu chọn Carousel; xác định rõ khi chuyển thành grid. |
| 2 | CTA label bị ghép vào description; card mở tab mới. | Chưa giữ ngữ nghĩa nút CTA riêng. Portfolio hiển thị copy qua hover overlay, cần kiểm tra khả năng nhìn thấy nội dung trên mobile. |
| 2 | Alt dùng title, có fallback ảnh mẫu; layout/crop theo block trình bày. | Cần giữ alt nguồn, kiểm soát ảnh thiếu và kiểm tra crop. Đây là khoảng trống trong renderer, chưa phải lỗi dữ liệu đã tái hiện trên mọi item. |

**Nghiệm thu:** item trỏ đúng danh mục PW2, lọc đúng bản ghi sau import, không lẫn product/blog category; giữ thứ tự lựa chọn; có chính sách rõ ràng cho danh mục thiếu/ẩn; CTA và cấu hình carousel hoạt động theo input.

## 4. Product listing PW1 → Products Grid

### Phần đã hỗ trợ

- Dùng Products Grid native, đọc sản phẩm DB theo **site**, không nhúng snapshot sản phẩm từ PW1.
- Map heading, limit và `showCategoryFilter` khi input cung cấp.
- Block native có cơ chế lọc/phân trang và hiển thị rỗng khi không có sản phẩm.
- Không tự tạo sản phẩm trong flow generate migration. Import sản phẩm là công việc riêng; đây là phạm vi đã thống nhất, không phải lỗi block.

### Dữ liệu mẫu và khoảng trống

| Ưu tiên | Hạng mục | Bằng chứng / ảnh hưởng | Đề xuất |
| --- | --- | --- | --- |
| 1 | Danh sách cố định | Home `3187`: `list_type: fixed`, nhưng input website hiện không chứa danh sách product ID được chọn; `sourceSettings` không tham gia query. | Bổ sung selected source IDs từ dữ liệu export, map sang ID PW2 và giữ thứ tự. Không thể khôi phục danh sách fixed chỉ từ heading/limit. |
| 1 | Ẩn/hiện hàng hết tồn | `3187` có `display_out_of_stock: 0`, `1597` có giá trị `1`; mapper chưa truyền quy tắc này. | Bổ sung contract và query tương ứng; thống nhất tồn kho theo sản phẩm/biến thể dựa trên mô hình PW2. |
| 1 | Bộ lọc riêng | Component `1595` yêu cầu category filter nhưng đang pending; listing không tự liên kết bộ lọc này. | Map control vào listing tương ứng hoặc cấu hình filter native; không bật toàn bộ filter nếu nguồn chỉ yêu cầu category. |
| 1 | Sort và category selection | Hook hiện gửi `sort=-createdAt`; mapper chưa dùng `order_by`/selection nguồn. Trường `category` có trong schema nhưng không được truyền vào hook hiện tại. | Hoàn thiện từ input → block → query; xác minh ngữ nghĩa và chiều sort nguồn trước khi chuyển đổi. |
| 2 | Số item mỗi trang | Products `1597` có `per_page: 10`, hiện map limit 10. Khi bật filter native, renderer dùng 9 desktop / 10 mobile thay cho limit. | Tách page size và giới hạn listing nếu cần; giữ yêu cầu nguồn hoặc ghi rõ quy tắc responsive được chấp nhận. |
| 2 | Variant đầu ra | AI được chọn grid-3/grid-4/list nhưng renderer hiện lấy view từ URL, mặc định grid-3. | Làm rõ ưu tiên URL so với block.variant để lựa chọn thiết kế có hiệu lực. |

**Nghiệm thu:** sau khi import, listing fixed hiển thị đúng sản phẩm/thứ tự; listing all có đúng sort, stock rule, filter và pagination; dữ liệu không vượt site; DB rỗng vẫn dùng empty state native. Kiểm tra riêng filter chỉ-category và page size trên desktop/mobile.

## 5. Article listing PW1 → Blog List

### Phần đã hỗ trợ

- Dùng Blog List native, đọc bài **published theo tenant**; không nhúng snapshot hoặc tự tạo bài trong flow migration.
- Map heading và limit; có variant cards/list và link bài viết PW2 theo ngữ cảnh site/preview.
- DB không có bài phù hợp thì hiển thị empty state native.

### Dữ liệu mẫu và khoảng trống

Amelina có Home `3189`, `4857` và Articles `1600`, đều limit 3, `list_type: all`, `order_by: created_at`, `show_created_at_article_listing: 1` trong input hiện tại.

| Ưu tiên | Hạng mục | Ảnh hưởng / đề xuất |
| --- | --- | --- |
| 1 | Category / selected article / sort chưa map | Renderer chỉ gửi tenant, limit và `sort=-createdAt`. API đã có lọc category theo slug, nhưng block chưa nối cấu hình này. Cần bổ sung selection, category, sort vào contract và query; map ID/slug sau import. |
| 1 | Nhiều listing có cùng kết quả | Hai component Home có cùng tenant/limit/query nên có thể hiển thị cùng bài. Đây là hai component nguồn khác nhau, không phải generator tự nhân bản block. Cần giữ cấu trúc nguồn, kiểm tra tiêu chí từng component; không tự xóa hoặc tự tạo dữ liệu khác để tránh trùng. |
| 2 | Hiển thị ngày | Input có cờ `show_created_at_article_listing`, nhưng block không map cờ; renderer luôn có vùng ngày. | Bổ sung lựa chọn hiện/ẩn và xác định dùng ngày tạo hay ngày xuất bản. Mẫu có cờ bật chưa chứng minh tương thích với nguồn có cờ tắt. |
| 2 | Trang danh sách Articles | Blog List chỉ tải số bài theo limit; hiện không có UI phân trang trong block. | Kiểm tra nhu cầu full listing của trang Articles, bổ sung pagination/load-more nếu cần. `list_type: all` không nên bị hiểu là chỉ ba bài đầu mà không có cách truy cập phần còn lại. |
| 2 | Phạm vi tenant so với store/site | PW2 Blog List lấy bài theo tenant, không theo site. | Xác nhận đây là phạm vi mong muốn; kiểm thử tenant có nhiều site để tránh hiển thị bài ngoài phạm vi store nguồn. Batch hiện tạo tenant riêng cho từng store nhưng block vẫn có ngữ nghĩa tenant. |

**Nghiệm thu:** hiển thị đúng tập bài published theo scope/selection/category; sort và ngày đúng quy tắc; link bài chạy trên preview/live; toàn bộ bài có đường truy cập khi dùng full listing; không tự phát sinh bài hoặc loại bỏ component nguồn.

## 6. Thứ tự xử lý listing đề xuất

1. Chuẩn hóa input theo chức năng: category type, selected source IDs, sort, stock rule, filter, pagination và cờ hiển thị.
2. Xác định mapping dữ liệu PW1 → PW2 sau import; không dùng trực tiếp ID PW1 để query PW2.
3. Hoàn thiện Category link/binding và Product filter/selection trước; tiếp theo Article selection/category/pagination.
4. Kiểm thử bằng dữ liệu nhiều category, sản phẩm hết tồn, bài draft/published và hai site/tenant. Không dùng riêng DB rỗng để kết luận đã tương thích.

### Căn cứ và giới hạn đánh giá listing

Đã đọc input Amelina, adapter `pw2-website-input.ts`, binder `pw1-native-ai.ts`, config/renderer Portfolio Grid, Carousel, Products Grid, Blog List, hook `use-products-grid-data.ts` và API storefront products/blogs. Đợt bổ sung listing là đánh giá code/input; chưa chạy migration lại hoặc kiểm thử chức năng với dữ liệu commerce đã import. Các tính năng được nêu là “đã có” không đồng nghĩa đã nghiệm thu end-to-end migration.


## 7. Rich text PW1 → Custom HTML / Video PW2

### Kết luận và phần đã hỗ trợ

Flow native hiện tại dùng **Custom HTML có sẵn**, không sử dụng block `rich-text` thử nghiệm. HTML được lấy từ input, không yêu cầu AI viết lại nội dung. Đoạn văn, heading, định dạng và ảnh được đưa vào HTML đầu ra; việc hiển thị cuối cùng phụ thuộc DOMPurify và CSS của PW2, nên chưa thể coi là bảo toàn định dạng hoàn toàn.

- Custom HTML chạy DOMPurify trước khi đưa HTML vào DOM. Việc loại bỏ nội dung không an toàn là hành vi cần giữ, không phải khoảng trống cần bỏ qua.
- Iframe YouTube/Vimeo có URL và cấu trúc được hỗ trợ được tách thành Video native, giữ thứ tự các đoạn văn trước/sau.
- Wrapper media-only của CKEditor được loại bỏ khi tách video để tránh khoảng trống do spacer cũ.
- Một component rich text có thể thành nhiều block Custom HTML/Video; đây là phép tách có chủ đích, cần giữ mapping về component nguồn.

### Dữ liệu mẫu Amelina

Home có bốn component rich text: `17403`, `15214`, `17404`, `3675`; tất cả có `paddingY: 120` trong input hiện tại.

- `17403`, `17404`: đoạn văn, căn giữa, chữ đậm, màu chữ/nền và cỡ chữ inline.
- `15214`: đoạn văn và figure ảnh có class `image-style-align-center`, `image_resized`, width `53.36%`; ảnh vẫn là URL bucket PW1.
- `3675`: heading, YouTube iframe bên trong figure media và đoạn văn. Flow tách phần video thành block Video.

### Các hạng mục cần xử lý

| Ưu tiên | Hạng mục | Hiện trạng / ảnh hưởng | Đề xuất |
| --- | --- | --- | --- |
| 1 | Spacing nguồn bị bỏ qua | Adapter nhận `paddingY`, nhưng binder native chỉ đọc HTML và bọc mỗi đoạn bằng padding 24px, max-width 960px, line-height 1.8. Renderer còn có SectionWrapper riêng. | Map spacing vào cấu hình block chuẩn; xác định spacing ở cấp component hay từng đoạn khi tách video để tránh cộng đệm nhiều lần. |
| 1 | CSS định dạng từ editor PW1 | HTML giữ class CKEditor nhưng Custom HTML chỉ áp prose/theme chung; CSS căn figure tương ứng hiện nằm trong block rich-text thử nghiệm, không áp cho flow native. | Chuẩn hóa alignment, figure/caption, resize ảnh, bảng và danh sách sang CSS/markup được PW2 hỗ trợ. Giữ nội dung và chủ đích định dạng, không cần sao chép toàn bộ giao diện PW1. |
| 1 | Ảnh bên trong HTML chưa import | Media importer duyệt trường ảnh có cấu trúc, không phân tích chuỗi HTML. Ảnh của `15214` vẫn phụ thuộc storage PW1. | Parse HTML, import ảnh nguồn hợp lệ vào media PW2 rồi rewrite src; bảo toàn alt/caption/kích thước. Báo rõ ảnh không tải được. |
| 1 | Link nội bộ trong HTML chưa map | Binder giữ href trong chuỗi HTML, không dùng cơ chế resolve page/category/product/blog ID. | Phân biệt link nội bộ/ngoài, map đích sang PW2 sau khi có bảng ID/slug; giữ anchor và báo đích chưa resolve. Chưa xác nhận mẫu Amelina có lỗi link cụ thể này. |
| 2 | Embed chỉ hỗ trợ một số dạng | Chỉ một số URL embed HTTPS của YouTube/Vimeo và cấu trúc wrapper được chấp nhận; iframe khác hoặc dạng lồng không hỗ trợ sẽ làm bước generation lỗi. | Chuẩn hóa dạng embed được hỗ trợ, kiểm tra trước generation và trả lỗi gắn source component. Các provider chưa hỗ trợ phải có chính sách rõ ràng, không âm thầm làm mất nội dung. |
| 2 | Xung đột inline style với theme mới | Màu nền/chữ/font-size cũ có thể còn trong HTML, cùng tồn tại với prose/theme PW2. | Xác định thuộc tính cần giữ và thuộc tính được chuẩn hóa để tăng độ dễ đọc, đặc biệt mobile/dark theme. Không tự xóa định dạng có ý nghĩa. |
| 2 | Nội dung chỉ xuất hiện sau JavaScript | Renderer khởi tạo HTML rỗng, sanitize trong useEffect phía client. | Đánh giá chuyển sanitize/render về server hoặc pipeline tương thích để nội dung có trong HTML ban đầu; kiểm tra loading/layout shift. Chưa đo tác động SEO thực tế. |
| 2 | Trải nghiệm chỉnh sửa | Custom HTML chỉ khai báo trường `html`, không có model tài liệu rich text chuyên biệt trong config. | Rà soát editor hiện tại, bổ sung sửa trực quan đoạn văn, link, ảnh, bảng; kiểm tra round-trip không mất định dạng. Chưa nghiệm thu WYSIWYG trong đợt này. |
| 2 | Tràn nội dung trên mobile | Wrapper ngoài có overflow-hidden; HTML có thể có kích thước cố định, bảng hoặc nội dung dài. | Test ảnh, bảng nhiều cột, URL dài; dùng responsive/scroll phù hợp thay vì cắt nội dung. Đây là rủi ro cần kiểm thử, chưa kết luận lỗi trên mọi component mẫu. |

### Kế hoạch và tiêu chí nghiệm thu

1. Sửa spacing, chuẩn hóa CSS/markup nguồn và import media trong HTML.
2. Map link nội bộ và kiểm tra embed trước khi gọi generation.
3. Hoàn thiện render HTML ban đầu và editor trực quan theo phạm vi sản phẩm.

Nghiệm thu: giữ thứ tự văn bản/ảnh/video, heading/list/table/link/alt/caption và alignment có chủ đích; spacing không bị nhân đôi khi tách; không phụ thuộc ảnh PW1 sau import thành công; link nội bộ đi đúng PW2; embed không hỗ trợ được báo rõ; sanitize vẫn hoạt động; desktop/mobile và lưu/mở lại editor không mất nội dung.

### Căn cứ và giới hạn

Đã đối chiếu bốn component trong input Amelina, `documentBlocks()` trong `src/lib/migration/pw1-native-ai.ts`, adapter `pw2-website-input.ts`, importer `pw1-media.ts`, config/renderer `src/blocks/custom-html/` và CSS của rich-text thử nghiệm. Đợt này chỉ đọc code/input và cập nhật báo cáo; chưa sửa implementation, chưa generate lại và chưa chạy bộ kiểm thử Rich text end-to-end.


## 8. Đối chiếu setting trong editor và phần UI cần bổ sung

### Phương pháp và giới hạn

Đã đọc implementation `src/components/editor/SettingsPanel.tsx`, các control được render, nhánh cập nhật ảnh trong `PreviewFrame.tsx` và config của từng block. **Không dùng `editableFields` làm bằng chứng duy nhất rằng UI đã tồn tại.** Danh sách dưới đây là kiểm tra code của editor hiện tại; chưa thao tác toàn bộ control và save/reload bằng trình duyệt.

Phân biệt ba lớp khi triển khai: (1) field/schema có tồn tại, (2) renderer/query có sử dụng, (3) editor có control đọc/ghi đúng field. Một hạng mục chỉ hoàn tất khi cả ba lớp hoạt động cùng mapper và persistence.

### Ma trận UI

| Block | UI/đường chỉnh sửa đã thấy trong code | Khoảng trống UI cần xử lý | Lưu ý chức năng |
| --- | --- | --- | --- |
| Hero | Có headline/subheadline khi field tồn tại, CTA cấp block với label/URL, thêm/xóa tối đa hai nút, setting spacing và lựa chọn layout theo cơ chế editor. | Thêm quản lý `slides`: chọn slide, thêm/xóa/sắp xếp, ảnh/nội dung/CTA từng slide; control autoplay, interval, điều hướng và fit/tỉ lệ/overlay theo contract được chốt. | CTA hiện sửa `block.ctaButtons`; native Slideshow đọc `slides[currentIndex].ctaButtons` khi có slides. Sửa CTA cấp block có thể không đổi nội dung slide đang hiển thị. Headline/subheadline cấp block cũng cần được điều hướng đúng theo slide. |
| Carousel (small banner) | Có setting chung; preview có handler thay ảnh vào `items[index].image`. Schema khai báo items/autoplay/interval. | Chưa thấy control autoplay/interval hay bộ quản lý items đầy đủ trong SettingsPanel được kiểm tra. Cần thêm toggle/timing, thêm/xóa/sắp xếp slide và sửa title/description/link/CTA; fit/tỉ lệ khi có field mới. | Đã có handler thay ảnh không đồng nghĩa đã có UI quản lý slide hoàn chỉnh. Không tạo lại tính năng thay ảnh nếu có thể tái sử dụng. |
| Category qua Portfolio/Carousel | Có handler thay ảnh theo `projects[index].image` / `items[index].image`; text/spacing chung theo field. | Thêm nguồn dữ liệu, loại danh mục product/blog, chọn danh mục PW2, thứ tự và đích liên kết; timing nếu dùng Carousel. | Không dùng danh sách category trang trí trong Portfolio thay cho binding danh mục commerce. UI phải chọn ID thuộc đúng scope. |
| Products Grid | Có toggle `showCategoryFilter` khi field tồn tại, text và spacing chung. | Chưa thấy control limit/category/selection/sort/stock rule trong SettingsPanel hiện tại. Cần UI chọn all/fixed, chọn/sắp xếp sản phẩm, category, sort, ẩn/hiện hết tồn, page size và từng tiêu chí filter. | Toggle filter hiện là bật/tắt chung, chưa diễn đạt nguồn chỉ bật category. Cần nối control vào query thực sự; schema có field chưa đủ. |
| Blog List | Có text/spacing chung. Schema có limit và các label, nhưng chưa thấy control riêng cho chúng trong SettingsPanel được kiểm tra. | Thêm limit/page size, all/selected/category, sort, hiện ngày, pagination và các label nếu cho phép cấu hình. | Cần chỉ rõ phạm vi bài viết theo tenant/site để người dùng hiểu lựa chọn dữ liệu; không tự tạo bản ghi blog từ setting listing. |
| Custom HTML (rich text) | Có spacing chung. Config khai báo `html`; chưa thấy control `html` hoặc editor tài liệu riêng trong SettingsPanel được kiểm tra. | Bổ sung đường sửa nội dung phù hợp: rich text trực quan, link/ảnh/figure/table và căn chỉnh; có thể thêm HTML nâng cao nếu sản phẩm cần. | Không kết luận editor đã hỗ trợ WYSIWYG chỉ vì schema có html. Phải kiểm tra round-trip nội dung và sanitize. Setting spacing ngoài block hiện không loại bỏ padding 24px hardcode bên trong HTML migrate. |

### Control dùng chung cần tái sử dụng

- **Top/Bottom Spacing đã có:** slider ghi vào `blockSpacing.paddingTop/paddingBottom`, khoảng 0–120px. Nên map spacing nguồn vào cơ chế này nếu đúng ngữ nghĩa; không thêm slider trùng chức năng. Input migration hiện cho phép một số giá trị padding tới 240px, cần thống nhất giới hạn và cách hiển thị giá trị ngoài range.
- **Text setting có điều kiện:** nhiều input chỉ hiện khi field khác undefined. Cần bảo đảm block migrate tạo đủ field cần sửa; không chỉ thêm control nhưng để dữ liệu khiến control không xuất hiện.
- **Thay ảnh trong preview đã có cho Carousel/Portfolio:** tái sử dụng handler và kiểm tra metadata/alt, persistence thay vì tạo một luồng upload tách biệt.
- **Hero CTA cấp block đã có:** mở rộng theo slide và variant, không tạo hai bộ setting ghi vào hai field khác nhau mà người dùng không biết.

### Tiêu chí nghiệm thu UI áp dụng cho mọi hạng mục

1. Mở block được migrate trong editor: control hiển thị đúng giá trị thực từ input, không hiển thị mặc định khác dữ liệu đã lưu.
2. Thay đổi setting: preview cập nhật đúng block/slide/item, không chỉ thay field không được renderer đọc.
3. Save, tải lại editor và mở preview: setting còn nguyên; kiểm tra cả draft/publish theo workflow PW2.
4. Thêm/xóa/sắp xếp item không làm lệch ảnh, CTA hay mapping của item khác.
5. Giá trị không hợp lệ có validation và thông báo; defaults giữ tương thích website PW2 cũ.
6. Mỗi đề xuất trong báo cáo phải ghi rõ phần việc **mapper + schema/DB + renderer/query + editor UI + kiểm thử**, hoặc ghi “tái sử dụng UI hiện có” nếu không cần thêm control.

Phần này bổ sung và làm rõ các nhận định editor ở các mục trước; không coi danh sách `editableFields` là xác nhận UI đã hoàn chỉnh. Chưa có thay đổi implementation editor trong lượt cập nhật báo cáo này.
