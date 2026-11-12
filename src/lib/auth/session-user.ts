import type { JsonObject, Payload, TypeWithID } from 'payload'

import { AuthUnavailableError } from './auth-unavailable'
import type { SessionClaims } from './session-token'

export type SessionUser = JsonObject & TypeWithID

/**
 * The user fields any caller of getCurrentUser reads (audited across getCurrentUser / withAuth callers and the
 * collection access functions they run with `user`; pages that need more, e.g. Settings → Profile, read the
 * full user themselves): identity + names, emails, phone, roles, memberships, locale, wizard flag, avatar, timestamps.
 * `sessions` is read only to check a Payload token's session id and is stripped before returning.
 */
export const SESSION_USER_SELECT = {
    email: true,
    firstName: true,
    lastName: true,
    // Account phone: the default contact number for AI site generation (generate-site-service, user-contact-defaults).
    phone: true,
    roles: true,
    prefer_lang: true,
    has_seen_ai_wizard: true,
    avatar: true,
    createdAt: true,
    updatedAt: true,
    sessions: true,
    tenants: { tenant: true, status: true, role: true, permissions: true },
} as const

/**
 * Depth 1 populates only what is read off the relations: the tenant name, slug and status, and the
 * avatar URL (editor-data, dashboard header; filename + prefix let the
 * storage adapter build it). Before this the user came at depth 2: the whole ~70-column tenants row, its own
 * relations, createdBy/updatedBy users. No `metaData`: the raw SSO payload (owner name, email, phone) is
 * super-admin only and nothing on the session reads it (TC-PERF-151).
 */
export const SESSION_USER_POPULATE = {
    tenants: { name: true, slug: true, status: true },
    media: { url: true, filename: true, prefix: true },
} as const

/**
 * The password step alone must not open a session: `POST /api/users/login` hands out a Payload token before the
 * OTP step, and only the OTP / SSO tokens carry `mfa_verified`. A Payload token without it is refused for
 * everyone except super-admins, who sign in to the Payload admin panel (and /studio, which redirects there)
 * with the password token; their token already has full access over Payload REST (TC-PERF-141).
 */
export function passesOtpGate(claims: SessionClaims, roles: unknown): boolean {
    if (claims.mfaVerified) return true
    return Array.isArray(roles) && roles.includes('super-admin')
}

/** A users id the database could hold: integer ids as numbers; anything else would make Postgres throw (→ 503). */
function toUserId(id: string | number, idType: 'number' | 'text' | string | undefined): string | number | null {
    if (typeof id === 'number') return Number.isSafeInteger(id) ? id : null
    if (idType === 'number') return /^\d{1,15}$/.test(id) ? Number(id) : null
    return id
}

/**
 * Loads the session's user once: one users query (roles, memberships, sessions joined) + one tenants + one media
 * query, no permission computation. Returns null when the user or the Payload session no longer exists (signed
 * out); throws AuthUnavailableError when the database could not answer.
 */
export async function loadSessionUser(payload: Payload, claims: SessionClaims): Promise<SessionUser | null> {
    const id = toUserId(claims.id, payload.db?.defaultIDType)
    if (id === null) return null

    let doc: (SessionUser & { sessions?: Array<{ id?: string }> }) | null
    try {
        doc = (await payload.findByID({
            collection: 'users',
            id,
            depth: 1,
            overrideAccess: true,
            disableErrors: true,
            select: SESSION_USER_SELECT,
            populate: SESSION_USER_POPULATE,
        } as Parameters<Payload['findByID']>[0])) as typeof doc
    } catch (error) {
        throw new AuthUnavailableError(error)
    }
    if (!doc) return null

    const { sessions, ...user } = doc
    if (!passesOtpGate(claims, user.roles)) return null
    const useSessions = payload.collections?.users?.config.auth?.useSessions !== false
    if (claims.kind === 'payload' && useSessions) {
        // Payload's JWT strategy (useSessions defaults on): the token's session must still exist.
        if (!claims.sid || !(sessions ?? []).some((session) => session?.id === claims.sid)) return null
        return { ...user, collection: 'users', _strategy: 'local-jwt', _sid: claims.sid } as SessionUser
    }
    if (claims.kind === 'payload') return { ...user, collection: 'users', _strategy: 'local-jwt' } as SessionUser
    return { ...user, collection: 'users' } as SessionUser
}
