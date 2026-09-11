# Đối chiếu Rich text PW1 → Tiptap PW2

Ngày kiểm tra: 2026-09-11. Kết luận: **chưa tương đương đầy đủ với Rich text đang dùng ở PW1**.

## Nguồn xác nhận

- PW1: `/Users/levietducprime/Work/primeweb-cms-frontend/src/components/WebBuilder/Page/Edit/EditConfigRichText.vue` dùng `<v-ckeditor>`. Cấu hình Quill trong cùng file là code không được template hiện tại sử dụng, không tính vào yêu cầu tương đương.
- PW1: `src/components/Editor/VCKEditor.vue` → `src/utils/ckeditor.js`: plugin, toolbar chính và toolbar ảnh thực tế.
- PW1: `/Users/levietducprime/Work/primeweb-frontend-v2/src/assets/style/ckeditor.less`: CSS nội dung.
- PW2: `src/components/editor/RichTextBlockEditor.tsx`, `rich-text-extensions.ts`, `rich-text-image.ts`; renderer `src/blocks/custom-html/`.
- Dữ liệu: `~/Downloads/stores-205-285-pw2-current-schema-collection-only(1).json`, bản hiện tại chỉ còn store 205. Rà soát 6 giá trị HTML trong model_settings của page components (chưa loại theo enabled trong thống kê này). Đây không phải kiểm chứng toàn bộ production.

## Kết quả đối chiếu

| Chức năng PW1 thực tế | PW2 hiện tại | Kết luận |
|---|---|---|
| Paragraph/heading, bold, italic, underline | Có extension và toolbar | Đã có |
| Alignment, bullet/numbered list, undo/redo, blockquote | Có extension và toolbar | Đã có |
| Inline code (`code`) | StarterKit có xử lý code, nhưng toolbar không có nút | Thiếu UI tương ứng |
| Font family | Có chọn font, nhưng danh sách không có Tahoma; dữ liệu thực tế dùng `Tahoma, Geneva, sans-serif` | Chưa đủ lựa chọn/hiển thị giá trị hiện tại |
| Font size | PW1 có 9/11/13/default/17/19/21 và nhận giá trị tùy ý; PW2 dùng danh sách khác | Thiếu giá trị PW1 và nhập cỡ tùy ý. HTML có thể giữ giá trị cũ, nhưng dropdown không thể hiện/chọn đúng |
| Font/text background color | Có picker; dữ liệu nguồn có HSL/RGB, hiện UI truyền trực tiếp vào input color vốn yêu cầu dạng hex phù hợp | Cần chuẩn hóa giá trị hiển thị để picker phản ánh đúng màu cũ |
| Link | Có chèn/sửa/bỏ link | Đã có chức năng chính |
| Upload ảnh, alt text, resize | Có | Đã có chức năng chính; lưu DB/upload production chưa được nghiệm thu |
| Ảnh inline/trái/giữa/phải | Có 4 mode inline/left/right/standalone ở PW2 | Có bố trí chính. Cần kiểm tra thêm chuyển class/style CKEditor của figure/inline wrapper sang thuộc tính ảnh PW2 để UI phản ánh đúng dữ liệu nguồn |
| Bật/tắt caption ảnh (`toggleImageCaption`) | Giữ/đọc được figcaption qua custom node, nhưng không có nút tạo/bật/tắt caption trên ảnh mới | Thiếu thao tác tương ứng |
| Media embed (`mediaEmbed`, previewsInData=true) | Tiptap chưa đăng ký node embed/iframe/oembed và chưa có UI chèn media | Thiếu. Chỉnh rồi serialize HTML embed trực tiếp không được bảo đảm giữ media; migration hiện tách một số embed ra Video block riêng, không đồng nghĩa Rich text editor có hỗ trợ |
| Autoformat + TextTransformation | StarterKit có input rules cho một số markup; chưa cấu hình tương đương TextTransformation PW1 | Chưa tương đương hành vi tự chuyển ký tự |
| CSS tài liệu CKEditor | Đã có một số style ảnh/bảng, nhưng chưa có toàn bộ mapping class ví dụ text-tiny/text-small/text-big/text-huge | Chưa xác nhận hiển thị tương đương toàn bộ |

Bảng và strikethrough có ở PW2, nhưng **không nằm trong toolbar/plugin đang bật của cấu hình CKEditor PW1 được kiểm tra**. Không lấy các tính năng thêm này để bù cho chức năng PW1 còn thiếu. PW1 cũng không có mode mặc định ảnh giữa và text tự chảy cả bốn phía.

## Bằng chứng từ dữ liệu mẫu

- HTML page components có `font-family:Tahoma, Geneva, sans-serif`, `font-size:17px`, `font-size:21px`, màu HSL, `figure`, `iframe`, và ảnh với `width:33.69%`.
- Do đó font/cỡ chữ, media và phần trăm kích thước ảnh là dữ liệu thực tế cần đối chiếu, không chỉ tình huống giả định.
- Không được kết luận “render được HTML trước khi sửa” đồng nghĩa “editor đọc → sửa → lưu lại không mất định dạng”.

## Điều kiện để xác nhận đầy đủ

1. Bổ sung code toolbar, media embed và caption controls.
2. Đồng bộ font/cỡ chữ nguồn, cho phép cỡ tùy ý và chuẩn hóa màu picker.
3. Chuẩn hóa các image wrapper/class, kích thước phần trăm và style nguồn vào model ảnh; kiểm tra resize và đổi layout không phá cấu hình khác.
4. Quyết định/triển khai tương đương TextTransformation và các class nội dung nguồn đang được sử dụng.
5. Kiểm chứng từng chức năng theo chu trình mở dữ liệu PW1 → chỉnh → lưu → tải lại → kiểm tra website thực tế, gồm cả dữ liệu mẫu và fixture các chức năng chưa có trong mẫu.
6. Xử lý lỗi API `/api/sites/3659/pages` đang trả 500 trong các lần kiểm tra UI trước đó để hoàn tất nghiệm thu lưu DB. Lỗi này không được dùng làm bằng chứng rằng Tiptap không hỗ trợ tính năng.

Đã có 7 unit tests cho cấu trúc HTML, đổi màu và 4 bố trí ảnh; chúng **không đủ để nghiệm thu tương đương toàn bộ PW1**. Báo cáo này xác nhận phạm vi chức năng từ source local, không khẳng định source local là chính xác phiên bản đang deploy production.

## Cập nhật triển khai sau đối chiếu (2026-09-11)

Các thiếu sót liệt kê phía trên là trạng thái **trước bản bổ sung**. Bản hiện tại đã thêm:

- Nút inline Code; extension Typography cho tự chuyển ký tự.
- Media toolbar và node giữ HTML media nguồn. Preview iframe hỗ trợ YouTube, Vimeo, SoundCloud player, Dailymotion embed, Spotify embed; chèn file HTTPS MP4/WebM/MP3/OGG/WAV. Không cho iframe tùy ý; chưa tuyên bố tương đương mọi provider CKEditor có thể mở rộng.
- Caption bật/tắt/sửa cho ảnh. Caption nguồn có định dạng được giữ HTML đến khi người dùng sửa nội dung caption bằng input text.
- Danh sách font CKEditor/PW1, gồm Tahoma và font đang lưu; cỡ 9/11/13/17/19/21 và nhập giá trị tùy ý (px/em/rem/%).
- Đổi HSL/RGB/named color sang hex để picker hiển thị đúng.
- Chuẩn hóa figure/image-inline CKEditor thành model ảnh PW2; giữ độ rộng phần trăm; resize bằng kéo chuyển sang kích thước pixel.
- Style class text-tiny/small/big/huge và căn ảnh giữa trong renderer.
- Bộ lọc HTML chung cho editor và renderer giữ iframe provider được duyệt, loại srcdoc/handler và iframe không được phép.

Kiểm chứng tự động hiện có 11 ca cho HTML, layout ảnh, caption có định dạng, percent width, media round-trip, lọc HTML nguy hiểm và màu. Việc đối chiếu toàn bộ production và nghiệm thu lưu DB vẫn là bước riêng; không dùng thay đổi này để khẳng định 100% mọi HTML/plugin PW1.
