# Test Plan: Products CRUD (F09)

> **Feature:** F09 — Products CRUD (Dashboard)  
> **Ref:** US-007

| ID | Scenario | Steps | Expected Result | Priority |
|---|---|---|---|---|
| TC-09.01 | Thêm sản phẩm cơ bản | 1. Tới `/dashboard/products` <br> 2. Click "Thêm sản phẩm" <br> 3. Điền đủ: Tên, giá RM, ảnh, Category, Stock | Lưu thành công. Giá trị field Format đúng MYR. Sản phẩm mới hiện trên table. | High |
| TC-09.02 | Validate Ảnh upload | 1. Mở Upload mục Sản phẩm <br> 2. Chọn file > 5MB hoặc file PDF | Hệ thống tự Block action, quăng Toast đỏ. Không gọi lưu ảnh thành công. | Medium |
| TC-09.03 | Xóa mềm sản phẩm | 1. Bấm xóa 1 row Product <br> 2. Verify Toast xuất hiện "Đã xóa. Hoàn tác?" trong 5s. | Sản phẩm ẩn khỏi trang Storefront. Field `deletedAt` được cập nhật thời gian. Bấm Hoàn tác phục hồi ngay. | High |
| TC-09.04 | Trợ lý AI Viết Môtả | 1. Gõ tên SP "Baju Kurung Pink" <br> 2. Nhấn "✨ AI Viết Description" | OpenAI stream Text mô tả thời trang nữ chuẩn. Bảng Review Accept/Discard hiện ra bình thường. | High |
| TC-09.05 | Frontend Sync Test | 1. Nhập và Create 1 SP đang "Active" <br> 2. Truy cập Live Store (`slug.primeweb.app/products`) | Khách ghé Storefront thấy card SP trên layout. Thông tin đồng nhất với Dashboard (Giá, Avatar SP). | High |
| TC-09.06 | Store Halal Cert Upload | 1. Click Checkbox `Halal Certified` <br> 2. Nộp file ảnh Certificate từ JAKIM. | Form mở thêm block Upload. Sau khi submit, Storefront hiện Icon Halal (P2). | Medium |
