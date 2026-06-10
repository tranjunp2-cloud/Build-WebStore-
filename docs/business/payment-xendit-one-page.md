# Xendit Payment Integration — One-Pager

**Trình:** Domin (Product) · **Duyệt:** BOD · **Ngày:** 2026-06-09 · **Status:** Draft, chờ Xendit sales

## Đề xuất

Tích hợp **Xendit (XenPlatform)** làm cổng thanh toán nội địa Malaysia, **song song Stripe**, để merchant nhận **Touch 'n Go, GrabPay, DuitNow QR, FPX**.

## Vì sao

- Stripe MY **không** hỗ trợ ví nội địa (TNG ~62% thị phần).
- TNG không có kết nối kiểu Stripe → phải qua provider có sẵn TNG.
- Xendit là provider duy nhất ở MY vừa có sub-merchant model vừa đủ TNG+GrabPay+DuitNow+FPX+thẻ.

## Mô hình

- Mỗi merchant = một **MANAGED sub-account**. Tiền settle **thẳng về merchant**, auto-payout về bank theo lịch.
- Nền tảng **chỉ orchestrate, không giữ tiền, KHÔNG thu phí giao dịch** (pure SaaS — doanh thu từ phí gói thuê bao).
- Mở rộng ví khác = bật cấu hình, không code lại.

## Vì sao Xendit (so vendor)

| PSP | TNG | Sub-merchant model | Kết luận |
|---|---|---|---|
| **Xendit** | ✅ | ✅ MANAGED, API-driven | ✅ **Chọn** |
| HitPay | ✅ | ⚠️ thiên affiliate | Dự phòng |
| Curlec | ❌ | ⚠️ non | Thiếu TNG |
| Fiuu / iPay88 / eGHL | ✅ | ❌ single-merchant | Sai mô hình |
| Stripe | ❌ | ⚠️ Connect MY hạn chế | Giữ cho quốc tế |

## Kiến trúc — không đụng Stripe

- Codebase đã có interface `PaymentProvider` abstract → thêm Xendit là **file mới, 0 sửa logic Stripe**.
- Hosted checkout: số thẻ/ví đi **thẳng buyer → Xendit**, không qua server ta. Webhook báo "đã trả" → `reconcileOrderPaid()` (dùng lại nguyên).
- Routing: ví + DuitNow + FPX → Xendit; thẻ quốc tế / merchant ngoài MY → Stripe.
- Việc dev: tạo `src/lib/payment/xendit.ts` + `api/xendit/*` + `api/webhooks/xendit/*`; thêm field `xenditAccountId`/`xenditInvoiceId` + migration. **Rủi ro kỹ thuật: thấp.**

## Merchant nhận tiền (auto-disburse)

- **Auto-Withdrawal**: tự quét số dư sub-account về bank merchant theo lịch (ngày/tuần/tháng); platform điều khiển qua API.
- Merchant cần: đăng ký (nhúng app) → **KYB pass (1–5 ngày)** → thêm bank (tên khớp) → bật rút. Chưa KYB → không nhận tiền.
- Settlement vào số dư: VA T+0 · ví T+2 · thẻ T+7 → rồi auto-payout ra bank. DuitNow ~RM1.50/lần, 99.9% trong 15 phút.

## Chi phí — ai chịu gì

| Khoản | Ai chịu | Mức (ước tính) |
|---|---|---|
| Phí xử lý giao dịch (MDR) | **Merchant** (trừ khi settle) | ví ~1.2–1.7% · FPX ~RM1.20 · thẻ ~2% |
| Phí rút tiền | **Merchant** | DuitNow ~RM1.50/đợt |
| **Sub-account/tháng** | **Platform (bạn)** | **RM0.35–6.50/merchant** ⚠️ |
| Dev tích hợp (1 lần) | Platform | ~3–6 tuần |
| Buyer | — | KHÔNG phí thêm |

**Chi phí ròng công ty = phí sub-account + dev.** Phí giao dịch KHÔNG vào P&L (merchant chịu). Ví dụ đơn RM100 qua TNG → merchant nhận ~RM98.5, platform thu RM0.

⚠️ **Ẩn số lớn nhất:** phí sub-account MY chênh 18x (RM0.35 ID vs RM6.50 PH). Ở 10.000 merchant = **RM3.5k vs RM65k/tháng**. Phải chốt với sales trước khi duyệt ngân sách.

## Rủi ro & Pháp lý

- Lộ data: **thấp** — số thẻ/ví không qua server ta; Xendit PCI-DSS L1 + BNM cấp phép.
- Giữ tiền (pháp lý): MANAGED sub-account → custody thuộc Xendit; *đang xác nhận*.
- Phụ thuộc vendor: **thấp** — multi-provider, vẫn giữ Stripe.
- PDPA: ký DPA + privacy notice; Xendit lưu data SEA (lợi thế cross-border vs Stripe US). **Không cần** giấy phép acquirer riêng.
- Pháp nhân MY: đã có (assumption) → đủ điều kiện.

## Roadmap (~5–8 tuần)

| Phase | Nội dung | Thời gian |
|---|---|---|
| 0 | Sales Xendit: chốt giá MY, custody, payout, KYB + ký DPA | 1–2 tuần |
| 1 | Onboarding merchant (MANAGED) + KYB | 1–2 tuần |
| 2 | Checkout + webhook + nhận tiền (TNG/GrabPay/DuitNow) | 2 tuần |
| 3 | Refund, đối soát, auto-disburse → staging | 1–2 tuần |

Nhân sự: 1 fullstack-developer + QA. **Phase 0 phải xong trước khi build.**

## Quyết định cần duyệt

1. ☐ Phê duyệt nguyên tắc tích hợp Xendit (song song Stripe).
2. ☐ Phê duyệt trần ngân sách (phí sub-account + 3–6 tuần dev).
3. ☐ Cho phép đàm phán + ký DPA với Xendit.
4. ☐ Ghi nhận phụ thuộc: giá MY + mô hình custody (báo cáo lại trước go-live).
