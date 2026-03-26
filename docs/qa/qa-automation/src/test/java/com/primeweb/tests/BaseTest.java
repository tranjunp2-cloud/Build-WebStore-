package com.primeweb.tests;

import com.microsoft.playwright.Browser;
import com.microsoft.playwright.BrowserContext;
import com.microsoft.playwright.BrowserType;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.Playwright;
import com.primeweb.pages.BasePage;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

/**
 * BaseTest — JUnit 5 lifecycle hooks + Playwright browser management.
 * Login once, save auth state, reuse for all tests.
 */
public abstract class BaseTest {
    protected static Playwright playwright;
    protected static Browser browser;
    private static final Path AUTH_STATE = Paths.get("auth-state.json");

    protected BrowserContext context;
    protected Page page;

    static String getBaseUrl() {
        return BasePage.getBaseUrl();
    }

    static boolean isHeadless() {
        String headless = System.getenv("HEADLESS");
        if (headless != null) return Boolean.parseBoolean(headless);
        // Default: headless on CI, headed locally
        return System.getenv("CI") != null;
    }

    @BeforeAll
    static void launchBrowser() {
        playwright = Playwright.create();
        browser = playwright.chromium().launch(
            new BrowserType.LaunchOptions().setHeadless(isHeadless())
        );

        // Login once and save auth state for all tests
        if (!Files.exists(AUTH_STATE)) {
            loginAndSaveState();
        }
    }

    /** Login with test account → save cookies/storage to auth-state.json */
    private static void loginAndSaveState() {
        String email = System.getenv("TEST_EMAIL") != null
            ? System.getenv("TEST_EMAIL") : "phuong.ltweb@gmail.com";
        String password = System.getenv("TEST_PASSWORD") != null
            ? System.getenv("TEST_PASSWORD") : "Aa123456@";

        BrowserContext authCtx = browser.newContext();
        Page authPage = authCtx.newPage();

        authPage.navigate(getBaseUrl() + "/login");
        authPage.waitForLoadState();

        // Fill login form
        authPage.locator("input[type='email'], input[name='email']").fill(email);
        authPage.locator("input[type='password'], input[name='password']").fill(password);
        authPage.locator("button:has-text('Sign in'), button[type='submit']").click();

        // Wait for redirect after login (dashboard or builder)
        authPage.waitForURL(url -> !url.contains("/login"), new Page.WaitForURLOptions().setTimeout(15000));

        // Save auth state
        authCtx.storageState(new BrowserContext.StorageStateOptions().setPath(AUTH_STATE));
        authCtx.close();

        System.out.println("✅ Auth state saved to " + AUTH_STATE);
    }

    @AfterAll
    static void closeBrowser() {
        playwright.close();
        // Clean up auth state
        try { Files.deleteIfExists(AUTH_STATE); } catch (Exception ignored) {}
    }

    @BeforeEach
    void createContextAndPage() {
        // Create context WITH saved auth state → already logged in
        context = browser.newContext(
            new Browser.NewContextOptions()
                .setViewportSize(1280, 720)
                .setStorageStatePath(AUTH_STATE)
        );
        page = context.newPage();
    }

    @AfterEach
    void closeContext() {
        context.close();
    }
}
