/**
 * Lark Bot — Event Webhook Endpoint
 * POST /api/lark/events
 *
 * Handles:
 * 1. URL verification challenge (Lark setup)
 * 2. Event signature verification
 * 3. Event deduplication
 * 4. Async event processing (fire-and-forget, respond within 3s)
 */
import { NextResponse } from 'next/server'
import { verifyRequestSignature, decryptEvent, verifyToken } from '@/lib/lark/crypto'
import { LARK_ENCRYPT_KEY, EVENT_DEDUP_TTL, EVENT_DEDUP_MAX_SIZE } from '@/lib/lark/constants'
import { handleLarkEvent } from '@/lib/lark/event-handler'
import type { LarkEventEnvelope } from '@/lib/lark/types'

// ─── Event Deduplication ─────────────────────────────────────────────────

const processedEvents = new Map<string, number>()

function isDuplicate(eventId: string): boolean {
    const now = Date.now()

    // Cleanup old entries
    if (processedEvents.size > EVENT_DEDUP_MAX_SIZE) {
        for (const [id, ts] of processedEvents) {
            if (now - ts > EVENT_DEDUP_TTL) {
                processedEvents.delete(id)
            }
        }
    }

    if (processedEvents.has(eventId)) {
        return true
    }

    processedEvents.set(eventId, now)
    return false
}

// ─── Route Handler ───────────────────────────────────────────────────────

export const maxDuration = 10

export async function POST(req: Request) {
    const rawBody = await req.text()

    // Step 1: Verify signature (if encrypt key is set)
    if (!verifyRequestSignature(req.headers, rawBody)) {
        console.error('[Lark Events] Signature verification failed')
        return NextResponse.json({ error: 'Invalid signature' }, { status: 403 })
    }

    // Step 2: Parse body (might be encrypted)
    let payload: LarkEventEnvelope

    try {
        const parsed = JSON.parse(rawBody)

        // If encrypted, decrypt first
        if (parsed.encrypt && LARK_ENCRYPT_KEY) {
            const decrypted = decryptEvent(parsed.encrypt)
            payload = JSON.parse(decrypted)
        } else {
            payload = parsed
        }
    } catch (error) {
        console.error('[Lark Events] Failed to parse body:', error)
        return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
    }

    // Step 3: Handle URL verification challenge
    if (payload.type === 'url_verification' || payload.challenge) {
        console.log('[Lark Events] URL verification challenge received')

        // Verify token if present
        if (payload.token && !verifyToken(payload.token)) {
            return NextResponse.json({ error: 'Invalid token' }, { status: 403 })
        }

        return NextResponse.json({ challenge: payload.challenge })
    }

    // Step 4: Validate event header
    const header = payload.header
    if (!header?.event_id || !header?.event_type) {
        console.warn('[Lark Events] Missing event header')
        return NextResponse.json({ error: 'Missing header' }, { status: 400 })
    }

    // Step 5: Verify token
    if (!verifyToken(header.token)) {
        console.error('[Lark Events] Token verification failed')
        return NextResponse.json({ error: 'Invalid token' }, { status: 403 })
    }

    // Step 6: Deduplicate
    if (isDuplicate(header.event_id)) {
        console.log('[Lark Events] Duplicate event:', header.event_id)
        return NextResponse.json({ ok: true })
    }

    console.log('[Lark Events] Processing:', header.event_type, header.event_id)

    // Step 7: Return 200 immediately, process async
    // Lark requires response within 3 seconds
    Promise.resolve().then(async () => {
        try {
            await handleLarkEvent(payload)
        } catch (error) {
            console.error('[Lark Events] Handler error:', error)
        }
    })

    return NextResponse.json({ ok: true })
}
