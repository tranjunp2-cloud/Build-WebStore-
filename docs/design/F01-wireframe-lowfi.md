# 📐 Low-fi Wireframes: F01 AI Chat Builder

Dựa trên PRD (`F01-ai-chat-builder.md`) và Design System `Prime AI Builder`, dưới đây là cấu trúc Wireframe Low-fi cho Desktop và Mobile, bao gồm 4 trạng thái bắt buộc (Empty, Loading, Success, Error).

---

## 💻 1. DESKTOP WIREFRAME (≥ 768px)

Cấu trúc: Split View (Chat Panel 380px bên trái, Live Preview chiếm phần còn lại bên phải).

### 1.1 Trạng thái Empty (Chưa có gì)
```text
┌──────────────────────────────────────┐┌────────────────────────────────────────────────────────┐
│ [Logo PrimeWeb]          [X] Close   ││                                                        │
│                                      ││                     [Badge: Draft]                     │
│ 🤖 Xin chào! Tên tôi là              ││                                                        │
│ Prime AI. Hãy mô tả về               ││                                                        │
│ cửa hàng của bạn nhé!                ││                                                        │
│                                      ││                                                        │
│ [Button: 👗 Shop thời trang]          ││            [Illustration: Empty Canvas]                │
│ [Button: 🍰 Tiệm bánh ngọt]           ││             "Website của bạn sẽ hiển                 │
│ [Button: 📱 Đồ công nghệ]             ││              thị ở đây..."                           │
│                                      ││                                                        │
│                                      ││                                                        │
│                                      ││                                                        │
│                                      ││                                                        │
│ ┌───────────────────────────────┐ ↗ ││                                                        │
│ │ Ví dụ: Tôi muốn mở shop thời...│   ││                                                        │
│ └───────────────────────────────┘    ││                                                        │
└──────────────────────────────────────┘└────────────────────────────────────────────────────────┘
```

### 1.2 Trạng thái Loading (Đang tạo)
```text
┌──────────────────────────────────────┐┌────────────────────────────────────────────────────────┐
│ [Logo PrimeWeb]          [X] Close   ││                                                        │
│                                      ││                     [Badge: Generating...]             │
│ 👤 Tôi muốn mở shop thời trang nữ,    ││                                                        │
│ phong cách Hàn Quốc, tên Mira.       ││  ┌──────────────────────────────────────────────────┐  │
│                                      ││  │ [Skeleton: Navbar - Logo] [Skeleton: Menu items] │  │
│ 🤖 Đang tiến hành xây dựng...         ││  └──────────────────────────────────────────────────┘  │
│                                      ││  ┌──────────────────────────────────────────────────┐  │
│ [ ] Phân tích yêu cầu...             ││  │                                                  │  │
│ [ ] Đoán màu sắc chủ đạo...           ││  │              [Skeleton: Header / Hero]           │  │
│ [ ] Tạo bố cục website...            ││  │                                                  │  │
│ [x] Thêm sản phẩm mẫu...             ││  └──────────────────────────────────────────────────┘  │
│                                      ││  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐  │
│                                      ││  │ [Skel: Card] │ │ [Skel: Card] │ │ [Skel: Card] │  │
│                                      ││  └──────────────┘ └──────────────┘ └──────────────┘  │
│ ┌───────────────────────────────┐ 🚫 ││                                                        │
│ │ Đang xử lý... (Disabled)      │    ││                                                        │
│ └───────────────────────────────┘    ││                                                        │
└──────────────────────────────────────┘└────────────────────────────────────────────────────────┘
```

### 1.3 Trạng thái Success (Hoàn thành)
```text
┌──────────────────────────────────────┐┌────────────────────────────────────────────────────────┐
│ [Logo PrimeWeb]          [X] Close   ││                                                        │
│                                      ││                     [Badge: Draft]                     │
│ 🤖 Mọi thứ đã hoàn tất! 🎉            ││  ┌──────────────────────────────────────────────────┐  │
│ Website của "Mira" đã sẵn           ││  │ [MIRA Logo]              [Home] [Shop] [Contact] │  │
│ sàng.                                ││  └──────────────────────────────────────────────────┘  │
│                                      ││  ┌──────────────────────────────────────────────────┐  │
│ Theo tôi phân tích, tông màu          ││  │                                                  │  │
│ "Hồng Pastel" sẽ rất phù hợp.         ││  │     👗 Thời trang nữ thanh lịch & Tinh tế         │  │
│ Bạn có muốn đổi màu không?           ││  │                [Nút: Mua sắm ngay]               │  │
│                                      ││  └──────────────────────────────────────────────────┘  │
│ [Button: Sang trọng (Đen)]           ││  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐  │
│ [Button: Năng động (Vàng)]           ││  │ 👗 Áo Polo   │ │ 👗 Váy chữ A │ │ 👚 Áo khoác  │  │
│                                      ││  │ RM 49.00     │ │ RM 89.00     │ │ RM 120.00    │  │
│ ┌───────────────────────────┐ ┌────┐ ││  └──────────────┘ └──────────────┘ └──────────────┘  │
│ │ Tinh chỉnh lại...         │ │(→) │ ││                                                        │
│ └───────────────────────────┘ └────┘ ││      [Nút: Publish Ngay] [Nút: Edit Manual]            │
└──────────────────────────────────────┘└────────────────────────────────────────────────────────┘
```

### 1.4 Trạng thái Error (Lỗi) + Clarifying Question
```text
┌──────────────────────────────────────┐┌────────────────────────────────────────────────────────┐
│ [Logo PrimeWeb]          [X] Close   ││                                                        │
│                                      ││                     [Badge: Error]                     │
│ 👤 Tôi muốn làm website bán quần áo.  ││                                                        │
│                                      ││                                                        │
│ 🤖 (Clarifying Question)             ││            [Illustration: Lỗi/Chưa đủ thông tin]       │
│ Bạn chưa cung cấp TÊN SHOP.          ││                                                        │
│ Tên shop của bạn là gì?              ││             "Xin lỗi, có quá ít dữ liệu.               │
│                                      ││              Hãy trả lời AI ở khung chat"              │
│ ┌────────────────────────┐           ││                                                        │
│ │ Lỗi kết nối AI [Thử lại]│ (Toast)  ││                                                        │
│ └────────────────────────┘           ││                                                        │
│                                      ││                                                        │
│ ┌───────────────────────────────┐ ↗ ││                                                        │
│ │ Shop của tôi tên là GenZ...   │   ││                                                        │
│ └───────────────────────────────┘    ││                                                        │
└──────────────────────────────────────┘└────────────────────────────────────────────────────────┘
```

---

## 📱 2. MOBILE WIREFRAME (< 768px)

Cấu trúc: Header có Tab Toggle `[💬 Chat | 👁 Preview]`. Dưới là 1 panel duy nhất.

### 2.1 Trạng thái Empty / Chat View
```text
┌──────────────────────────┐
│ [Logo]           [X]    │
│ ┌──────────────────────┐ │
│ │  [💬 Chat] [👁 View] │ │
│ └──────────────────────┘ │
│                          │
│ 🤖 Xin chào! Tôi là AI. │
│ Hãy mô tả cửa hàng của   │
│ bạn nhé!                 │
│                          │
│ [👗 Shop thời trang]     │
│ [🍰 Tiệm bánh ngọt]      │
│ [📱 Đồ công nghệ]        │
│                          │
│                          │
│ ┌─────────────────────┐➤│
│ │Nhập mô tả của bạn.. │ │
│ └─────────────────────┘ │
└──────────────────────────┘
```

### 2.2 Trạng thái Loading / Chat View (Tự cuộn chat)
```text
┌──────────────────────────┐
│ [Logo]           [X]    │
│ ┌──────────────────────┐ │
│ │  [💬 Chat] [👁 View] │ │
│ └──────────────────────┘ │
│                          │
│ 👤 Shop thời trang nữ... │
│                          │
│ 🤖 Đang xây dựng...      │
│ [x] Phân tích yêu cầu... │
│ [ ] Tạo giao diện...     │
│ [ ] Thêm sản phẩm mẫu... │
│                          │
│                          │
│ ┌─────────────────────┐🚫│
│ │Đang xử lý...        │ │
│ └─────────────────────┘ │
└──────────────────────────┘
```
*(Nếu user bấm sang Tab "View", sẽ thấy Skeleton Layout trải xuống dọc màn hình).*

### 2.3 Trạng thái Success / Preview View
```text
┌──────────────────────────┐
│ [Logo]           [X]    │
│ ┌──────────────────────┐ │
│ │  [💬 Chat] [👁 View] │ │
│ └──────────────────────┘ │
│ [Badge: Draft]           │
│ ┌──────────────────────┐ │
│ │ [MIRA]         [ ☰ ] │ │
│ └──────────────────────┘ │
│ ┌──────────────────────┐ │
│ │ 👗 Thời trang nữ...  │ │
│ │    [Mua sắm ngay]    │ │
│ └──────────────────────┘ │
│ ┌──────────────────────┐ │
│ │ Ảnh Váy 1            │ │
│ │ RM 89.00             │ │
│ └──────────────────────┘ │
│  [Nút nổi: Publish Ngay] │
└──────────────────────────┘
```

---

---

## 🛡 3. Ghi chú UI Patterns

- **Dialog Draft Recovery:** Khi user đóng `[X]` hoặc Back trang, sẽ hiện popup confirm: "Có nháp đang lưu. Tiếp tục hay Tạo mới?".
- **Skeleton loading animation:** Dùng hiệu ứng lướt sáng (shimmer/pulse) cho Skeleton ở trạng thái Loading.
- **Scroll Chat:** Khung chat (Left panel hoặc tab Chat) luôn tự scroll xuống cuộn tin nhắn mới nhất.
- **Form Input Disabled:** Khi đang gửi lệnh qua API AI, ô text input mờ đi 50% và không click được, nút mũi tên `[↗]` -> Thành ô xám bị khoá.

---

## 🔍 4. BỘ SUNG: CÁC MÀN HÌNH CHI TIẾT (USER-CENTRIC EDGE CASES)

### 4.1 Trạng thái Refinement (Tương tác Tinh chỉnh)
Sau khi tạo xong, user không vừa ý và muốn AI sửa lại (Ví dụ: "Đổi màu theme sang xanh dương").

```text
┌──────────────────────────────────────┐┌────────────────────────────────────────────────────────┐
│ [Logo PrimeWeb]          [X] Close   ││                     [Badge: Draft - Updating...]       │
│                                      ││                                                        │
│ 👤 Mọi thứ trông ổn, nhưng bạn đổi    ││  ┌──────────────────────────────────────────────────┐  │
│ giúp tôi sang tông màu Xanh Dương    ││  │ [MIRA Logo]              [Home] [Shop] [Contact] │  │
│ được không?                          ││  └─[🔵 Khung Navbar đang loe sáng (CSS highlight)]──┘  │
│                                      ││  ┌──────────────────────────────────────────────────┐  │
│ 🤖 Đã rõ! Đang áp dụng tông màu       ││  │                                                  │  │
│ Xanh Dương (Blue Ocean) cho          ││  │     👗 Thời trang nữ thanh lịch & Tinh tế         │  │
│ website của bạn...                   ││  │              [Nút đổi thành: Xanh Dương]         │  │
│                                      ││  └──────────────────────────────────────────────────┘  │
│ [x] Thay đổi biến CSS Primary        ││                                                        │
│ [x] Cập nhật màu nút bấm             ││                                                        │
│                                      ││                                                        │
└──────────────────────────────────────┘└────────────────────────────────────────────────────────┘
```
**Trải nghiệm người dùng:** Mọi thay đổi qua câu lệnh sẽ highlight (loe sáng) ngay tại Preview Tức Thời, giống màn ảo thuật, giúp user thấy rõ "AI đang thực sự làm việc".

### 4.2 Draft Recovery Dialog (Khôi phục Nháp)
Người dùng vô tình tắt tab hoặc ấn nút `[X] Close`. Lần đăng nhập sau truy cập lại `/builder/new`:

```text
┌────────────────────────────────────────────────────────┐
│                                                        │
│          ┌──────────────────────────────────┐          │
│          │ ⚠️ Bạn có một bản nháp!           │          │
│          │                                  │          │
│          │ Chúng tôi thấy bạn đang tạo dở   │          │
│          │ website "Mira Boutique" cách đây │          │
│          │ 2 giờ. Bạn muốn tiếp tục không?  │          │
│          │                                  │          │
│          │ [Button: Bỏ qua, tạo mới (Đỏ)]    │          │
│          │ [Button: Tiếp tục bản nháp (Xanh)]│          │
│          └──────────────────────────────────┘          │
│                                                        │
└────────────────────────────────────────────────────────┘
```
**Trải nghiệm người dùng:** Xây dựng sự an tâm (Peace of Mind). Họ biết PrimeWeb không vứt bỏ công sức của họ.

### 4.3 Rate Limit / Up-sell Paywall (Hết lượt miễn phí)
Người dùng Free Tier cố gắng ấn "Tạo Website" lần thứ 2.

```text
┌──────────────────────────────────────┐┌────────────────────────────────────────────────────────┐
│                                      ││                     [Badge: View Only]                 │
│ 👤 Tạo giúp tôi một web bán giày...   ││                                                        │
│                                      ││                                                        │
│ 🤖 Ôi! Bạn đã sử dụng hết lượt tạo    ││            [Illustration: Upgrade/Rocket]              │
│ AI miễn phí của tài khoản này!       ││             "Nâng cấp để mở khóa quyền                 │
│                                      ││              năng sáng tạo vô hạn!"                    │
│ ┌─────────────────────────────────┐  ││                                                        │
│ │ 🌟 Gói Pro - RM 49/tháng          │  ││                                                        │
│ │ - Tạo không giới hạn            │  ││                                                        │
│ │ - Không logo PrimeWeb           │  ││                                                        │
│ │ [Nâng cấp ngay]                 │  ││                                                        │
│ └─────────────────────────────────┘  ││                                                        │
│                                      ││                                                        │
└──────────────────────────────────────┘└────────────────────────────────────────────────────────┘
```
**Trải nghiệm người dùng:** Đặt paywall một cách tự nhiên trong luồng chat thay vì chuyển sang một trang báo lỗi khô khan.

### 4.4 Clarifying Options (AI đưa ra nhiều lựa chọn Visual)
Nếu user mô tả quá chung chung, thay vì chỉ hỏi text, AI sẽ render các cấu trúc Card lựa chọn để user "Click" cho nhanh (Thay vì phải gõ lại).

```text
┌──────────────────────────────────────┐
│ 👤 Cho tôi cái web bán đồ ăn.         │
│                                      │
│ 🤖 Đồ ăn thì có rất nhiều loại. Bạn  │
│ thích phong cách nào dưới đây?       │
│                                      │
│  ┌─[Card 1]────────┐ ┌─[Card 2]────┐ │
│  │ 🍔 Đồ ăn nhanh  │ │ ☕ Cafe      │ │
│  │ (Đỏ/Vàng)       │ │ (Nâu/Kem)   │ │
│  └─────────────────┘ └─────────────┘ │
│  ┌─[Card 3]────────┐                 │
│  │ 🥗 Đồ chay/Healthy│                 │
│  │ (Xanh lá)       │                 │
│  └─────────────────┘                 │
│                                      │
│ [Nhập text nếu muốn mô tả khác...]   │
└──────────────────────────────────────┘
```
**Trải nghiệm người dùng:** Gõ bàn phím (đặc biệt trên Mobile) là một cực hình. AI đưa ra Option để Click/Tap sẽ tăng tỉ lệ hoàn thành Onboarding lên đáng kể.
