# Test Plan: AI Editor (F05)

> **Feature:** F05 — AI Editor (Split Screen)  
> **Ref:** US-004, US-005, US-006, US-007

| ID | Scenario | Steps | Expected Result | Priority |
|---|---|---|---|---|
| TC-05.01 | Bố cục Layout Split Screen | 1. Truy cập `/editor/:siteId` | Layout chia 3: Trái AI Chat (380px), Giữa Preview Iframe, Phải Settings (320px). Toolbar đầy đủ action. Badge hiển thị đúng status. | High |
| TC-05.02 | AI Edit bằng Text Chat | 1. Gõ: "Đổi màu chủ đạo thành xanh mint" vào khung chat <br> 2. Gửi lệnh | AI trả về text xác nhận và Preview Iframe áp dụng thiết kế mới realtime. Message chat có option Undo. | High |
| TC-05.03 | Hoàn tác (Undo/Redo) | 1. Gửi lệnh đổi màu (TC-05.02) <br> 2. Bấm Ctrl+Z (Undo) <br> 3. Bấm Ctrl+Y (Redo) | Trạng thái Preview Iframe UI lùi về chính xác thiết kế cũ (Undo), và tiến tiếp về thiết kế xanh mint (Redo). | High |
| TC-05.04 | Auto-save Draft State | 1. Chỉnh sửa văn bản / UI <br> 2. Đóng tab lập tức không ấn Save. <br> 3. Truy cập lại link editor. | Debounce 3s đã tự động save. Lịch sử chỉnh sửa bảo toàn, Badge hiển thị "Draft". | High |
| TC-05.05 | Quản lý Page (Tạo mới) | 1. Chuyển sang thẻ "Pages" <br> 2. Click "Thêm trang mới" <br> 3. Nhập "Khuyến mãi" | Tạo page với slug `khuyen-mai` thành công. Redirect vào Iframe page đó. | Medium |
| TC-05.06 | Quản lý Page (Xóa mềm) | 1. Chọn 1 page đang có <br> 2. Click xoá <br> 3. Chờ 5 giây không undo | Page bị soft delete (`deletedAt != null`), mất khỏi danh sách trang Published. | Medium |
| TC-05.07 | Inline Edit Content ✨ | 1. Hover vào một dòng Typography 200ms <br> 2. Click "✨ Edit with AI" <br> 3. Nhập: Make it funny | Khung popup Mini xuất hiện, nội dung text được AI sinh lại và Preview update ngay lập tức (chỉ element đó đổi). | High |
| TC-05.08 | Thêm section mới từ Chat | 1. Gõ: "Add a testimonials section with 3 customer reviews" vào chat | Cấu trúc layout tự mọc thêm 1 Section Testimonial ở dưới cùng preview. Design chuẩn style cả site. Kéo thả được block này. | Medium |
