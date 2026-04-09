package com.primeweb.tests;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;

public class AiChatBuilderTest extends BaseTest {

    @Test
    @DisplayName("TC-01.01: Sinh website thÃ nh cÃ´ng vá»›i prompt Ä‘áº§y Ä‘á»§ ngá»¯ cáº£nh (Happy Path)")
    void TC_01_01_GenerateSiteWithFullContext() {
        page.navigate(getBaseUrl() + "/builder/new");
        page.locator("textarea[name='prompt']").fill("Tiá»‡m bÃ¡nh handmade quáº­n 3, má»Ÿ nÄƒm 2020");
        page.locator("button[data-testid='btn-generate-site']").click();
        
        assertThat(page.locator("div[data-testid='generation-progress-bar']")).isVisible();
        assertThat(page.locator("div[data-testid='generation-progress-label']")).containsText("Äang táº¡o...");
        
        page.waitForSelector("iframe[data-testid='site-preview-iframe']", new com.microsoft.playwright.Page.WaitForSelectorOptions().setTimeout(60000));
        assertThat(page.locator("iframe[data-testid='site-preview-iframe']")).isVisible();
    }

    @Test
    @DisplayName("TC-01.02: AI yÃªu cáº§u lÃ m rÃµ khi prompt quÃ¡ chung chung")
    void TC_01_02_AiAsksForClarification() {
        page.navigate(getBaseUrl() + "/builder/new");
        page.locator("textarea[name='prompt']").fill("LÃ m web cho mÃ¬nh");
        page.locator("button[data-testid='btn-generate-site']").click();
        
        // Tráº£ lá»i dáº¡ng Chat thay vÃ¬ sinh Layout
        page.waitForSelector("div.ai-chat-bubble");
        assertThat(page.locator("div.ai-chat-bubble").last()).containsText("ngÃ nh nghá»");
    }

    @Test
    @DisplayName("TC-01.03: Admin: Chat há»i láº¡i (Follow-up) Ä‘á»ƒ tinh chá»‰nh")
    void TC_01_03_AdminFollowUpChat() {
        // Giáº£ láº­p Ä‘Ã£ cÃ³ Site Preview
        page.navigate(getBaseUrl() + "/builder/session/abc");
        page.locator("textarea[name='prompt']").fill("Äá»•i mÃ u nÃºt qua cam");
        page.locator("button[data-testid='btn-send-followup']").click();
        
        page.waitForTimeout(2000); // Wait for stream
        assertThat(page.frameLocator("iframe[data-testid='site-preview-iframe']").locator("button").first()).hasCSS("background-color", "rgb(255, 102, 0)"); // Mock Orange
    }

    @Test
    @DisplayName("TC-01.04: NgÄƒn cháº·n gá»­i ná»™i dung prompt rá»—ng [Negative]")
    void TC_01_04_PreventEmptyPromptSubmission() {
        page.navigate(getBaseUrl() + "/builder/new");
        page.locator("textarea[name='prompt']").fill("   ");
        page.locator("button[data-testid='btn-generate-site']").click();
        
        assertThat(page.locator("span.error-message")).hasText("Vui lÃ²ng nháº­p mÃ´ táº£ website");
        assertThat(page.locator("button[data-testid='btn-generate-site']")).isDisabled();
    }

    @Test
    @DisplayName("TC-01.05: Giá»›i háº¡n Ä‘á»™ dÃ i tá»‘i Ä‘a cá»§a Prompt [Negative]")
    void TC_01_05_PromptMaxLengthValidation() {
        page.navigate(getBaseUrl() + "/builder/new");
        String longPrompt = "a".repeat(501);
        // Do FE cÃ³ thá»ƒ cháº·n gÃµ nÃªn test Backend throw lá»—i hoáº·c FE throw Validator
        page.locator("textarea[name='prompt']").fill(longPrompt);
        page.locator("button[data-testid='btn-generate-site']").click();
        
        assertThat(page.locator("span.error-message")).containsText("500 kÃ½ tá»±");
    }

    @Test
    @DisplayName("TC-01.06: Xá»­ lÃ½ lá»—i khi AI Service bá»‹ Timeout [Negative]")
    void TC_01_06_AiServiceTimeoutHandling() {
        // CÃ³ thá»ƒ Route Abort trÃªn Playwright Ä‘á»ƒ giáº£ Timeout
        page.route("**/api/generate**", route -> route.abort("timedout"));
        
        page.navigate(getBaseUrl() + "/builder/new");
        page.locator("textarea[name='prompt']").fill("Test Timeout");
        page.locator("button[data-testid='btn-generate-site']").click();
        
        assertThat(page.locator("div.toast-error")).containsText("MÃ¡y chá»§ AI Ä‘ang báº­n");
        assertThat(page.locator("textarea[name='prompt']")).hasValue("Test Timeout"); // Text input cÅ© Ä‘Æ°á»£c giá»¯ nguyÃªn
    }

    @Test
    @DisplayName("TC-01.08: Placeholder gá»£i Ã½ thÃ´ng minh trong Ã´ Textbox Prompt [UX Empathy]")
    void TC_01_08_IntelligentPlaceholder() {
        page.navigate(getBaseUrl() + "/builder/new");
        assertThat(page.locator("textarea[name='prompt']")).hasAttribute("placeholder", java.util.regex.Pattern.compile(".*VD: TÃ´i muá»‘n má»™t website.*"));
    }

    @Test
    @DisplayName("TC-01.09: Focus Ã´ nháº­p liá»‡u ngay khi táº£i trang [UX Empathy]")
    void TC_01_09_AutoFocusPromptInputOnLoad() {
        page.navigate(getBaseUrl() + "/builder/new");
        assertThat(page.locator("textarea[name='prompt']")).isFocused();
    }

    @Test
    @DisplayName("TC-01.10: VÃ´ hiá»‡u hÃ³a NÃºt Gá»­i khi tráº¡ng thÃ¡i Äang Load [UX Empathy]")
    void TC_01_10_DisableSubmitDuringGeneration() {
        page.navigate(getBaseUrl() + "/builder/new");
        page.locator("textarea[name='prompt']").fill("Táº¡o web bÃ¡n Ã¡o thun");
        page.locator("button[data-testid='btn-generate-site']").click();
        assertThat(page.locator("button[data-testid='btn-generate-site']")).isDisabled();
    }

    @Test
    @DisplayName("TC-01.13: ThoÃ¡t ngang khi AI Ä‘ang táº¡o trang [Interruption]")
    void TC_01_13_WarnBeforeLeaveDuringGeneration() {
        page.navigate(getBaseUrl() + "/builder/new");
        page.locator("textarea[name='prompt']").fill("Táº¡o web dÃ i");
        page.locator("button[data-testid='btn-generate-site']").click();
        
        // Báº¥m Back hoáº·c sang Tab khÃ¡c
        page.locator("a[data-testid='nav-dashboard']").click();
        
        // Pháº£i hiá»‡n há»™p thoáº¡i Native confirm
        page.onceDialog(dialog -> {
            org.junit.jupiter.api.Assertions.assertTrue(dialog.message().contains("bá»‹ giÃ¡n Ä‘oáº¡n"));
            dialog.dismiss(); // á»ž láº¡i
        });
    }

    @Test
    @DisplayName("TC-01.16: Chá»‘ng táº¥n cÃ´ng mÃ£ Ä‘á»™c Stored XSS [Negative]")
    void TC_01_16_StoredXssProtection() {
        page.navigate(getBaseUrl() + "/builder/new");
        page.locator("textarea[name='prompt']").fill("<script>alert('Bá»‹ hack')</script>");
        page.locator("button[data-testid='btn-generate-site']").click();
        
        // KhÃ´ng hiá»‡n Popup Alert (Sáº½ throw Exception á»Ÿ Java náº¿u cÃ³ Alert khÃ´ng gá»¡ Ä‘Æ°á»£c)
        page.onDialog(dialog -> org.junit.jupiter.api.Assertions.fail("Ná»• Alert XSS"));
        
        // Ná»™i dung in ra Chat History
        page.waitForSelector("div.user-chat-bubble");
        assertThat(page.locator("div.user-chat-bubble").last()).hasText("<script>alert('Bá»‹ hack')</script>");
    }
}

