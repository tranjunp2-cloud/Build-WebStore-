/** Footer brand rule shared by the migration binder and the post-generation repair script. */
export type FooterBrandSource = {
    tagline?: unknown
    storeDescription?: unknown
    showContactInfo?: unknown
    columns?: unknown
}

/** A brand block (tagline/description/contact; dark-gradient renders the description and contact from the site) beside three or more link columns always uses the columned dark-gradient layout. */
export function isBrandWithColumns(footer: FooterBrandSource): boolean {
    return Boolean(footer.tagline || footer.storeDescription || footer.showContactInfo)
        && Array.isArray(footer.columns) && footer.columns.length >= 3
}
