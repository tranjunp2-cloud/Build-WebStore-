/**
 * Shared utilities for Studio admin API routes.
 * Provides super-admin auth wrapper and common Zod schemas.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import type { PlatformUser } from '@/types/user'
import { z } from 'zod'

export type AdminHandler = (
    req: NextRequest,
    context: { user: PlatformUser; params?: Record<string, string> },
) => Promise<NextResponse>

type AdminRouteContext = {
    params?: Record<string, string> | Promise<Record<string, string>>
}

/**
 * Wraps an API route handler with super-admin auth enforcement.
 * Returns 401 if unauthenticated, 403 if wrong role.
 */
export function withSuperAdmin(handler: AdminHandler) {
    return async (req: NextRequest, ctx?: AdminRouteContext) => {
        const rawUser = await getCurrentUser()

        if (!rawUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const user = rawUser as unknown as PlatformUser

        if (!user.roles?.includes('super-admin')) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const params = ctx?.params ? await ctx.params : undefined
        return handler(req, { user, params })
    }
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
    ids: z.array(z.union([z.string(), z.number()])).min(1),
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
