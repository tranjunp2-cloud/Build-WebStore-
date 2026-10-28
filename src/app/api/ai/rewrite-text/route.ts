/**
 * POST /api/ai/rewrite-text
 * AI-powered text rewriting for inline editing.
 * Takes original text + instruction → returns rewritten text.
 *
 * F-03: Inline AI Edit
 */

import { NextResponse } from 'next/server'
import { rewriteTextSchema } from '@/lib/validations/ai'
import { parseRequest } from '@/lib/validations/helpers'
import { withAuth } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rateLimit'
import { describeAiTaskFailure, resolveSiteBillingTenant, runAiTaskForUser } from '@/lib/ai-platform/ai-tasks'
import { z } from 'zod'
import { AI_UNAVAILABLE_MESSAGE, isAiTasksEnabled } from '@/lib/ai-platform/config'

// A site-scoped caller (the website editor) names its site so usage bills that site's workspace.
const rewriteTextRequestSchema = rewriteTextSchema.extend({
    siteId: z.union([z.string().min(1), z.number()]).optional().transform((v) => (v != null ? String(v) : undefined)),
})

export const POST = withAuth(async (user, req) => {
    try {
        // Rate Limit: 20 AI tasks per hour
        const rateLimit = await checkRateLimit(`ai:rewrite-text:${user.id}`, 20)
        if (!rateLimit.allowed) {
            return NextResponse.json(
                { error: 'Rate limit exceeded. Try again later.' },
                { status: 429 }
            )
        }

        const { data, errorResponse } = await parseRequest(req, rewriteTextRequestSchema)
        if (errorResponse) return errorResponse
        
        const { text, instruction, context, language = 'en', siteId } = data!

        if (!isAiTasksEnabled()) {
            return NextResponse.json({ error: AI_UNAVAILABLE_MESSAGE }, { status: 503 })
        }

        let billingTenantId: string | undefined
        if (siteId) {
            const billing = await resolveSiteBillingTenant(user, siteId)
            if (!billing.ok) return NextResponse.json({ error: billing.error }, { status: billing.status })
            billingTenantId = billing.tenantId
        }

        try {
            const { output } = await runAiTaskForUser(user, req, 'copy.rewrite-text', {
                text,
                instruction,
                context,
                language,
            }, { tenantId: billingTenantId })
            return NextResponse.json({ rewritten: output.rewritten.trim() || text })
        } catch (error) {
            const failure = describeAiTaskFailure(error)
            return NextResponse.json({ error: failure.message }, { status: failure.status })
        }
    } catch (error: any) {
        console.error('[AI Rewrite Error]', error)
        return NextResponse.json(
            { error: 'Rewrite failed' },
            { status: 500 },
        )
    }
}, { csrf: true, requireMfa: true })
