/**
 * SQL statements + DB time per hot merchant request, measured in-process (no server, no build).
 *
 * Runs route handlers, server actions and server components' data loading the way one request would, against a
 * DISPOSABLE database copy, and prints per scenario: SQL statements, summed DB ms (time each statement took from
 * send to result), wall ms. `next/headers`, React `cache()` and `unstable_cache` are emulated per request by
 * scripts/perf/request-harness-preload.cjs (unstable_cache is pass-through, so numbers are the cache-miss cost).
 *
 *   docker exec primeweb-db sh -c "createdb -U primeweb primeweb_nplus1 && pg_dump -U primeweb primeweb_staging_host | psql -q -U primeweb primeweb_nplus1"
 *   DATABASE_URI=postgres://primeweb:<pw>@localhost:5433/primeweb_nplus1 PAYLOAD_SECRET=<any> \
 *   node_modules/.bin/tsx --require ./scripts/perf/request-harness-preload.cjs scripts/perf/measure-hot-requests.ts \
 *     [--user=3] [--runs=3] [--only=name,name] [--sql]
 *
 * Each scenario runs once to warm modules (its own in-memory caches are cleared between runs where the scenario
 * says so), then `--runs` times; the table shows the median run. `--sql` prints the statements of the last run.
 */
import { SignJWT } from 'jose'

type Stats = { count: number; ms: number; texts: Array<{ ms: number; text: string }> }
type HarnessRequest = { cookies: Record<string, string>; headers?: Record<string, string> }
const g = globalThis as unknown as { __sqlStats: Stats; __harnessRequest: HarnessRequest | null }

export type Scenario = {
    name: string
    /** One request's work. Receives a fresh Request-like context; return value is inspected for errors only. */
    run: (ctx: ScenarioContext) => Promise<unknown>
    /** A storefront visitor: no session cookie. */
    anonymous?: boolean
    /** Called before each measured run, e.g. to clear an in-memory cache so the run measures a miss. */
    reset?: () => void | Promise<void>
}

export type ScenarioContext = {
    token: string
    userId: number
    tenantId: number
    request: (url: string, init?: RequestInit) => Request
}

function arg(name: string): string | undefined {
    const hit = process.argv.find((a) => a.startsWith(`--${name}=`) || a === `--${name}`)
    if (!hit) return undefined
    return hit.includes('=') ? hit.slice(hit.indexOf('=') + 1) : 'true'
}

async function measure(scenario: Scenario, ctx: ScenarioContext) {
    await scenario.reset?.()
    g.__harnessRequest = {
        cookies: scenario.anonymous ? {} : { 'payload-token': ctx.token, 'active-tenant-id': String(ctx.tenantId) },
    }
    const stats = g.__sqlStats
    stats.count = 0
    stats.ms = 0
    stats.texts = []
    const t0 = performance.now()
    let error: string | null = null
    try {
        const out = await scenario.run(ctx)
        if (out instanceof Response && out.status >= 400) error = `HTTP ${out.status}`
    } catch (e) {
        const digest = (e as { digest?: string })?.digest
        if (!digest?.startsWith('NEXT_')) error = e instanceof Error ? e.message.slice(0, 160) : String(e)
    }
    const wall = performance.now() - t0
    // let fire-and-forget work (after(), cache fills) settle before reading the counters
    await new Promise((r) => setTimeout(r, 30))
    g.__harnessRequest = null
    return { sql: stats.count, dbMs: stats.ms, wallMs: wall, error, texts: [...stats.texts] }
}

async function main() {
    if (!/nplus1|perf/.test(process.env.DATABASE_URI ?? '')) {
        throw new Error('Refusing to run: DATABASE_URI must point at a disposable *_nplus1 / *_perf database.')
    }
    const userId = Number(arg('user') ?? 3)
    const runs = Number(arg('runs') ?? 3)
    const only = arg('only')?.split(',')
    const showSql = Boolean(arg('sql'))

    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    const payload = await getPayload({ config })
    const user = await payload.findByID({ collection: 'users', id: userId, depth: 0, overrideAccess: true })
    const membership = (user as { tenants?: Array<{ tenant: number | { id: number } }> }).tenants?.[0]?.tenant
    const tenantId = Number(typeof membership === 'object' ? membership?.id : membership)
    const token = await new SignJWT({ id: user.id, email: user.email, collection: 'users', mfa_verified: true })
        .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h')
        .sign(new TextEncoder().encode(process.env.PAYLOAD_SECRET!))
    const ctx: ScenarioContext = {
        token,
        userId,
        tenantId,
        request: (url, init) => {
            const headers = new Headers(init?.headers)
            headers.set('cookie', `payload-token=${token}; active-tenant-id=${tenantId}`)
            headers.set('host', 'localhost:3000')
            // same-site, as a browser sends it: a cookie session on a write needs it (TC-PERF-162)
            if (!headers.has('origin')) headers.set('origin', 'http://localhost:3000')
            return new Request(new URL(url, 'http://localhost:3000'), { ...init, headers })
        },
    }

    const { scenarios } = await import('./hot-request-scenarios')
    const rows: Array<Record<string, string | number>> = []
    for (const scenario of scenarios(payload)) {
        if (only && !only.includes(scenario.name)) continue
        await measure(scenario, ctx) // warm modules
        const results = []
        for (let i = 0; i < runs; i++) results.push(await measure(scenario, ctx))
        results.sort((a, b) => a.dbMs - b.dbMs)
        const mid = results[Math.floor(results.length / 2)]
        rows.push({
            scenario: scenario.name,
            sql: mid.sql,
            dbMs: +mid.dbMs.toFixed(1),
            wallMs: +mid.wallMs.toFixed(1),
            ...(mid.error ? { error: mid.error } : {}),
        })
        if (showSql) {
            console.log(`\n--- ${scenario.name}: ${mid.sql} statements`)
            for (const t of mid.texts) console.log(`${t.ms.toFixed(1).padStart(7)} ms  ${t.text.replace(/\s+/g, ' ').slice(0, 220)}`)
        }
    }
    console.log(JSON.stringify({ userId, tenantId, runs }, null, 0))
    console.table(rows)
    process.exit(0)
}

main().catch((error) => {
    console.error(error)
    process.exit(1)
})
