# User Stories: Payment Gateway (F13)

> **Feature:** F13 — Payment Gateway (Malaysia)
> **Wave:** 6 | **Priority:** P1 | **Ref PRD:** [F13-payment-gateway.md](../prd/F13-payment-gateway.md)

---

## US-F13-01: Buy with FPX (Online Banking)

**Wave 6** | **P0** | **L** | **Status:** Draft

### Story

```
As a   Malaysian buyer
I want pay sử dụng FPX (online banking)
So that tôi thanh toán trực tiếp từ bank mà không cần credit card
```

### Acceptance Criteria

#### AC-1: FPX Payment Happy Path
```gherkin
GIVEN buyer at checkout selects FPX
WHEN  they choose bank và click "Pay Now"
THEN  redirect to bank's login page (3D Secure)
  AND after bank approval → redirect to confirmation page
  AND order status = 'new'
  AND webhook: payment_intent.succeeded → update order
```

#### AC-2: Payment Failed
```gherkin
GIVEN payment fails (bank declined, timeout)
WHEN  buyer redirected back
THEN  error: "Pembayaran gagal. Sila cuba lagi."
  AND cart items preserved — buyer can retry
  AND order status stays 'pending'
```

### Definition of Done
- [ ] Tích hợp Stripe Payment Element cho MYR.
- [ ] Webhook xử lý đúng luồng thanh toán thành công/thất bại.

---

## US-F13-02: Seller Payment Settings

**Wave 6** | **P0** | **M** | **Status:** Draft

### Story

```
As a   SME Owner
I want bật/tắt các phương thức thanh toán (Card, FPX)
So that tôi kiểm soát được cổng thanh toán theo nhu cầu kinh doanh
```

### Acceptance Criteria

#### AC-1: Toggle Payment Methods
```gherkin
GIVEN user đang ở Dashboard > Settings > Payments
WHEN  user bật/tắt (toggle) cổng thanh toán Card hoặc FPX
THEN  thay đổi được cập nhật vào settings của Site
  AND checkout widget tự động ẩn/hiện phương thức tương ứng
```

### Definition of Done
- [ ] UI Settings cập nhật real-time phía cổng thanh toán (Checkout).
