/**
 * GET /api/admin/ai-settings — limits per plan code, platform config (prices + model chains),
 *   last-7-day per-group usage spread and unpriced models. The "would have hit" preview is computed
 *   in the browser from `stats[].shops` (see lib/admin/ai-settings/limit-stats).
 * PUT /api/admin/ai-settings — body { limits?: [{planCode, kind, value}], config?: AiPlatformConfig }.
 *   422 with { errors: [{path, message}] } when anything is invalid (nothing is written).
 * Super-admin only.
 */
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { withSuperAdmin } from '@/lib/admin/api-utils'
import { loadAiSettings, saveAiSettings } from '@/lib/admin/ai-settings/settings-store'

const BodySchema = z
  .object({
    limits: z.array(z.object({ planCode: z.string(), kind: z.enum(['budget', 'pictures']), value: z.string().max(40) })).max(40).optional(),
    config: z.unknown().optional(),
  })
  .refine((body) => body.limits !== undefined || body.config !== undefined, { message: 'Nothing to save.' })

export const GET = withSuperAdmin(async () => {
  try {
    return NextResponse.json(await loadAiSettings())
  } catch (error) {
    console.error('[ai-settings] load failed', error)
    return NextResponse.json({ error: 'Could not load AI settings' }, { status: 500 })
  }
})

export const PUT = withSuperAdmin(async (req: NextRequest) => {
  let json: unknown
  try {
    json = await req.json()
  } catch {
    return NextResponse.json({ error: 'Body must be JSON' }, { status: 400 })
  }
  const body = BodySchema.safeParse(json)
  if (!body.success) {
    return NextResponse.json({ error: body.error.issues[0]?.message ?? 'Invalid body' }, { status: 400 })
  }
  try {
    const result = await saveAiSettings({
      limits: body.data.limits as Parameters<typeof saveAiSettings>[0]['limits'],
      config: body.data.config,
    })
    if (!result.ok) return NextResponse.json({ errors: result.errors }, { status: 422 })
    // the write is done; a failed re-read must not look like a failed save
    const settings = await loadAiSettings().catch((error) => {
      console.error('[ai-settings] reload after save failed', error)
      return null
    })
    return NextResponse.json({ ok: true, written: result.written, settings })
  } catch (error) {
    console.error('[ai-settings] save failed', error)
    return NextResponse.json({ error: 'Could not save AI settings' }, { status: 500 })
  }
})
