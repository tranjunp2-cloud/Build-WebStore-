# User Stories: Onboarding Flow (F06)

> **Feature:** F06 — Onboarding Flow
> **Wave:** 1 | **Priority:** P0 | **Ref PRD:** [F06-onboarding.md](../prd/F06-onboarding.md)

---

## US-F06-02: Welcome Screen — Zero Friction to AI Builder

**Wave 1** | **P0** | **S** | **Status:** Ready

### Story

```
As a   newly registered user
I want thấy welcome screen ngắn gọn hướng tôi vào AI Builder
So that tôi không bị lost hoặc confused về bước tiếp theo
```

### Acceptance Criteria

#### AC-1: Happy Path — Welcome Screen Display

```gherkin
GIVEN user vừa authenticate thành công thông qua F02
WHEN  vào /onboarding
THEN  welcome screen có single primary CTA: "Create My Store"
  AND không có competing actions khác
  AND screen giải thích "5-minute promise" trong tối đa 1-2 câu
  AND progress indicator: "Step 1 of 2: Create Store"
```

#### AC-2: CTA Navigation

```gherkin
GIVEN user click CTA "Create My Store"
WHEN  clicked
THEN  navigate to /builder/new within 300ms
  AND no loading screen
```

#### AC-3: Skip Option

```gherkin
GIVEN user muốn bỏ qua onboarding
WHEN  click "Set up later" link
THEN  redirect to /dashboard
```

### Additional Criteria

- [ ] Mobile-responsive: CTA button full-width below 480px

### Definition of Done

- [ ] 9-Point Checklist pass (ref: `SPEC.md §13`)
- [ ] Single CTA không có competing actions

---

## US-F06-03: AI Feature Discovery Wizard (CMS Welcome)

**Wave 1** | **P0** | **M** | **Status:** Ready

### Story

```
As a   new store owner accessing the CMS for the first time
I want được giới thiệu nhanh các tính năng AI trọng tâm và lợi ích của chúng
So that tôi hiểu ngay AI có thể giúp tôi làm gì mà không bị ngộp bởi các cài đặt phức tạp
```

### Acceptance Criteria

#### AC-1: Triggering the Wizard

```gherkin
GIVEN user đăng nhập lần đầu tiên vào CMS
WHEN  Dashboard được load
THEN  một Modal Carousel "AI Discovery Wizard" tự động hiển thị ở trung tâm màn hình
  AND background tối đi (backdrop) để tập trung sự chú ý
```

#### AC-2: Slide 1 — AI Editor

```gherkin
GIVEN user đang ở Step 1 của Wizard
WHEN  modal hiển thị
THEN  hiển thị tiêu đề: "Thiết kế bằng AI: Sửa giao diện qua chat"
  AND nội dung: "Hỗ trợ bạn thay đổi thiết kế nhanh chóng (đổi màu, thêm module) bằng cách chat với AI, không cần kéo thả hay biết code."
  AND một GIF/chú thích minh hoạ
  AND nút "Tiếp tục"
```

#### AC-3: Slide 2 — AI Content Generation

```gherkin
GIVEN user chuyển sang Step 2
WHEN  modal hiển thị
THEN  hiển thị tiêu đề: "AI Content: Viết lách siêu tốc"
  AND nội dung: "Biểu tượng ✨ xuất hiện ở mọi nơi. Hỗ trợ bạn tự động viết mô tả sản phẩm, bài blog chuẩn SEO ngay lập tức khi bí ý tưởng."
  AND một GIF/chú thích minh hoạ
  AND nút "Tiếp tục"
```

#### AC-4: Slide 3 — AI SEO Assistant

```gherkin
GIVEN user chuyển sang Step 3
WHEN  modal hiển thị
THEN  hiển thị tiêu đề: "AI SEO: Tối ưu trang web tự động"
  AND nội dung: "Hỗ trợ bạn phân tích từ khoá và chấm điểm SEO tự động. Đưa website lên top tìm kiếm dễ dàng mà không cần mướn chuyên gia."
  AND một GIF/chú thích minh hoạ
  AND nút "Khám phá CMS ngay" để đóng hoàn toàn Wizard
```

#### AC-5: Skip / Dismiss

```gherkin
GIVEN user mở Modal Wizard
WHEN  click "Bỏ qua hướng dẫn" hoặc hoàn thành Step 3
THEN  Modal đóng lại
  AND không bao giờ tự động hiện lại trong các lần đăng nhập sau (lưu state has_seen_ai_wizard = true)
```

### Additional Criteria

- [ ] Wizard thiết kế dạng Minimal Modal Carousel, thao tác nhanh, animation smooth.
- [ ] Ảnh GIF/Video trong mỗi slide phải được tối ưu dung lượng bám sát đúng tính năng và chỉ "show" chức năng hỗ trợ.

### Market Notes

- [ ] Các tính năng Commerce/Delivery setup đã được chuyển sang phần Publish Setting (F08) để giảm ma sát phút ban đầu.

### Definition of Done

- [ ] 9-Point Checklist pass (ref: `SPEC.md §13`)
- [ ] Trạng thái đã xem Wizard được lưu trữ liên tục ở user document
