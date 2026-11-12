/**
 * Who may enter Prime Studio, and with what rights. Pure — safe in edge middleware and client components.
 *
 * - `super-admin`: full Studio.
 * - `studio-viewer`: the team's read-only seat — every Studio page and GET API except AI settings
 *   (provider keys, routing, spend caps); every write answers 403.
 * - `studio-content`, `studio-reviewer`, `studio-qa`, `studio-ops`: team seats that read like a viewer and
 *   may change only what `studio-permissions.ts` grants them.
 * - `support`: the team that builds sites for merchants — only the merchant CMS access page
 *   (/support/merchant-access), never Studio itself. Super-admins use /studio/merchant-access instead.
 */
export const SUPER_ADMIN_ROLE = 'super-admin'
export const STUDIO_VIEWER_ROLE = 'studio-viewer'
export const SUPPORT_ROLE = 'support'
export const STUDIO_CONTENT_ROLE = 'studio-content'
export const STUDIO_REVIEWER_ROLE = 'studio-reviewer'
export const STUDIO_QA_ROLE = 'studio-qa'
export const STUDIO_OPS_ROLE = 'studio-ops'

/** Seats that may change part of Studio. */
const STUDIO_WORK_ROLES = [STUDIO_CONTENT_ROLE, STUDIO_REVIEWER_ROLE, STUDIO_QA_ROLE, STUDIO_OPS_ROLE]
/** Every non-super-admin seat that may open Studio. */
const STUDIO_SEAT_ROLES = [STUDIO_VIEWER_ROLE, ...STUDIO_WORK_ROLES]

type Roles = readonly string[] | null | undefined

export function isSuperAdmin(roles: Roles): boolean {
    return Boolean(roles?.includes(SUPER_ADMIN_ROLE))
}

/** True for anyone who may open Studio pages (super-admin or any team seat). */
export function canViewStudio(roles: Roles): boolean {
    return isSuperAdmin(roles) || Boolean(roles?.some((r) => STUDIO_SEAT_ROLES.includes(r)))
}

/** True for a team seat without super-admin: lands in Studio after login and never opens AI settings. */
export function isStudioTeamSeat(roles: Roles): boolean {
    return canViewStudio(roles) && !isSuperAdmin(roles)
}

/** True when the user may only look: a viewer with no seat that can change anything. */
export function isStudioReadOnly(roles: Roles): boolean {
    return isStudioTeamSeat(roles) && !roles?.some((r) => STUDIO_WORK_ROLES.includes(r))
}

/** AI settings and Studio merchant access stay super-admin-only for every team seat. */
const SUPER_ADMIN_ONLY_PATHS = ['/studio/settings', '/studio/merchant-access']

export function isSuperAdminOnlyStudioPath(pathname: string): boolean {
    return SUPER_ADMIN_ONLY_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

/** Roles that hold platform-wide rights; a merchant access link must never open one of these accounts. */
const STAFF_ROLES = [SUPER_ADMIN_ROLE, ...STUDIO_SEAT_ROLES, SUPPORT_ROLE, 'editor', 'viewer']

/** True for anyone who may open a merchant's CMS without the merchant's OTP (super-admin or support). */
export function canUseMerchantAccess(roles: Roles): boolean {
    return isSuperAdmin(roles) || Boolean(roles?.includes(SUPPORT_ROLE))
}

/** True when an account holds any staff role, so it is not a merchant account. */
export function hasStaffRole(roles: Roles): boolean {
    return Boolean(roles?.some((r) => STAFF_ROLES.includes(r)))
}
