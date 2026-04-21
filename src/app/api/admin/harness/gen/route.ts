/**
 * POST /api/admin/harness/gen — super-admin only.
 *
 * Spawns `npx tsx scripts/test-harness/cli.ts --mode=quick` as a child process,
 * parses the resulting `.harness-out/matrix.json`, and returns a summary.
 *
 * Plan: plans/260419-2022-GH-1-harness-template-block-sync-flow/phase-04-admin-harness-ui.md
 *
 * Caveats:
 * - CLI has no exported runCli() — it calls process.exit, so we must spawn.
 * - Child_process/tsx may not be available in all deploy envs (e.g. edge).
 *   This route is intended for staging/dev admin use; production deployments
 *   on Vercel serverless nodes include npx+tsx and should work.
 */

import { NextResponse } from 'next/server'
import { spawn } from 'node:child_process'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { withAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const HARNESS_TIMEOUT_MS = 60_000

type HarnessSummary = {
    composed: number
    errors: number
    durationMs: number
}

function runHarness(): Promise<{ summary: HarnessSummary } | { error: string; stderrTail?: string }> {
    return new Promise((resolve) => {
        const cwd = process.cwd()
        const outPath = path.resolve(cwd, '.harness-out/matrix.json')
        // Minimal env — do NOT forward PAYLOAD_SECRET / SEED_TOKEN / DATABASE_URI
        // to the child. Harness is pure-compose (no DB/auth needed).
        const childEnv: NodeJS.ProcessEnv = {
            PATH: process.env.PATH,
            HOME: process.env.HOME,
            NODE_ENV: process.env.NODE_ENV,
        }
        const child = spawn('npx', ['tsx', 'scripts/test-harness/cli.ts', '--mode=quick'], {
            cwd,
            env: childEnv,
        })

        let stderr = ''
        child.stderr.on('data', (chunk) => { stderr += String(chunk) })
        child.stdout.on('data', () => { /* discard — only summary matters */ })

        const timer = setTimeout(() => {
            child.kill('SIGKILL')
            resolve({ error: 'Harness timed out after 60s' })
        }, HARNESS_TIMEOUT_MS)

        child.on('error', (err) => {
            clearTimeout(timer)
            resolve({ error: `Spawn failed: ${err.message}` })
        })

        child.on('close', async (code) => {
            clearTimeout(timer)
            // CLI exits 1 when fixtures fail but still writes matrix.json.
            try {
                const raw = await fs.readFile(outPath, 'utf8')
                const report = JSON.parse(raw) as { summary?: { composed?: number; composerErrors?: number; totalDurationMs?: number } }
                const s = report.summary ?? {}
                resolve({
                    summary: {
                        composed: s.composed ?? 0,
                        errors: s.composerErrors ?? 0,
                        durationMs: s.totalDurationMs ?? 0,
                    },
                })
            } catch (readErr) {
                const tail = stderr.split('\n').slice(-8).join('\n')
                resolve({
                    error: `Harness exited code=${code} and matrix.json not readable: ${(readErr as Error).message}`,
                    stderrTail: tail,
                })
            }
        })
    })
}

export const POST = withAuth(async (user) => {
    const roles = (user as unknown as { roles?: string[] }).roles ?? []
    if (!roles.includes('super-admin')) {
        return NextResponse.json(
            { success: false, error: { code: 'FORBIDDEN', message: 'super-admin only' } },
            { status: 403 },
        )
    }

    // Vercel serverless filesystem is read-only except /tmp, and tsx isn't
    // bundled into production runtime — CLI spawn will fail. Surface a clear
    // 501 on Vercel so the UI can show a useful message ("run locally").
    if (process.env.VERCEL === '1') {
        return NextResponse.json(
            {
                success: false,
                error: {
                    code: 'NOT_SUPPORTED_ON_VERCEL',
                    message: 'Harness gen is dev/local only. Run `npm run harness:quick` from a workstation.',
                },
            },
            { status: 501 },
        )
    }

    const result = await runHarness()
    if ('error' in result) {
        return NextResponse.json(
            { success: false, error: { code: 'HARNESS_FAILED', message: result.error }, stderrTail: result.stderrTail },
            { status: 500 },
        )
    }
    return NextResponse.json({ success: true, summary: result.summary })
})
