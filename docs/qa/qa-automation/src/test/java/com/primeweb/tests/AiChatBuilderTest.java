package com.primeweb.tests;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;

public class AiChatBuilderTest extends BaseTest {

    @Test
    @DisplayName("TC-01.01: Sinh website thành công với prompt đầy đủ ngữ cảnh (Happy Path)")
    void TC_01_01_GenerateSiteWithFullContext() {
        page.navigate("http://localhost:3000/builder/new");
        page.locator("textarea[name='prompt']").fill("Tiệm bánh handmade quận 3, mở năm 2020");
        page.locator("button[data-testid='btn-generate-site']").click();
        
        assertThat(page.locator("div[data-testid='generation-progress-bar']")).isVisible();
        assertThat(page.locator("div[data-testid='generation-progress-label']")).containsText("Đang tạo...");
        
        page.waitForSelector("iframe[data-testid='site-preview-iframe']", new com.microsoft.playwright.Page.WaitForSelectorOptions().setTimeout(60000));
        assertThat(page.locator("iframe[data-testid='site-preview-iframe']")).isVisible();
    }

    @Test
    @DisplayName("TC-01.02: AI yêu cầu làm rõ khi prompt quá chung chung")
    void TC_01_02_AiAsksForClarification() {
        page.navigate("http://localhost:3000/builder/new");
        page.locator("textarea[name='prompt']").fill("Làm web cho mình");
        page.locator("button[data-testid='btn-generate-site']").click();
        
        // Trả lời dạng Chat thay vì sinh Layout
        page.waitForSelector("div.ai-chat-bubble");
        assertThat(page.locator("div.ai-chat-bubble").last()).containsText("ngành nghề");
    }

    @Test
    @DisplayName("TC-01.03: Admin: Chat hỏi lại (Follow-up) để tinh chỉnh")
    void TC_01_03_AdminFollowUpChat() {
        // Giả lập đã có Site Preview
        page.navigate("http://localhost:3000/builder/session/abc");
        page.locator("textarea[name='prompt']").fill("Đổi màu nút qua cam");
        page.locator("button[data-testid='btn-send-followup']").click();
        
        page.waitForTimeout(2000); // Wait for stream
        assertThat(page.frameLocator("iframe[data-testid='site-preview-iframe']").locator("button").first()).hasCSS("background-color", "rgb(255, 102, 0)"); // Mock Orange
    }

    @Test
    @DisplayName("TC-01.04: Ngăn chặn gửi nội dung prompt rỗng [Negative]")
    void TC_01_04_PreventEmptyPromptSubmission() {
        page.navigate("http://localhost:3000/builder/new");
        page.locator("textarea[name='prompt']").fill("   ");
        page.locator("button[data-testid='btn-generate-site']").click();
        
        assertThat(page.locator("span.error-message")).hasText("Vui lòng nhập mô tả website");
        assertThat(page.locator("button[data-testid='btn-generate-site']")).isDisabled();
    }

    @Test
    @DisplayName("TC-01.05: Giới hạn độ dài tối đa của Prompt [Negative]")
    void TC_01_05_PromptMaxLengthValidation() {
        page.navigate("http://localhost:3000/builder/new");
        String longPrompt = "a".repeat(501);
        // Do FE có thể chặn gõ nên test Backend throw lỗi hoặc FE throw Validator
        page.locator("textarea[name='prompt']").fill(longPrompt);
        page.locator("button[data-testid='btn-generate-site']").click();
        
        assertThat(page.locator("span.error-message")).containsText("500 ký tự");
    }

    @Test
    @DisplayName("TC-01.06: Xử lý lỗi khi AI Service bị Timeout [Negative]")
    void TC_01_06_AiServiceTimeoutHandling() {
        // Có thể Route Abort trên Playwright để giả Timeout
        page.route("**/api/generate**", route -> route.abort("timedout"));
        
        page.navigate("http://localhost:3000/builder/new");
        page.locator("textarea[name='prompt']").fill("Test Timeout");
        page.locator("button[data-testid='btn-generate-site']").click();
        
        assertThat(page.locator("div.toast-error")).containsText("Máy chủ AI đang bận");
        assertThat(page.locator("textarea[name='prompt']")).hasValue("Test Timeout"); // Text input cũ được giữ nguyên
    }

    @Test
    @DisplayName("TC-01.08: Placeholder gợi ý thông minh trong ô Textbox Prompt [UX Empathy]")
    void TC_01_08_IntelligentPlaceholder() {
        page.navigate("http://localhost:3000/builder/new");
        assertThat(page.locator("textarea[name='prompt']")).hasAttribute("placeholder", java.util.regex.Pattern.compile(".*VD: Tôi muốn một website.*"));
    }

    @Test
    @DisplayName("TC-01.09: Focus ô nhập liệu ngay khi tải trang [UX Empathy]")
    void TC_01_09_AutoFocusPromptInputOnLoad() {
        page.navigate("http://localhost:3000/builder/new");
        assertThat(page.locator("textarea[name='prompt']")).isFocused();
    }

    @Test
    @DisplayName("TC-01.10: Vô hiệu hóa Nút Gửi khi trạng thái Đang Load [UX Empathy]")
    void TC_01_10_DisableSubmitDuringGeneration() {
        page.navigate("http://localhost:3000/builder/new");
        page.locator("textarea[name='prompt']").fill("Tạo web bán áo thun");
        page.locator("button[data-testid='btn-generate-site']").click();
        assertThat(page.locator("button[data-testid='btn-generate-site']")).isDisabled();
    }

    @Test
    @DisplayName("TC-01.13: Thoát ngang khi AI đang tạo trang [Interruption]")
    void TC_01_13_WarnBeforeLeaveDuringGeneration() {
        page.navigate("http://localhost:3000/builder/new");
        page.locator("textarea[name='prompt']").fill("Tạo web dài");
        page.locator("button[data-testid='btn-generate-site']").click();
        
        // Bấm Back hoặc sang Tab khác
        page.locator("a[data-testid='nav-dashboard']").click();
        
        // Phải hiện hộp thoại Native confirm
        page.onceDialog(dialog -> {
            org.junit.jupiter.api.Assertions.assertTrue(dialog.message().contains("bị gián đoạn"));
            dialog.dismiss(); // Ở lại
        });
    }

    @Test
    @DisplayName("TC-01.16: Chống tấn công mã độc Stored XSS [Negative]")
    void TC_01_16_StoredXssProtection() {
        page.navigate("http://localhost:3000/builder/new");
        page.locator("textarea[name='prompt']").fill("<script>alert('Bị hack')</script>");
        page.locator("button[data-testid='btn-generate-site']").click();
        
        // Không hiện Popup Alert (Sẽ throw Exception ở Java nếu có Alert không gỡ được)
        page.onDialog(dialog -> org.junit.jupiter.api.Assertions.fail("Nổ Alert XSS"));
        
        // Nội dung in ra Chat History
        page.waitForSelector("div.user-chat-bubble");
        assertThat(page.locator("div.user-chat-bubble").last()).hasText("<script>alert('Bị hack')</script>");
    }
}
