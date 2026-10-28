// F26: top-level block fields NEVER sent to the translator. Two groups (see docs/prd/F26 §7b
// Content Classification): (1) structural/media/link fields, and (2) "business data" that must
// stay identical across locales — shop name (logoText), contact info (email/phone/address),
// social links. Translating these mangles brand names, phone numbers, and URLs.
// Shared by the editor's locale switch and the web builder copilot's page translation.
export const NON_TRANSLATABLE_FIELDS = [
    // structural
    'id', 'blockType', 'variant', 'backgroundColor', 'showLanguageSwitcher', 'multilingualEnabled', 'primaryLocale', 'secondaryLocale', '_localeContent',
    'filterControls', 'selectionMode', 'selectedProductIds', 'includeOutOfStock', 'category', 'limit', 'showCategoryFilter',
    // media / assets
    'logo', 'image', 'backgroundImage', 'images', 'icon', 'avatar', 'media',
    // links / urls
    'url', 'href', 'src', 'embedUrl',
    // business data — preserved verbatim across locales
    'logoText', 'email', 'phone', 'phoneNumber', 'countryCode', 'address', 'socials',
] as const
