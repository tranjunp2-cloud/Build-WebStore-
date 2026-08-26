import { blockRegistry } from "@/blocks/registry";

type FixtureBlock = Record<string, unknown> & { blockType: string };

const image = (url: string, alt: string) => ({ url, alt });

const mediaBase =
  "https://tm-prime-web.sgp1.digitaloceanspaces.com/tm-primeweb/img/2022";
const media = {
  logo: `${mediaBase}/d4zVAXRI-64hV8nj1zVNXR4b03gQbJzXmrFb0fu46UQ.webp`,
  hero: `${mediaBase}/XsoXW8-kFq2iy47rw6XhjOw8FOPw7OywfKY4Lh6wTYs.webp`,
  productLaMer: `${mediaBase}/jCuWfFXWGkgWAaxtbEQurIx4FsENp3m6dTe0P7NZODk.webp`,
  productCocoa: `${mediaBase}/edYe9kOexcMRTMJK5XI4ERPoVHEM9etLof8PU8knj0o.webp`,
  productLotion: `${mediaBase}/dqw1oCTlLvYUeYVkBJ9vMnHj8HLFHk6h34FsAvOOVs4.jpeg`,
  eyes: "/static-prototypes/c101/categories/c101-eyes.jpg",
  body: "/static-prototypes/c101/categories/c101-body.jpg",
  face: "/static-prototypes/c101/categories/c101-face.jpg",
  lips: "/static-prototypes/c101/categories/c101-lips.jpg",
  shiseido: "/static-prototypes/c101/categories/c101-shiseido.jpg",
  lamer: "/static-prototypes/c101/categories/c101-lamer.jpg",
  promo: `${mediaBase}/LkO9yPk37EI4nsTe30XdjF8vp7LDwH3ccmL3ywwGPTY.webp`,
  articleOne: `${mediaBase}/2I4T3mqAM5JvpBVPcVwZVs9wHSbBLvrbIo2RrpHYPas.webp`,
  articleTwo: `${mediaBase}/RNyP7TvdII6c1EgpXiy7-qdL2yidu1k3SPB5-BbeYCo.webp`,
  articleThree: `${mediaBase}/t8D_8rVvnvJAaZNfVoKUA5h31Omgwne1B76S9CuxLyc.webp`,
};

const nav = {
  blockType: "navigation",
  variant: "centered",
  logoText: "BRANCY",
  logo: image(media.logo, "BRANCY"),
  ariaLabel: "BRANCY navigation",
  links: [
    { label: "Home", url: "/" },
    { label: "Product", url: "/products" },
    { label: "Blog", url: "/articles" },
    { label: "Contact", url: "/contact" },
    {
      label: "Tracking Order",
      url: "https://c101.web.ecommercehub.unifi.com.my/order-tracking",
    },
  ],
};

const footer = {
  blockType: "footer",
  variant: "dark-gradient",
  logoText: "BRANCY",
  logo: image(media.logo, "BRANCY"),
  tagline:
    'Beauty essentials selected for quality, comfort, and everyday confidence.<br><br>BUSINESS SUITE 19A-24-3, LEVEL 24, UOA CENTRE, NO 19, JALAN PINANG 50450 KUALA LUMPUR.<br><a href="tel:02866542688">02866542688</a><br><a href="mailto:c101@primeweb.asia">c101@primeweb.asia</a>',
  columns: [
    {
      title: "QUALITY PRODUCTS",
      links: [
        { label: "Popular Products", url: "/products" },
        { label: "Best Selling", url: "/products" },
        { label: "About Us", url: "/about-us" },
        { label: "Deal Of The Day", url: "/products" },
      ],
    },
    {
      title: "SUPPORT POLICY",
      links: [
        { label: "My Order Details", url: "https://c101.web.ecommercehub.unifi.com.my/order-tracking" },
        { label: "My Credit Offers", url: "/products" },
        { label: "My Addresses", url: "/contact" },
        { label: "My Personal Details", url: "/contact" },
      ],
    },
    {
      title: "INTRODUCE",
      links: [
        { label: "My Order Details", url: "https://c101.web.ecommercehub.unifi.com.my/order-tracking" },
        { label: "My Credit Offers", url: "/products" },
        { label: "My Addresses", url: "/contact" },
        { label: "My Personal Details", url: "/contact" },
      ],
    },
  ],
  copyrightText: "Copyright © 2022 by Prime Commerce",
  backgroundColor: "#171329",
  socials: [
    { platform: "facebook", url: "https://www.facebook.com/" },
    { platform: "youtube", url: "https://www.youtube.com/" },
    { platform: "instagram", url: "https://www.instagram.com/" },
  ],
};

const pageHero = (headline: string, subheadline: string): FixtureBlock => ({
  blockType: "hero",
  variant: "minimal",
  headline,
  subheadline,
  ctaButtons: [],
});

const layouts: Record<string, FixtureBlock[]> = {
  "/": [
    {
      blockType: "hero",
      variant: "split-right",
      headline: "Comestic",
      subheadline:
        "Lorem Ipsum is simply dummy text of the printing and typesetting industry.",
      ctaButtons: [
        { label: "SHOP NOW", url: "/products?page=1", style: "primary" },
      ],
      image: image(media.hero, "Comestic"),
    },
    {
      blockType: "cta",
      variant: "banner",
      headline: "BEST PRODUCT — SALE 15% OFF",
      subheadline: "SHOP NOW",
      ctaLabel: "SHOP NOW",
      ctaUrl: "/products",
    },
    {
      blockType: "carousel",
      variant: "cards",
      headline: "Your Interest!!!",
      autoplay: false,
      items: [
        {
          title: "EYES",
          image: image(media.eyes, "EYES"),
          linkUrl: "/products?category=3242",
        },
        {
          title: "BODY",
          image: image(media.body, "BODY"),
          linkUrl: "/products?category=3250",
        },
        {
          title: "FACE",
          image: image(media.face, "FACE"),
          linkUrl: "/products?category=3272",
        },
        {
          title: "LIPS",
          image: image(media.lips, "LIPS"),
          linkUrl: "/products?category=3278",
        },
        {
          title: "Shiseido",
          image: image(media.shiseido, "Shiseido"),
          linkUrl: "/products?brand=725",
        },
        {
          title: "Lamer",
          image: image(media.lamer, "Lamer"),
          linkUrl: "/products?brand=726",
        },
      ],
    },
    {
      blockType: "products-featured",
      variant: "carousel",
      headline: "Featured Products",
    },
    {
      blockType: "products-grid",
      variant: "grid-4",
      headline: "All DEPARTMENTS",
      limit: 8,
      showCategoryFilter: false,
    },
    {
      blockType: "about",
      variant: "two-column",
      sectionLabel: "BRANCY",
      headline: "About Us",
      body: "BRANCY makes everyday beauty feel simple, thoughtful, and personal. We curate effective skincare, body care, and makeup essentials designed to fit naturally into your routine.\n\nFrom gentle formulas to expressive colour, every product is chosen for quality, comfort, and confidence. Our goal is to help you discover beauty that feels good, works well, and stays effortless.",
    },
    {
      blockType: "blog-list",
      variant: "cards",
      sectionLabel: "RECENT NEWS",
      headline: "Latest News",
      limit: 3,
      readArticleLabel: "Read article",
    },
  ],
  "/products": [
    pageHero(
      "Product",
      "Lorem Ipsum is simply dummy text of the printing and typesetting industry.",
    ),
    {
      blockType: "products-grid",
      variant: "grid-4",
      headline: "All DEPARTMENTS",
      limit: 12,
      showCategoryFilter: true,
    },
  ],
  "/articles": [
    pageHero(
      "Blog",
      "Lorem Ipsum is simply dummy text of the printing and typesetting industry.",
    ),
    {
      blockType: "blog-list",
      variant: "cards",
      headline: "Latest News",
      limit: 9,
      readArticleLabel: "Read article",
    },
  ],
  "/about-us": [
    pageHero(
      "About Us",
      "Lorem Ipsum is simply dummy text of the printing and typesetting industry.",
    ),
    {
      blockType: "about",
      variant: "split",
      sectionLabel: "BRANCY",
      headline: "About Us",
      body: "Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy text ever since the 1500s.",
      image: image(media.promo, "BEST PRODUCT SALE 15% OFF"),
      layout: "image-left",
    },
  ],
  "/contact": [
    pageHero(
      "Contact",
      "Lorem Ipsum is simply dummy text of the printing and typesetting industry.",
    ),
    {
      blockType: "contact",
      variant: "split",
      sectionLabel: "Contact",
      headline: "Contact Us",
      subtext:
        "Lorem Ipsum is simply dummy text of the printing and typesetting industry.",
      email: "c101@primeweb.asia",
      phone: "02866542688",
      address:
        "BUSINESS SUITE 19A-24-3, LEVEL 24, UOA CENTRE, NO 19, JALAN PINANG 50450 KUALA LUMPUR.",
      submitLabel: "Send message",
      formFields: [
        { label: "Name", fieldName: "name", fieldType: "text", required: true },
        {
          label: "Email",
          fieldName: "email",
          fieldType: "email",
          required: true,
        },
        {
          label: "Message",
          fieldName: "message",
          fieldType: "textarea",
          required: true,
        },
      ],
    },
  ],
};

function validateBlock(block: FixtureBlock): FixtureBlock {
  const result = blockRegistry.validate(block.blockType, block);
  if (!result.success)
    throw new Error(`Invalid C101 ${block.blockType} fixture: ${result.error}`);
  return result.data as FixtureBlock;
}

export const C101_PAGES = Object.keys(layouts).map((slug, index) => ({
  id: `c101-${index}`,
  slug,
  isHomepage: slug === "/",
  isVisible: true,
  status: "published",
  layout: layouts[slug].map(validateBlock),
}));

export const C101_SITE = {
  id: "static-prototype-c101",
  name: "BRANCY",
  siteType: "beauty",
  tenant: "static-prototype-c101",
  tenantSlug: "c101",
  siteBasePath: "",
  headerBlock: validateBlock(nav),
  footerBlock: validateBlock(footer),
  globalBlocks: { cartWidget: null, whatsappButton: null, socialWidget: null },
  theme: {
    primaryColor: "#FF6565",
    secondaryColor: "#FF6565",
    accentColor: "#FF6565",
    surfaceColor: "#FFFFFF",
    textColor: "#231942",
    mutedColor: "#364958",
    fontHeading: "Inter",
    fontBody: "Inter",
    spacingPreset: "default" as const,
    borderRadius: "rounded" as const,
    shadowPreset: "subtle" as const,
    colorMode: "light" as const,
    backgroundColor: "#FFFFFF",
  },
};

export function getC101Page(path: string) {
  return C101_PAGES.find((page) => page.slug === path) ?? null;
}
