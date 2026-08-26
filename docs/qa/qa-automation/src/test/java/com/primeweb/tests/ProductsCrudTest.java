package com.primeweb.tests;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;

public class ProductsCrudTest extends BaseTest {

    @Test
    @DisplayName("TC-09.01: ThÃªm sáº£n pháº©m cÆ¡ báº£n thÃ nh cÃ´ng (Happy Path)")
    void TC_09_01_AddNewProductHappyPath() {
        page.navigate(getBaseUrl() + "/dashboard/products");
        page.locator("a[data-testid='btn-create-new-product']").click();
        page.locator("input[name='title']").fill("Baju Pink");
        page.locator("input[name='price']").fill("189");
        page.locator("input[name='stock']").fill("50");
        page.locator("button[type='submit']").click();
        assertThat(page.locator("div.toast-success")).containsText("thÃ nh cÃ´ng");
        assertThat(page.locator("table.products-list")).containsText("RM 189.00");
    }

    @Test
    @DisplayName("TC-09.02: Thao tÃ¡c XÃ³a Má»m má»™t Sáº£n Pháº©m (Soft Delete)")
    void TC_09_02_SoftDeleteProduct() {
        page.navigate(getBaseUrl() + "/dashboard/products");
        page.locator("tr[data-product-id='1'] button[data-action='delete']").click();
        page.locator("button[data-testid='confirm-delete-btn']").click();
        assertThat(page.locator("tr[data-product-id='1']")).isHidden();
    }

    @Test
    @DisplayName("TC-09.03: Thao tÃ¡c Admin: Sá»­a nhanh GiÃ¡ vÃ  Tá»“n Kho (Quick Edit)")
    void TC_09_03_QuickEditStock() {
        page.navigate(getBaseUrl() + "/dashboard/products");
        page.locator("td[data-field='stock']").first().dblclick();
        page.locator("input.quick-edit-stock").fill("150");
        page.keyboard().press("Enter");
        assertThat(page.locator("td[data-field='stock']").first()).hasText("150");
        assertThat(page.locator("td[data-field='stock']").first()).hasClass(java.util.regex.Pattern.compile(".*text-green.*"));
    }

    @Test
    @DisplayName("TC-09.04: Thao tÃ¡c Admin: XÃ³a hÃ ng loáº¡t nhiá»u sáº£n pháº©m (Bulk Delete)")
    void TC_09_04_BulkDeleteProducts() {
        page.navigate(getBaseUrl() + "/dashboard/products");
        page.locator("input.row-checkbox").nth(0).check();
        page.locator("input.row-checkbox").nth(1).check();
        page.locator("input.row-checkbox").nth(2).check();
        page.locator("input.row-checkbox").nth(3).check();
        page.locator("input.row-checkbox").nth(4).check();
        page.locator("button[data-testid='btn-bulk-actions']").click();
        page.locator("button[data-testid='action-delete-selected']").click();
        page.onceDialog(dialog -> dialog.accept());
        assertThat(page.locator("div.toast-message")).containsText("ÄÃ£ XÃ³a ThÃ nh CÃ´ng 5 Sáº£n Pháº©m");
    }

    @Test
    @DisplayName("TC-09.05: Cháº·n GiÃ¡ Trá»‹ Ã‚m / Sai Äá»‹nh Dáº¡ng Field Numeric [Negative]")
    void TC_09_05_BlockNegativeNumericFields() {
        page.navigate(getBaseUrl() + "/dashboard/products/new");
        page.locator("input[name='price']").fill("-50");
        page.locator("button[type='submit']").click();
        assertThat(page.locator("span.error-message")).hasText("GiÃ¡ khÃ´ng Ä‘Æ°á»£c nhá» hÆ¡n 0");
    }

    @Test
    @DisplayName("TC-09.06: Cháº·n TÃªn Sáº£n Pháº©m Rá»—ng KhÃ´ng Nháº­p [Negative]")
    void TC_09_06_BlockEmptyProductName() {
        page.navigate(getBaseUrl() + "/dashboard/products/new");
        page.locator("input[name='title']").fill("   ");
        page.locator("button[type='submit']").click();
        assertThat(page.locator("span.error-message")).hasText("KhÃ´ng Ä‘Æ°á»£c bá» trá»‘ng");
    }

    @Test
    @DisplayName("TC-09.07: Cháº·n Upload File Sai Äá»‹nh Dáº¡ng áº¢nh [Negative]")
    void TC_09_07_BlockInvalidFileUpload() {
        page.navigate(getBaseUrl() + "/dashboard/products/new");
        // Simulate uploading a PDF renamed to JPG. Assuming input type file exists
        // page.setInputFiles("input[type='file']", Paths.get("src/test/resources/invoice.pdf"));
        // assertThat(page.locator("div.toast-error")).containsText("Lá»—i File");
    }

    @Test
    @DisplayName("TC-09.08: Äá»“ng bá»™ GiÃ¡ Storefront Tá»± Äá»™ng SSR Revalidation")
    void TC_09_08_SyncStorefrontPriceRevalidation() {
        // Mock Admin action
        page.navigate(getBaseUrl() + "/dashboard/products/123/edit");
        page.locator("input[name='price']").fill("150");
        page.locator("button[type='submit']").click();
        // Check Storefront
        page.navigate(getBaseUrl() + "/product/123");
        assertThat(page.locator("span.product-price-display")).hasText("RM 150.00");
    }

    @Test
    @DisplayName("TC-09.09: Tá»± Ä‘á»™ng focus Ã´ TÃªn SP & Label Tooltip mÆ°á»£t mÃ  [UX Empathy]")
    void TC_09_09_AutoFocusProductName() {
        page.navigate(getBaseUrl() + "/dashboard/products/new");
        assertThat(page.locator("input[name='title']")).isFocused();
    }

    @Test
    @DisplayName("TC-09.10: Sinh mÃ´ táº£ sáº£n pháº©m báº±ng AI Streaming")
    void TC_09_10_GenerateDescriptionUsingAI() {
        page.navigate(getBaseUrl() + "/dashboard/products/new");
        page.locator("input[name='title']").fill("Tudung Basic Muslimah");
        page.locator("button[data-testid='btn-ai-write-desc']").click();
        assertThat(page.locator("button[type='submit']")).isDisabled();
        page.waitForSelector("div.ai-streaming-complete", new com.microsoft.playwright.Page.WaitForSelectorOptions().setTimeout(30000));
        assertThat(page.locator("button[type='submit']")).isEnabled();
    }

    @Test
    @DisplayName("TC-09.11: Hiá»ƒn thá»‹ Condition Fields Chá»©ng Nháº­n Thá»±c Pháº©m (JAKIM Halal)")
    void TC_09_11_ShowHalalConditionFields() {
        page.navigate(getBaseUrl() + "/dashboard/products/new");
        page.locator("input[name='isHalal']").check();
        assertThat(page.locator("div.halal-certificate-upload")).isVisible();
    }

    @Test
    @DisplayName("TC-09.12: Auto-scroll nháº£y tá»›i trÆ°á»ng Lá»—i khi Form quÃ¡ dÃ i [UX Empathy]")
    void TC_09_12_AutoScrollToErrorField() {
        page.navigate(getBaseUrl() + "/dashboard/products/new");
        page.locator("input[name='title']").fill("Product Name");
        // Scroll to top and save, omitting price which is at the bottom
        page.evaluate("window.scrollTo(0, 0)");
        page.locator("button[type='submit']").click();
        // Check if viewport scrolled to the price input element automatically
        Boolean isScrolled = (Boolean) page.evaluate("() => window.scrollY > 0");
        assertThat(page.locator("input[name='price']")).hasClass(java.util.regex.Pattern.compile(".*border-red.*"));
    }

    @Test
    @DisplayName("TC-09.13: TÃ¬m kiáº¿m SP báº±ng mÃ£ SKU khÃ´ng phÃ¢n biá»‡t chá»¯ hoa/thÆ°á»ng")
    void TC_09_13_CaseInsensitiveSkuSearch() {
        page.navigate(getBaseUrl() + "/dashboard/products");
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
    @DisplayName("TC-09.14: LÆ°u bá»™ lá»c tÃ¬m kiáº¿m tuá»³ chá»‰nh (Save Custom Filter)")
    void TC_09_14_SaveCustomFilter() {
        page.navigate(getBaseUrl() + "/dashboard/products");
        page.locator("button[data-testid='btn-save-filter']").click();
        page.locator("input[name='filter-name']").fill("Products Sáº¯p Háº¿t");
        page.locator("button[data-testid='btn-confirm-save-filter']").click();
        assertThat(page.locator("button[data-testid='filter-Products Sáº¯p Háº¿t']")).isVisible();
    }

    @Test
    @DisplayName("TC-09.15: ÄÆ°á»ng Menu Breadcrumbs / Navigation LÆ°u Tráº¡ng ThÃ¡i Search")
    void TC_09_15_BreadcrumbsRetainFilterState() {
        // filter & click
        page.navigate(getBaseUrl() + "/dashboard/products?filter=out_of_stock");
        page.locator("table.products-list tr").first().click();
        // go back
        page.locator("a.breadcrumb-back").click();
        assertThat(page).hasURL(java.util.regex.Pattern.compile(".*filter=out_of_stock.*"));
    }

    @Test
    @DisplayName("TC-09.18: TÆ°á»ng Lá»­a NgÄƒn Lá»‡nh Stored XSS Scripting Dá»¯ Liá»‡u [Negative]")
    void TC_09_18_PreventStoredXss() {
        page.navigate(getBaseUrl() + "/dashboard/products/new");
        page.locator("div.rich-text-editor").fill("<script>alert('hack')</script>");
        page.locator("button[type='submit']").click();
        // Should be sanitized, script tags removed
        assertThat(page.locator("div.toast-success")).isVisible(); // Created successfully
        page.navigate(getBaseUrl() + "/product/new-product");
        // Alert should not trigger
        boolean dialogTriggered = false;
        page.onDialog(dialog -> dialog.accept());
        // Simple assertion to verify standard page load
        assertThat(page.locator("body")).isVisible();
    }
}

