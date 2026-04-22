/**
 * POST /api/admin/review/reject
 * Rejects a template: sets status=draft, optionally creates a TemplateIssue.
 */
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { z } from 'zod'
import { withSuperAdmin } from '@/lib/admin/api-utils'

const RejectSchema = z.object({
    templateId: z.union([z.string(), z.number()]),
    issueTitle: z.string().min(1).max(300).optional(),
    issueDescription: z.string().max(5000).optional(),
})

export const POST = withSuperAdmin(async (req: NextRequest, ctx) => {
    let body: unknown
    try {
        body = await req.json()
    } catch {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const parsed = RejectSchema.safeParse(body)
    if (!parsed.success) {
        return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 })
    }

    const { templateId, issueTitle, issueDescription } = parsed.data
    const payload = await getPayload({ config })

    // Verify template exists
    let template: Record<string, unknown>
    try {
        template = await payload.findByID({
            collection: 'templates',
            id: templateId,
            depth: 0,
        }) as Record<string, unknown>
    } catch {
        return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    if (template.status !== 'review') {
        return NextResponse.json(
            { error: `Template status is "${template.status}", expected "review"` },
            { status: 400 },
        )
    }

    try {
        // Set template back to draft
        const updated = await payload.update({
            collection: 'templates',
            id: templateId,
            data: { status: 'draft' },
        })

        // Optionally create a linked TemplateIssue
        let issue: unknown = null
        if (issueTitle) {
            issue = await payload.create({
                collection: 'template-issues',
                data: {
                    title: issueTitle,
                    description: issueDescription ?? '',
                    severity: 'medium',
                    category: 'content',
                    status: 'open',
                    relatedType: 'template',
                    relatedId: String(templateId),
                },
            })
        }

        return NextResponse.json({ data: updated, issue })
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'Reject failed'
        return NextResponse.json({ error: msg }, { status: 500 })
    }
})
