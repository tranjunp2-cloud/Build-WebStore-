package com.primeweb.pages;

import com.microsoft.playwright.Page;
import com.microsoft.playwright.Locator;

/**
 * BasePage — Page Object Model foundation.
 * All page objects inherit from this class.
 */
public abstract class BasePage {
    protected Page page;

    public BasePage(Page page) {
        this.page = page;
    }

    public static String getBaseUrl() {
        String url = System.getenv("BASE_URL");
        if (url != null && !url.isEmpty()) return url;
        return "https://ech-prime-web-v2-staging-pzdwc.ondigitalocean.app";
    }

    public void navigateTo(String path) {
        page.navigate(getBaseUrl() + path);
    }

    public void waitForNetworkIdle() {
        page.waitForLoadState(com.microsoft.playwright.options.LoadState.NETWORKIDLE);
    }

    /** Wait for toast notification to appear */
    public Locator waitForToast() {
        return page.locator("[data-sonner-toast]").first();
    }

    /** Wait for page to fully load (network idle + no skeleton) */
    public void waitForPageReady() {
        page.waitForLoadState(com.microsoft.playwright.options.LoadState.NETWORKIDLE);
        // Wait for skeleton loaders to disappear
        page.locator("[data-testid='skeleton']").first().waitFor(
            new Locator.WaitForOptions().setState(com.microsoft.playwright.options.WaitForSelectorState.HIDDEN).setTimeout(5000)
        );
    }
}
