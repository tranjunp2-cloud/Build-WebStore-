type Ref = string | number | { id?: string | number | null } | null | undefined
type Member = { roles?: string[] | null; tenants?: Array<{ tenant?: Ref }> | null }

const refId = (ref: Ref) => (ref && typeof ref === 'object' ? ref.id : ref)

/**
 * Whether the caller may act on a site: a super-admin, or a member of the site's tenant. Routes that read the site
 * through the Local API (access off) must check this themselves — /api/seo/fix and /api/seo/sitemap took any
 * site id, so a member of one shop rewrote another shop's page SEO and listed its unpublished pages (TC-PERF-138).
 */
export function isMemberOfSiteTenant(user: Member | null | undefined, site: object | null | undefined): boolean {
    if (!user || !site) return false
    if (user.roles?.includes('super-admin')) return true
    const siteTenantId = refId((site as { tenant?: Ref }).tenant)
    if (siteTenantId == null) return false
    return (user.tenants ?? []).some((membership) => String(refId(membership?.tenant)) === String(siteTenantId))
}
