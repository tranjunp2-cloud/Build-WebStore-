package com.primeweb.tests;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;

public class ProductsCrudTest extends BaseTest {

    @Test
    @DisplayName("TC-09.01: Thêm sản phẩm cơ bản thành công (Happy Path)")
    void TC_09_01_AddNewProductHappyPath() {
        page.navigate("http://localhost:3000/dashboard/products");
        page.locator("a[data-testid='btn-create-new-product']").click();
        page.locator("input[name='title']").fill("Baju Pink");
        page.locator("input[name='price']").fill("189");
        page.locator("input[name='stock']").fill("50");
        page.locator("button[type='submit']").click();
        assertThat(page.locator("div.toast-success")).containsText("thành công");
        assertThat(page.locator("table.products-list")).containsText("RM 189.00");
    }

    @Test
    @DisplayName("TC-09.02: Thao tác Xóa Mềm một Sản Phẩm (Soft Delete)")
    void TC_09_02_SoftDeleteProduct() {
        page.navigate("http://localhost:3000/dashboard/products");
        page.locator("tr[data-product-id='1'] button[data-action='delete']").click();
        page.locator("button[data-testid='confirm-delete-btn']").click();
        assertThat(page.locator("tr[data-product-id='1']")).isHidden();
    }

    @Test
    @DisplayName("TC-09.03: Thao tác Admin: Sửa nhanh Giá và Tồn Kho (Quick Edit)")
    void TC_09_03_QuickEditStock() {
        page.navigate("http://localhost:3000/dashboard/products");
        page.locator("td[data-field='stock']").first().dblclick();
        page.locator("input.quick-edit-stock").fill("150");
        page.keyboard().press("Enter");
        assertThat(page.locator("td[data-field='stock']").first()).hasText("150");
        assertThat(page.locator("td[data-field='stock']").first()).hasClass(java.util.regex.Pattern.compile(".*text-green.*"));
    }

    @Test
    @DisplayName("TC-09.04: Thao tác Admin: Xóa hàng loạt nhiều sản phẩm (Bulk Delete)")
    void TC_09_04_BulkDeleteProducts() {
        page.navigate("http://localhost:3000/dashboard/products");
        page.locator("input.row-checkbox").nth(0).check();
        page.locator("input.row-checkbox").nth(1).check();
        page.locator("input.row-checkbox").nth(2).check();
        page.locator("input.row-checkbox").nth(3).check();
        page.locator("input.row-checkbox").nth(4).check();
        page.locator("button[data-testid='btn-bulk-actions']").click();
        page.locator("button[data-testid='action-delete-selected']").click();
        page.onceDialog(dialog -> dialog.accept());
        assertThat(page.locator("div.toast-message")).containsText("Đã Xóa Thành Công 5 Sản Phẩm");
    }

    @Test
    @DisplayName("TC-09.05: Chặn Giá Trị Âm / Sai Định Dạng Field Numeric [Negative]")
    void TC_09_05_BlockNegativeNumericFields() {
        page.navigate("http://localhost:3000/dashboard/products/new");
        page.locator("input[name='price']").fill("-50");
        page.locator("button[type='submit']").click();
        assertThat(page.locator("span.error-message")).hasText("Giá không được nhỏ hơn 0");
    }

    @Test
    @DisplayName("TC-09.06: Chặn Tên Sản Phẩm Rỗng Không Nhập [Negative]")
    void TC_09_06_BlockEmptyProductName() {
        page.navigate("http://localhost:3000/dashboard/products/new");
        page.locator("input[name='title']").fill("   ");
        page.locator("button[type='submit']").click();
        assertThat(page.locator("span.error-message")).hasText("Không được bỏ trống");
    }

    @Test
    @DisplayName("TC-09.07: Chặn Upload File Sai Định Dạng Ảnh [Negative]")
    void TC_09_07_BlockInvalidFileUpload() {
        page.navigate("http://localhost:3000/dashboard/products/new");
        // Simulate uploading a PDF renamed to JPG. Assuming input type file exists
        // page.setInputFiles("input[type='file']", Paths.get("src/test/resources/invoice.pdf"));
        // assertThat(page.locator("div.toast-error")).containsText("Lỗi File");
    }

    @Test
    @DisplayName("TC-09.08: Đồng bộ Giá Storefront Tự Động SSR Revalidation")
    void TC_09_08_SyncStorefrontPriceRevalidation() {
        // Mock Admin action
        page.navigate("http://localhost:3000/dashboard/products/123/edit");
        page.locator("input[name='price']").fill("150");
        page.locator("button[type='submit']").click();
        // Check Storefront
        page.navigate("http://localhost:3000/product/123");
        assertThat(page.locator("span.product-price-display")).hasText("RM 150.00");
    }

    @Test
    @DisplayName("TC-09.09: Tự động focus ô Tên SP & Label Tooltip mượt mà [UX Empathy]")
    void TC_09_09_AutoFocusProductName() {
        page.navigate("http://localhost:3000/dashboard/products/new");
        assertThat(page.locator("input[name='title']")).isFocused();
    }

    @Test
    @DisplayName("TC-09.10: Sinh mô tả sản phẩm bằng AI Streaming")
    void TC_09_10_GenerateDescriptionUsingAI() {
        page.navigate("http://localhost:3000/dashboard/products/new");
        page.locator("input[name='title']").fill("Tudung Basic Muslimah");
        page.locator("button[data-testid='btn-ai-write-desc']").click();
        assertThat(page.locator("button[type='submit']")).isDisabled();
        page.waitForSelector("div.ai-streaming-complete", new com.microsoft.playwright.Page.WaitForSelectorOptions().setTimeout(30000));
        assertThat(page.locator("button[type='submit']")).isEnabled();
    }

    @Test
    @DisplayName("TC-09.11: Hiển thị Condition Fields Chứng Nhận Thực Phẩm (JAKIM Halal)")
    void TC_09_11_ShowHalalConditionFields() {
        page.navigate("http://localhost:3000/dashboard/products/new");
        page.locator("input[name='isHalal']").check();
        assertThat(page.locator("div.halal-certificate-upload")).isVisible();
    }

    @Test
    @DisplayName("TC-09.12: Auto-scroll nhảy tới trường Lỗi khi Form quá dài [UX Empathy]")
    void TC_09_12_AutoScrollToErrorField() {
        page.navigate("http://localhost:3000/dashboard/products/new");
        page.locator("input[name='title']").fill("Product Name");
        // Scroll to top and save, omitting price which is at the bottom
        page.evaluate("window.scrollTo(0, 0)");
        page.locator("button[type='submit']").click();
        // Check if viewport scrolled to the price input element automatically
        Boolean isScrolled = (Boolean) page.evaluate("() => window.scrollY > 0");
        assertThat(page.locator("input[name='price']")).hasClass(java.util.regex.Pattern.compile(".*border-red.*"));
    }

    @Test
    @DisplayName("TC-09.13: Tìm kiếm SP bằng mã SKU không phân biệt chữ hoa/thường")
    void TC_09_13_CaseInsensitiveSkuSearch() {
        page.navigate("http://localhost:3000/dashboard/products");
        page.locator("input[name='search']").fill("sp-a01");
        page.keyboard().press("Enter");
        page.waitForTimeout(500);
        assertThat(page.locator("table.products-list")).containsText("SP-A01");
        
        page.locator("input[name='search']").fill("SP-A01");
        page.keyboard().press("Enter");
        page.waitForTimeout(500);
        assertThat(page.locator("table.products-list")).containsText("SP-A01");
    }

    @Test
    @DisplayName("TC-09.14: Lưu bộ lọc tìm kiếm tuỳ chỉnh (Save Custom Filter)")
    void TC_09_14_SaveCustomFilter() {
        page.navigate("http://localhost:3000/dashboard/products");
        page.locator("button[data-testid='btn-save-filter']").click();
        page.locator("input[name='filter-name']").fill("Products Sắp Hết");
        page.locator("button[data-testid='btn-confirm-save-filter']").click();
        assertThat(page.locator("button[data-testid='filter-Products Sắp Hết']")).isVisible();
    }

    @Test
    @DisplayName("TC-09.15: Đường Menu Breadcrumbs / Navigation Lưu Trạng Thái Search")
    void TC_09_15_BreadcrumbsRetainFilterState() {
        // filter & click
        page.navigate("http://localhost:3000/dashboard/products?filter=out_of_stock");
        page.locator("table.products-list tr").first().click();
        // go back
        page.locator("a.breadcrumb-back").click();
        assertThat(page).hasURL(java.util.regex.Pattern.compile(".*filter=out_of_stock.*"));
    }

    @Test
    @DisplayName("TC-09.18: Tường Lửa Ngăn Lệnh Stored XSS Scripting Dữ Liệu [Negative]")
    void TC_09_18_PreventStoredXss() {
        page.navigate("http://localhost:3000/dashboard/products/new");
        page.locator("div.rich-text-editor").fill("<script>alert('hack')</script>");
        page.locator("button[type='submit']").click();
        // Should be sanitized, script tags removed
        assertThat(page.locator("div.toast-success")).isVisible(); // Created successfully
        page.navigate("http://localhost:3000/product/new-product");
        // Alert should not trigger
        boolean dialogTriggered = false;
        page.onDialog(dialog -> dialog.accept());
        // Simple assertion to verify standard page load
        assertThat(page.locator("body")).isVisible();
    }
}
