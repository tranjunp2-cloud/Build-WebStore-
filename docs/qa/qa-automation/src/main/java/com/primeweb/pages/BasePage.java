package com.primeweb.pages;

import com.microsoft.playwright.Page;
import com.microsoft.playwright.Locator;

/**
 * BasePage is the foundation of the Page Object Model (POM) architecture.
 * All subsequent page objects should inherit from this class.
 */
public abstract class BasePage {
    protected Page page;

    public BasePage(Page page) {
        this.page = page;
    }

    /**
     * Utility method to navigate to a specific relative URL.
     * @param path The relative path to navigate to (e.g. "/dashboard/products")
     */
    public void navigateTo(String path) {
        // Assume BASE_URL would be configured via env vars, hardcoding for template
        String baseUrl = System.getenv("BASE_URL") != null ? System.getenv("BASE_URL") : "http://localhost:3000";
        page.navigate(baseUrl + path);
    }
    
    /**
     * Utility method for waiting network to be idle
     */
    public void waitForNetworkIdle() {
        page.waitForLoadState(com.microsoft.playwright.options.LoadState.NETWORKIDLE);
    }
}
