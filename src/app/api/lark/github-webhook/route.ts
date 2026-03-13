/**
 * GitHub Webhook → Auto-ingest to BotKnowledge
 * POST /api/lark/github-webhook
 *
 * Receives GitHub push/PR events and creates knowledge entries.
 * This is what makes the bot automatically learn from new code changes.
 *
 * Setup: In GitHub repo Settings → Webhooks → Add webhook:
 *   URL: https://your-domain/api/lark/github-webhook
 *   Content type: application/json
 *   Secret: (set GITHUB_WEBHOOK_SECRET env var)
 *   Events: Push, Pull requests
 */
import { NextResponse } from 'next/server'
import { createHmac } from 'crypto'
import { ingestCommit, ingestPR } from '@/lib/lark/knowledge-ingest'

const WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET || ''

export const maxDuration = 30

// ─── Signature Verification ──────────────────────────────────────────────

function verifyGitHubSignature(payload: string, signature: string): boolean {
    if (!WEBHOOK_SECRET) {
        console.warn('[GitHub Webhook] No GITHUB_WEBHOOK_SECRET — skipping verification')
        return true
    }

    const expected = 'sha256=' + createHmac('sha256', WEBHOOK_SECRET).update(payload).digest('hex')

    if (expected.length !== signature.length) return false

    const a = Buffer.from(expected, 'utf8')
    const b = Buffer.from(signature, 'utf8')
    let diff = 0
    for (let i = 0; i < a.length; i++) {
        diff |= a[i] ^ b[i]
    }
    return diff === 0
}

// ─── Route Handler ───────────────────────────────────────────────────────

export async function POST(req: Request) {
    const rawBody = await req.text()

    // Verify signature
    const signature = req.headers.get('x-hub-signature-256') || ''
    if (!verifyGitHubSignature(rawBody, signature)) {
        console.error('[GitHub Webhook] Signature verification failed')
        return NextResponse.json({ error: 'Invalid signature' }, { status: 403 })
    }

    const event = req.headers.get('x-github-event')
    const payload = JSON.parse(rawBody)

    console.log('[GitHub Webhook] Event:', event, '| Action:', payload.action || 'N/A')

    // Process async — return 200 immediately
    Promise.resolve().then(async () => {
        try {
            switch (event) {
                case 'push':
                    await handlePush(payload)
                    break

                case 'pull_request':
                    await handlePullRequest(payload)
                    break

                default:
                    console.log('[GitHub Webhook] Unhandled event:', event)
            }
        } catch (error) {
            console.error('[GitHub Webhook] Processing error:', error)
        }
    })

    return NextResponse.json({ ok: true })
}

// ─── Push Event Handler ──────────────────────────────────────────────────

async function handlePush(payload: any): Promise<void> {
    const branch = payload.ref?.replace('refs/heads/', '') || ''
    const commits = payload.commits || []

    console.log(`[GitHub Webhook] Push: ${commits.length} commits on ${branch}`)

    for (const commit of commits) {
        // Skip merge commits
        if (commit.message.startsWith('Merge')) continue

        await ingestCommit({
            sha: commit.id,
            message: commit.message,
            author: commit.author?.username || commit.author?.name || 'unknown',
            branch,
            url: commit.url,
            files: [
                ...(commit.added || []),
                ...(commit.modified || []),
                ...(commit.removed || []),
            ],
        })
    }
}

// ─── Pull Request Event Handler ──────────────────────────────────────────

async function handlePullRequest(payload: any): Promise<void> {
    const action = payload.action
    const pr = payload.pull_request

    // Only ingest on meaningful actions
    if (!['opened', 'closed', 'merged'].includes(action)) return

    // For closed: only ingest if merged
    if (action === 'closed' && !pr.merged) return

    console.log(`[GitHub Webhook] PR #${pr.number}: ${action}`)

    await ingestPR({
        number: pr.number,
        title: pr.title,
        body: pr.body,
        author: pr.user?.login || 'unknown',
        branch: pr.head?.ref || '',
        baseBranch: pr.base?.ref || '',
        url: pr.html_url,
        additions: pr.additions,
        deletions: pr.deletions,
        merged: pr.merged || false,
        mergedBy: pr.merged_by?.login,
    })
}
