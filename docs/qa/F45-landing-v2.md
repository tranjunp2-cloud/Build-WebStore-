# F45 Landing page v2 — QA Plan

> **Story source:** [F45 stories](../stories/F45-landing-v2-stories.md) · **Spec:** [PRD F45](../prd/F45-landing-v2.md)
> **Mục tiêu:** landing v2 thay `/` trên staging, đúng nội dung PO chốt 28/10/2026, chạy tốt desktop + mobile, EN + BM, theme tối/sáng.

## 1. Rủi ro cần chặn

| Rủi ro | Hậu quả | Cách test |
|---|---|---|
| Còn claim/chữ đã bỏ (Xendit, e-wallets, Pro, Contact sales, "Malaysian" ở hero) | Sai nội dung PO chốt | TC-02 |
| Tràn ngang trên mobile / bản BM dài hơn | Trang vỡ trên điện thoại | TC-09 |
| CSS landing rò sang dashboard | Dashboard đổi style sau khi rời landing | TC-11 |
| API template lỗi làm vỡ section | Trang trắng một phần | TC-07 |
| Video không phát / không điều khiển bằng bàn phím | Mất nội dung chính, lỗi a11y | TC-04 |

## 2. Coverage

| Story | Test cases |
|---|---|
| US-F45-01 Landing page v2 | 01–12 |

## 3. Test cases

| ID | Loại | Mức | Ưu tiên | Arrange · Act · Assert |
|---|---|---|---|---|
| TC-F45-01 | [ ] AUTO | UI | Critical | **A:** mở `/`. **A:** chờ tải. **A:** đủ 9 phần: nav, hero, how, features (10 thẻ), tour (4 tab), templates, faq, final CTA, footer. |
| TC-F45-02 | [ ] AUTO | UI | Critical | **A:** EN rồi BM. **A:** đọc toàn bộ text. **A:** không có "Xendit", "e-wallet/E-dompet", "Pro", "Contact sales/Hubungi jualan"; hero không có "Malaysian/Malaysia". |
| TC-F45-03 | [ ] AUTO | UI | Critical | **A:** desktop. **A:** bấm "Get started free" (nav, hero, final, footer) và "Sign in". **A:** lần lượt tới `/register` và `/login`. |
| TC-F45-04 | [ ] AUTO | UI | High | **A:** hero video. **A:** Tab tới nút Play, Enter; bấm pause, tua, mute. **A:** video phát; controls hoạt động; aria-label đúng ngôn ngữ. |
| TC-F45-05 | [ ] AUTO | UI | High | **A:** trang EN. **A:** bấm EN/BM. **A:** mọi section đổi ngôn ngữ; reload vẫn giữ ngôn ngữ đã chọn. |
| TC-F45-06 | [ ] AUTO | UI | Medium | **A:** lần đầu vào. **A:** bấm nút theme 2 lần. **A:** mặc định tối → sáng → tối; chữ "Store" luôn `#06B6D4`. |
| TC-F45-07 | [ ] AUTO | UI + API | High | **A:** mock `/api/templates/list` trả 8 template / trả lỗi. **A:** mở section, bấm chip ngành, bấm ›. **A:** card đúng ngành; nút ‹ tắt ở đầu; khi lỗi section vẫn có tiêu đề + "Browse all templates". |
| TC-F45-08 | [ ] AUTO | UI | High | **A:** FAQ. **A:** mở câu 2, mở câu 3, đổi nhóm. **A:** chỉ 1 câu mở; aria-expanded đúng; đổi nhóm thì đổi danh sách. |
| TC-F45-09 | [ ] MANUAL | UI | Critical | **A:** DevTools 320, 375, 390, 768, 1024, 1280, 1920 px; EN và BM. **A:** cuộn hết trang. **A:** không cuộn ngang; nav < 1100px là hamburger; H1 desktop đúng 2 dòng. |
| TC-F45-10 | [ ] AUTO | UI | Medium | **A:** bật `prefers-reduced-motion`. **A:** tải trang. **A:** mọi section hiện ngay; tour không tự chuyển tab. |
| TC-F45-11 | [ ] MANUAL | UI | High | **A:** mở `/`, đăng nhập, vào `/dashboard`. **A:** so sánh với dashboard mở trực tiếp. **A:** không khác style (font, màu link, focus ring). |
| TC-F45-12 | [ ] AUTO | UI | High | **A:** desktop ≥ 960px. **A:** để tour trong màn hình 8 s; rồi bấm tab 3. **A:** tab tự chuyển sau ~7 s; sau khi bấm thì dừng tự chuyển. |

## 4. Còn mở

- BM bản nháp — cần người bản ngữ duyệt (không chặn staging).
- Theme chính thức (tối/sáng) chốt sau review.
