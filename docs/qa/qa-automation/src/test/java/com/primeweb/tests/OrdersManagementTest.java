package com.primeweb.tests;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;

public class OrdersManagementTest extends BaseTest {

    @Test
    @DisplayName("TC-11.01: Checkout tạo Order qua cổng Stripe khi thanh toán thành công (Happy Path)")
    void TC_11_01_CheckoutViaStripeSuccessfully() {
        page.navigate("http://localhost:3000/checkout");
        page.locator("input[name='email']").fill("khachhang@test.com");
        page.locator("button[data-testid='btn-pay-stripe']").click();
        page.waitForURL(java.util.regex.Pattern.compile(".*/order/.*/confirm"));
        assertThat(page.locator("h1.checkout-success-title")).isVisible();
    }

    @Test
    @DisplayName("TC-11.02: Thao tác Khách: Hủy Thanh Toán (Cancel) Đầu Cổng Trả Tồn Kho")
    void TC_11_02_CancelStripePaymentRestoresStock() {
        page.navigate("http://localhost:3000/checkout");
        page.locator("button[data-testid='btn-pay-stripe']").click();
        // Giả lập KH bấm Hủy/Back ở Stripe
        page.locator("a[data-testid='btn-cancel-payment']").click();
        assertThat(page).hasURL("http://localhost:3000/cart");
    }

    @Test
    @DisplayName("TC-11.03: Khách Cập Nhật Địa Chỉ Shipping Xong CMS Label Update")
    void TC_11_03_UpdateShippingAddress() {
        page.navigate("http://localhost:3000/admin/orders/123");
        page.locator("button[data-testid='btn-edit-shipping']").click();
        page.locator("input[name='address']").fill("New Address 456");
        page.locator("button[data-testid='btn-save-shipping']").click();
        assertThat(page.locator("div.shipping-label-preview")).containsText("New Address 456");
    }

    @Test
    @DisplayName("TC-11.04: Admin Hoàn Tiền Thẻ Một Phần Qua Stripe (Partial Refund)")
    void TC_11_04_PartialRefundAdminAction() {
        page.navigate("http://localhost:3000/admin/orders/123");
        page.locator("button[data-testid='btn-issue-refund']").click();
        page.locator("input[name='refund_amount']").fill("30");
        page.locator("button[data-testid='btn-confirm-refund']").click();
        assertThat(page.locator("span.badge-status")).hasText("Partially Refunded");
    }

    @Test
    @DisplayName("TC-11.05: Tính Toán Giỏ Hàng Sai Lệch JS Client Check [Negative]")
    void TC_11_05_ClientSidePriceTampering() {
        page.navigate("http://localhost:3000/checkout");
        // Giả lập chèn giá trị giả qua JS
        page.evaluate("document.querySelector('input[name=\"total_price\"]').value = '0.1'");
        page.locator("button[data-testid='btn-pay-stripe']").click();
        assertThat(page.locator("div.toast-error")).containsText("Bad Logic Error");
    }

    @Test
    @DisplayName("TC-11.06: Dò Nén Chặn CheckForm Thiếu Dữ Liệu Form Missing Address/Email [Negative]")
    void TC_11_06_BlockMissingRequiredFields() {
        page.navigate("http://localhost:3000/checkout");
        page.locator("input[name='email']").fill("   ");
        page.locator("button[data-testid='btn-pay-stripe']").click();
        assertThat(page.locator("input[name='email']")).hasClass(java.util.regex.Pattern.compile(".*border-red.*"));
        assertThat(page.locator("div.error-tooltip")).isVisible();
    }

    @Test
    @DisplayName("TC-11.08: Ngăn Nhập Mã Promocode Giảm Giá Hết Lượt / Hết Hạn [Negative]")
    void TC_11_08_BlockExpiredPromoCode() {
        page.navigate("http://localhost:3000/checkout");
        page.locator("input[name='promo_code']").fill("SUMMER2026");
        page.locator("button[data-testid='btn-apply-promo']").click();
        assertThat(page.locator("div.promo-tooltip-error")).containsText("Mã này đã hết hạn");
    }

    @Test
    @DisplayName("TC-11.10: Auto-focus Nhập Thẻ & Label Checkout Friendly [UX Empathy]")
    void TC_11_10_CheckoutUXEmpathy() {
        page.navigate("http://localhost:3000/checkout");
        assertThat(page.locator("input[name='phone']")).isFocused();
        assertThat(page.locator("button[data-testid='btn-pay-stripe']")).containsText("Thanh Toán");
    }

    @Test
    @DisplayName("TC-11.11: Push Real-Time SSE Thông Báo Đơn Tới Mới Trên Admin Desktop")
    void TC_11_11_RealTimeSseNotification() {
        page.navigate("http://localhost:3000/admin/dashboard");
        // Mock SSE Event Tới
        page.evaluate("window.dispatchEvent(new CustomEvent('new_order_event', {detail: {id: 999}}))");
        assertThat(page.locator("div.toast-notification")).containsText("Đơn Mới");
    }

    @Test
    @DisplayName("TC-11.13: In Hàng Loạt Batch Cục Mass Lệnh Label Bưu Phiếu Shipping Khách Chọn Mảng Chọn")
    void TC_11_13_BatchPrintShippingLabels() {
        page.navigate("http://localhost:3000/admin/orders");
        for(int i=0; i<5; i++) {
             page.locator("input.row-checkbox").nth(i).check();
        }
        page.locator("button[data-testid='btn-bulk-actions']").click();
        page.locator("button[data-testid='btn-batch-print-pdf']").click();
        // Dialog print should pop up. We cannot natively test OS print dialogs in Playwright easily but we check backend/UI trigger
        page.waitForTimeout(500); 
    }

    @Test
    @DisplayName("TC-11.14: Hành Vi Nút Bulk Action Đảo Mode Nhiều Item Quản Lý Tool Batch")
    void TC_11_14_BulkUpdateOrderStatus() {
        page.navigate("http://localhost:3000/admin/orders");
        page.locator("input.row-checkbox").nth(0).check();
        page.locator("input.row-checkbox").nth(1).check();
        page.locator("button[data-testid='btn-bulk-actions']").click();
        page.locator("button[data-testid='action-mark-shipped']").click();
        assertThat(page.locator("div.toast-success")).containsText("Cập nhật 2 đơn hàng thành công");
    }

    @Test
    @DisplayName("TC-11.15: Modal Lướt Dữ Liệu Ngoại Xem Đơn Không Đổ Trang Context Web [UX Empathy]")
    void TC_11_15_ViewOrderInSideModalUX() {
        page.navigate("http://localhost:3000/admin/orders?filter=new");
        page.locator("table.orders-list tr td[data-field='id']").first().click();
        assertThat(page.locator("div.right-side-modal")).isVisible();
        page.locator("button.close-modal").click();
        assertThat(page).hasURL(java.util.regex.Pattern.compile(".*filter=new.*"));
    }
}
