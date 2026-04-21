# F03 Dashboard Suite & Analytics: UX Audit

> **Trạng thái:** Đã chốt (Finalized)
> **Auditor:** Assistant
> **Ngày:** 14 Tháng 4, 2026
> **Phạm vi:** `src/app/(dashboard)/dashboard/*`, `src/components/dashboard/*`
> **Tham chiếu:** [F03-dashboard.md](../../prd/F03-dashboard.md), [F03-dashboard-stories.md](../../stories/F03-dashboard-stories.md)

## 📌 Tóm tắt (Executive Summary)

Bộ tính năng F03 Dashboard cung cấp trung tâm điều khiển (command center) cơ bản để người dùng theo dõi Lưu lượng truy cập (Traffic), Khách hàng tiềm năng (Leads), Đơn hàng (Orders) và Sức khỏe SEO (SEO Health). Mặc dù các tính năng cốt lõi về phân tích và AI Fix-All đã hoạt động ổn định về mặt kỹ thuật, đợt đánh giá UX này đã phát hiện ra một số điểm cần tối ưu ở **trạng thái dữ liệu trống** và **luồng phục hồi lỗi từ F01**.

Tài liệu này vạch ra các giải pháp thiết kế cần thiết để đưa F03 tuân thủ hoàn toàn với tiêu chuẩn giao diện F18 CMS và giải quyết lỗi ngõ cụt Dashboard từ F01 (GAP-06).

---

## 🎯 1. Đánh giá Component & Analytics

### GAP-01: Analytics Charts & Empty States
**Độ nghiêm trọng:** TRUNG BÌNH 🟡
**Component:** `AnalyticsView.tsx`, `DashboardOverview.tsx`

**Vấn đề:**
1.  **Empty States:** Khi mới kết nối tên miền, biểu đồ trống gây hiểu lầm là lỗi kết nối.
2.  **Khả năng đọc biểu đồ:** Các biểu đồ hiện tại thiếu trục tọa độ rõ ràng và thông tin tương tác, gây khó khăn cho việc theo dõi xu hướng chính xác.

**Giải pháp đề xuất:**
*   **Xử lý Empty State:** Phân biệt rõ "Chưa cấu hình" vs "Dữ liệu bằng 0". Thêm banner "Warming Up" và minh họa SVG.
*   **Nâng cấp Hiển thị Biểu đồ:**
    *   **Trục Toạ độ:** Bổ sung trục X (định dạng ngày `dd/mm/yy`) và trục Y với thang đo metric rõ ràng.
    *   **Tương tác Hover:** Hiển thị Tooltip khi di chuột vào các điểm dữ liệu, bao gồm: Ngày chính xác (`dd/mm/yy`) và Giá trị metric tương ứng.
    *   **Tính nhất quán:** Đảm bảo màu sắc và kiểu dáng đồng nhất trên tất cả các loại biểu đồ (Views, Clicks, Checkout, Revenue).

---

## 🛠 2. Kiểm chứng Tính năng AI (Status Check)

### Khả năng phục hồi của luồng stream SEO "Fix All"
**Trạng thái:** ✅ ĐÃ KIỂM CHỨNG & TỐI ƯU
**Component:** `AIFixModal.tsx`

**Kết quả Audit:**
Đã xem xét thư viện tích hợp SSE trong `AIFixModal.tsx`. Component này thỏa mãn xuất sắc các ràng buộc từ US-F03-05 về khả năng phục hồi một phần, cơ chế Undo (sessionStorage) và chống xung đột dữ liệu.

**Kết luận:**
Không cần chỉnh sửa cấu trúc. Chỉ cần đảm bảo thông điệp phục hồi đúng thực trạng.

---

## 🚨 3. Khắc phục vấn đề F01 & Onboarding

### GAP-02: Luồng phục hồi & Trình trạng "Website chưa xuất bản" (Next Action)
**Độ nghiêm trọng:** NGHIÊM TRỌNG 🛑
**Component:** `DashboardOnboarding.tsx`, `DashboardOverview.tsx`

**Vấn đề:**
1.  **Ngõ cụt (GAP-02):** Nếu AI sập khi đang sinh web, dashboard bị trắng mà không có cách sinh lại.
2.  **Trạng thái "Chưa xuất bản":** Sau khi AI sinh web xong, người dùng thường kẹt ở dashboard với dữ liệu 0 mà không biết rằng cần phải "Publish" để bắt đầu thu thập số liệu.

**Giải pháp đề xuất:**
*   **Smart Stepper (Thanh tiến trình 3 trạng thái):** Nâng cấp thanh tiến trình để hiển thị rõ rệt 3 trạng thái: `Đã hoàn thành` (Completed), `Đang thực hiện` (In Progress - làm nổi bật bước hiện tại), và `Sắp tới` (Upcoming).
*   **Next Best Action Card:** Khi website đã sinh xong nhưng chưa xuất bản, hiển thị một thẻ (card) nổi bật với các yếu tố:
    *   **CTA Chính:** "Publish Website" (nổi bật nhất).
    *   **Giải thích ngắn:** Giải thích rằng người dùng cần xuất bản để bắt đầu thấy các chỉ số metrics.
    *   **Thiết kế:** Thu hút sự chú ý, là thành phần ưu tiên hàng đầu trong UI khi ở trạng thái "Not Published".
*   **DashboardRecoveryBanner:** Cho trường hợp crash dữ liệu ở F01 (trạng thái `failed`).

---

## 📝 4. Kế hoạch triển khai cho Team Code (Action Plan)

1.  **Fix GAP-02 (Ưu tiên Cao):** Triển khai `DashboardRecoveryBanner` và cập nhật logic State Machine cho `DashboardOnboarding.tsx`.
2.  **Nâng cấp Onboarding UI:**
    *   Thiết kế lại Stepper với 3 trạng thái rõ rệt.
    *   Thêm "Next Best Action Card" cho các trang web chưa xuất bản.
3.  **Tối ưu Charts:** 
    *   Cập nhật trục X/Y, format ngày `dd/mm/yy`.
    *   Triển khai hover interactions và tooltips trên tất cả các Dashboard Charts.
4.  **An toàn Analytics:** Đảm bảo xử lý lỗi Rate Limit 429 và Empty States trực quan.

> Kết thúc Audit UX F03


