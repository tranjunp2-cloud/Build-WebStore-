import { NextResponse } from 'next/server'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

/**
 * POST /api/webhooks/vercel
 *
 * Receives Vercel deployment webhooks and forwards to Lark via Bot API.
 * Events: deployment.ready (success), deployment.error (fail)
 *
 * Setup: Vercel Dashboard → Settings → Webhooks → Add
 *   URL: https://web-v2.dev.ecommercehub.my/api/webhooks/vercel
 *   Events: deployment.ready, deployment.error
 */
export async function POST(req: Request) {
    try {
        const body = await req.text()

        // Verify webhook signature
        const signature = req.headers.get('x-vercel-signature')
        const secret = process.env.VERCEL_WEBHOOK_SECRET
        if (secret && signature) {
            const hash = crypto.createHmac('sha1', secret).update(body).digest('hex')
            if (hash !== signature) {
                return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
            }
        }

        const payload = JSON.parse(body)
        const eventType = payload.type // deployment.ready, deployment.error, etc.

        // Only handle deployment events
        if (!eventType?.startsWith('deployment.')) {
            return NextResponse.json({ ok: true, skipped: true })
        }

        const deployment = payload.payload?.deployment || payload.payload || {}
        const project = payload.payload?.project || payload.payload?.name || 'PrimeWeb'
        const isSuccess = eventType === 'deployment.ready'
        const isFail = eventType === 'deployment.error' || eventType === 'deployment.canceled'

        if (!isSuccess && !isFail) {
            return NextResponse.json({ ok: true, skipped: true })
        }

        // Extract deploy info
        const meta = deployment.meta || {}
        const environment = deployment.target || 'preview'
        const branch = meta.githubCommitRef || meta.gitBranch || 'unknown'
        const author = meta.githubCommitAuthorLogin || meta.githubCommitAuthorName || 'unknown'
        const commitSha = (meta.githubCommitSha || '').slice(0, 7)
        const commitMsg = meta.githubCommitMessage || ''
        const deployUrl = deployment.url ? `https://${deployment.url}` : ''
        const inspectUrl = deployment.inspectorUrl || ''
        const projectName = typeof project === 'object' ? project.name : project

        // Build smart-notify payload
        const notifyPayload = {
            event: isSuccess ? 'deploy_success' : 'deploy_fail',
            project: projectName || 'PrimeWeb',
            branch,
            environment,
            author,
            commit: { sha: commitSha, message: commitMsg.slice(0, 80) },
            urls: {
                deployment: deployUrl,
                run: inspectUrl,
                staging: deployUrl,
            },
        }

        // Try Bot API first (smart-notify)
        const botUrl = process.env.BOT_NOTIFY_URL
        const botSecret = process.env.BOT_SECRET
        let botSent = false

        if (botUrl && botSecret) {
            try {
                const botRes = await fetch(`${botUrl}/api/ci/notify`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${botSecret}`,
                    },
                    body: JSON.stringify(notifyPayload),
                    signal: AbortSignal.timeout(8000),
                })
                botSent = botRes.ok
            } catch {
                // Bot unavailable — fallback to Lark
            }
        }

        // Fallback: direct Lark webhook
        if (!botSent) {
            const larkUrl = process.env.LARK_WEBHOOK_CI || process.env.LARK_WEBHOOK_URL
            if (larkUrl) {
                const color = isSuccess ? 'green' : 'red'
                const icon = isSuccess ? '✅' : '❌'
                const title = isSuccess
                    ? `${icon} Deploy Success — ${projectName}`
                    : `${icon} Deploy Failed — ${projectName}`

                const card = {
                    msg_type: 'interactive',
                    card: {
                        header: {
                            title: { tag: 'plain_text', content: title },
                            template: color,
                        },
                        elements: [
                            {
                                tag: 'div',
                                fields: [
                                    { is_short: true, text: { tag: 'lark_md', content: `**Branch:** ${branch}` } },
                                    { is_short: true, text: { tag: 'lark_md', content: `**Env:** ${environment}` } },
                                    { is_short: true, text: { tag: 'lark_md', content: `**Author:** ${author}` } },
                                    { is_short: true, text: { tag: 'lark_md', content: `**Commit:** ${commitSha}` } },
                                ],
                            },
                            {
                                tag: 'div',
                                text: { tag: 'lark_md', content: `📝 ${commitMsg.slice(0, 100)}` },
                            },
                            ...(deployUrl || inspectUrl
                                ? [{
                                    tag: 'action',
                                    actions: [
                                        ...(deployUrl ? [{ tag: 'button', text: { tag: 'plain_text', content: '🔗 View Site' }, url: deployUrl, type: 'primary' }] : []),
                                        ...(inspectUrl ? [{ tag: 'button', text: { tag: 'plain_text', content: '📋 View Logs' }, url: inspectUrl }] : []),
                                    ],
                                }]
                                : []),
                        ],
                    },
                }

                // Sign if key provided
                const signKey = process.env.LARK_SIGN_KEY_CI || process.env.LARK_SIGN_KEY
                if (signKey) {
                    const timestamp = Math.floor(Date.now() / 1000).toString()
                    const stringToSign = `${timestamp}\n${signKey}`
                    const sign = crypto.createHmac('sha256', stringToSign).update('').digest('base64')
                    Object.assign(card, { timestamp, sign })
                }

                await fetch(larkUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(card),
                    signal: AbortSignal.timeout(5000),
                }).catch(() => {})
            }
        }

        return NextResponse.json({ ok: true, event: notifyPayload.event, botSent })
    } catch (error) {
        console.error('[Vercel Webhook Error]', error)
        return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
}
