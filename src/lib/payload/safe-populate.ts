/**
 * Populated relations for reads served to the dashboard / browser.
 * The Local API skips field read access, so a plain `depth >= 1` read hands the client a whole user
 * (otpHash, keyString, sessions) or tenant row (Xendit / EasyParcel / ECH secrets). Pass this as `populate`
 * so related users, tenants and sites carry only what the screens show (TC-PERF-073, TC-PERF-126).
 */
export const SAFE_RELATION_POPULATE = {
    users: { firstName: true, lastName: true, email: true },
    tenants: { name: true, slug: true },
    sites: { name: true, domain: true },
} as const

// Names only a tenant / user / order row uses: block content may legitimately hold e.g. `hash` or `sessions`.
export const PRIVATE_SNAPSHOT_KEYS: ReadonlySet<string> = new Set([
    'xenditSecretKey', 'xenditCallbackToken', 'easyParcelIntegration', 'echIntegration',
    'otpHash', 'otpExpiresAt', 'keyString', 'resetPasswordToken', 'magicLinkSecret',
])
export const RELATION_ROW_KEYS: ReadonlySet<string> = new Set(['tenant', 'createdBy', 'updatedBy'])

/**
 * Client-sent JSON the server stores verbatim (pages.locale_content) can hold populated docs the editor once got:
 * a media `tenant` here was the whole tenant row (payment / courier secrets) and was served back to every editor
 * of the shop. Relation rows under tenant / createdBy / updatedBy become their id; private keys are dropped
 * wherever they sit (TC-PERF-139).
 */
export function stripPrivateSnapshots<T>(value: T, depth = 0): T {
    if (depth > 40 || value === null || typeof value !== 'object') return value
    if (Array.isArray(value)) return value.map((item) => stripPrivateSnapshots(item, depth + 1)) as T
    const out: Record<string, unknown> = {}
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
        if (PRIVATE_SNAPSHOT_KEYS.has(key)) continue
        if (RELATION_ROW_KEYS.has(key) && child && typeof child === 'object' && !Array.isArray(child) && 'id' in child) {
            out[key] = (child as { id: unknown }).id
            continue
        }
        out[key] = stripPrivateSnapshots(child, depth + 1)
    }
    return out as T
}
