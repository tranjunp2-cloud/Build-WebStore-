---
title: "Kế Hoạch Tối Ưu SEO — F03 + F05"
description: "Scope Sprint 1: đơn giản setup, chặt chẽ, tìm được trên Google"
status: pending
priority: P0
sprint: "Sprint 1 — Deadline 15/04/2026"
branch: docs/BA-QC-Design
tags: [seo, f03, f05]
created: 2026-04-07
updated: 2026-04-07
---

# Kế Hoạch Tối Ưu SEO — F03 + F05

## Mục tiêu

> Khách hàng chỉ cần setup đơn giản → SEO được tối ưu → khi search tên doanh nghiệp hoặc keyword liên quan sẽ tìm được website của họ.

**Sprint 1 — Deadline: 15/04/2026**

---

## 1. Tổng Quan Hiện Trạng

Hệ thống đã hoàn thiện khoảng **90%** các thành phần SEO cần thiết:

### ✅ Đã có và hoạt động tốt

| # | Thành phần | Mô tả ngắn |
|---|------------|-------------|
| 1 | **Trường dữ liệu SEO** | Mỗi trang có: Tiêu đề SEO (60 ký tự), Mô tả SEO (160 ký tự), Ảnh OG, cờ Ẩn khỏi Google |
| 2 | **SEO cấp toàn site** | Tiêu đề/Mô tả mặc định, danh sách Từ khoá theo dõi (tối đa 5) |
| 3 | **Tab SEO trong Editor (F05)** | Người dùng chỉnh Slug, Tiêu đề, Mô tả từng trang. Có ô xem trước hiển thị trên Google (SERP Preview). Có nút "✨ Tự động tối ưu SEO" bằng AI |
| 4 | **AI tự sinh Meta khi Publish** | Lần đầu publish, nếu chưa có meta → AI tự sinh tiêu đề + mô tả phù hợp |
| 5 | **Bảng điều khiển SEO (F03)** | Điểm SEO tổng quan (0-100), danh sách vấn đề, nút "Sửa tất cả bằng AI" với xem trước + phê duyệt, hỗ trợ Hoàn tác |
| 6 | **Sitemap tự động** | File `sitemap.xml` tự sinh, cập nhật khi thêm/xoá trang, tuân thủ cờ ẩn khỏi Google |
| 7 | **JSON-LD Structured Data** | Dữ liệu có cấu trúc tự inject: Organization, WebSite, Breadcrumb, FAQ, LocalBusiness, Product. Google dùng để hiểu doanh nghiệp |
| 8 | **Phân cấp tiêu đề H1/H2/H3** | Tự đảm bảo mỗi trang chỉ có 1 H1 (ở Hero), các phần còn lại H2, thẻ con H3. Chuẩn SEO |
| 9 | **Theo dõi từ khoá** | Người dùng thêm tối đa 5 từ khoá, hệ thống theo dõi thứ hạng hàng tuần |

### ❌ Còn thiếu — Cần làm trong Sprint 1

| # | Vấn đề | Tại sao quan trọng | Mức độ |
|---|--------|---------------------|--------|
| **G1** | **Điểm SEO chưa phân loại rõ** — Hiện tại chỉ có 1 con số tổng, không chia thành hạng mục. Người dùng không biết cần sửa gì trước | Người dùng nhìn điểm 65/100 nhưng không biết vấn đề nằm ở Meta Tags, Nội dung, hay Kỹ thuật → không hành động được | 🔴 Cao |
| **G2** | **AI không sử dụng từ khoá của người dùng** — Trường "Từ khoá theo dõi" đã tồn tại nhưng AI hoàn toàn bỏ qua khi sinh tiêu đề/mô tả | Người dùng nhập "bakery KL" nhưng AI sinh meta chung chung "Welcome to ABC" → website không xuất hiện khi search "bakery KL" | 🔴 Cao |
| **G3** | **JSON-LD còn thiếu thông tin liên hệ và mạng xã hội** — Schema Organization chỉ có tên + logo, thiếu SĐT, email, link Facebook/Instagram | Google không hiển thị Knowledge Panel đầy đủ (tên DN + SĐT + mạng xã hội) khi search tên doanh nghiệp | 🟡 Trung bình |
| **G4** | **Widget SEO trên Dashboard chính đang giả** — Hiện hiển thị cố định số 68, không phải điểm thực | Người dùng thấy điểm sai → mất niềm tin vào hệ thống | 🟡 Trung bình |

---

## 2. Phân Chia Trách Nhiệm F03 vs F05

| Ai làm gì | Feature | Thuộc F nào |
|-----------|---------|-------------|
| **Người dùng chủ động sửa SEO từng trang** | Tab SEO trong Editor, nút AI Generate từng trang | **F05** (Editor) |
| **Hệ thống quét + sửa hàng loạt** | Bảng điều khiển SEO, Điểm số, Sửa tất cả, Theo dõi từ khoá | **F03** (Dashboard) |
| **Tự động khi publish** | AI sinh meta, Sitemap, JSON-LD, Phân cấp tiêu đề | **Dùng chung** |

**Quy tắc mới cần bổ sung vào PRD:**
> Khi AI sinh meta (lúc publish hoặc Fix All), nếu trường đang trống → tự động điền. Nếu trường **đã có nội dung thủ công** → AI **đề xuất bản chỉnh sửa** và hiển thị so sánh (bản cũ vs bản mới). Người dùng xem xét và **chỉ ghi đè khi người dùng đồng ý**.

---

## 3. Sprint 1 — Việc Cần Làm (Deadline 15/04/2026)

### Công việc 1: Phân loại Điểm SEO theo hạng mục (Giải quyết G1)

**Hiện tại:** Điểm SEO chỉ là 1 con số (VD: 65/100), không giải thích.

**Cần đạt được:**
- Điểm tổng vẫn giữ thang 0-100
- Chia thành **3 hạng mục** với trọng số:
  - **Meta Tags (40%)** — Tiêu đề có chưa? Đúng độ dài chưa? Mô tả có chưa? Đúng độ dài chưa?
  - **Nội dung (35%)** — Có tiêu đề chính (H1)? Nội dung đủ dài (≥300 từ)? Ảnh có mô tả alt? Có phần liên hệ?
  - **Kỹ thuật (25%)** — Có ảnh chia sẻ OG? Slug thân thiện? Đã xác minh Google?
- Giao diện Dashboard SEO hiển thị điểm từng hạng mục (thanh tiến trình hoặc con số)
- Người dùng nhìn vào **biết ngay** cần cải thiện phần nào

**Tiêu chí hoàn thành:**
- [ ] API trả về điểm tổng + điểm 3 hạng mục
- [ ] Dashboard SEO hiển thị 3 hạng mục với điểm tương ứng
- [ ] Người dùng hiểu được "Meta Tags yếu → cần bổ sung tiêu đề/mô tả"

---

### Công việc 2: AI sử dụng Từ khoá mục tiêu khi sinh Meta (Giải quyết G2)

**Hiện tại:** AI sinh meta chung chung, bỏ qua hoàn toàn từ khoá người dùng đã nhập.

**Cần đạt được:**
- Khi người dùng đã nhập từ khoá theo dõi (VD: "bakery KL", "bánh sinh nhật"), AI **sử dụng các từ khoá đó** khi sinh tiêu đề và mô tả
- Áp dụng cho **tất cả các điểm chạm AI**: nút "✨ Tự động tối ưu" trong Editor, nút "Sửa tất cả" trong Dashboard, và tự sinh khi publish
- Từ khoá được kết hợp tự nhiên, **không nhồi nhét**

**Ví dụ so sánh:**

| | Không có từ khoá (hiện tại) | Có từ khoá (sau khi sửa) |
|---|---|---|
| Tiêu đề | "About Us \| Tiệm Bánh ABC \| Malaysia" | "Bakery KL \| Tiệm Bánh ABC \| Bánh Sinh Nhật Online" |
| Mô tả | "Learn about Tiệm Bánh ABC and our services." | "Tiệm Bánh ABC — Bakery KL chuyên bánh sinh nhật. Đặt bánh online ngay!" |

**Tiêu chí hoàn thành:**
- [ ] Meta sinh ra có chứa từ khoá mục tiêu một cách tự nhiên
- [ ] Khi không có từ khoá, hoạt động giống hệt hiện tại (tương thích ngược)
- [ ] Áp dụng ở cả 3 điểm: Editor AI, Dashboard Fix All, Auto-generate khi publish

---

### Công việc 3: Bổ sung thông tin liên hệ + mạng xã hội vào JSON-LD (Giải quyết G3)

**Hiện tại:** Google chỉ biết tên và logo doanh nghiệp. Thiếu SĐT, email, Facebook, Instagram.

**Cần đạt được:**
- Schema Organization trên trang chủ bổ sung:
  - **Thông tin liên hệ** (SĐT, email) — lấy từ cài đặt site hoặc block Liên hệ
  - **Mạng xã hội** (Facebook, Instagram, LinkedIn, YouTube) — lấy từ cài đặt site
- Schema LocalBusiness: địa chỉ hiển thị đúng cấu trúc (đường, thành phố, quốc gia) thay vì 1 dòng text
- Thêm schema WebPage cho các trang con (About, Services...) — giúp Google hiểu rõ nội dung từng trang

**Tại sao quan trọng cho mục tiêu "search tên doanh nghiệp → tìm được":**
- Google dùng JSON-LD để hiển thị **Knowledge Panel** bên phải kết quả search (tên + logo + SĐT + link mạng xã hội)
- Có đầy đủ thông tin → Google **tin tưởng** website hơn → xếp hạng cao hơn

**Tiêu chí hoàn thành:**
- [ ] Trang chủ: JSON-LD Organization có SĐT, email, link mạng xã hội
- [ ] Trang có block Liên hệ: JSON-LD LocalBusiness có địa chỉ đúng cấu trúc
- [ ] Trang con: có JSON-LD WebPage
- [ ] Kiểm tra bằng Google Rich Results Test → không có lỗi

---

### Công việc 4: Kết nối Widget SEO trên Dashboard với dữ liệu thực (Giải quyết G4)

**Hiện tại:** Widget SEO trên trang Dashboard chính luôn hiển thị số 68 (giả).

**Cần đạt được:**
- Widget lấy điểm SEO thực từ API phân tích
- Điểm khớp với trang Bảng điều khiển SEO (`/dashboard/seo`)
- Có cache 5 phút để không làm chậm trang Dashboard

**Tiêu chí hoàn thành:**
- [ ] Widget hiển thị điểm thực, không phải 68 cố định
- [ ] Điểm nhất quán với trang SEO Dashboard

---

## 4. Lịch Trình Sprint 1 (07/04 → 15/04/2026)

| Ngày | Việc | Phụ thuộc | Ưu tiên |
|------|------|-----------|---------|
| 07-09/04 | **Công việc 1:** Phân loại Điểm SEO 3 hạng mục | Không | 🔴 P0 |
| 07-09/04 | **Công việc 2:** AI sử dụng từ khoá mục tiêu | Không (song song với CV1) | 🔴 P0 |
| 09-11/04 | **Công việc 3:** Bổ sung JSON-LD thông tin liên hệ + mạng xã hội | Không (song song với CV1, CV2) | 🟡 P1 |
| 11-12/04 | **Công việc 4:** Kết nối Widget SEO thực | Sau Công việc 1 | 🟡 P1 |
| 13-15/04 | **Kiểm tra + sửa lỗi** | Tất cả | — |

**Công việc 1, 2, 3** không phụ thuộc nhau → có thể làm **song song**.
**Công việc 4** cần Công việc 1 xong trước (dùng API điểm mới).

---

## 5. Việc HOÃN LẠI (Không làm trong Sprint 1)

| Hạng mục | Lý do hoãn | Khi nào làm |
|----------|-----------|-------------|
| **SSE Streaming cho Fix All** | Hiện tại Fix All xử lý song song 5-10 trang mất ~3-5 giây, chấp nhận được. SSE tốn thêm effort và cần test kỹ trên server | Khi có phản hồi timeout thực tế hoặc cần hỗ trợ >10 trang |
| **Tích hợp Google Search Console** | Cần setup OAuth phức tạp, tốn effort lớn. Keyword Tracker hiện tại nhập thủ công là đủ cho MVP | Sprint sau |

---

## 6. Cần Cập Nhật Trong PRD

### PRD F03 (Dashboard):

| Mục | Cần sửa |
|-----|---------|
| FR-09 | Sửa "4 category" → "3 category: Meta Tags (40%), Nội dung (35%), Kỹ thuật (25%)" |
| FR-10 | Ghi rõ: "Sprint 1 chỉ nhập từ khoá thủ công. Tích hợp Google Search Console làm sau" |
| FR-11 | Ghi chú: "MVP dùng xử lý song song. SSE streaming nâng cấp sau" |
| Business Rules | Thêm BR-06: "Trường trống → AI tự điền. Trường đã có nội dung → AI đề xuất chỉnh sửa, chỉ ghi đè khi người dùng đồng ý" |

### PRD F05 (Editor):

| Mục | Cần sửa |
|-----|---------|
| FR-27 | Thêm: "AI Generate sử dụng từ khoá theo dõi từ cài đặt site" |

### Tài liệu kiến trúc:

| Cần làm | Chi tiết |
|---------|----------|
| Đổi tên file | `docs/architecture/F11-seo-dashboard.md` → `docs/architecture/F03-seo-dashboard.md` (F11 là Undo/Redo, không phải SEO) |
| Cập nhật nội dung | Bổ sung trọng số cụ thể cho thuật toán chấm điểm (40/35/25) |

---

## 7. Rủi Ro

| Rủi ro | Mức độ | Biện pháp |
|--------|--------|-----------|
| JSON-LD bổ sung sai format → Google từ chối | Thấp | Đã có base hoạt động, chỉ thêm trường. Test bằng Google Rich Results Test |
| AI nhồi nhét từ khoá trong meta | Thấp | Chỉ dẫn AI rõ ràng "kết hợp tự nhiên" + kiểm tra thủ công |
| Điểm SEO thay đổi → người dùng hoang mang | Thấp | Hiển thị thông báo "Hệ thống chấm điểm đã được nâng cấp" 1 lần |

---

## 8. Checklist Kiểm Tra Cuối Sprint

- [ ] Dashboard SEO: điểm hiển thị 3 hạng mục (Meta Tags / Nội dung / Kỹ thuật)
- [ ] Đặt từ khoá theo dõi → nhấn AI Generate → meta có chứa từ khoá tự nhiên
- [ ] View source trang chủ → JSON-LD có SĐT, email, link mạng xã hội
- [ ] Dashboard chính → Widget SEO hiển thị điểm thực (không phải 68)
- [ ] Tất cả test tự động hiện có vẫn pass
