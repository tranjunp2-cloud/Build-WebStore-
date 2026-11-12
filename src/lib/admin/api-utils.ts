/**
 * Shared utilities for Studio admin API routes.
 * Provides the Studio auth wrappers and common Zod schemas.
 */
import { NextRequest, NextResponse } from 'next/server'
import { authUnavailableResponse, getCurrentUser, isAuthUnavailableError } from '@/lib/auth'
import type { PlatformUser } from '@/types/user'
import { z } from 'zod'
import { canViewStudio, isSuperAdmin } from './studio-roles'
import { hasStudioPermission, type StudioPermission } from './studio-permissions'

export type AdminHandler = (
    req: NextRequest,
    context: { user: PlatformUser; params?: Record<string, string> },
) => Promise<NextResponse>

type AdminRouteContext = {
    params?: Record<string, string> | Promise<Record<string, string>>
}

export type WithSuperAdminOptions = {
    /**
     * Let the read-only studio-viewer call this route's GET / HEAD (default true). Set false for reads
     * a viewer must not see (AI provider keys, routing, spend caps). Writes are always super-admin only.
     */
    viewerCanRead?: boolean
}

const READ_METHODS = new Set(['GET', 'HEAD'])

/** For AI settings routes: provider keys, model routing and spend caps are super-admin reads too. */
export const AI_SETTINGS_SUPER_ADMIN_ONLY: WithSuperAdminOptions = { viewerCanRead: false }

type RoleCheck = (roles: string[] | undefined, method: string) => boolean

/** Returns 401 if unauthenticated, 403 if the check refuses, 503 if the session could not be checked. */
function guardStudioRoute(isAllowed: RoleCheck, handler: AdminHandler) {
    return async (req: NextRequest, ctx?: AdminRouteContext) => {
        let rawUser: Awaited<ReturnType<typeof getCurrentUser>>
        try {
            rawUser = await getCurrentUser()
        } catch (error) {
            // The session could not be checked (DB incident): 503 busy, not 401 (TC-PERF-011).
            if (isAuthUnavailableError(error)) return authUnavailableResponse()
            throw error
        }

        if (!rawUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const user = rawUser as unknown as PlatformUser

        if (!isAllowed(user.roles, req.method)) return studioForbidden()

        const params = ctx?.params ? await ctx.params : undefined
        return handler(req, { user, params })
    }
}

export function studioForbidden() {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

/** Studio route: super-admin for everything, any team seat for reads. */
export function withSuperAdmin(handler: AdminHandler, { viewerCanRead = true }: WithSuperAdminOptions = {}) {
    return guardStudioRoute(
        (roles, method) => isSuperAdmin(roles) || (viewerCanRead && READ_METHODS.has(method) && canViewStudio(roles)),
        handler,
    )
}

/** Studio route that needs one permission from the team seat table. */
export function withStudioPermission(permission: StudioPermission, handler: AdminHandler) {
    return guardStudioRoute((roles) => hasStudioPermission(roles, permission), handler)
}

/** Studio route whose permission depends on the request body or the record: the handler MUST check it. */
export function withStudioSeat(handler: AdminHandler) {
    return guardStudioRoute((roles) => canViewStudio(roles), handler)
}

// ── Common Zod schemas ──────────────────────────────────────────────────────

export const TemplateStatusSchema = z.enum(['live', 'draft', 'review', 'scheduled', 'archived'])

export const PERSONALITY_VALUES = [
    'warm-traditional',
    'warm-homestyle',
    'bold-dark',
    'soft-feminine',
    'calm-wellness',
    'modern-vibrant',
    'editorial-clean',
    'luxury-travel',
    'playful-kids',
] as const

export const PersonalitySchema = z.enum(PERSONALITY_VALUES)

export const CreateTemplateSchema = z.object({
    name: z.string().min(1).max(200),
    description: z.string().max(2000).optional(),
    category: z.array(z.string()).min(1),
    personality: PersonalitySchema.optional(),
    status: TemplateStatusSchema.optional().default('draft'),
    isPremium: z.boolean().optional().default(false),
    isFeatured: z.boolean().optional().default(false),
    tags: z.array(z.object({ tag: z.string() })).optional(),
    previewUrl: z.string().url().optional().or(z.literal('')),
    scheduledFor: z.string().datetime().optional(),
})

export const UpdateTemplateSchema = CreateTemplateSchema.partial()

export const BulkActionSchema = z.object({
    ids: z.array(z.union([z.string(), z.number()])).min(1).max(200),
    action: z.enum(['publish', 'archive', 'schedule', 'delete', 're-score']),
    /** ISO string — only required when action=schedule */
    scheduledFor: z.string().datetime().optional(),
    /** Rubric version — only used when action=re-score */
    rubricVersion: z.enum(['v1', 'v1.1', 'v1.2', 'v1.3']).optional(),
})

// Simple in-memory rate limiter (MVP; per IP, per minute)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT = 10
const WINDOW_MS = 60_000

export function checkRateLimit(key: string, limit: number = RATE_LIMIT): boolean {
    const now = Date.now()
    const entry = rateLimitStore.get(key)

    if (!entry || now > entry.resetAt) {
        rateLimitStore.set(key, { count: 1, resetAt: now + WINDOW_MS })
        return true
    }

    if (entry.count >= limit) return false

    entry.count++
    return true
}
