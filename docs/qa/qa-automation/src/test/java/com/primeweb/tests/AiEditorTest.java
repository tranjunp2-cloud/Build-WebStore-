package com.primeweb.tests;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;

public class AiEditorTest extends BaseTest {

    @Test
    @DisplayName("TC-05.01: Chat điều chỉnh giao diện (Change Color)")
    void TC_05_01_AdjustUIUsingChat() {
        page.navigate("http://localhost:3000/editor/site-123");
        page.locator("input[data-testid='ai-editor-chat-input']").fill("Đổi màu nút chính thành màu tím");
        page.locator("button[data-testid='btn-send-edit']").click();
        // Iframe Preview cập nhật real-time Component Button
        assertThat(page.frameLocator("iframe#preview-canvas").locator("button.primary-btn")).hasCSS("background-color", "rgb(128, 0, 128)");
    }

    @Test
    @DisplayName("TC-05.02: Tính năng Hoàn tác và Tiến tới (Undo / Redo)")
    void TC_05_02_UndoRedoFunctionality() {
        page.navigate("http://localhost:3000/editor/site-123");
        // Ctrl+Z Undo 
        page.keyboard().press("Control+Z");
        // Check màu UI trở về gốc
        assertThat(page.frameLocator("iframe#preview-canvas").locator("button.primary-btn")).not().hasCSS("background-color", "rgb(128, 0, 128)");
        
        // Ctrl+Y Redo
        page.keyboard().press("Control+Y");
        assertThat(page.frameLocator("iframe#preview-canvas").locator("button.primary-btn")).hasCSS("background-color", "rgb(128, 0, 128)");
    }

    @Test
    @DisplayName("TC-05.03: Thao tác tạo trang Web mới thành công")
    void TC_05_03_CreateNewPage() {
        page.navigate("http://localhost:3000/editor/site-123/pages");
        page.locator("button[data-testid='btn-add-page']").click();
        page.locator("input[name='page_name']").fill("Khuyến mãi 2026");
        page.locator("button[data-testid='btn-save-page']").click();
        
        assertThat(page.locator("ul.page-list")).containsText("Khuyến mãi 2026");
        assertThat(page.frameLocator("iframe#preview-canvas").locator("body")).hasText(""); // Chuyển iframe qua trang trống
    }

    @Test
    @DisplayName("TC-05.04: Admin: Thao tác Sao chép (Duplicate) Component Block")
    void TC_05_04_DuplicateComponentBlock() {
        page.navigate("http://localhost:3000/editor/site-123");
        page.frameLocator("iframe#preview-canvas").locator("section[data-block-type='Hero']").first().hover();
        page.frameLocator("iframe#preview-canvas").locator("button[data-action='duplicate-block']").click();
        page.waitForTimeout(500); 
        assertThat(page.frameLocator("iframe#preview-canvas").locator("section[data-block-type='Hero']")).hasCount(2);
    }

    @Test
    @DisplayName("TC-05.06: Vô hiệu Gửi Regex khi Prompt rỗng tại Popup Inline Edit [Negative]")
    void TC_05_06_DisableEmptyInlineEditPrompt() {
        page.navigate("http://localhost:3000/editor/site-123");
        page.frameLocator("iframe#preview-canvas").locator("h1.typography-element").hover();
        page.frameLocator("iframe#preview-canvas").locator("button[data-action='ai-inline-edit']").click(); // Nút ✨ Edit with AI
        
        Com.microsoft.playwright.Locator promptBox = page.frameLocator("iframe#preview-canvas").locator("input.inline-prompt-box");
        promptBox.fill("   ");
        assertThat(page.frameLocator("iframe#preview-canvas").locator("button.inline-prompt-submit")).isDisabled();
    }

    @Test
    @DisplayName("TC-05.07: Từ chối thao tác Xóa Trang Home mặc định [Negative]")
    void TC_05_07_PreventDefaultHomePageDeletion() {
        page.navigate("http://localhost:3000/editor/site-123/pages");
        page.locator("li[data-page-slug='/']").hover();
        // Nút xóa bị ẩn hoặc không click được
        assertThat(page.locator("li[data-page-slug='/'] button[data-action='delete-page']")).isHidden();
    }

    @Test
    @DisplayName("TC-05.08: Viền Xanh (Highlight Border) dẫn hướng trực quan khi Hover Block [UX Empathy]")
    void TC_05_08_HighlightBorderOnHover() {
        page.navigate("http://localhost:3000/editor/site-123");
        page.frameLocator("iframe#preview-canvas").locator("img").first().hover();
        assertThat(page.frameLocator("iframe#preview-canvas").locator("img").first()).hasClass(java.util.regex.Pattern.compile(".*highlight-border.*"));
    }

    @Test
    @DisplayName("TC-05.09: Nút (Bong Bóng) Quick Action nổi lên mượt mà theo Con Trỏ [UX Empathy]")
    void TC_05_09_FloatingBubbleQuickAction() {
        page.navigate("http://localhost:3000/editor/site-123");
        page.frameLocator("iframe#preview-canvas").locator("img").first().hover();
        page.waitForTimeout(600);
        assertThat(page.frameLocator("iframe#preview-canvas").locator("div.toolbar-mini-bubble")).isVisible();
    }

    @Test
    @DisplayName("TC-05.10: Check Cảnh Báo Nếu Có Thay Đổi (Dirty State) Khi Rời Trang Chóng Vánh [Interruption]")
    void TC_05_10_WarnDirtyStateOnLeave() {
        page.navigate("http://localhost:3000/editor/site-123");
        // Nhập content để dirty true
        page.locator("input[data-testid='ai-editor-chat-input']").fill("Make dirty");
        page.evaluate("window.onbeforeunload = () => 'Mock beforeunload'"); // Browser mock
        
        page.locator("a[data-testid='nav-back-admin']").click();
        page.onceDialog(dialog -> {
            dialog.dismiss();
        });
    }

    @Test
    @DisplayName("TC-05.11: Cơ chế tự động lưu Auto-save Debounce")
    void TC_05_11_AutoSaveDebounce() {
        page.navigate("http://localhost:3000/editor/site-123");
        page.frameLocator("iframe#preview-canvas").locator("h1.typography-element").fill("Gõ văn bản liên tục");
        
        // Đợi 3 giây
        page.waitForTimeout(3500);
        assertThat(page.locator("span.save-badge")).hasText("Đã lưu");
    }

    @Test
    @DisplayName("TC-05.19: Phân tách Dữ Liệu Versioned Draft vs Published")
    void TC_05_19_DraftVsPublishedData() {
        page.navigate("http://localhost:3000/editor/site-123");
        page.frameLocator("iframe#preview-canvas").locator("h1.typography-element").fill("Khuyến Mãi Khủng");
        page.waitForTimeout(3000); // Wait Autosave (Draft Data)
        
        // Khách mặt tiền load web cũ
        page.navigate("http://localhost:3000/site/123");
        assertThat(page.locator("h1.typography-element")).not().hasText("Khuyến Mãi Khủng"); // Vẫn là text cũ vì admin chưa click Publish
    }
}
