/**
 * /api/admin/ai-providers/** — super-admin proxy to the ai-platform internal settings API (providers, keys, routing, tasks,
 * runtime, history). Only the calls in lib/admin/ai-providers/allow-list are forwarded; the token carries the session user as
 * `actor`. Bodies are forwarded as JSON and never logged. 503 "AI service unreachable" when ai-platform does not answer.
 */
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { withSuperAdmin } from '@/lib/admin/api-utils'
import { matchCall } from '@/lib/admin/ai-providers/allow-list'
import { callSettings, TEST_TIMEOUT_MS } from '@/lib/admin/ai-providers/upstream-client'

const MAX_BODY_BYTES = 64 * 1024

async function readBody(req: NextRequest): Promise<{ ok: true; body: unknown } | { ok: false; response: NextResponse }> {
  if (req.method === 'GET' || req.method === 'DELETE') return { ok: true, body: undefined }
  const text = await req.text()
  if (text.length > MAX_BODY_BYTES) return { ok: false, response: NextResponse.json({ error: 'Body too large' }, { status: 413 }) }
  if (!text.trim()) return { ok: true, body: {} }
  try {
    const parsed: unknown = JSON.parse(text)
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not an object')
    return { ok: true, body: parsed }
  } catch {
    return { ok: false, response: NextResponse.json({ error: 'Body must be a JSON object' }, { status: 400 }) }
  }
}

const handle = withSuperAdmin(async (req, { user, params }) => {
  const segments = (params?.path as unknown as string[] | undefined) ?? []
  const call = matchCall(req.method, segments, req.nextUrl.searchParams)
  if (!call) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const body = await readBody(req)
  if (!body.ok) return body.response
  const result = await callSettings({
    actor: { id: String(user.id), email: user.email },
    method: req.method,
    path: call.path,
    body: body.body,
    timeoutMs: call.slow ? TEST_TIMEOUT_MS : undefined,
  })
  if (result.ok) return NextResponse.json(result.data, { status: 200 })
  return NextResponse.json(result.errors ? { error: result.error, errors: result.errors } : { error: result.error }, { status: result.status })
})

export const GET = handle
export const POST = handle
export const PUT = handle
export const DELETE = handle
