package com.primeweb.tests;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;

public class SeoDashboardTest extends BaseTest {

    @Test
    @DisplayName("TC-12.01: Crawler Cháº¥m Äiá»ƒm Audit Tá»•ng Quan SEO Score (Health Dashboard App)")
    void TC_12_01_ViewSeoAuditReport() {
        page.navigate(getBaseUrl() + "/admin/seo-dashboard");
        assertThat(page.locator("div[data-testid='seo-score-panel']")).isVisible();
        assertThat(page.locator("svg.gauge-score")).isVisible();
        assertThat(page.locator("table[data-testid='seo-issues-table']")).isVisible();
    }

    @Test
    @DisplayName("TC-12.02: Táº¡o ÄÆ°á»£c Khung CÃ¢y SÆ¡ Äá»“ XML Mapping Tree Auto sitemap.xml")
    void TC_12_02_SitemapXmlGeneration() {
        page.navigate(getBaseUrl() + "/sitemap.xml");
        // Web route tráº£ vá» Raw XML string content cho Spider Bot
        assertThat(page.locator("body")).containsText("<loc>");
        assertThat(page.locator("body")).containsText("</url>");
    }

    @Test
    @DisplayName("TC-12.03: Lá»—i RÃ¡c Bá» Trá»‘ng TrÆ°á»ng Meta Form Core [Negative]")
    void TC_12_03_ScorePenaltyForEmptyMeta() {
        // Form post ko nháº­p Title/Desc vÃ  báº¥m lÆ°u
        page.navigate(getBaseUrl() + "/admin/collections/posts/new");
        page.locator("input[name='title']").fill("Tráº¯ng Meta");
        page.locator("button[type='submit']").click();
        
        // Ra mÃ n SEO sáº½ bá»‹ trá»« rate 
        page.navigate(getBaseUrl() + "/admin/seo-dashboard");
        assertThat(page.locator("td.issue-desc")).containsText("sitemap"); // CÃ³ error Missing Meta trong Data Table Bá»‹ trÃ³c NÃ£
    }

    @Test
    @DisplayName("TC-12.04: Draft NhÃ¡p áº¨n Giáº¥u Ngáº§m Cáº¥m CÃ¢y XML Public [Negative]")
    void TC_12_04_DraftsExcludedFromSitemap() {
        page.navigate(getBaseUrl() + "/sitemap.xml");
        // Äáº£m báº£o bÃ i viáº¿t Draft slug "/draft-post" khÃ´gn bá»‹ rÃ² rÄ© Xml
        assertThat(page.locator("body")).not().containsText("/draft-post");
    }

    @Test
    @DisplayName("TC-12.06: DÃ¹ng Bulk Action ThÃºc AI Ä‘iá»n Default Alt Text Media")
    void TC_12_06_BulkFillAltTextByAi() {
        page.navigate(getBaseUrl() + "/admin/seo-dashboard");
        page.locator("button[data-testid='btn-bulk-fix-issues']").click();
        page.locator("button[data-testid='btn-ai-generate-alt']").click();
        page.waitForSelector("div.progress-100", new com.microsoft.playwright.Page.WaitForSelectorOptions().setTimeout(10000));
        assertThat(page.locator("div.toast-success")).hasText("Cáº­p nháº­t thÃ nh cÃ´ng 50 áº£nh bá»‹ thiáº¿u");
    }

    @Test
    @DisplayName("TC-12.07: ThÆ°á»›c Ä‘o Meta Text Color (Gauge Bar) [UX Empathy]")
    void TC_12_07_GaugeBarMetaTextLimitColorUX() {
        page.navigate(getBaseUrl() + "/admin/collections/posts/555");
        
        // QuÃ¡ 160 kÃ½ tá»± -> Äá»Ž
        String longText = "ÄÃ¢y lÃ  má»™t Ä‘oáº¡n text cá»±c ká»³ dÃ i Ä‘á»ƒ lÃ m láº¥n chiáº¿m khoáº£ng trá»‘ng. VÆ°á»£t quÃ¡ 160 kÃ½ tá»± thÃ¬ thanh Gauge Bar (thÆ°á»›c Ä‘o SEO) sáº½ ngay láº­p tá»©c Alert cho KhÃ¡ch biáº¿t lá»—i Viáº¿t lÃ¡ch quÃ¡ dÃ i lÃ m tá»¥t Ranking trÃªn káº¿t quáº£ tÃ¬m kiáº¿m Google thay vÃ¬ khÃ¡ch pháº£i tá»± Ä‘oÃ¡n mÃ² xem sao Ä‘á»";
        page.locator("textarea[name='meta_description']").fill(longText);
        assertThat(page.locator("div[data-testid='seo-meta-gauge-bar']")).hasClass(java.util.regex.Pattern.compile(".*danger.*"));
        
        // QuÃ¡ 50 -> Xanh/VÃ ng Chuáº©n
        String goodText = "Website bÃ¡n mÃ¡y pha cÃ  phÃª cao cáº¥p táº¡i Viá»‡t Nam. Review tÃ­nh nÄƒng vÃ  cung cáº¥p kiáº¿n thá»©c Barista chuáº©n sao.";
        page.locator("textarea[name='meta_description']").fill(goodText);
        assertThat(page.locator("div[data-testid='seo-meta-gauge-bar']")).hasClass(java.util.regex.Pattern.compile(".*success.*"));
    }

    @Test
    @DisplayName("TC-12.08: BÃ¡o Lá»—i SEO Plain English Giáº£n ÄÆ¡n Ãt Mang TÃ­nh Jargon [UX Empathy]")
    void TC_12_08_PlainEnglishSeoIssues() {
        page.navigate(getBaseUrl() + "/admin/seo-dashboard");
        assertThat(page.locator("table[data-testid='seo-issues-table']")).containsText("Báº¡n Äang Thiáº¿u TiÃªu Äá» ChÃ­nh Cho BÃ i NÃ y NhÃ©");
    }

    @Test
    @DisplayName("TC-12.10: Tráº£i Nghiá»‡m Äiá»u HÆ°á»›ng Sá»­a Trá»±c Diá»‡n")
    void TC_12_10_DirectEditNavigation() {
        page.navigate(getBaseUrl() + "/admin/seo-dashboard");
        // Báº¥m nÃºt sá»­a chÃ©o nháº£y vÃ o form 1 Post
        page.locator("button[data-action='jump-fix-issue']").first().click();
        assertThat(page).hasURL(java.util.regex.Pattern.compile(".*/admin/collections/posts/.*"));
        // Cáº§n Ä‘áº£m báº£o tab TrÆ°á»£t Sidebar Form má»Ÿ sáºµn (sáºµn khung text trá» luÃ´n)
        assertThat(page.locator("div.right-sidebar-edit-form")).isVisible();
    }
}

