# Test Plan: SEO Dashboard (F12)

> **Feature:** F12 — SEO Dashboard  
> **Ref:** US-009, US-010, US-011

| ID | Scenario | Steps | Expected Result | Priority |
|---|---|---|---|---|
| TC-12.01 | Audit Điểm Health Score | 1. Vào trang `/dashboard/seo` <br> 2. Theo dõi kết quả Load | Hiện 1 điểm Health Score tổng (0 - 100), phân tích Breakdown rõ Issues (Meta, Content, Tech). | High |
| TC-12.02 | Nút "AI Fix All Issues" | 1. Trang có Score < 70, cảnh báo Thiếu Alt tag > 10 images. <br> 2. Nhấn nút "AI Fix All Issues". | UI show progress "Đang xử lý". API fix Alt Text hàng loạt + Generate Missing Title < 15s. Score refresh > 85. | High |
| TC-12.03 | Hoàn tác AI Fix | 1. Vừa submit Fix All (TC-12.02) <br> 2. Bấm Ctrl+Z | DB rollback transaction. Tất cả tag Meta và Alt lại Empty / Về form cũ. | Low |
| TC-12.04 | Generate Sitemap XML | 1. Click "Generate Sitemap" <br> 2. Tới link `slug.primeweb.app/sitemap.xml` | Khởi tạo cấu trúc XML chuẩn Google. Include All URL các page có status Published. Toast Success. | Medium |
| TC-12.05 | Auto Init thẻ SEO ở Publish lần đầu | 1. Chưa config Setting Page SEO bao giờ. <br> 2. Trình Editor bấm Publish | Crawler chèn Meta Title + Meta Description dựa vào tên Store, keyword. Check View-Source có đầy đủ cấu trúc. | High |
| TC-12.06 | Schema Product Rendering (JSON-LD) | 1. Publish Storefront SP A. <br> 2. Truy cập page Product A, mở Chrome Inspect Element | Thẻ `<script type="application/ld+json">` xuất hiện khai báo Schema "Product" / "LocalBusiness" + giá RM. | Medium |
