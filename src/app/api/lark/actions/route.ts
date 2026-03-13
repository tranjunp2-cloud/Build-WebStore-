/**
 * Lark Bot — Card Action Callback Endpoint
 * POST /api/lark/actions
 *
 * Handles interactive card button clicks (callback buttons)
 */
import { NextResponse } from 'next/server'
import { verifyCardActionToken } from '@/lib/lark/crypto'
import { replyText, updateCard } from '@/lib/lark/client'
import { getCIErrorDetails } from '@/lib/lark/github-service'
import { buildErrorCard } from '@/lib/lark/cards'
import type { LarkCardActionPayload } from '@/lib/lark/types'

export const maxDuration = 15

export async function POST(req: Request) {
    try {
        const payload: LarkCardActionPayload = await req.json()

        // Verify token
        if (!verifyCardActionToken(payload.token)) {
            console.error('[Lark Actions] Token verification failed')
            return NextResponse.json({ error: 'Invalid token' }, { status: 403 })
        }

        const action = payload.action?.value?.action
        console.log('[Lark Actions] Action:', action, '| from:', payload.open_id)

        switch (action) {
            case 'show_ci_error': {
                const runId = payload.action.value.run_id
                if (!runId) {
                    return NextResponse.json({})
                }

                const details = await getCIErrorDetails(runId)

                // Update the card in-place with error details
                const errorCard = buildErrorCard('CI Error Details', details)
                await updateCard(payload.open_message_id, errorCard)

                return NextResponse.json({})
            }

            default:
                console.warn('[Lark Actions] Unknown action:', action)
                return NextResponse.json({})
        }
    } catch (error) {
        console.error('[Lark Actions] Error:', error)
        return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
}
