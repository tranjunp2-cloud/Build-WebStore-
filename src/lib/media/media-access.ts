import type { Access, CollectionAfterReadHook, CollectionBeforeChangeHook, Where } from 'payload'

/**
 * Media ownership (TC-PERF-144..146).
 * - `tenant`: the shop a file belongs to. Set on every upload path (dashboard, AI, payment proof, pw1); legacy rows
 *   created before the column existed keep none (no backfill), as do the shared stock library and user avatars.
 * - `private`: payment receipts (bank-transfer proofs). Readable only by members of the media's tenant and
 *   super-admins, never through the public S3 URL: their `url` points at `/api/media/private/{id}`.
 * Storefront images stay public (read access for everyone on non-private rows).
 */

type MembershipUser = {
    roles?: unknown
    tenants?: Array<{ tenant?: unknown; status?: unknown } | null> | null
} | null | undefined

/** Users come typed differently per caller (Payload `req.user`, session user): read them structurally. */
const asMember = (user: unknown): MembershipUser => (user && typeof user === 'object' ? (user as MembershipUser) : null)

export function isSuperAdmin(user: unknown): boolean {
    const roles = asMember(user)?.roles
    return Array.isArray(roles) && roles.includes('super-admin')
}

function relationId(value: unknown): number | string | null {
    const raw = value && typeof value === 'object' ? (value as { id?: unknown }).id : value
    if (typeof raw === 'number' && Number.isFinite(raw)) return raw
    if (typeof raw === 'string' && raw.trim() !== '') return /^\d+$/.test(raw) ? Number(raw) : raw
    return null
}

/** Tenants the user is an active member of (pending / suspended memberships do not count). */
export function activeTenantIds(user: unknown): Array<number | string> {
    const ids: Array<number | string> = []
    for (const membership of asMember(user)?.tenants ?? []) {
        if (!membership) continue
        const status = membership.status ?? 'active'
        if (status !== 'active') continue
        const id = relationId(membership.tenant)
        if (id !== null && !ids.includes(id)) ids.push(id)
    }
    return ids
}

/** True when the user may see a private media row of `tenant` (its active members, super-admins). */
export function canReadPrivateMedia(user: unknown, tenant: unknown): boolean {
    if (isSuperAdmin(user)) return true
    const id = relationId(tenant)
    return id !== null && activeTenantIds(user).some((member) => String(member) === String(id))
}

const NOT_PRIVATE: Where = { private: { not_equals: true } }

type ListingRequest = {
    payloadAPI?: unknown
    method?: unknown
    routeParams?: Record<string, unknown> | null
}

/**
 * True for a REST listing of the media collection itself: `GET /api/media` (and `/api/media/count`). Not a read by
 * id (`/api/media/{id}`), not a file (`/api/media/file/{name}`), and not media populated into another collection's
 * response (`/api/pages`, `/api/templates`… carry their own `routeParams.collection`) or read through the Local API.
 */
export function isRestMediaListing(req: unknown, isReadingStaticFile?: boolean): boolean {
    if (isReadingStaticFile) return false
    const request = (req && typeof req === 'object' ? req : {}) as ListingRequest
    if (request.payloadAPI !== 'REST') return false
    if (typeof request.method === 'string' && request.method.toUpperCase() !== 'GET') return false
    const params = request.routeParams ?? {}
    return params.collection === 'media' && params.id == null && params.filename == null
}

/**
 * Read access (TC-PERF-144, TC-PERF-169).
 * - Rows by id, relations populated into pages / products / templates, and files: everyone reads public media
 *   (storefront images, template thumbnails); private rows only within their tenant.
 * - The REST listing of the whole collection (`GET /api/media`): only the media of the user's own (active) tenants;
 *   visitors get 403. It used to list every shop's files to anyone. Super-admins see everything.
 */
export const mediaReadAccess: Access = ({ req, isReadingStaticFile }) => {
    if (isSuperAdmin(req.user)) return true
    const tenants = activeTenantIds(req.user)
    if (isRestMediaListing(req, isReadingStaticFile)) return tenants.length > 0 ? { tenant: { in: tenants } } : false
    if (tenants.length === 0) return NOT_PRIVATE
    return { or: [NOT_PRIVATE, { tenant: { in: tenants } }] }
}

/**
 * Update / delete: the media of the member's own (active) tenants only; super-admin all (TC-PERF-144).
 * That includes stock pictures (Pixabay / Wikimedia) the copilot saved for the shop: they carry its tenant, so its
 * members can remove them (TC-AIREL-216). Rows without a tenant — the shared stock library, legacy uploads — are
 * nobody's to edit here. The provenance fields (`sourceProvider`, license…) stay system-only (field access).
 */
export const mediaWriteAccess: Access = ({ req }) => {
    if (!req.user) return false
    if (isSuperAdmin(req.user)) return true
    const tenants = activeTenantIds(req.user)
    if (tenants.length === 0) return false
    return { tenant: { in: tenants } }
}

/**
 * The row-level answer of `mediaWriteAccess` for one media row: may this user delete / edit it? Lets lists (the
 * dashboard Media library) disable Delete on rows the server would refuse — legacy files without a tenant that the
 * shop's site uses are listed (TC-PERF-168) but stay nobody's to delete (TC-PERF-187).
 */
export function canWriteMedia(user: unknown, tenant: unknown): boolean {
    if (!user) return false
    if (isSuperAdmin(user)) return true
    const id = relationId(tenant)
    return id !== null && activeTenantIds(user).some((member) => String(member) === String(id))
}

/** A relation as given (id or populated doc): the id, unchanged in type; null when absent. */
function requestedId(value: unknown): string | number | null {
    const raw = value && typeof value === 'object' ? (value as { id?: unknown }).id : value
    if (typeof raw === 'number' && Number.isFinite(raw)) return raw
    if (typeof raw === 'string' && raw.trim() !== '') return raw
    return null
}

/**
 * The tenant a new file belongs to (TC-AIREL-133, TC-AICP-352). The tenant is what lets the AI copilot list "this
 * shop's library" and refuse another shop's picture (`lib/ai-platform/media-access.ts`).
 * - Signed-in tenant user: one of their ACTIVE workspaces (the one asked for if they belong to it, else their first).
 * - Signed-in platform admin: whatever was asked for, else their first workspace, else none.
 * - No user (Local API: payment proof, copilot ingest, pw1, scripts): the caller's explicit tenant as given.
 * Rows created before the field existed keep no tenant.
 */
export function resolveMediaTenant(user: unknown, requested: unknown): string | number | null {
    const asked = requestedId(requested)
    if (!user) return asked
    if (isSuperAdmin(user) && asked !== null) return asked
    const tenants = activeTenantIds(user)
    if (asked !== null && tenants.some((id) => String(id) === String(asked))) return asked
    return tenants[0] ?? null
}

/**
 * On create by a signed-in user: the media belongs to the tenant resolveMediaTenant picks, and a request can never
 * mark it private (super-admins aside). Server flows that run without a user (payment proof, AI, pw1) pass
 * `tenant` / `private` themselves and are left as they set them.
 */
export const assignMediaTenant: CollectionBeforeChangeHook = ({ data, operation, req }) => {
    if (operation !== 'create' || !data || !req.user) return data
    const tenant = resolveMediaTenant(req.user, data.tenant)
    if (tenant !== null) data.tenant = tenant
    else delete data.tenant
    if (!isSuperAdmin(req.user)) data.private = false
    return data
}

export function privateMediaUrl(id: number | string): string {
    return `/api/media/private/${encodeURIComponent(String(id))}`
}

/** A private row never carries the public S3 URL: browsers load it through the member-checked route. */
export const hidePrivateMediaUrl: CollectionAfterReadHook = ({ doc }) => {
    if (doc && doc.private === true && doc.id != null) {
        doc.url = privateMediaUrl(doc.id)
        if ('thumbnailURL' in doc) doc.thumbnailURL = null
    }
    return doc
}
