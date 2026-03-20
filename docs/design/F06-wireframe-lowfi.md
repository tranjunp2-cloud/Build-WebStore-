# 📐 Low-fi Wireframes: F06 Onboarding Flow

Dựa trên PRD v3.0 (`F06-onboarding.md`) và User Stories (`F06-onboarding-stories.md`).
Bao gồm Welcome Screen, AI Discovery Wizard (Carousel), và Mobile Web Experience.

---

## 🗺️ Tóm tắt User Flow

```text
[Auth Thành Công (F02)] 
        │
        ▼
[Welcome Screen] ──(Bỏ qua)──▶ [CMS Dashboard]
        │
   (Create My Store)
        │
        ▼
[AI Builder (F01)] ──(Hoàn tất/Lưu)──▶ [CMS Dashboard (admin/dashboard)]
                                                │
                                 (Check `has_seen_ai_wizard` == false?)
                                        ┌───────┴───────┐
                                       Yes              No
                                        │               │
                                        ▼               ▼
                              [AI Discovery Wizard]  [Sử dụng CMS bình thường]
                              - Slide 1: AI Editor
                              - Slide 2: AI Content 
                              - Slide 3: AI SEO
                                        │
                                (Đóng / Khám phá)
                                        │
                                        ▼
                         [API Patch: has_seen_ai_wizard = true]
```

---

## 💻 1. DESKTOP WIREFRAME (≥ 768px)

### 1.1 Welcome Screen (Zero-Friction)
- **Luồng:** Màn hình đầu tiên sau khi Auth (F02) thành công.
- **Mục tiêu:** 1 CTA duy nhất hướng tới AI Builder, giải thích "5-minute promise", không có competing actions.

```text
┌────────────────────────────────────────────────────────────────────────────┐
│ [Logo PrimeWeb]                                                            │
│                                                                            │
│                                                                            │
│                           🎉 Chào mừng tới PrimeWeb                       │
│                       Bắt đầu xây dựng cửa hàng của bạn                    │
│                 (Hoàn tất chỉ trong 5 phút với AI của chúng tôi)           │
│                                                                            │
│                           [ 🚀 Create My Store ]                           │
│                                                                            │
│                           Bỏ qua & Đi tới Dashboard                        │
│                                                                            │
│                                                                            │
│                          Step 1 of 2: Create Store                         │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 AI Discovery Wizard (CMS Overlay Carousel)
- **Luồng:** Hiển thị 1 lần duy nhất khi user vào CMS Dashboard lần đầu (`has_seen_ai_wizard` = false).
- **Mục tiêu:** Giới thiệu 3 chức năng AI chính (AI Editor, AI Content, AI SEO) trong một modal focus.

**Slide 1: AI Editor**
```text
CMS Dashboard - Background is darkened (opacity 0.6)
┌─────────────────────────────────────────────────────────────┐
│ ✦ Khám phá Quyền năng AI                              [✕]   │
│                                                             │
│   ┌─────────────────────────────────────────────────────┐   │
│   │                                                     │   │
│   │                 [ 🖼️ GIF/Video ]                    │   │
│   │   (Minh họa AI Editor đổi màu/layout - Max 500KB)   │   │
│   │                                                     │   │
│   └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Thiết kế bằng AI: Sửa giao diện qua chat                   │
│  Hỗ trợ bạn thay đổi thiết kế nhanh chóng (đổi màu, thêm    │
│  module) bằng cách chat với AI, không cần kéo thả hay code. │
│                                                             │
│                      (●) (○) (○)                            │
│                                                             │
│  [ Bỏ qua hướng dẫn ]                  [ Tiếp tục ➔ ]       │
└─────────────────────────────────────────────────────────────┘
```

**Slide 2: AI Content Generation**
```text
CMS Dashboard - Background is darkened (opacity 0.6)
┌─────────────────────────────────────────────────────────────┐
│ ✦ Khám phá Quyền năng AI                              [✕]   │
│                                                             │
│   ┌─────────────────────────────────────────────────────┐   │
│   │                                                     │   │
│   │                 [ 🖼️ GIF/Video ]                    │   │
│   │   (Minh họa AI viết mô tả sản phẩm - Max 500KB)     │   │
│   │                                                     │   │
│   └─────────────────────────────────────────────────────┘   │
│                                                             │
│  AI Content: Viết lách siêu tốc                             │
│  Biểu tượng ✨ xuất hiện ở mọi nơi. Hỗ trợ tự động viết mô  │
│  tả sản phẩm, bài blog chuẩn SEO ngay khi bạn bí ý tưởng.   │
│                                                             │
│                      (○) (●) (○)                            │
│                                                             │
│  [ Bỏ qua hướng dẫn ]                  [ Tiếp tục ➔ ]       │
└─────────────────────────────────────────────────────────────┘
```

**Slide 3: AI SEO Assistant**
```text
CMS Dashboard - Background is darkened (opacity 0.6)
┌─────────────────────────────────────────────────────────────┐
│ ✦ Khám phá Quyền năng AI                              [✕]   │
│                                                             │
│   ┌─────────────────────────────────────────────────────┐   │
│   │                                                     │   │
│   │                 [ 🖼️ GIF/Video ]                    │   │
│   │ (Minh họa phân tích từ khóa và chấm điểm - Max 500KB)│   │
│   │                                                     │   │
│   └─────────────────────────────────────────────────────┘   │
│                                                             │
│  AI SEO: Tối ưu trang web tự động                           │
│  Hỗ trợ phân tích từ khoá và chấm điểm SEO tự động. Đưa     │
│  website lên top tìm kiếm dễ dàng mà không cần chuyên gia.  │
│                                                             │
│                      (○) (○) (●)                            │
│                                                             │
│                                        [ Khám phá CMS ngay ]│
└─────────────────────────────────────────────────────────────┘
```

---

## 📱 2. MOBILE WIREFRAME (< 768px)

### 2.1 Ergonomic Welcome Screen
- **UX:** Tối ưu hóa cho ngón tay cái (Thumb zone). Nút "Create My Store" tràn viền, cố định ở dưới cùng, dễ dàng chạm.

```text
┌─ 📱 Mobile Browser ──────┐
│ [Logo]                   │
│                          │
│ 🎉 Chào mừng tới         │
│ PrimeWeb                 │
│                          │
│ Bắt đầu xây dựng cửa     │
│ hàng của bạn ngay hôm    │
│ nay chỉ trong 5 phút!    │
│                          │
│ Bỏ qua & Đi tới Dashboard│
│                          │
│                          │
│ Step 1 of 2: Create Store│
│ ┌──────────────────────┐ │ ← Cố định ở đáy,
│ │ 🚀 Create My Store    │ │    chiếm 100% width
│ └──────────────────────┘ │
└──────────────────────────┘
```

### 2.2 Swipeable AI Discovery Carousel (Overlay)
- **UX:** Fullscreen, làm mờ background 100%. Hỗ trợ vuốt trái/phải để đổi slide, ẩn bớt các nút thao tác phức tạp để tối ưu touch target.

```text
┌─ 📱 Mobile AI Wizard ────┐
│ ✦ Khám phá AI       [✕] │
│                          │
│ ┌──────────────────────┐ │
│ │                      │ │
│ │   [ 🖼️ GIF/Video ]   │ │
│ │                      │ │
│ └──────────────────────┘ │
│                          │
│ Thiết kế bằng AI: Sửa    │
│ giao diện qua chat       │
│                          │
│ Hỗ trợ bạn thay đổi thiết│
│ kế nhanh chóng bằng cách │
│ chat với AI.             │
│                          │
│      (●) (○) (○)         │ ← Swipe left/right ↔️
│                          │    để chuyển slide
│                          │
│ [Bỏ qua]      [Tiếp tục] │ ← Size touch-friendly 
└──────────────────────────┘
```

---

## 🛡 3. Ghi chú UI Patterns & Trạng thái

- **Loading State:** Sử dụng Shimmer skeleton layout bên trong hộp media 16:9 khi chờ GIF tải. Nút CTA Disable/Loading trong lúc chờ transition giữa các slide.
- **Error State (Media Load Fail):** Fallback sử dụng 1 hình ảnh minh hoạ tĩnh nếu GIF/Video load lỗi để giao diện hoàn chỉnh.
- **Success/Dismissal State:** Fade-out UI modal nhẹ nhàng khi ấn "Khám phá CMS ngay", "Bỏ qua hướng dẫn" hoặc khi nhấn tắt nút "✕". Gọi API patch `has_seen_ai_wizard` thành `true` khi dismiss modal này.
- **Mobile Swipe Gestures:** Set CSS `touch-action: pan-y` để vuốt chuyển qua lại các hướng dẫn mà không kích hoạt thao tác pull-to-refresh của mobile browser.
