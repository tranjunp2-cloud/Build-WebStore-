# Blog content giữ nguyên — exporter 1.6.2

User chốt chỉ migrate content chính. Exporter lưu nguyên chuỗi blog_posts.content trong blogs[].content dưới dạng Lexical root → paragraph → text; không parse HTML, bỏ thẻ/attribute, decode entity, đổi whitespace/xuống dòng, lọc link hoặc trích ảnh trong body. HTML được lưu như text để workflow rich text xử lý sau, không tự render HTML.

content_ms giữ ở CSV nguồn, không thêm field PW2 và không ghép vào content. Raw classifier không kiểm nội dung bên trong hai field. Thumbnail từ blog_posts.image và các field metadata/slug/status/category vẫn chịu kiểm tra cũ. Quy tắc author thiếu → owner tenant từ 1.6.1 giữ nguyên. Blocker không liên quan content vẫn có thể quarantine Blog.

## Kiểm chứng

- Full suite đầu: 480 test pass, 1 test cũ còn kỳ vọng trích ảnh body; đã sửa kỳ vọng theo policy mới.
- Sau sửa và thêm test full artifact: 61 tests content+artifact pass. CSV quoting/CRLF/HTML giữ nguyên; không ghép content_ms; owner fallback và validate artifact pass.
- Importer contract: 68 tests pass, gồm prepare/load 1.6.2, giữ contract cũ và reject outcome sai. TypeScript hai source pass.
- Field-level check trên CSV thật: PROD 6,723 rows, DEV 2,108 rows; content qua mapper + JSON round-trip khớp nguyên văn, không sinh diagnostic/media body. Hash CSV trước/sau không đổi.
- Chưa export lại toàn bộ PROD/DEV hoặc ghi DB. Số rows kiểm tra gồm cả Blog có thể bị chặn bởi lỗi khác; không phải số Blog đã migrate.

Logs và evidence phiên làm việc: /tmp/pw1-blog-content-*.log, /tmp/pw1-blog-content-real-check.json.
