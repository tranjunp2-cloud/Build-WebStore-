# User Stories: Landing page v2 (F45)

<!-- Rules & ID Convention: docs/stories/user-stories-p0.md | SPEC.md §2.4 -->

> **Feature:** F45 — Landing page v2 (thay trang chủ marketing `/`)
> **Wave:** 8 | **Priority:** P0 | **Ref PRD:** [F45-landing-v2.md](../prd/F45-landing-v2.md)
> **QA:** [docs/qa/F45-landing-v2.md](../qa/F45-landing-v2.md) · **Design:** prototype HTML Landing v2 (PO duyệt 28/10/2026)

**Ngoài phạm vi:** testimonials, bảng giá, Contact sales / WhatsApp, footer pháp lý, route `/en` `/ms`, analytics events.

---

## US-F45-01: Landing page v2 thay trang chủ

**Wave 8** | **P0** | **L** | Status: Ready

### Story

```
As a   chủ doanh nghiệp đang tìm cách bán hàng online
I want hiểu nhanh Web Store làm được gì và bắt đầu dùng thử ngay
So that tôi quyết định đăng ký mà không cần hỏi thêm sales
```

### Acceptance Criteria

#### AC-1: Thay trang chủ

```gherkin
GIVEN khách truy cập "/"
WHEN  trang tải xong
THEN  hiện landing v2 với đủ: Nav, Hero + video, How it works, Features (10 thẻ), Product tour (4 tab), Templates, FAQ, Final CTA, Footer
  AND không còn dải "Works with…", nút Contact sales, nhãn Pro, chữ Xendit hay e-wallets
  AND "Get started free" đi tới /register, "Sign in" đi tới /login
```

#### AC-2: Hero

```gherkin
GIVEN khách ở đầu trang
THEN  eyebrow "AI-powered website & online store builder", H1 đúng 2 dòng trên desktop ("Describe your business." / "AI builds your online store."), 1 câu overview, 2 nút, 3 dòng tick
  AND video intro (V2_INTRO_MEDIA) có poster, bấm để phát; thanh điều khiển play/pause/replay, tua, tắt tiếng, toàn màn hình; nút Play dùng được bằng bàn phím
  AND không có mascot đè lên video
```

#### AC-3: Đa ngôn ngữ

```gherkin
WHEN  khách bấm nút EN/BM trên nav hoặc footer
THEN  mọi chữ trên trang (kể cả aria-label) đổi ngôn ngữ và lựa chọn được lưu qua I18nProvider (prefer_lang)
```

#### AC-4: Theme

```gherkin
GIVEN lần đầu vào trang
THEN  theme tối
WHEN  bấm nút ☀/🌙
THEN  đổi sang theme sáng (và ngược lại); logo giữ chữ "Store" màu #06B6D4 ở cả hai theme
```

#### AC-5: Product tour

```gherkin
GIVEN desktop ≥ 960px
THEN  4 tab dọc bên trái, tab đang chọn mở mô tả + 3 ý, visual bên phải chuyển cảnh
  AND tự chuyển tab mỗi 7 giây khi section trong màn hình; dừng khi rê chuột/focus; dừng hẳn khi khách tự chọn tab
GIVEN mobile
THEN  tab là hàng chip cuộn ngang, nội dung tab hiện bên dưới
```

#### AC-6: Templates

```gherkin
GIVEN section Templates
THEN  chip All + 14 ngành; băng chuyền 1 hàng (4 card desktop / 2 tablet / 1 mobile) với preview thật từ /api/templates/preview, tên + ngành
WHEN  bấm chip ngành
THEN  băng chuyền chỉ còn template của ngành đó; nút ‹ › bị tắt ở hai đầu
WHEN  API lỗi hoặc không có template
THEN  section vẫn hiện tiêu đề + nút "Browse all templates", không vỡ layout
```

#### AC-7: FAQ

```gherkin
GIVEN section FAQ
THEN  3 nhóm (Getting started · Selling & orders · Domain & growth), mặc định nhóm 1, tất cả câu đóng
WHEN  bấm 1 câu
THEN  câu đó mở, câu khác đóng; aria-expanded đúng
WHEN  đổi nhóm
THEN  danh sách câu đổi theo nhóm
```

#### AC-8: Responsive & chuyển động

```gherkin
GIVEN viewport bất kỳ từ 320px đến 1920px (EN và BM)
THEN  không có thanh cuộn ngang; nav < 1100px dùng menu hamburger; CTA trên nav ẩn < 600px (vẫn có trong menu)
GIVEN máy bật prefers-reduced-motion
THEN  không có animation lặp, nội dung hiện ngay không cần cuộn tới
```

### Additional Criteria

- [ ] CSS scoped dưới `.lv` — vào dashboard sau khi rời landing không bị đổi style.
- [ ] Copy trong `src/i18n/locales/en.json` + `ms.json`, namespace `landingV2`; BM cần người bản ngữ duyệt trước production.
- [ ] Không thêm env var, không migration, không file video mới.

### Definition of Done

- [ ] 9-Point Checklist pass (ref: `SPEC.md §13`)
- [ ] TC-F45-01 → TC-F45-12 pass
- [ ] `npm run lint`, `typecheck`, `test`, `build` pass
