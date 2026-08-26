# Bug Report Summary — F06 Onboarding Flow (GitHub Issues)

> **Project:** ECH Prime Web v2
> **Environment:** Staging
> **Date:** 2026-04-10
> **Reported by:** QA Team (Extracted from test reports)
> **Status:** 🔴 OPEN — Pending Dev Fix

---

## Tổng quan

| Feature | Tổng Bug | P0 Critical | P1 High | P2 Medium | Trạng thái |
| :--- | :---: | :---: | :---: | :---: | :---: |
| F06 — Onboarding | 10 | 0 | 2 | 8 | 🔴 BLOCKED |

> **⚠️ Release Decision: BLOCKED**
> Có 2 lỗi P1 High liên quan đến luồng chính (Block/Crash) cần được fix.

---

## Bugs (FAILED) — 10 Issues

---

### BUG-F06-001 · Font "Times New Roman" thay vì "Inter" trên Welcome Screen

| | |
| :--- | :--- |
| **TC-ID** | TC-F06.03a |
| **Severity** | 🟡 P2 Medium |
| **Module** | Welcome Screen |
| **Nguồn** | F06-onboarding-test-report.md |

**Mô tả**
Computed font-family trên Welcome Screen = `"Times New Roman"`. Spec Figma yêu cầu font `Inter`. Có thể Inter font chưa load hoặc CSS fallback sai. Cần kiểm tra font import.

---

### BUG-F06-002 · AI Discovery Wizard KHÔNG tự mở trên dashboard sau skip

| | |
| :--- | :--- |
| **TC-ID** | TC-F06.04 |
| **Severity** | 🟠 P1 High |
| **Module** | AI Discovery Wizard |
| **Nguồn** | F06-onboarding-test-report.md |

**Mô tả**
Sau khi click "Skip & Go to Dashboard" → navigate `/dashboard` → 0 modals, 0 overlays, 0 wizard content.
Spec yêu cầu: `has_seen_ai_wizard == false → Modal Overlay tự mở`. Wizard hiện ở lần scout trước nhưng KHÔNG hiện ở lần chạy test serial.
Có thể flag đã bị set true bởi CTA click (navigate `/builder/new` lưu flag `has_seen_ai_wizard = true`).

**Mức độ ảnh hưởng:** Core onboarding flow broken (user skip → không thấy AI features).

---

### BUG-F06-003 · /onboarding KHÔNG redirect sau khi wizard completed

| | |
| :--- | :--- |
| **TC-ID** | TC-F06.01b |
| **Severity** | 🟡 P2 Medium |
| **Module** | Welcome Screen |
| **Nguồn** | F06-onboarding-test-report.md |

**Mô tả**
Sau khi user đã hoàn thành flow, navigate thủ công `/onboarding` → vẫn hiện Welcome Screen (URL = `/onboarding`, content = CTA + Skip).
Spec yêu cầu: "Hệ thống redirect ngay về `/dashboard`". Guard redirect chưa implement cho `/onboarding` route. User có thể xem onboarding lại nhiều lần.

---

### BUG-F06-004 · Onboarding — Layout mobile bị mất text

| | |
| :--- | :--- |
| **Severity** | 🟠 P1 High |
| **Module** | Onboarding / Mobile |
| **Nguồn** | BUG-REPORT-SUMMARY.md (BUG-038) |

**Mô tả**
Trên mobile, một số text trong màn hình Onboarding bị mất (không hiển thị), gây mất thông tin hướng dẫn với user.

---

### BUG-F06-005 · Onboarding — Không có hình ảnh/video/GIF hướng dẫn trên UI

| | |
| :--- | :--- |
| **Severity** | 🟡 P2 Medium |
| **Module** | Onboarding / UI |
| **Nguồn** | BUG-REPORT-SUMMARY.md (BUG-037) |

**Mô tả**
Màn hình Onboarding tour guide hiện tại chỉ hiển thị text thuần, thiếu hình ảnh/video/GIF minh họa theo thiết kế.

---

### BUG-F06-006 · Onboarding — Đóng tour chưa hoàn thành rồi login lại, không hiện lại slide

| | |
| :--- | :--- |
| **Severity** | 🟡 P2 Medium |
| **Module** | Onboarding / State |
| **Nguồn** | BUG-REPORT-SUMMARY.md (BUG-039) |

**Mô tả**
Khi user đóng tour guide Onboarding giữa chừng (chưa hoàn thành hết các bước), sau đó logout và login lại — hệ thống không hiển thị lại phần Onboarding còn lại.

**Kết quả mong đợi:** Nếu user chưa hoàn thành Onboarding, khi login lại phải tiếp tục hiển thị từ bước user đã dừng.

---

### BUG-F06-007 · Chưa có màn hình welcome khi đăng nhập lần đầu

| | |
| :--- | :--- |
| **Severity** | 🟡 P2 Medium |
| **Module** | Welcome Screen |
| **Nguồn** | Issue #93 |

**Mô tả**
Khi user mới login vào hệ thống, màn hình Welcome bị bỏ qua và xuất hiện luôn màn hình "Discover the Power of AI". Theo Figma, màn hình Welcome phải xuất hiện đầu tiên khi user đăng nhập thành công.

**Trạng thái cập nhật:** HIện tại QC đã test **pass** trên Staging, màn hình Welcome đã hiển thị lại đúng luồng.

---

### BUG-F06-008 · Lỗi UI popup bị phóng to tràn viền

| | |
| :--- | :--- |
| **Severity** | 🟡 P2 Medium |
| **Module** | Onboarding / UI |
| **Nguồn** | Issue #94 |

**Mô tả**
Popup onboarding bị phóng to hơn mức bình thường, làm cho chữ và các button trong popup bị che khuất và không thể thao tác được.

**Trạng thái cập nhật:** Đã được dev fix, test **pass** trên staging.

---

### BUG-F06-009 · Lỗi responsive - padding giữa các step không đồng đều

| | |
| :--- | :--- |
| **Severity** | 🟡 P2 Medium |
| **Module** | Onboarding / UI |
| **Nguồn** | Issue #189 |

**Mô tả**
Khi switch qua lại giữa các slide trong Wizard, nội dung/section/button bên trong bị nhảy vị trí (padding không đồng đều giữa các slide).
Đồng thời, text trong block vẫn bị che khi hiển thị ở viewport mobile 375px (liên quan đến BUG-F06-004 nhưng text vẫn chưa thể hiển thị hoàn toàn hết cỡ).

**Trạng thái cập nhật:** **NOT PASS**. UI có cải thiện nhưng text vẫn bị che ở góc nhìn mobile 375px.

---

### BUG-F06-010 · Ấn next qua các slide onboarding lỗi giật layout

| | |
| :--- | :--- |
| **Severity** | 🟡 P2 Medium |
| **Module** | Onboarding / UI |
| **Nguồn** | Sumbug.txt |

**Mô tả**
Khi thao tác ấn nút Next để qua các slide tiếp theo của Onboarding Tour Guide, layout hiển thị lỗi giật lag, chưa mượt mà. Đội dev cần kiểm tra lại animation hoặc state re-render giữa các slide.

