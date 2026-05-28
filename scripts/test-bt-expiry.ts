/**
 * test-bt-expiry.ts
 * Manually trigger BT payment-expiry flow for local testing (cross-platform).
 *
 * Usage:
 *   npx tsx scripts/test-bt-expiry.ts             # list pending BT orders then prompt
 *   npx tsx scripts/test-bt-expiry.ts <order-id>  # expire a specific order
 *   npx tsx scripts/test-bt-expiry.ts all         # expire ALL pending BT orders
 */

import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'
import { getPayload } from 'payload'
import config from '../src/payload.config'

// ── Load .env.local ─────────────────────────────────────────────────────────
const envPath = path.join(__dirname, '..', '.env.local')
if (!fs.existsSync(envPath)) {
    console.error('❌  .env.local not found')
    process.exit(1)
}
for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
    if (!(key in process.env)) process.env[key] = val
}

const CRON_SECRET = process.env.CRON_SECRET ?? ''
const BASE_URL = process.env.NEXT_PUBLIC_SERVER_URL ?? 'http://localhost:3000'

if (!CRON_SECRET) {
    console.error('❌  CRON_SECRET not set in .env.local')
    process.exit(1)
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function prompt(question: string): Promise<string> {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    return new Promise(resolve => rl.question(question, ans => { rl.close(); resolve(ans.trim()) }))
}

async function listPendingOrders(payload: Awaited<ReturnType<typeof getPayload>>) {
    const result = await payload.find({
        collection: 'orders',
        where: {
            and: [
                { paymentMethod: { equals: 'bank_transfer' } },
                { paymentStatus: { in: ['awaiting_payment', 'pending_verification'] } },
            ],
        },
        sort: '-createdAt',
        limit: 20,
        depth: 0,
        overrideAccess: true,
    })

    const orders = result.docs as any[]
    if (orders.length === 0) {
        console.log('  (no pending BT orders found)')
    } else {
        const col = (s: string, w: number) => s.padEnd(w).slice(0, w)
        console.log(`  ${'id'.padEnd(6)}  ${'#order'.padEnd(14)}  ${'paymentStatus'.padEnd(24)}  expires`)
        console.log(`  ${'─'.repeat(6)}  ${'─'.repeat(14)}  ${'─'.repeat(24)}  ${'─'.repeat(30)}`)
        for (const o of orders) {
            console.log(`  ${col(String(o.id), 6)}  ${col('#' + o.orderNumber, 14)}  ${col(o.paymentStatus, 24)}  ${o.paymentExpiresAt ?? 'N/A'}`)
        }
    }
    console.log()
    return orders
}

async function expireOrders(
    payload: Awaited<ReturnType<typeof getPayload>>,
    targetId: string | 'all',
    pendingOrders: any[],
) {
    const toExpire = targetId === 'all'
        ? pendingOrders
        : pendingOrders.filter(o => String(o.id) === targetId)

    if (toExpire.length === 0) {
        console.error(`❌  No matching order found for id=${targetId}`)
        process.exit(1)
    }

    const pastDate = new Date(Date.now() - 60_000).toISOString() // 1 minute ago

    for (const o of toExpire) {
        await payload.update({
            collection: 'orders',
            id: o.id,
            data: { paymentExpiresAt: pastDate } as any,
            overrideAccess: true,
        })
        console.log(`  ✓ expired  id=${o.id}  #${o.orderNumber}`)
    }
    console.log()
}

async function callCron() {
    const url = `${BASE_URL}/api/cron/payment-expiry`
    console.log(`🔄  Calling cron: ${url}`)

    let res: Response
    try {
        res = await fetch(url, { headers: { Authorization: `Bearer ${CRON_SECRET}` } })
    } catch {
        console.error(`❌  Could not reach ${url} — is the dev server running?`)
        process.exit(1)
    }

    const body = await res.json().catch(() => null)
    console.log(`    HTTP ${res.status}`)
    console.log()
    console.log(JSON.stringify(body, null, 2))
    console.log()

    if (res.ok && body) {
        console.log(`✅  processed=${body.processed ?? '?'}  errors=${body.errors ?? '?'}`)
    } else {
        console.error('❌  Cron returned an error (see above)')
    }
    console.log()
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
    const arg = process.argv[2]

    const payload = await getPayload({ config })

    console.log()
    console.log('📋  Pending BT orders (awaiting_payment | pending_verification):')
    console.log('─'.repeat(70))
    const pending = await listPendingOrders(payload)

    let target = arg ?? ''
    if (!target) {
        if (pending.length === 0) {
            console.log('Nothing to expire. Create a BT order first.')
            process.exit(0)
        }
        target = await prompt("Enter order id to expire (or 'all'): ")
    }

    console.log(`⏩  Setting paymentExpiresAt to 1 minute ago...`)
    await expireOrders(payload, target, pending)

    await callCron()

    process.exit(0)
}

main().catch(err => { console.error(err); process.exit(1) })
