import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { withAuth } from '@/lib/auth'
import { createBroadcastNotifications } from '@/lib/notifications/create-broadcast'
import type { BroadcastTargetAudience } from '@/lib/notifications/create-broadcast'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/broadcasts
 *
 * Creates a global broadcast notification for all tenant owners.
 * Auth: super-admin only.
 *
 * Body: {
 *   title: string (required, max 200 chars)
 *   message: string (required, max 2000 chars)
 *   actionUrl?: string (optional URL)
 *   targetAudience?: 'all' | 'free' | 'paid' (default: 'all')
 * }
 *
 * Response: { success: true, notified: number }
 */
export const POST = withAuth(async (user, request) => {
    // RBAC: super-admin only
    const roles = (user as unknown as { roles?: string[] }).roles ?? []
    if (!roles.includes('super-admin')) {
        return NextResponse.json(
            { success: false, error: { code: 'FORBIDDEN', message: 'Only super-admin can send broadcasts' } },
            { status: 403 },
        )
    }

    try {
        const body = await request.json()

        // Validate input
        const { title, message, actionUrl, targetAudience } = body as {
            title?: string
            message?: string
            actionUrl?: string
            targetAudience?: string
        }

        if (!title || typeof title !== 'string' || title.trim().length === 0) {
            return NextResponse.json(
                { success: false, error: { code: 'VALIDATION_ERROR', message: 'title is required' } },
                { status: 400 },
            )
        }

        if (!message || typeof message !== 'string' || message.trim().length === 0) {
            return NextResponse.json(
                { success: false, error: { code: 'VALIDATION_ERROR', message: 'message is required' } },
                { status: 400 },
            )
        }

        if (title.length > 200) {
            return NextResponse.json(
                { success: false, error: { code: 'VALIDATION_ERROR', message: 'title must be 200 characters or less' } },
                { status: 400 },
            )
        }

        if (message.length > 2000) {
            return NextResponse.json(
                { success: false, error: { code: 'VALIDATION_ERROR', message: 'message must be 2000 characters or less' } },
                { status: 400 },
            )
        }

        const validAudiences: BroadcastTargetAudience[] = ['all', 'free', 'paid']
        const audience: BroadcastTargetAudience =
            targetAudience && validAudiences.includes(targetAudience as BroadcastTargetAudience)
                ? (targetAudience as BroadcastTargetAudience)
                : 'all'

        // Sanitize: strip any HTML tags from title/message to prevent stored XSS
        const sanitizedTitle = stripHtml(title.trim())
        const sanitizedMessage = stripHtml(message.trim())

        const payload = await getPayload({ config })

        const result = await createBroadcastNotifications({
            title: sanitizedTitle,
            message: sanitizedMessage,
            actionUrl: actionUrl?.trim() || undefined,
            targetAudience: audience,
            payload,
        })

        return NextResponse.json({
            success: true,
            notified: result.notified,
        })
    } catch (error) {
        console.error('[Broadcasts POST Error]', error)
        return NextResponse.json(
            { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to send broadcast' } },
            { status: 500 },
        )
    }
})

/**
 * Strip HTML tags from a string to prevent XSS.
 * Preserves the text content only.
 */
function stripHtml(input: string): string {
    return input.replace(/<[^>]*>/g, '')
}
