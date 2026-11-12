/**
 * GET   /api/admin/templates/[id]  — single template detail
 * PATCH /api/admin/templates/[id]  — partial update
 */
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { studioForbidden, withStudioSeat, withSuperAdmin, UpdateTemplateSchema } from '@/lib/admin/api-utils'
import { canPatchTemplate } from '@/lib/admin/studio-permissions'
import { isNotFoundError } from '@/lib/api/is-not-found-error'

type RouteContext = { params: Promise<{ id: string }> }

// Template ids are int4 serial PKs. Both a non-numeric id (Postgres 22P02 cast error) and
// an out-of-range numeric id (22003 value out of range) make Payload/Drizzle throw — and
// `disableErrors` suppresses NEITHER → 500. Reject both as a plain 404 before touching the
// DB. (GH #1535 review — same INT4 cap applied in mark-read + customers/export.)
const INT4_MAX = 2147483647
const isValidTemplateId = (id: string) => /^\d+$/.test(id) && Number(id) <= INT4_MAX

export async function GET(req: NextRequest, ctx: RouteContext) {
    return withSuperAdmin(async () => {
        const { id } = await ctx.params
        if (!isValidTemplateId(id)) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 })
        }
        const payload = await getPayload({ config })

        // disableErrors: findByID throws NotFound on a missing id by default, which
        // withSuperAdmin has no catch for → 500. With disableErrors it returns null,
        // so the 404 branch below runs (GH #1535).
        const template = await payload.findByID({
            collection: 'templates',
            id,
            depth: 1,
            disableErrors: true,
        })

        if (!template) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 })
        }

        return NextResponse.json({ data: template })
    })(req)
}

export async function PATCH(req: NextRequest, ctx: RouteContext) {
    return withStudioSeat(async (_req, { user }) => {
        const { id } = await ctx.params
        if (!isValidTemplateId(id)) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 })
        }
        const body = await req.json().catch(() => null)

        if (!body) {
            return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
        }

        const parsed = UpdateTemplateSchema.safeParse(body)
        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Validation failed', details: parsed.error.flatten() },
                { status: 422 },
            )
        }

        const payload = await getPayload({ config })

        // update() throws NotFound on a missing id (withSuperAdmin has no catch → 500).
        // Map it to 404 so a non-existent template isn't reported as a server crash. (GH #1535)
        try {
            const current = await payload.findByID({ collection: 'templates', id, depth: 0 })
            if (!canPatchTemplate(user.roles, current.status, parsed.data)) return studioForbidden()

            const updated = await payload.update({
                collection: 'templates',
                id,
                data: parsed.data,
            })
            return NextResponse.json({ data: updated })
        } catch (err) {
            if (isNotFoundError(err)) {
                return NextResponse.json({ error: 'Not found' }, { status: 404 })
            }
            throw err
        }
    })(req)
}
