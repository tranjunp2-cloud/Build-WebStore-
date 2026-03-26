# F07 Template Gallery — Design & Wireframe Report

> **Epic:** AI Editor Integration
> **Feature Code:** F07
> **Priority:** P1
> **Depends on:** F05 AI Editor

Tài liệu này cung cấp bản vẽ Wireframe dạng text chi tiết cho tính năng Template Gallery (F07), bám sát các luồng đã định nghĩa trong PRD và User Stories. Giao diện tích hợp dưới dạng Overlay Module đè lên AI Editor.

---

## 1. Màn Hình Chính: Templates Modal / Popup (Desktop)

*Khi click vào thẻ [Templates 🎨] trong AI Editor, một Popup Modal hiển thị bao trùm khu vực giữa màn hình. Chứa khung Chat AI nhập liệu phía trên và danh sách Grid kết quả phía dưới.*

```text
┌───────────────────────────────────────────────────────────────┐
│ ┌─ 🎨 Cửa hàng Mẫu Giao Diện (Templates) ───────────────[X]─┐ │
│ │                                                           │ │
│ │ ┌─ AI Search ───────────────────────────────────────────┐ │ │
│ │ │ ✨ Bạn đang phân vân? Chat với AI để AI gợi ý mẫu       │ │ │
│ │ │ ┌───────────────────────────────────────────────────┐ │ │ │
│ │ │ │ Nhập "Mẫu nhà hàng lãng mạn" hoặc "Shop thể thao"  │ │ │ │
│ │ │ └───────────────────────────────────────────────────┘ │ │ │
│ │ │                                 [ Tự động tối ưu ]      │ │ │
│ │ └───────────────────────────────────────────────────────┘ │ │
│ │                                                           │ │
│ │ 📂 Danh mục: [All]  [F&B]  [Retail]  [Portfolio]  [News]  │ │
│ │                                                           │ │
│ │ ┌─ Mẫu Thể Thao Pro ─┐ ┌─ Foodie Haven ──────┐            │ │
│ │ │ 🖼️ IMAGE THUMB     │ │ 🖼️ IMAGE THUMB     │  ..        │ │
│ │ │                    │ │                    │            │ │
│ │ │ Tags: Sport, Gym   │ │ Tags: Food, Cafe   │            │ │
│ │ │ ┌────────────────┐ │ │ ┌────────────────┐ │            │ │
│ │ │ │ [👁 Preview]    │ │ │ │ [👁 Preview]    │ │            │ │
│ │ │ │ [✨ Tự bọc Data]│ │ │ │ [✨ Tự bọc Data]│ │            │ │
│ │ │ └────────────────┘ │ │ └────────────────┘ │            │ │
│ │ └────────────────────┘ └────────────────────┘            │ │
│ └───────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────┘
```

---

## 2. Màn Hình Chi Tiết: Full Preview Modal (View-Only)

*Khi người dùng bấm "Preview" tại một Template bất kỳ. Modal này hiển thị Fullscreen (Toàn màn hình) nội dung website đã được ghép Data cũ (Smart Swap). Iframe này là dạng View-Only (tắt event hover/click).*

```text
┌───────────────────────────────────────────────────────────────┐
│ ┌─ Top Navbar (Cố định - Sticky Top) ───────────────────────┐ │
│ │ [← Quay lại Cửa Hàng]       Mẫu: Mẫu Thể Thao Pro         │ │
│ │                                      [ Nút Đóng "X" ]     │ │
│ └───────────────────────────────────────────────────────────┘ │
│                                                               │
│ ┌─ Iframe Content (Scrollable, View-Only) ──────────────────┐ │
│ │                                                           │ │
│ │  (Header của khách đã được đổ sang màu xanh/template mới) │ │
│ │  [ Logo Store ]        [ Home ] [ Products ] [ About ]    │ │
│ │                                                           │ │
│ │  ======================================================   │ │
│ │  =  "Vượt qua giới hạn bản thân" (Text cũ của khách)  =   │ │
│ │  =  [ Ảnh nền Hero cũ của khách được Map sang ]       =   │ │
│ │  =                                                    =   │ │
│ │  =                 [ MUA NGAY MIỄN PHÍ SHIP ]         =   │ │
│ │  ======================================================   │ │
│ │                                                           │ │
│ │  (Nếu người dùng click vào text chữ, KHÔNG CÓ phản hồi)   │ │
│ └───────────────────────────────────────────────────────────┘ │
│                                                               │
│ ┌─ Bottom CTA Bar (Cố định, Nổi bật) ───────────────────────┐ │
│ │ Bạn thấy thích mẫu này?         [ ✨ APPLY THIS TEMPLATE ]│ │
│ └───────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────┘
```

---

## 3. Cảnh Báo Guard Rail (Chống ghi đè Nhầm lúc Save)

*Modal xuất hiện trên giao diện Editor chính sau khi user đã Apply Template mới và lỡ bấm nút [🚀 Lưu Template / Publish] ở Navbar.*

```text
       ┌── ⚠️ Lưu ý Cực Kỳ Quan Trọng ───────────────[X]┐
       │                                                │
       │ Thay đổi sẽ được lưu vĩnh viễn, bạn không thể  │
       │ HOÀN TÁC (Undo) về giao diện cũ sau bước này.  │
       │                                                │
       │ 💡 Hãy chắc chắn rằng bạn hài lòng với giao    │
       │ diện hiện tại. Content Text/Image đã được mapping│
       │ đầy đủ và không bị thất thoát.                 │
       │                                                │
       │                   [ Huỷ ]    [ Xác nhận Lưu 🚀]│
       └────────────────────────────────────────────────┘
```

---

## 4. Mobile Optimized View (Bottom Sheet Gallery)

*Trên màn hình điện thoại (< 768px). Template Gallery thay vì hiện ở giữa màn hình dính chật chội, sẽ mọc lên dưới dạng Bottom Sheet (rượt từ dưới lên chiếm 90% chiều cao màn hình).*

```text
📱 Mobile View (Bottom Sheet Gallery)
┌─────────────────────────────┐
│ (Đang ở Editor mờ phía sau) │
├─────────────────────────────┤
│ ┌─ ▬▬ (Vuốt để đóng) ─────┐ │ ◄── Kéo xuống để ẩn
│ │ Cửa hàng Mẫu Giao Diện  │ │
│ │                         │ │
│ │ ┌─ AI Search ─────────┐ │ │ ◄── Input chat dính trên cùng sheet
│ │ │ Chat với AI tìm mẫu  │ │ │
│ │ └─────────────────────┘ │ │
│ │                         │ │
│ │ [All] [F&B] [Retail]    │ │
│ │                         │ │
│ │ ┌─ Grid 2 cột (Tối ưu) ─┐ │
│ │ │ ┌─ Mẫu Thể Thao ─┐    │ │
│ │ │ │ 🖼️ IMAGE       │    │ │
│ │ │ │ [👁 Preview ]   │    │ │ ◄── Tap Target to (≥ 44x44px)
│ │ │ │ [✨ Apply   ]   │    │ │
│ │ │ └────────────────┘    │ │
│ │ │ ┌─ Mẫu Làm Đẹp ──┐    │ │
│ │ │ │ 🖼️ IMAGE       │    │ │
│ │ │ │ [👁 Preview ]   │    │ │
│ │ │ │ [✨ Apply   ]   │    │ │
│ │ │ └────────────────┘    │ │
│ │ └───────────────────────┘ │
└─────────────────────────────┘
```

---

## 5. UI States & Fallbacks

1. **Empty State:** Khi truy vấn AI không tìm ra mẫu `(Vd: "Tôi muốn mẫu phi hành gia vũ trụ")`, Grid trả về 0 kết quả -> Hiện Vector đồ hoạ "Phi hành gia bối rối" + dòng text: *"Chúng tôi chưa có mẫu giao diện phù hợp với yêu cầu này. Hãy thử từ khoá khác nhẹ nhàng hơn nhé!"*
2. **Skeleton Loading:** Khi User click tìm kiếm, lúc chờ AI Search phản hồi (1-2s), hiển thị các thẻ Card nhấp nháy Skeleton trắng/xám giữ chỗ, tạo cảm giác app đang chạy nhanh.
3. **Data Mapping Notification (Toast):** Gửi Toast Message chữ vàng cam *"Một số phần (như Video, Thư viện Ảnh) không tương đồng với Mẫu mới và đã được làm mờ (ẩn) nhằm tránh phá vỡ giao diện."* khi Smart Mapping phát hiện orphan block.
4. **Trạng thái Undo (Hoàn Tác):** Nút Undo `[⤺ Hoàn tác cài đặt template]` xuất hiện kế bên thanh công cụ Editor MÀU ĐỎ nổi bật, để báo hiệu với khách "Tôi luôn có thể backup". Sau khi khách lỡ click *Xác nhận Lưu* ở Box số 3, Nút này Disable mờ căm đi.

---

## 6. Tích hợp AI Editor Toolbar (Trạng thái Hoàn Tác / Undo)

*Để làm rõ **FR-09, FR-11, FR-12**, đây là phần Navbar của UI Editor chính sau khi user vừa bấm Apply Template từ Gallery.*

```text
┌─ Editor Toolbar ───────────────────────────────────────────────────────────┐
│ [Pages ▼] [Templates 🎨]  [⤺ Hoàn tác cài đặt Template]    [👁] [🚀 Lưu] │
└────────────────────────────────────────────────────────────────────────────┘
```
**Quy tắc Tương tác & Hiển thị:**
- Nút `[⤺ Hoàn tác cài đặt Template]` chỉ xuất hiện lộ diện/Clickable ngay sau khi người dùng Apply một mẫu mới. Nút được thiết kế nổi bật (Outline đỏ hoặc Background nhạt cảnh báo).
- **Single-step Undo (FR-09, FR-10):** Áp dụng mẫu A -> Undo về trạng thái gốc. Nếu áp dụng mẫu A xong lại trỏ sang mẫu B, điểm Undo sẽ bị ghi đè, lúc này Undo chỉ đưa User lùi về mẫu A.
- **Sự kiện Bị Vô Hiệu (FR-12):** Ngay khi User bấm `[🚀 Lưu]`, Modal Guard Rail (Mục 3) hiện ra. Nếu User bấm "Xác nhận Lưu Thành Công", nút Hoàn tác bị Disable (chuyển xám mờ) hoặc ẩn hoàn toàn để không gây rối.
