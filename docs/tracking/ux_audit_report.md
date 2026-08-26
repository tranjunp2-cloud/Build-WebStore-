# PrimeWeb — UX Audit Report 🔍

> **Ngày**: 07/03/2026 | **Góc nhìn**: Chủ doanh nghiệp SME, không biết code, muốn có website nhanh

---

## Tổng Quan: Vấn Đề Cốt Lõi

**PrimeWeb hiện tại là một "tech demo" — không phải một sản phẩm cho user thật.**

Tất cả tính năng đều hoạt động ở mức kỹ thuật, nhưng khi đứng ở góc độ **chủ tiệm cafe, owner shop, freelancer** — chưa ai có thể dùng PrimeWeb để tạo một website THẬT và mang đi kinh doanh.

---

## User Journey Map — Điểm Đứt Gãy

```
User nghe về PrimeWeb → Vào Homepage → Đăng ký → Dashboard → ???
                                                               ↓
                              "Tôi phải làm gì tiếp theo?" ← ĐỨNG ĐÂY
```

> [!CAUTION]
> **Insight quan trọng nhất**: User KHÔNG BIẾT PHẢI LÀM GÌ SAU KHI ĐĂNG KÝ. Dashboard hiện 3 site với globe icons, stats giả, và nút "Create New Website" — nhưng không có hướng dẫn nào.

---

## Phân Tích Từng Màn Hình

### 1. Marketing Homepage — ⭐ 4/5

![Marketing Homepage](file:///Users/ngotuannhan/.gemini/antigravity/brain/aaf1c2e7-a115-468f-a851-59537ad53299/marketing_homepage_1772887226938.png)

**✅ Tốt**: Design đẹp, gradient ấn tượng, messaging rõ
**❌ Thiếu**:
- Nút "Watch Demo" → placeholder, không có demo thật
- Không có **social proof** (testimonials, số liệu khách hàng)
- Không có **template showcase** hoặc demo website mẫu
- Pricing section không có → user không biết giá

### 2. Login / Register — ⭐ 3.5/5

![Login Page](file:///Users/ngotuannhan/.gemini/antigravity/brain/aaf1c2e7-a115-468f-a851-59537ad53299/login_page_1772887292087.png)

**✅ Tốt**: Clean, minimal
**❌ Thiếu**:
- Không có **Forgot Password**
- Không có **Social Login** (Google)
- Không có Terms of Service checkbox
- Không hiển thị rõ **giá trị** khi đăng ký ("Tạo website miễn phí trong 5 phút")

### 3. Dashboard — ⭐ 3/5

![Dashboard](file:///Users/ngotuannhan/.gemini/antigravity/brain/aaf1c2e7-a115-468f-a851-59537ad53299/dashboard_page_1772887263496.png)

**✅ Tốt**: Layout tổng quan, greeting cá nhân hóa, banner nhắc publish
**❌ Nghiêm trọng**:
- **Tất cả site cards chỉ hiện globe icon** → user không nhận ra site nào là site nào
- Stats **hardcoded**: Views = 0, Storage = 0/500GB, AI Credits = 20/20
- Sidebar: SEO, Analytics, Billing đều ghi "Soon" → **mất tin tưởng**
- "Media" link đi đâu? → không rõ
- **KHÔNG CÓ onboarding flow** cho user mới → "Tạo website đầu tiên nhé!"

### 4. Template Gallery — ⭐ 2.5/5

![Template Gallery](file:///Users/ngotuannhan/.gemini/antigravity/brain/aaf1c2e7-a115-468f-a851-59537ad53299/templates_gallery_page_1772887454383.png)

**✅ Tốt**: Categories, search, design card đẹp
**❌ Nghiêm trọng**:
- **Thumbnail là wireframe giả** (thanh xám + nút màu) → user không thấy website thật trông như thế nào
- Không có **Live Preview** khi hover hoặc click
- Nút "Sử dụng" → tạo site nhưng **không hỏi tên doanh nghiệp** → user không customize được
- **Không có demo link** để xem website mẫu trước khi chọn

### 5. AI Builder — ⭐ 3.5/5

**✅ Tốt**: Chat conversational, 3-step flow
**❌ Thiếu**:
- Rule-based, **chưa dùng AI thật** → content lặp lại, không sáng tạo
- Không có **quick chips** ("Cafe", "Restaurant", "Beauty Salon") → user phải tự nghĩ
- Khi tạo xong, **redirect nhưng user không biết site vừa tạo ở đâu**
- Không có progress animation khi đang generate

### 6. Editor — ⭐ 3.5/5

![Editor](file:///Users/ngotuannhan/.gemini/antigravity/brain/aaf1c2e7-a115-468f-a851-59537ad53299/editor_page_with_settings_1772887562765.png)

**✅ Tốt**: 3-panel layout chuyên nghiệp, theme controls, block list, publish
**❌ Nghiêm trọng**:
- **Không click-to-edit** → user phải biết panel nào edit cái gì
- **Không drag-drop** → không thay đổi thứ tự block
- Block settings chỉ hiện **Logo Text** → không edit được nội dung block
- Theme changes **không real-time** → iframe không reload tự động
- Save button luôn disabled (Save chỉ active khi có thay đổi, nhưng user thường không hiểu)

### 7. Published Site — ⭐ 4/5

**✅ Tốt**: Typography đẹp, responsive, nội dung có ý nghĩa
**❌ Thiếu**:
- Ảnh là **placeholder** (gradient backgrounds) → doanh nghiệp thật cần ảnh thật
- Contact form **không gửi email thật**
- Footer links **không hoạt động**
- **Không có Google Analytics** / tracking

---

## 🎯 Top 10 Điều User THẬT SỰ CẦN

Xếp theo mức ảnh hưởng với user:

| # | Insight | Tại sao quan trọng | Mức độ |
|---|---------|-------------------|--------|
| 1 | **First-time onboarding** | User mới = mất hướng hoàn toàn | 🔴 Critical |
| 2 | **Template live preview** | User chọn template bằng MẮT, không bằng mô tả | 🔴 Critical |
| 3 | **Site thumbnail screenshots** | Dashboard với globe icons = vô nghĩa | 🔴 Critical |
| 4 | **Click-to-edit text** | "Đây là EDITOR mà không edit được text?" | 🟡 High |
| 5 | **Real images** (upload hoặc AI gen) | Website toàn gradient = không dùng được | 🟡 High |
| 6 | **Contact form hoạt động** | SME cần nhận contact từ khách hàng | 🟡 High |
| 7 | **Custom domain hướng dẫn** | "Website tôi sống ở URL nào?" | 🟡 High |
| 8 | **Ẩn sidebar items "Soon"** | Giao diện có 3 chỗ "Soon" = thiếu chuyên nghiệp | 🟢 Medium |
| 9 | **Block drag-drop reorder** | User muốn About trước Hero? Không làm được | 🟢 Medium |
| 10 | **Mobile responsive preview** | User muốn check site trên mobile | 🟢 Medium |

---

## 🔄 Đề Xuất Redesign — 3 Cấp Độ

### Cấp 1: Quick Wins (1-2 ngày) — Sửa ngay

1. ✅ ~~**First-time empty state**~~ — DONE: Card hai hướng (AI Builder + Templates)
2. ✅ ~~**Ẩn sidebar "Soon"**~~ — DONE: Chỉ còn Dashboard, My Sites, Templates, Media, Settings
3. **Template preview fullscreen**: Click template → modal preview toàn trang trước khi chọn
4. ✅ ~~**Site card thumbnails**~~ — DONE: Gradient màu + initials thay cho globe icon
5. ✅ ~~**Editor: hiện tất cả field**~~ — DONE: Headline, Subheadline, CTA, Description editable

### Cấp 2: Core UX (3-5 ngày) — Tạo sản phẩm thật

6. **Inline text editing**: Click text trên preview → edit trực tiếp
7. **Image upload + AI generate**: Cho user upload ảnh hoặc AI tạo ảnh
8. **Working contact form**: Gửi email notification khi khách hàng submit
9. **Block drag-drop**: Kéo thả để sắp xếp blocks
10. **Mobile/tablet preview**: Toggle viewport size trong editor

### Cấp 3: Growth (1-2 tuần) — Scale

11. **Google login**: Đăng ký nhanh hơn
12. **Real analytics dashboard**: Page views, unique visitors
13. **Custom domain wizard**: Step-by-step gắn domain riêng
14. **SEO checklist**: Hướng dẫn user tối ưu meta tags
15. **AI content rewrite**: Click text → "Viết lại bằng AI"

---

## Kết Luận

PrimeWeb có **nền tảng kỹ thuật rất mạnh** — 7 collections, 8 block types, multi-tenant, SSR. Nhưng đang thiếu "last mile" — những thứ nhỏ mà user cần để thực sự dùng được:

> **User không cần biết mình có 7 blocks. User cần biết: "Website tôi trông đẹp không? Khách hàng có liên hệ được không?"**

Đề xuất: Tập trung vào **Cấp 1 (Quick Wins)** trước → làm sản phẩm "usable" → rồi mới thêm tính năng nâng cao.
