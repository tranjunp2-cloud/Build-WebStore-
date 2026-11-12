/**
 * Cost of one getCurrentUser() call against a real Postgres: CPU ms, wall ms and SQL statements per call,
 * for an OTP session token (raw PAYLOAD_SECRET) and a Payload login token (derived secret + session id).
 * The Payload login token only signs a super-admin in (TC-PERF-142), so that row needs BENCH_USER_ID of one.
 *
 * Run it against a DISPOSABLE copy, never a shared database — it inserts (and removes) one users_sessions row:
 *   docker exec primeweb-db psql -U primeweb -d postgres -c "create database primeweb_perf"
 *   docker exec primeweb-db sh -c "pg_dump -U primeweb primeweb_release | psql -q -U primeweb primeweb_perf"
 *   DATABASE_URI=postgres://primeweb:<pw>@localhost:5433/primeweb_perf PAYLOAD_SECRET=perf PAYLOAD_PUSH_SCHEMA=false \
 *   NODE_ENV=production BENCH_USER_ID=4 \
 *     node_modules/.bin/tsx --require ./scripts/seed-preload.cjs scripts/perf/bench-get-current-user.ts [authModule...]
 *
 * Each argument is an auth module exporting getCurrentUser (default src/lib/auth.ts), e.g. an older copy to compare
 * against. Modules are timed interleaved in rounds in one process so machine noise hits all of them alike.
 * Each call gets a fresh Request, so the per-request memo never hides the real cost.
 */
import path from 'node:path'
import { createRequire } from 'node:module'
import { SignJWT } from 'jose'

const ITERATIONS = Number(process.env.BENCH_ITERATIONS ?? 100)
const ROUNDS = Number(process.env.BENCH_ROUNDS ?? 6)
const WARMUP = 30

type AuthModule = { getCurrentUser: (req?: Request) => Promise<unknown> }
type Totals = { cpuMs: number; wallMs: number; sql: number; calls: number; keys: number }

async function main() {
    if (!/_perf\b|perf/.test(process.env.DATABASE_URI ?? '')) {
        throw new Error('Refusing to run: DATABASE_URI must point at a disposable *_perf database.')
    }
    const modulePaths = (process.argv.length > 2 ? process.argv.slice(2) : ['src/lib/auth.ts']).map((p) => path.resolve(p))
    const userId = Number(process.env.BENCH_USER_ID ?? 3)

    // Count every statement the pg driver sends (BEGIN/COMMIT included), whichever copy of `pg` drizzle loads.
    let statements = 0
    const require = createRequire(import.meta.url)
    const pgPaths = new Set([require.resolve('pg')])
    try {
        pgPaths.add(require.resolve('pg', { paths: [path.dirname(require.resolve('@payloadcms/db-postgres'))] }))
    } catch { /* single copy */ }
    for (const p of pgPaths) {
        const proto = require(p).Client.prototype
        const original = proto.query
        proto.query = function (...args: unknown[]) {
            statements++
            return original.apply(this, args)
        }
    }

    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    const payload = await getPayload({ config })
    const modules = await Promise.all(modulePaths.map(async (p) => [p, (await import(p)) as AuthModule] as const))

    const user = await payload.findByID({ collection: 'users', id: userId, depth: 0 })
    const otpToken = await new SignJWT({ id: user.id, email: user.email, collection: 'users', mfa_verified: true })
        .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h')
        .sign(new TextEncoder().encode(process.env.PAYLOAD_SECRET!))

    // A tenant user's password-step token is refused (TC-PERF-142): only a super-admin's measures a sign-in.
    const payloadTokenSignsIn = ((user as { roles?: string[] }).roles ?? []).includes('super-admin')
    if (!payloadTokenSignsIn) console.error(`user ${userId} is not a super-admin: timing the OTP token only`)

    const sid = `perf-bench-${Date.now()}`
    const pool = (payload.db as unknown as { pool: { query: (text: string, values?: unknown[]) => Promise<unknown> } }).pool
    await pool.query(
        `insert into users_sessions (_order, _parent_id, id, created_at, expires_at) values (999, $1, $2, now(), now() + interval '1 hour')`,
        [Number(user.id), sid],
    )
    const payloadToken = await new SignJWT({ id: user.id, email: user.email, collection: 'users', sid })
        .setProtectedHeader({ alg: 'HS256', authVersion: 1, typ: 'JWT' })
        .setIssuedAt().setExpirationTime('1h').sign(new TextEncoder().encode(payload.secret))

    const kinds = payloadTokenSignsIn ? [['otp', otpToken], ['payload', payloadToken]] as const : [['otp', otpToken]] as const
    const totals = new Map<string, Totals>()
    const callFor = (auth: AuthModule, token: string) => () =>
        auth.getCurrentUser(new Request('http://bench.local/api/x', { headers: { authorization: `JWT ${token}` } }))

    try {
        for (const [modulePath, auth] of modules) {
            for (const [kind, token] of kinds) {
                const call = callFor(auth, token)
                const probe = await call()
                if (!probe) throw new Error(`${kind} token did not authenticate with ${modulePath}`)
                for (let i = 0; i < WARMUP; i++) await call()
                totals.set(`${modulePath}|${kind}`, { cpuMs: 0, wallMs: 0, sql: 0, calls: 0, keys: Object.keys(probe as object).length })
            }
        }
        for (let round = 0; round < ROUNDS; round++) {
            for (const [modulePath, auth] of modules) {
                for (const [kind, token] of kinds) {
                    const call = callFor(auth, token)
                    statements = 0
                    const cpu0 = process.cpuUsage()
                    const t0 = performance.now()
                    for (let i = 0; i < ITERATIONS; i++) await call()
                    const wall = performance.now() - t0
                    const cpu = process.cpuUsage(cpu0)
                    const t = totals.get(`${modulePath}|${kind}`)!
                    t.cpuMs += (cpu.user + cpu.system) / 1000
                    t.wallMs += wall
                    t.sql += statements
                    t.calls += ITERATIONS
                }
            }
        }
    } finally {
        await pool.query('delete from users_sessions where id = $1', [sid])
    }

    const report: Record<string, Record<string, unknown>> = {}
    for (const [key, t] of totals) {
        const [modulePath, kind] = key.split('|')
        const name = path.relative(process.cwd(), modulePath)
        report[name] ??= {}
        report[name][kind] = {
            cpuMsPerCall: +(t.cpuMs / t.calls).toFixed(2),
            wallMsPerCall: +(t.wallMs / t.calls).toFixed(2),
            sqlPerCall: +(t.sql / t.calls).toFixed(2),
            userKeys: t.keys,
        }
    }
    console.log(JSON.stringify({ userId, callsPerCell: ITERATIONS * ROUNDS, ...report }, null, 2))
    process.exit(0)
}

main().catch((error) => {
    console.error(error)
    process.exit(1)
})
