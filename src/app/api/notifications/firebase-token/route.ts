import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rateLimit'
import { getFirebaseAdminApp, getFirebaseServerConfig } from '@/lib/firebase/firebase-admin-app'
import {
    broadcastSignalPath,
    getNotificationSignalEnv,
    signalUid,
    userSignalPath,
} from '@/lib/notifications/notification-signal-env'

export const dynamic = 'force-dynamic'

const NO_STORE = { 'Cache-Control': 'no-store' }

/**
 * GET /api/notifications/firebase-token
 *
 * Issues a Firebase custom token (uid `pw2_{env}_{userId}`) so the browser can
 * listen to its own notification "doorbell" in RTDB. Also returns the public
 * web config and the exact paths to subscribe to, so the client needs no env vars.
 * `{ enabled: false }` => Firebase not configured (or no env prefix on Vercel);
 * client falls back to polling.
 */
export const GET = withAuth(async (user) => {
    try {
        const rate = await checkRateLimit(`notifications:fb-token:${user.id}`, 10, 60_000)
        if (!rate.allowed) {
            return NextResponse.json(
                { success: false, error: 'Too many requests' },
                {
                    status: 429,
                    headers: {
                        ...NO_STORE,
                        'Retry-After': String(Math.max(1, Math.ceil((rate.resetAt - Date.now()) / 1000))),
                    },
                },
            )
        }

        const cfg = getNotificationSignalEnv() ? getFirebaseServerConfig() : null
        const app = cfg ? await getFirebaseAdminApp() : null
        if (!cfg || !app) return NextResponse.json({ enabled: false }, { headers: NO_STORE })

        const { getAuth } = await import('firebase-admin/auth')
        const token = await getAuth(app).createCustomToken(signalUid(user.id))

        return NextResponse.json(
            {
                enabled: true,
                token,
                config: { apiKey: cfg.webApiKey, databaseURL: cfg.databaseURL, projectId: cfg.projectId },
                userPath: userSignalPath(user.id),
                broadcastPath: broadcastSignalPath(),
            },
            { headers: NO_STORE },
        )
    } catch (error) {
        console.error('[Notifications firebase-token Error]', error instanceof Error ? error.message : 'unknown')
        return NextResponse.json(
            { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to issue token' } },
            { status: 500, headers: NO_STORE },
        )
    }
})
