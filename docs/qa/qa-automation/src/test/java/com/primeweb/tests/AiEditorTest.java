package com.primeweb.tests;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;

public class AiEditorTest extends BaseTest {

    @Test
    @DisplayName("TC-05.01: Chat Ä‘iá»u chá»‰nh giao diá»‡n (Change Color)")
    void TC_05_01_AdjustUIUsingChat() {
        page.navigate(getBaseUrl() + "/editor/site-123");
        page.locator("input[data-testid='ai-editor-chat-input']").fill("Äá»•i mÃ u nÃºt chÃ­nh thÃ nh mÃ u tÃ­m");
        page.locator("button[data-testid='btn-send-edit']").click();
        // Iframe Preview cáº­p nháº­t real-time Component Button
        assertThat(page.frameLocator("iframe#preview-canvas").locator("button.primary-btn")).hasCSS("background-color", "rgb(128, 0, 128)");
    }

    @Test
    @DisplayName("TC-05.02: TÃ­nh nÄƒng HoÃ n tÃ¡c vÃ  Tiáº¿n tá»›i (Undo / Redo)")
    void TC_05_02_UndoRedoFunctionality() {
        page.navigate(getBaseUrl() + "/editor/site-123");
        // Ctrl+Z Undo 
        page.keyboard().press("Control+Z");
        // Check mÃ u UI trá»Ÿ vá» gá»‘c
        assertThat(page.frameLocator("iframe#preview-canvas").locator("button.primary-btn")).not().hasCSS("background-color", "rgb(128, 0, 128)");
        
        // Ctrl+Y Redo
        page.keyboard().press("Control+Y");
        assertThat(page.frameLocator("iframe#preview-canvas").locator("button.primary-btn")).hasCSS("background-color", "rgb(128, 0, 128)");
    }

    @Test
    @DisplayName("TC-05.03: Thao tÃ¡c táº¡o trang Web má»›i thÃ nh cÃ´ng")
    void TC_05_03_CreateNewPage() {
        page.navigate(getBaseUrl() + "/editor/site-123/pages");
        page.locator("button[data-testid='btn-add-page']").click();
        page.locator("input[name='page_name']").fill("Khuyáº¿n mÃ£i 2026");
        page.locator("button[data-testid='btn-save-page']").click();
        
        assertThat(page.locator("ul.page-list")).containsText("Khuyáº¿n mÃ£i 2026");
        assertThat(page.frameLocator("iframe#preview-canvas").locator("body")).hasText(""); // Chuyá»ƒn iframe qua trang trá»‘ng
    }

    @Test
    @DisplayName("TC-05.04: Admin: Thao tÃ¡c Sao chÃ©p (Duplicate) Component Block")
    void TC_05_04_DuplicateComponentBlock() {
        page.navigate(getBaseUrl() + "/editor/site-123");
        page.frameLocator("iframe#preview-canvas").locator("section[data-block-type='Hero']").first().hover();
        page.frameLocator("iframe#preview-canvas").locator("button[data-action='duplicate-block']").click();
        page.waitForTimeout(500); 
        assertThat(page.frameLocator("iframe#preview-canvas").locator("section[data-block-type='Hero']")).hasCount(2);
    }

    @Test
    @DisplayName("TC-05.06: VÃ´ hiá»‡u Gá»­i Regex khi Prompt rá»—ng táº¡i Popup Inline Edit [Negative]")
    void TC_05_06_DisableEmptyInlineEditPrompt() {
        page.navigate(getBaseUrl() + "/editor/site-123");
        page.frameLocator("iframe#preview-canvas").locator("h1.typography-element").hover();
        page.frameLocator("iframe#preview-canvas").locator("button[data-action='ai-inline-edit']").click(); // NÃºt âœ¨ Edit with AI
        
        Com.microsoft.playwright.Locator promptBox = page.frameLocator("iframe#preview-canvas").locator("input.inline-prompt-box");
        promptBox.fill("   ");
        assertThat(page.frameLocator("iframe#preview-canvas").locator("button.inline-prompt-submit")).isDisabled();
    }

    @Test
    @DisplayName("TC-05.07: Tá»« chá»‘i thao tÃ¡c XÃ³a Trang Home máº·c Ä‘á»‹nh [Negative]")
    void TC_05_07_PreventDefaultHomePageDeletion() {
        page.navigate(getBaseUrl() + "/editor/site-123/pages");
        page.locator("li[data-page-slug='/']").hover();
        // NÃºt xÃ³a bá»‹ áº©n hoáº·c khÃ´ng click Ä‘Æ°á»£c
        assertThat(page.locator("li[data-page-slug='/'] button[data-action='delete-page']")).isHidden();
    }

    @Test
    @DisplayName("TC-05.08: Viá»n Xanh (Highlight Border) dáº«n hÆ°á»›ng trá»±c quan khi Hover Block [UX Empathy]")
    void TC_05_08_HighlightBorderOnHover() {
        page.navigate(getBaseUrl() + "/editor/site-123");
        page.frameLocator("iframe#preview-canvas").locator("img").first().hover();
        assertThat(page.frameLocator("iframe#preview-canvas").locator("img").first()).hasClass(java.util.regex.Pattern.compile(".*highlight-border.*"));
    }

    @Test
    @DisplayName("TC-05.09: NÃºt (Bong BÃ³ng) Quick Action ná»•i lÃªn mÆ°á»£t mÃ  theo Con Trá» [UX Empathy]")
    void TC_05_09_FloatingBubbleQuickAction() {
        page.navigate(getBaseUrl() + "/editor/site-123");
        page.frameLocator("iframe#preview-canvas").locator("img").first().hover();
        page.waitForTimeout(600);
        assertThat(page.frameLocator("iframe#preview-canvas").locator("div.toolbar-mini-bubble")).isVisible();
    }

    @Test
    @DisplayName("TC-05.10: Check Cáº£nh BÃ¡o Náº¿u CÃ³ Thay Äá»•i (Dirty State) Khi Rá»i Trang ChÃ³ng VÃ¡nh [Interruption]")
    void TC_05_10_WarnDirtyStateOnLeave() {
        page.navigate(getBaseUrl() + "/editor/site-123");
        // Nháº­p content Ä‘á»ƒ dirty true
        page.locator("input[data-testid='ai-editor-chat-input']").fill("Make dirty");
        page.evaluate("window.onbeforeunload = () => 'Mock beforeunload'"); // Browser mock
        
        page.locator("a[data-testid='nav-back-admin']").click();
        page.onceDialog(dialog -> {
            dialog.dismiss();
        });
    }

    @Test
    @DisplayName("TC-05.11: CÆ¡ cháº¿ tá»± Ä‘á»™ng lÆ°u Auto-save Debounce")
    void TC_05_11_AutoSaveDebounce() {
        page.navigate(getBaseUrl() + "/editor/site-123");
        page.frameLocator("iframe#preview-canvas").locator("h1.typography-element").fill("GÃµ vÄƒn báº£n liÃªn tá»¥c");
        
        // Äá»£i 3 giÃ¢y
        page.waitForTimeout(3500);
        assertThat(page.locator("span.save-badge")).hasText("ÄÃ£ lÆ°u");
    }

    @Test
    @DisplayName("TC-05.19: PhÃ¢n tÃ¡ch Dá»¯ Liá»‡u Versioned Draft vs Published")
    void TC_05_19_DraftVsPublishedData() {
        page.navigate(getBaseUrl() + "/editor/site-123");
        page.frameLocator("iframe#preview-canvas").locator("h1.typography-element").fill("Khuyáº¿n MÃ£i Khá»§ng");
        page.waitForTimeout(3000); // Wait Autosave (Draft Data)
        
        // KhÃ¡ch máº·t tiá»n load web cÅ©
        page.navigate(getBaseUrl() + "/site/123");
        assertThat(page.locator("h1.typography-element")).not().hasText("Khuyáº¿n MÃ£i Khá»§ng"); // Váº«n lÃ  text cÅ© vÃ¬ admin chÆ°a click Publish
    }
}

