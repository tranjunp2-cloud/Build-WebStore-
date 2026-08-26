#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const repoRoot = path.resolve(__dirname, "..");
const outputRoot = path.join(
  repoRoot,
  "docs/design/Adapt template/static-prototypes/c101",
);
const baseUrl = (
  process.env.STATIC_PROTOTYPE_BASE_URL || "http://127.0.0.1:3000"
).replace(/\/$/, "");

const pages = [
  ["/", "index.html"],
  ["/products", "products/index.html"],
  ["/articles", "articles/index.html"],
  ["/about-us", "about-us/index.html"],
  ["/contact", "contact/index.html"],
];

const variants = {
  navigation: "centered",
  hero: "minimal",
  cta: "banner",
  carousel: "cards",
  "products-featured": "carousel",
  "products-grid": "grid-4",
  about: "two-column",
  "blog-list": "cards",
  newsletter: "banner",
  contact: "split",
  footer: "dark-gradient",
};

const variantOverrides = {
  "index.html": { hero: "split-right", about: "two-column" },
  "about-us/index.html": { about: "split" },
};

const mediaBase =
  "https://tm-prime-web.sgp1.digitaloceanspaces.com/tm-primeweb/img/2022";
const sourceMedia = {
  "d4zVAXRI-64hV8nj1zVNXR4b03gQbJzXmrFb0fu46UQ.webp":
    "813d6fd19526-d4zVAXRI-64hV8nj1zVNXR4b03gQbJzXmrFb0fu46UQ.webp",
  "XsoXW8-kFq2iy47rw6XhjOw8FOPw7OywfKY4Lh6wTYs.webp":
    "04b80d2f29e8-XsoXW8-kFq2iy47rw6XhjOw8FOPw7OywfKY4Lh6wTYs.webp",
  "jCuWfFXWGkgWAaxtbEQurIx4FsENp3m6dTe0P7NZODk.webp":
    "6eb1efa0f04f-jCuWfFXWGkgWAaxtbEQurIx4FsENp3m6dTe0P7NZODk.webp",
  "edYe9kOexcMRTMJK5XI4ERPoVHEM9etLof8PU8knj0o.webp":
    "314d1255f38d-edYe9kOexcMRTMJK5XI4ERPoVHEM9etLof8PU8knj0o.webp",
  "dqw1oCTlLvYUeYVkBJ9vMnHj8HLFHk6h34FsAvOOVs4.jpeg":
    "61e66fc9d3d8-dqw1oCTlLvYUeYVkBJ9vMnHj8HLFHk6h34FsAvOOVs4.jpeg",
  "wJNH0ZGakIxTyoG8uwPCmz97F06c9arlJc7xudxRXEM.webp":
    "1d94567c1076-wJNH0ZGakIxTyoG8uwPCmz97F06c9arlJc7xudxRXEM.webp",
  "CMwiQp_WRtLEq5CcHczpHDPx_uVG8OylpZjmfPw-6qU.webp":
    "1dd59749841b-CMwiQp_WRtLEq5CcHczpHDPx_uVG8OylpZjmfPw-6qU.webp",
  "h-uzkIyM6UnrkCKTTDrwYrES4zrCyL_EfbdMaI_hEy4.webp":
    "137908347aff-h-uzkIyM6UnrkCKTTDrwYrES4zrCyL_EfbdMaI_hEy4.webp",
  "_opO-v4PkxPscYgQyVTXSRKkAYzdJDHKsSb6abDSxDE.webp":
    "48598cff9a34-_opO-v4PkxPscYgQyVTXSRKkAYzdJDHKsSb6abDSxDE.webp",
  "yz1o5Jc91nKTthantDAuR5I5JZmpUXqpHpVbFhrDz0M.webp":
    "8c9b97113467-yz1o5Jc91nKTthantDAuR5I5JZmpUXqpHpVbFhrDz0M.webp",
  "c101-eyes.jpg": "public/static-prototypes/c101/categories/c101-eyes.jpg",
  "c101-body.jpg": "public/static-prototypes/c101/categories/c101-body.jpg",
  "c101-face.jpg": "public/static-prototypes/c101/categories/c101-face.jpg",
  "c101-lips.jpg": "public/static-prototypes/c101/categories/c101-lips.jpg",
  "c101-shiseido.jpg":
    "public/static-prototypes/c101/categories/c101-shiseido.jpg",
  "c101-lamer.jpg": "public/static-prototypes/c101/categories/c101-lamer.jpg",
  "LkO9yPk37EI4nsTe30XdjF8vp7LDwH3ccmL3ywwGPTY.webp":
    "cf65775704da-LkO9yPk37EI4nsTe30XdjF8vp7LDwH3ccmL3ywwGPTY.webp",
  "2I4T3mqAM5JvpBVPcVwZVs9wHSbBLvrbIo2RrpHYPas.webp":
    "ef3fe681c2c3-2I4T3mqAM5JvpBVPcVwZVs9wHSbBLvrbIo2RrpHYPas.webp",
  "RNyP7TvdII6c1EgpXiy7-qdL2yidu1k3SPB5-BbeYCo.webp":
    "5c2a95ccb1b4-RNyP7TvdII6c1EgpXiy7-qdL2yidu1k3SPB5-BbeYCo.webp",
  "t8D_8rVvnvJAaZNfVoKUA5h31Omgwne1B76S9CuxLyc.webp":
    "d22187c919b4-t8D_8rVvnvJAaZNfVoKUA5h31Omgwne1B76S9CuxLyc.webp",
};

const productSource = [
  {
    slug: "stand",
    name: "La Mer The Body Crème - Body cream 300ml",
    price: 1400,
    description: "A rich body cream that nourishes dry skin with lasting moisture.",
    image: `${mediaBase}/jCuWfFXWGkgWAaxtbEQurIx4FsENp3m6dTe0P7NZODk.webp`,
  },
  {
    slug: "coco-cocoa-creme-body-butter",
    name: "Coco Cocoa Creme Body Butter",
    price: 129,
    description: "A whipped body butter that softens skin with cocoa-rich hydration.",
    image: `${mediaBase}/edYe9kOexcMRTMJK5XI4ERPoVHEM9etLof8PU8knj0o.webp`,
  },
  {
    slug: "revealing-body-lotion-10-aha",
    name: "Revealing Body Lotion 10% AHA",
    price: 180,
    description: "An exfoliating body lotion that smooths rough, uneven-looking skin.",
    image: `${mediaBase}/dqw1oCTlLvYUeYVkBJ9vMnHj8HLFHk6h34FsAvOOVs4.jpeg`,
  },
  {
    slug: "hydrating-cream-cleanser",
    name: "Hydrating Cream Cleanser",
    price: 89,
    description: "A gentle daily cleanser that leaves skin soft and comfortable.",
    image: `${mediaBase}/wJNH0ZGakIxTyoG8uwPCmz97F06c9arlJc7xudxRXEM.webp`,
  },
  {
    slug: "radiance-repair-serum",
    name: "Radiance Repair Serum",
    price: 168,
    description: "A lightweight serum for smoother, brighter-looking skin.",
    image: `${mediaBase}/CMwiQp_WRtLEq5CcHczpHDPx_uVG8OylpZjmfPw-6qU.webp`,
  },
  {
    slug: "daily-moisture-cream",
    name: "Daily Moisture Cream",
    price: 95,
    description: "Everyday hydration with a soft, non-greasy finish.",
    image: `${mediaBase}/h-uzkIyM6UnrkCKTTDrwYrES4zrCyL_EfbdMaI_hEy4.webp`,
  },
  {
    slug: "silk-finish-foundation",
    name: "Silk Finish Foundation",
    price: 149,
    description: "Buildable coverage with a natural, skin-like finish.",
    image: `${mediaBase}/_opO-v4PkxPscYgQyVTXSRKkAYzdJDHKsSb6abDSxDE.webp`,
  },
  {
    slug: "refined-facial-mist",
    name: "Refined Facial Mist",
    price: 79,
    description: "A refreshing mist for an instant boost of hydration.",
    image: `${mediaBase}/yz1o5Jc91nKTthantDAuR5I5JZmpUXqpHpVbFhrDz0M.webp`,
  },
];

const products = productSource.map((product, index) => ({
  id: `c101-product-${index + 1}`,
  slug: product.slug,
  name: product.name,
  price: product.price,
  currency: "MYR",
  inventory: 12,
  shortDescription:
    product.description ||
    "Lorem Ipsum is simply dummy text of the printing and typesetting industry.",
  images: [
    {
      image: { url: product.image },
      alt: product.name,
    },
  ],
}));

const blogs = Array.from({ length: 3 }, (_, index) => ({
  id: `c101-blog-${index + 1}`,
  slug: ["logitech-pop-mouse", "audio-technica-s220bt", "logitech-pop-keys"][
    index % 3
  ],
  title: [
    "How to pick the right face oil for your skin type",
    "| Review | Tom Ford Soleil Neige Lip Balm Frost",
    "Scrub school is in session: everything you need to know about exfoliation",
  ][index % 3],
  content:
    "<p>Practical guidance for a thoughtful, uncomplicated beauty routine.</p>",
  publishedAt: "2022-08-04T08:00:00.000Z",
  category: { name: "RECENT NEWS" },
  thumbnail: {
    url: [
      `${mediaBase}/2I4T3mqAM5JvpBVPcVwZVs9wHSbBLvrbIo2RrpHYPas.webp`,
      `${mediaBase}/RNyP7TvdII6c1EgpXiy7-qdL2yidu1k3SPB5-BbeYCo.webp`,
      `${mediaBase}/t8D_8rVvnvJAaZNfVoKUA5h31Omgwne1B76S9CuxLyc.webp`,
    ][index % 3],
  },
}));

function relativeLink(fromFile, target) {
  const fromDir = path.posix.dirname(fromFile);
  const targetFile =
    target === "/" ? "index.html" : `${target.replace(/^\//, "")}/index.html`;
  const value = path.posix.relative(fromDir, targetFile);
  return value || "index.html";
}

async function main() {
  if (process.argv[2] && process.argv[2] !== "c101")
    throw new Error("This incremental exporter currently supports only: c101");
  const health = await fetch(`${baseUrl}/preview/static-prototype/c101`);
  if (!health.ok)
    throw new Error(
      `C101 preview health check failed (${health.status}) at ${baseUrl}`,
    );
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1100 },
  });

  await page.route("**/api/storefront/products?**", (route) =>
    route.fulfill({ json: { docs: products, totalPages: 1 } }),
  );
  await page.route("**/api/storefront/categories?**", (route) =>
    route.fulfill({ json: { docs: [] } }),
  );
  await page.route("**/api/storefront/products/bounds?**", (route) =>
    route.fulfill({
      json: { minPrice: 0, maxPrice: 0, attributes: [] },
    }),
  );
  await page.route("**/api/storefront/blogs?**", (route) =>
    route.fulfill({ json: { docs: blogs, data: blogs } }),
  );

  const assetDir = path.join(outputRoot, "_renderer-assets");
  fs.mkdirSync(assetDir, { recursive: true });
  for (const [publicName, sourceName] of Object.entries(sourceMedia)) {
    const sourcePath = sourceName.startsWith("public/")
      ? path.join(repoRoot, sourceName)
      : path.join(outputRoot, "_assets", sourceName);
    fs.copyFileSync(sourcePath, path.join(assetDir, publicName));
  }

  for (const [slug, output] of pages) {
    const url = `${baseUrl}/preview/static-prototype/c101${slug === "/" ? "" : slug}`;
    // The preview can emit optional telemetry requests that never become idle in
    // restricted/offline environments. SiteRenderer provenance is the stable
    // readiness signal for this deterministic static export.
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('[data-render-provenance="SiteRenderer"]');
    if (slug === "/" || slug === "/products") {
      await page.waitForFunction(
        () =>
          document.querySelectorAll('[data-block-type="products-grid"] img')
            .length >= 8,
        { timeout: 10000 },
      );
    }

    const css = await page.$$eval('link[rel="stylesheet"]', async (links) => {
      const results = await Promise.all(
        links.map((link) =>
          fetch(link.href).then((response) => response.text()),
        ),
      );
      return results.join("\n");
    });
    const runtimeCss = await page.evaluate(() =>
      Array.from(document.styleSheets)
        .map((sheet) => {
          try {
            return Array.from(sheet.cssRules)
              .map((rule) => rule.cssText)
              .join("\n");
          } catch {
            return "";
          }
        })
        .join("\n"),
    );

    const links = Object.fromEntries(
      [
        "/",
        "/products",
        "/articles",
        "/about-us",
        "/contact",
        "/order-tracking",
      ].map((target) => [target, relativeLink(output, target)]),
    );
    const mediaPaths = Object.fromEntries(
      Object.keys(sourceMedia).map((name) => [
        name,
        path.posix.relative(
          path.posix.dirname(output),
          `_renderer-assets/${name}`,
        ),
      ]),
    );
    const productDetailPath = path.posix.relative(
      path.posix.dirname(output),
      "products/stand/index.html",
    );
    const articleDetailPath = path.posix.relative(
      path.posix.dirname(output),
      "articles/logitech-pop-mouse/index.html",
    );
    await page.evaluate(
      ({
        cssText,
        localLinks,
        blockVariants,
        localMediaPaths,
        productDetail,
        articleDetail,
      }) => {
        document
          .querySelectorAll(
            'script, link[rel="stylesheet"], link[rel="preload"], link[rel="modulepreload"], next-route-announcer',
          )
          .forEach((node) => node.remove());
        document
          .querySelectorAll(
            'link[rel="icon"], link[rel="preconnect"], meta[name="sentry-trace"], meta[name="baggage"]',
          )
          .forEach((node) => node.remove());
        document.querySelectorAll("style").forEach((node) => {
          if (node.textContent?.includes("__nextjs")) node.remove();
        });
        document.documentElement.classList.remove("dark");
        const style = document.createElement("style");
        style.dataset.rendererCss = "next-build";
        style.textContent = cssText
          .replace(/url\([^)]*\.(?:woff2?|ttf|otf)[^)]*\)/gi, 'local("Arial")')
          .replace(/[\r\n]+/g, "");
        document.head.append(style);
        const snapshotStyle = document.createElement("style");
        snapshotStyle.dataset.staticSnapshot = "true";
        snapshotStyle.textContent =
          '[style*="opacity: 0"]{opacity:1!important;transform:none!important}[data-block-type="hero"][data-block-variant="split-right"]{padding-top:12px!important;padding-bottom:12px!important}[data-block-type="hero"][data-block-variant="split-right"]>section{min-height:70vh!important}[data-block-type="hero"][data-block-variant="split-right"]>section>.max-w-6xl{max-width:1320px}[data-block-type="hero"][data-block-variant="split-right"] img{max-width:627px!important;max-height:620px!important;margin-inline:auto}.static-mobile-nav{display:none}.static-mobile-nav[data-open="true"]{display:flex;flex-direction:column;padding:0 1.5rem 1rem;gap:.25rem}.static-mobile-nav a{padding:.75rem 1rem;border-radius:.5rem}@media(max-width:767px){[data-block-type="hero"][data-block-variant="split-right"]{padding-top:8px!important;padding-bottom:8px!important}[data-block-type="hero"][data-block-variant="split-right"]>section{min-height:auto!important;padding-top:24px;padding-bottom:24px}nav .hidden.md\\:flex{display:none!important}button[aria-label*="menu" i]{display:flex!important}}@media(min-width:768px){.static-mobile-nav{display:none!important}}@media(min-width:1024px){[data-block-type="hero"][data-block-variant="split-right"] .grid{grid-template-columns:minmax(0,3fr) minmax(0,2fr);gap:2.5rem}}';
        document.head.append(snapshotStyle);
        document.title = "BRANCY";
        document
          .querySelectorAll(
            'meta[name="description"], meta[property="og:title"], meta[property="og:description"], meta[name="twitter:title"], meta[name="twitter:description"]',
          )
          .forEach((meta) =>
            meta.setAttribute(
              "content",
              meta.getAttribute("name") === "description"
                ? "BRANCY cosmetic, body care and beauty products."
                : "BRANCY",
            ),
          );
        document.querySelectorAll("a[href]").forEach((anchor) => {
          const href = anchor.getAttribute("href");
          if (!href) return;
          if (href.startsWith("/products?")) {
            const query = href.slice(href.indexOf("?"));
            anchor.setAttribute("href", `${localLinks["/products"]}${query}`);
            return;
          }
          if (localLinks[href]) {
            anchor.setAttribute("href", localLinks[href]);
            return;
          }
          try {
            const parsed = new URL(href, location.origin);
            const isLocalOrigin = parsed.origin === location.origin;
            const isLegacyC101OrderTracking =
              parsed.origin === "https://c101.web.ecommercehub.unifi.com.my" &&
              parsed.pathname === "/order-tracking";
            if (
              (isLocalOrigin || isLegacyC101OrderTracking) &&
              localLinks[parsed.pathname]
            ) {
              anchor.setAttribute("href", localLinks[parsed.pathname]);
              anchor.removeAttribute("target");
              anchor.removeAttribute("rel");
              return;
            }
            if (/^\/products\/[^/]+$/.test(parsed.pathname)) {
              const isRepresentativePdp = parsed.pathname === "/products/stand";
              anchor.setAttribute(
                "href",
                isRepresentativePdp ? productDetail : localLinks["/products"],
              );
              anchor.dataset.staticProductDestination = isRepresentativePdp
                ? "representative-pdp"
                : "products-list";
              return;
            }
            if (
              /\/blog\/(?:logitech-pop-mouse|audio-technica-s220bt|logitech-pop-keys)$/.test(
                parsed.pathname,
              )
            ) {
              anchor.setAttribute("href", articleDetail);
              return;
            }
            const pageId = parsed.searchParams.get("pageId");
            const routeById = {
              "c101-0": "/",
              "c101-1": "/products",
              "c101-2": "/articles",
              "c101-3": "/about-us",
              "c101-4": "/contact",
            };
            if (pageId && routeById[pageId])
              anchor.setAttribute("href", localLinks[routeById[pageId]]);
          } catch {
            // External and fragment URLs remain untouched.
          }
        });
        document.querySelectorAll("button").forEach((button) => {
          button.disabled = true;
          button.setAttribute("aria-disabled", "true");
          button.dataset.staticControl = "disabled";
        });
        document
          .querySelectorAll('[data-block-type="navigation"]')
          .forEach((navigation, navigationIndex) => {
            const menuButton = navigation.querySelector(
              'button[aria-label*="menu" i]',
            );
            const desktopLinks = navigation.querySelector(
              "nav .hidden.md\\:flex",
            );
            const nav = navigation.querySelector("nav");
            if (!menuButton || !desktopLinks || !nav) return;

            menuButton.disabled = false;
            menuButton.removeAttribute("aria-disabled");
            delete menuButton.dataset.staticControl;
            menuButton.dataset.staticMenuToggle = "true";

            const mobileMenu = document.createElement("nav");
            mobileMenu.className = "static-mobile-nav md:hidden";
            mobileMenu.dataset.staticMobileMenu = "true";
            mobileMenu.dataset.open = "false";
            mobileMenu.hidden = true;
            mobileMenu.setAttribute("aria-hidden", "true");
            mobileMenu.id = `static-mobile-nav-${navigationIndex + 1}`;
            mobileMenu.setAttribute("aria-label", "Mobile navigation");
            Array.from(desktopLinks.querySelectorAll("a"))
              .filter((link) => link.textContent?.trim())
              .forEach((link) => {
                mobileMenu.append(link.cloneNode(true));
              });
            menuButton.setAttribute("aria-controls", mobileMenu.id);
            nav.after(mobileMenu);
          });
        document
          .querySelectorAll('[data-block-type="carousel"]')
          .forEach((carousel) => {
            const track = carousel.querySelector(
              ".relative.overflow-hidden > .flex",
            );
            const slides = track ? Array.from(track.children) : [];
            const controls = Array.from(
              carousel.querySelectorAll('button[aria-label*="slide" i]'),
            );
            if (!track || slides.length < 2 || controls.length < 2) return;

            carousel.dataset.staticCarousel = "true";
            track.dataset.staticCarouselTrack = "true";
            controls.forEach((button) => {
              button.disabled = false;
              button.removeAttribute("aria-disabled");
              delete button.dataset.staticControl;
              button.dataset.staticCarouselControl = "true";
            });
          });
        const staticBehavior = document.createElement("script");
        staticBehavior.dataset.staticBehavior = "navigation-carousel";
        staticBehavior.textContent =
          'document.querySelectorAll("[data-static-menu-toggle]").forEach(function(button){button.addEventListener("click",function(){var menu=document.getElementById(button.getAttribute("aria-controls"));if(!menu)return;var open=button.getAttribute("aria-expanded")!=="true";button.setAttribute("aria-expanded",String(open));button.setAttribute("aria-label",open?"Close menu":"Open menu");menu.hidden=!open;menu.setAttribute("aria-hidden",String(!open));menu.setAttribute("data-open",String(open));});});document.querySelectorAll("[data-static-carousel]").forEach(function(carousel){var track=carousel.querySelector("[data-static-carousel-track]");var dots=Array.from(carousel.querySelectorAll("button[aria-label^=\\"Go to slide\\"]"));var previous=carousel.querySelector("button[aria-label=\\"Previous slide\\"]");var next=carousel.querySelector("button[aria-label=\\"Next slide\\"]");if(!track||!dots.length)return;var index=Math.max(0,dots.findIndex(function(dot){return dot.getAttribute("aria-current")==="true";}));function show(nextIndex){index=(nextIndex+dots.length)%dots.length;track.style.transform="translateX(-"+(index*100)+"%)";dots.forEach(function(dot,dotIndex){var active=dotIndex===index;dot.setAttribute("aria-current",String(active));var marker=dot.firstElementChild;if(marker){marker.style.background=active?"var(--brand-primary, #0ea5e9)":"rgba(var(--brand-primary-rgb), 0.188)";marker.style.transform=active?"scale(1.2)":"none";}});var image=track.children[index]&&track.children[index].querySelector("img");if(image)image.loading="eager";}dots.forEach(function(dot,dotIndex){dot.addEventListener("click",function(){show(dotIndex);});});if(previous)previous.addEventListener("click",function(){show(index-1);});if(next)next.addEventListener("click",function(){show(index+1);});show(index);});';
        document.body.append(staticBehavior);
        document
          .querySelectorAll('[data-footer-field="copyrightText"]')
          .forEach((element) => {
            element.textContent = "Copyright © 2022 by Prime Commerce";
          });
        document.querySelectorAll("[data-block-type]").forEach((element) => {
          const type = element.getAttribute("data-block-type");
          if (type && blockVariants[type])
            element.setAttribute("data-block-variant", blockVariants[type]);
          element.setAttribute("data-mapping-status", "renderer-generated");
        });
        document.getAnimations().forEach((animation) => animation.cancel());
        document.querySelectorAll("[style]").forEach((element) => {
          if (element.style.opacity === "0") element.style.opacity = "1";
          if (element.style.transform && element.style.transform !== "none")
            element.style.transform = "none";
        });
        document.querySelectorAll("img").forEach((img) => {
          const current = img.getAttribute("src") || "";
          let source = current;
          try {
            const parsed = new URL(current, location.origin);
            if (parsed.pathname === "/_next/image")
              source = parsed.searchParams.get("url") || current;
          } catch {
            source = current;
          }
          const name = source.split("/").pop()?.split("?")[0] || "";
          if (localMediaPaths[name]) {
            img.setAttribute("src", localMediaPaths[name]);
            img.removeAttribute("srcset");
          }
          const carouselIndex = img.getAttribute("data-image-index");
          if (carouselIndex !== null)
            img.setAttribute(
              "loading",
              carouselIndex === "0" ? "eager" : "lazy",
            );
        });
        document.documentElement.dataset.generatedArtifact = "true";
      },
      {
        cssText: `${css}\n${runtimeCss}`,
        localLinks: links,
        blockVariants: { ...variants, ...(variantOverrides[output] || {}) },
        localMediaPaths: mediaPaths,
        productDetail: productDetailPath,
        articleDetail: articleDetailPath,
      },
    );

    const target = path.join(outputRoot, output);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const html = (await page.content())
      .replace(
        "<!DOCTYPE html>",
        "<!DOCTYPE html>\n<!-- GENERATED by scripts/export-static-prototypes.cjs from Prime Web v2 SiteRenderer. DO NOT EDIT. -->",
      )
      .replace(/[ \t]+\n/g, "\n");
    fs.writeFileSync(target, html);
    process.stdout.write(`exported c101${slug} -> ${output}\n`);
  }

  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
