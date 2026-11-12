/**
 * Authenticated SSE latency harness for GH-1190.
 *
 * Usage:
 *   E2E_SETUP_SECRET=... npm run measure:generation -- --runs=20 --language=vi --label=staging
 *
 * Each run signs a fresh account in through verify-otp (scripts/perf/otp-session.ts): that needs a server that
 * accepts its code for any account, i.e. a local `next dev`; deployed envs only bypass OTP for TEST_EMAIL.
 */
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { percentile } from '../src/lib/ai/generation-timings'
import { createOtpSession, type OtpSession } from './perf/otp-session'

const BASE = process.env.NEXT_PUBLIC_SERVER_URL ?? `http://localhost:${process.env.PORT ?? 3000}`
const BEARER = process.env.E2E_SETUP_SECRET ?? ''
const TEST_PASSWORD = process.env.TEST_PASSWORD ?? ''
const REPORT_DIR = 'plans/260717-1600-gh-1190-generation-critical-path/reports'
const REQUEST_TIMEOUT_MS = 75_000

type RunResult = {
    requestId: string
    language: string
    industry: string
    acceptedMs?: number
    firstEventMs?: number
    doneMs?: number
    serverTimeMs?: number
    totalPages?: number
    productsCount?: number
    blogsCount?: number
    imagesFailed?: number
    status: 'success' | 'failed'
    error?: string
}

const FIXTURES = [
    { industry: 'fnb', name: 'Sunrise Coffee Roasters', products: 'coffee beans, cold brew, pastries' },
    { industry: 'health', name: 'Nha Khoa Viet Smile', products: 'dental checkup, whitening, braces' },
    { industry: 'beauty', name: 'Lumi Skin Studio', products: 'facial treatment, skincare consultation' },
    { industry: 'services', name: 'Northstar Advisory', products: 'business consulting, accounting' },
    { industry: 'retail', name: 'Everyday Living', products: 'home decor, kitchen accessories' },
]

function parseArgs() {
    const args = Object.fromEntries(process.argv.slice(2).map((arg) => {
        const [key, value = ''] = arg.replace(/^--/, '').split('=', 2)
        return [key, value]
    }))
    return {
        runs: Math.max(1, Number(args.runs) || 20),
        language: args.language || 'en',
        label: args.label || new Date().toISOString().replace(/[:.]/g, '-'),
    }
}

async function createBenchmarkSession(runIndex: number, label: string): Promise<OtpSession> {
    if (!BEARER) throw new Error('E2E_SETUP_SECRET is required')
    if (!TEST_PASSWORD) throw new Error('TEST_PASSWORD is required')
    const suffix = `${label}-${runIndex}-${crypto.randomUUID().slice(0, 8)}`
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '-')
    const tenantSlug = `e2e-gen-${suffix}`.slice(0, 62).replace(/-+$/g, '')
    const email = `measure-gen+${crypto.randomUUID()}@primeweb.app`
    const response = await fetch(`${BASE}/api/e2e/ensure-test-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${BEARER}` },
        body: JSON.stringify({ email, password: TEST_PASSWORD, tenantSlug, tenantName: `Generation Benchmark ${runIndex + 1}` }),
    })
    if (!response.ok) throw new Error(`ensure-test-user failed: ${response.status} ${await response.text()}`)
    // The password step alone opens no app route (TC-PERF-142): finish the sign-in with the OTP step.
    return createOtpSession(BASE, email)
}

async function runGeneration(session: OtpSession, fixture: typeof FIXTURES[number], language: string): Promise<RunResult> {
    const requestId = crypto.randomUUID()
    const startedAt = performance.now()
    const result: RunResult = { requestId, language, industry: fixture.industry, status: 'failed' }
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    try {
        const response = await fetch(`${BASE}/api/ai/generate-site?stream=true`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Cookie: session.cookie,
                Origin: session.origin,
                'X-Generation-Request-Id': requestId,
            },
            body: JSON.stringify({
                businessInfo: {
                    businessName: `${fixture.name} ${requestId.slice(0, 6)}`,
                    industry: fixture.industry,
                    shortDescription: `${fixture.name} serves customers in Malaysia.`,
                    products: fixture.products,
                },
                language: ['en', 'ms', 'vi'].includes(language) ? language : 'auto',
                generationLocale: language,
            }),
            signal: controller.signal,
        })
        if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}: ${await response.text()}`)

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        let event = ''
        while (true) {
            const { done, value } = await reader.read()
            if (done) break
            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() ?? ''
            for (const line of lines) {
                if (line.startsWith('event: ')) {
                    event = line.slice(7)
                    result.firstEventMs ??= Math.round(performance.now() - startedAt)
                } else if (line.startsWith('data: ') && event) {
                    const data = JSON.parse(line.slice(6)) as Record<string, unknown>
                    if (event === 'generation_accepted') result.acceptedMs = Math.round(performance.now() - startedAt)
                    if (event === 'done') {
                        result.doneMs = Math.round(performance.now() - startedAt)
                        result.serverTimeMs = typeof data.timeMs === 'number' ? data.timeMs : undefined
                        result.totalPages = typeof data.totalPages === 'number' ? data.totalPages : undefined
                        result.productsCount = typeof data.productsCount === 'number' ? data.productsCount : undefined
                        result.blogsCount = typeof data.blogsCount === 'number' ? data.blogsCount : undefined
                        result.imagesFailed = typeof data.imagesFailed === 'number' ? data.imagesFailed : undefined
                        if (
                            result.totalPages !== 5 ||
                            result.productsCount !== 6 ||
                            result.blogsCount === undefined || result.blogsCount < 3 ||
                            result.imagesFailed !== 0
                        ) {
                            throw new Error(
                                `incomplete done payload pages=${result.totalPages ?? '-'} products=${result.productsCount ?? '-'} ` +
                                `blogs=${result.blogsCount ?? '-'} imagesFailed=${result.imagesFailed ?? '-'}`,
                            )
                        }
                        result.status = 'success'
                    }
                    if (event === 'error') throw new Error(String(data.message ?? 'SSE error'))
                    event = ''
                }
            }
        }
        if (result.status !== 'success') throw new Error('stream ended before done')
        return result
    } catch (error) {
        result.error = error instanceof Error ? error.message : String(error)
        return result
    } finally {
        clearTimeout(timer)
    }
}

function summarize(results: RunResult[]) {
    const success = results.filter((result) => result.status === 'success')
    const done = success.flatMap((result) => result.doneMs === undefined ? [] : [result.doneMs])
    const first = success.flatMap((result) => result.firstEventMs === undefined ? [] : [result.firstEventMs])
    return {
        attempts: results.length,
        successes: success.length,
        failures: results.length - success.length,
        firstEvent: { p50: percentile(first, 0.5), p95: percentile(first, 0.95), p99: percentile(first, 0.99) },
        done: { p50: percentile(done, 0.5), p95: percentile(done, 0.95), p99: percentile(done, 0.99) },
    }
}

export function assertBenchmarkSuccessful(summary: { attempts: number; failures: number }): void {
    if (summary.failures > 0) {
        throw new Error(`benchmark completed with ${summary.failures}/${summary.attempts} failed run(s)`)
    }
}

async function main() {
    const args = parseArgs()
    const results: RunResult[] = []
    for (let index = 0; index < args.runs; index++) {
        const fixture = FIXTURES[index % FIXTURES.length]!
        const session = await createBenchmarkSession(index, args.label)
        const result = await runGeneration(session, fixture, args.language)
        results.push(result)
        console.info(`[measure-generation] ${index + 1}/${args.runs} ${fixture.industry} ${result.status} done=${result.doneMs ?? '-'}ms`)
    }

    const summary = summarize(results)
    fs.mkdirSync(REPORT_DIR, { recursive: true })
    const baseName = `generation-latency-${args.label}-${args.language}`
    fs.writeFileSync(path.join(REPORT_DIR, `${baseName}.json`), JSON.stringify({ base: BASE, ...summary, results }, null, 2))
    fs.writeFileSync(path.join(REPORT_DIR, `${baseName}.md`), [
        `# Generation Latency - ${args.label} (${args.language})`,
        '',
        `- Attempts: ${summary.attempts}`,
        `- Successes: ${summary.successes}`,
        `- Failures: ${summary.failures}`,
        `- First event p50/p95/p99: ${summary.firstEvent.p50}/${summary.firstEvent.p95}/${summary.firstEvent.p99} ms`,
        `- Done p50/p95/p99: ${summary.done.p50}/${summary.done.p95}/${summary.done.p99} ms`,
        '',
    ].join('\n'))
    console.info(JSON.stringify(summary, null, 2))
    assertBenchmarkSuccessful(summary)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    void main().catch((error) => {
        console.error('[measure-generation] fatal:', error)
        process.exitCode = 1
    })
}
