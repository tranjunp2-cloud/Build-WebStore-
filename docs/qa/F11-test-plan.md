# Test Plan: Orders Management (F11)

> **Feature:** F11 — Orders Management  
> **Ref:** US-012, US-013

| ID | Scenario | Steps | Expected Result | Priority |
|---|---|---|---|---|
| TC-11.01 | Check out (Thanh toán Stripe thành công) | 1. Giả lập Customer qua Storefront <br> 2. Add To Cart > Checkout <br> 3. Dùng test card / Stripe | Đi tới `/order/{id}/confirm` báo Success. Tạo Order trong Dashboard CMS, stock giảm. | High |
| TC-11.02 | Xử lý Order thất bại (Payment Failed) | 1. Add To Cart > Checkout <br> 2. Đóng Popup Stripe / Hết session / Bank Decline | Webhook trả vể Failed. Order status = PAYMENT_FAILED. Stock reservation bị huỷ sau 30 phút. | High |
| TC-11.03 | Dashboard Order Auto Sync | 1. Một Order Mới vừa Checkout (Test case 11.01) <br> 2. Chờ < 60 giây đứng nguyên ở `/dashboard/orders` | Dữ liệu Order table mọc Row mới không cần F5. Hệ thống gọi Toast in-app và gửi Email welcome. | High |
| TC-11.04 | Chuyển Status + Email Triggers | 1. Dashboard mở 1 Order <br> 2. Đổi status từ "New" sang "Shipped". | DB update cột Status. Resend phát Trigger Email có template chuẩn về Mail khách mua hàng. | High |
| TC-11.05 | Bulk Status Update | 1. Check chọn 5 Orders trạng thái New. <br> 2. Chọn Bulk Actions "Chuyển Processing". | 5 dòng dữ liệu được vá Batch Update. Status chuyển loạt sang Processing > Loading > Done. | Medium |
| TC-11.06 | Hold Inventory lúc thanh toán | 1. SP đang có Stock = 10. Customer bấm nút Pay / tới trang thẻ. Không Pay. | Stock API khoá 1 SP (Available 9). Đợi Pay = Success thì - 1 hẳn. Timeout 30p = + 1 lên lại 10. | High |
