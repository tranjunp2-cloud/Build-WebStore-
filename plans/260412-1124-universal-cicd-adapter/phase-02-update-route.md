---
phase: 2
title: "Update /api/ci/notify Route"
status: pending
priority: P1
effort: 45m
---

# Phase 2 — Update /api/ci/notify Route

**Parent:** [plan.md](plan.md)
**Repo:** `prime-bot-assistant`
**Depends on:** Phase 1

## Overview

Refactor `POST /api/ci/notify` route handler để sử dụng adapter framework thay vì hardcoded logic.

## Key Insights

- Current route: parse JSON → normalizePayload (GitHub Actions only) → validate event → handleCINotify
- New route: read raw body → detectSource → verify → normalize → validate → handleCINotify
- Must read body as text first (for signature verification), then parse JSON
- Backward compat: GitHub Actions sends exact same format, adapter produces exact same output

## Related Files

| File | Action |
|------|--------|
| `src/app/api/ci/notify/route.ts` | Refactor — use adapter chain |
| `src/lib/ci-adapters/index.ts` | Import detectSource |
| `src/lib/lark/ci-notify-service.ts` | No changes |

## Implementation Steps

### 1. Refactor route.ts

```typescript
import { NextResponse } from 'next/server'
import { handleCINotify } from '@/lib/lark/ci-notify-service'
import type { CINotifyEvent } from '@/lib/lark/ci-notify-service'
import { detectSource } from '@/lib/ci-adapters'
import { logBotEvent } from '@/lib/monitoring/bot-events'

export const maxDuration = 30

const VALID_EVENTS: CINotifyEvent[] = [
  'deploy_success', 'deploy_fail', 'ci_pass', 'ci_fail',
]

export async function POST(req: Request) {
  // Read raw body (needed for signature verification)
  const rawBody = await req.text()
  let body: Record<string, unknown>
  try {
    body = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // Detect source adapter
  const adapter = detectSource(req.headers, body)
  console.log(`[CI Notify] Source detected: ${adapter.name}`)

  // Verify authenticity
  const valid = await adapter.verify(req.headers, rawBody)
  if (!valid) {
    console.warn(`[CI Notify] ${adapter.name}: signature verification failed`)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Normalize to CINotifyPayload
  const payload = adapter.normalize(body)
  if (!payload) {
    // Adapter says skip this event (e.g. deployment.created)
    return NextResponse.json({ ok: true, skipped: true })
  }

  // Validate event type
  if (!payload.event || !VALID_EVENTS.includes(payload.event)) {
    return NextResponse.json(
      { error: `Invalid event. Must be one of: ${VALID_EVENTS.join(', ')}` },
      { status: 400 }
    )
  }

  // Process async
  Promise.resolve().then(async () => {
    try {
      await handleCINotify(payload)
    } catch (error) {
      console.error('[CI Notify] Processing error:', error)
      logBotEvent({
        eventType: 'api_error',
        message: `CI notify ${payload.event} (${adapter.name}) failed: ${error instanceof Error ? error.message : 'Unknown'}`,
        details: { source: adapter.name, event: payload.event, project: payload.project, author: payload.author },
      }).catch(() => {})
    }
  })

  return NextResponse.json({
    ok: true,
    source: adapter.name,
    event: payload.event,
    message: 'Notification queued',
  })
}
```

### 2. Remove old normalizePayload from route.ts

Moved to `github-actions.ts` adapter in Phase 1.

### 3. Update response to include `source` field

Helps debugging — caller knows which adapter handled request.

## Todo

- [ ] Refactor route.ts to use adapter chain
- [ ] Remove inline normalizePayload (now in github-actions adapter)
- [ ] Add `source` field to response
- [ ] Test with existing smart-notify format (must not break)

## Success Criteria

- [ ] GitHub Actions smart-notify requests produce identical Lark cards as before
- [ ] Vercel webhook requests are correctly processed (new capability)
- [ ] Unknown sources with valid Bearer token still work (generic adapter)
- [ ] Invalid signatures return 401
- [ ] Skippable events return `{ ok: true, skipped: true }`

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Breaking GitHub Actions flow | Adapter produces exact same CINotifyPayload |
| Raw body read conflicts with JSON parse | Read as text first, parse manually |
| Vercel sends body > maxBodyLength | Vercel payloads are small (~2KB), not a concern |
