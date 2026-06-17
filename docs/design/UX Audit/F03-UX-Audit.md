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

### GAP-03: Onboarding Checklist "Get Your Store Ready" + CTA Banner "Almost Ready" (Issue #1224)
**Độ nghiêm trọng:** TRUNG BÌNH 🟡
**Component:** `DashboardOnboarding.tsx` (mở rộng 2 → 4 bước, **KHÔNG** tạo file mới), `OverviewView.tsx`

**Bối cảnh:** Issue [#1224](https://github.com/primeproduction/ech-prime-web-v2/issues/1224) yêu cầu thêm checklist 4 bước + CTA banner phía trên Overview Widgets. Spec UI/CTA đã rõ trong issue. Mục dưới đây bổ sung phần **còn thiếu**: **bản đồ nguồn dữ liệu (data-source map)** cho từng bước, vì hiện `DashboardOnboarding` mới nhận `hasWebsite / hasPublishedSite / hasIncompleteSite / aiStatusFailed / siteId` — chưa có dữ liệu cho 2/4 bước.

#### 🔌 Data-source map (server-side, fetch trong `OverviewView.tsx`, truyền prop xuống)

| # | Task (UI) | Điều kiện "done" | Nguồn dữ liệu thật | Trạng thái hiện tại |
|---|-----------|------------------|--------------------|---------------------|
| 1 | Add Your First Product | `count(products) > 0` | `payload.find({ collection: 'products', where: { tenant, status: 'active' } })` — **đã fetch** tại `OverviewView.tsx:281` (`productsRes`) | ✅ Có sẵn — chỉ cần truyền prop `productCount` |
| 2 | Customize Your Store Design | User đã lưu cấu hình giao diện ≥ 1 lần | `Sites.theme` (group: `primaryColor`, `secondaryColor`, `backgroundColor`, `fontHeading`…) | ⚠️ **Cần định nghĩa** — xem ghi chú bên dưới |
| 3 | Set Up Payment & Shipping | ≥ 1 payment gateway active **VÀ** shipping enabled | Payment: `Tenants.payments.*` (các checkbox `payment_card`, `payment_fpx`, `payment_cod`, `payment_qr`, `xendit_tng`, `xendit_grabpay`, `xendit_duitnow`, `xendit_fpx`, `xendit_shopeepay`, `xendit_boost`, `xendit_mae`) — done khi **bất kỳ** toggle = `true`. Shipping: `Sites.shippingConfig.enabled === true` | ❌ **Chưa fetch** — cần query thêm |
| 4 | Publish Your Website | site `status === 'published'` | `Sites.status` (`draft` / `published` / `archived`) — **đã có** `hasPublishedSite` tại `OverviewView.tsx:102` | ✅ Có sẵn |

#### 🧠 Công thức tiến độ
`progressPct = round(doneCount / 4 × 100)` — section ẩn khi `doneCount === 4` (giữ pattern `if (allDone) return null` đang có).

#### 🚩 CTA Banner "Almost Ready"
- **Hiển thị khi:** Task 3 (Payment & Shipping) chưa done.
- **"Complete Setup"** → redirect **`/settings/payments`** (route thật, **không** phải `/store-config/payment` như spec gốc ghi nhầm).
- **"I'll do this later"** → ẩn tạm trong phiên (`sessionStorage`); hiện lại ở lần login sau nếu chưa setup xong.

#### ⚠️ Ghi chú quan trọng cho Task 2 (cần PM/Dev chốt)
Các field trong `Sites.theme` đều có `defaultValue` (vd `primaryColor='#0ea5e9'`) → **không thể** phân biệt "đã lưu" vs "giá trị mặc định" chỉ bằng việc field có dữ liệu. 3 hướng xử lý (khuyến nghị (a)):
- **(a) Khuyến nghị:** so sánh `theme` hiện tại với bộ default — nếu khác default ⇒ coi như đã customize. KISS, không cần migration.
- (b) Thêm flag boolean `Sites.themeCustomized` (cần migration `scripts/db-setup.js`).
- (c) Dùng mốc `updatedAt` của site sau lần edit builder đầu tiên (kém chính xác).

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
5.  **Fix GAP-03 (Issue #1224):** Mở rộng `DashboardOnboarding` 2 → 4 bước theo data-source map ở trên; fetch thêm payment toggle (`Tenants.payments.*`) + shipping (`Sites.shippingConfig.enabled`) trong `OverviewView.tsx`; chốt cách xác định Task 2 (khuyến nghị so sánh `Sites.theme` với default); redirect "Complete Setup" → `/settings/payments`.

> Kết thúc Audit UX F03


