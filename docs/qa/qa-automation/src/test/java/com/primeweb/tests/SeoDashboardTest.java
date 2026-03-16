package com.primeweb.tests;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;

public class SeoDashboardTest extends BaseTest {

    @Test
    @DisplayName("TC-12.01: Crawler Chấm Điểm Audit Tổng Quan SEO Score (Health Dashboard App)")
    void TC_12_01_ViewSeoAuditReport() {
        page.navigate("http://localhost:3000/admin/seo-dashboard");
        assertThat(page.locator("div[data-testid='seo-score-panel']")).isVisible();
        assertThat(page.locator("svg.gauge-score")).isVisible();
        assertThat(page.locator("table[data-testid='seo-issues-table']")).isVisible();
    }

    @Test
    @DisplayName("TC-12.02: Tạo Được Khung Cây Sơ Đồ XML Mapping Tree Auto sitemap.xml")
    void TC_12_02_SitemapXmlGeneration() {
        page.navigate("http://localhost:3000/sitemap.xml");
        // Web route trả về Raw XML string content cho Spider Bot
        assertThat(page.locator("body")).containsText("<loc>");
        assertThat(page.locator("body")).containsText("</url>");
    }

    @Test
    @DisplayName("TC-12.03: Lỗi Rác Bỏ Trống Trường Meta Form Core [Negative]")
    void TC_12_03_ScorePenaltyForEmptyMeta() {
        // Form post ko nhập Title/Desc và bấm lưu
        page.navigate("http://localhost:3000/admin/collections/posts/new");
        page.locator("input[name='title']").fill("Trắng Meta");
        page.locator("button[type='submit']").click();
        
        // Ra màn SEO sẽ bị trừ rate 
        page.navigate("http://localhost:3000/admin/seo-dashboard");
        assertThat(page.locator("td.issue-desc")).containsText("sitemap"); // Có error Missing Meta trong Data Table Bị tróc Nã
    }

    @Test
    @DisplayName("TC-12.04: Draft Nháp Ẩn Giấu Ngầm Cấm Cây XML Public [Negative]")
    void TC_12_04_DraftsExcludedFromSitemap() {
        page.navigate("http://localhost:3000/sitemap.xml");
        // Đảm bảo bài viết Draft slug "/draft-post" khôgn bị rò rĩ Xml
        assertThat(page.locator("body")).not().containsText("/draft-post");
    }

    @Test
    @DisplayName("TC-12.06: Dùng Bulk Action Thúc AI điền Default Alt Text Media")
    void TC_12_06_BulkFillAltTextByAi() {
        page.navigate("http://localhost:3000/admin/seo-dashboard");
        page.locator("button[data-testid='btn-bulk-fix-issues']").click();
        page.locator("button[data-testid='btn-ai-generate-alt']").click();
        page.waitForSelector("div.progress-100", new com.microsoft.playwright.Page.WaitForSelectorOptions().setTimeout(10000));
        assertThat(page.locator("div.toast-success")).hasText("Cập nhật thành công 50 ảnh bị thiếu");
    }

    @Test
    @DisplayName("TC-12.07: Thước đo Meta Text Color (Gauge Bar) [UX Empathy]")
    void TC_12_07_GaugeBarMetaTextLimitColorUX() {
        page.navigate("http://localhost:3000/admin/collections/posts/555");
        
        // Quá 160 ký tự -> ĐỎ
        String longText = "Đây là một đoạn text cực kỳ dài để làm lấn chiếm khoảng trống. Vượt quá 160 ký tự thì thanh Gauge Bar (thước đo SEO) sẽ ngay lập tức Alert cho Khách biết lỗi Viết lách quá dài làm tụt Ranking trên kết quả tìm kiếm Google thay vì khách phải tự đoán mò xem sao đỏ";
        page.locator("textarea[name='meta_description']").fill(longText);
        assertThat(page.locator("div[data-testid='seo-meta-gauge-bar']")).hasClass(java.util.regex.Pattern.compile(".*danger.*"));
        
        // Quá 50 -> Xanh/Vàng Chuẩn
        String goodText = "Website bán máy pha cà phê cao cấp tại Việt Nam. Review tính năng và cung cấp kiến thức Barista chuẩn sao.";
        page.locator("textarea[name='meta_description']").fill(goodText);
        assertThat(page.locator("div[data-testid='seo-meta-gauge-bar']")).hasClass(java.util.regex.Pattern.compile(".*success.*"));
    }

    @Test
    @DisplayName("TC-12.08: Báo Lỗi SEO Plain English Giản Đơn Ít Mang Tính Jargon [UX Empathy]")
    void TC_12_08_PlainEnglishSeoIssues() {
        page.navigate("http://localhost:3000/admin/seo-dashboard");
        assertThat(page.locator("table[data-testid='seo-issues-table']")).containsText("Bạn Đang Thiếu Tiêu Đề Chính Cho Bài Này Nhé");
    }

    @Test
    @DisplayName("TC-12.10: Trải Nghiệm Điều Hướng Sửa Trực Diện")
    void TC_12_10_DirectEditNavigation() {
        page.navigate("http://localhost:3000/admin/seo-dashboard");
        // Bấm nút sửa chéo nhảy vào form 1 Post
        page.locator("button[data-action='jump-fix-issue']").first().click();
        assertThat(page).hasURL(java.util.regex.Pattern.compile(".*/admin/collections/posts/.*"));
        // Cần đảm bảo tab Trượt Sidebar Form mở sẵn (sẵn khung text trỏ luôn)
        assertThat(page.locator("div.right-sidebar-edit-form")).isVisible();
    }
}
