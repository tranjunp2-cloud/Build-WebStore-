/**
 * PATCH /api/admin/categories/[id]/dna
 * Updates the DNA JSON field on a category. Needs category.edit.
 */
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { z } from 'zod'
import { withStudioPermission } from '@/lib/admin/api-utils'

const PERSONALITY_VALUES = [
    'warm-traditional', 'warm-homestyle', 'bold-dark', 'soft-feminine',
    'calm-wellness', 'modern-vibrant', 'editorial-clean', 'luxury-travel', 'playful-kids',
] as const

const DnaSchema = z.object({
    signatureBlocks: z.array(z.string()).optional(),
    recommendedBlocks: z.array(z.string()).optional(),
    mandatoryOrder: z.array(z.string()).optional(),
    forbiddenBlocks: z.array(z.string()).optional(),
    typicalPersonalities: z.array(z.enum(PERSONALITY_VALUES)).optional(),
    minSections: z.number().int().min(1).max(20).optional(),
    aiPromptHint: z.string().max(500).optional(),
})

type RouteContext = { params: Promise<{ id: string }> }

export const PATCH = withStudioPermission('category.edit', async (req: NextRequest, _ctx) => {
    // Extract dynamic param from the URL path directly (workaround for withSuperAdmin wrapper)
    const segments = req.nextUrl.pathname.split('/')
    // path: /api/admin/categories/[id]/dna → id at index -2
    const id = segments[segments.length - 2]

    if (!id) {
        return NextResponse.json({ error: 'Missing category id' }, { status: 400 })
    }

    let body: unknown
    try {
        body = await req.json()
    } catch {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const parsed = DnaSchema.safeParse(body)
    if (!parsed.success) {
        return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 })
    }

    const payload = await getPayload({ config })

    try {
        const updated = await payload.update({
            collection: 'categories',
            id,
            data: { dna: parsed.data },
        })
        return NextResponse.json({ data: updated })
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'Update failed'
        return NextResponse.json({ error: msg }, { status: 500 })
    }
})
