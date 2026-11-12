// @vitest-environment node
/**
 * CI deploy preflights (scripts/ci/*.mjs): read only the needed key from the `vercel pull` env file
 * (never sourced in a shell, never printed) — pg-tcp-check (DB reachable before migrations) and
 * ai-env-preflight (production must reach the AI platform; ALLOW_PROD_WITHOUT_AI opt-out).
 * TC-AIREL-276..279 (docs/qa/F-ai-release.md) — PR #2059 review M9, L15.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { parseEnvFile } from '../../../../scripts/ci/env-file.mjs'
import { checkAiPlatformEnv, main as aiPreflight } from '../../../../scripts/ci/ai-env-preflight.mjs'
import { main as pgTcpCheck } from '../../../../scripts/ci/pg-tcp-check.mjs'

const SECRET = 'x'.repeat(40)
let dir: string

function envFile(text: string): string {
    const file = path.join(dir, `.env.${Math.random().toString(36).slice(2)}.local`)
    fs.writeFileSync(file, text)
    return file
}

function captureLog() {
    const lines: string[] = []
    return { lines, log: { log: (line: string) => lines.push(line) } }
}

beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ci-preflight-'))
})
afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true })
})

describe('[TC-AIREL-276] env file reader: vercel pull format, no shell expansion', () => {
    it('[TC-AIREL-276] reads double-quoted, single-quoted, unquoted and export-prefixed values literally', () => {
        const vars = parseEnvFile(
            [
                '# Created by Vercel CLI',
                'DATABASE_URI="postgres://u:p$ss`x`@db.example.com:5432/app?sslmode=require"',
                "SINGLE='$(rm -rf /)'",
                'PLAIN=https://ai.example.com # comment',
                'export EXPORTED=yes',
                'MULTI="line1\\nline2"',
                'EMPTY=""',
                '',
            ].join('\n'),
        )

        expect(vars.get('DATABASE_URI')).toBe('postgres://u:p$ss`x`@db.example.com:5432/app?sslmode=require')
        expect(vars.get('SINGLE')).toBe('$(rm -rf /)')
        expect(vars.get('PLAIN')).toBe('https://ai.example.com')
        expect(vars.get('EXPORTED')).toBe('yes')
        expect(vars.get('MULTI')).toBe('line1\nline2')
        expect(vars.has('EMPTY')).toBe(true)
        expect(vars.get('EMPTY')).toBe('')
        expect(vars.has('MISSING')).toBe(false)
    })
})

describe('[TC-AIREL-277] AI env preflight: what production needs to reach the AI platform', () => {
    it('[TC-AIREL-277] https URL + 32+ char secret passes', () => {
        const result = checkAiPlatformEnv(
            new Map([['AI_PLATFORM_URL', 'https://ai.example.com'], ['AI_PLATFORM_CONTEXT_SECRET', SECRET]]),
        )

        expect(result).toEqual({ problems: [], notes: [] })
    })

    it('[TC-AIREL-277] missing URL, non-https URL, missing secret and short secret are problems', () => {
        expect(checkAiPlatformEnv(new Map([['AI_PLATFORM_CONTEXT_SECRET', SECRET]])).problems).toEqual([
            'AI_PLATFORM_URL is missing or empty',
        ])
        expect(
            checkAiPlatformEnv(new Map([['AI_PLATFORM_URL', 'http://ai.example.com'], ['AI_PLATFORM_CONTEXT_SECRET', SECRET]])).problems,
        ).toEqual(['AI_PLATFORM_URL must be an https:// URL'])
        expect(checkAiPlatformEnv(new Map([['AI_PLATFORM_URL', 'https://ai.example.com']])).problems).toEqual([
            'AI_PLATFORM_CONTEXT_SECRET is missing',
        ])
        expect(
            checkAiPlatformEnv(new Map([['AI_PLATFORM_URL', 'https://ai.example.com'], ['AI_PLATFORM_CONTEXT_SECRET', 'short']]))
                .problems[0],
        ).toMatch(/shorter than 32 characters/)
    })

    it('[TC-AIREL-277] a secret pulled empty (Vercel Sensitive) only warns', () => {
        const result = checkAiPlatformEnv(
            new Map([['AI_PLATFORM_URL', 'https://ai.example.com'], ['AI_PLATFORM_CONTEXT_SECRET', '']]),
        )

        expect(result.problems).toEqual([])
        expect(result.notes[0]).toMatch(/AI_PLATFORM_CONTEXT_SECRET is empty/)
    })
})

describe('[TC-AIREL-278] AI env preflight CLI: fail production, opt-out, staging warn-only, never print values', () => {
    const short = 'tooShort$(whoami)'
    const badFile = () => envFile(`AI_PLATFORM_URL="https://ai.example.com"\nAI_PLATFORM_CONTEXT_SECRET="${short}"\n`)

    it('[TC-AIREL-278] production with a problem → ::error:: and exit 1, value not printed', () => {
        const { lines, log } = captureLog()

        const code = aiPreflight([badFile()], {}, log)

        expect(code).toBe(1)
        expect(lines.some((l) => l.startsWith('::error::AI_PLATFORM_CONTEXT_SECRET is shorter'))).toBe(true)
        expect(lines.join('\n')).not.toContain(short)
        expect(lines.join('\n')).not.toContain('ai.example.com')
    })

    it('[TC-AIREL-278] ALLOW_PROD_WITHOUT_AI=true → ::warning:: and exit 0', () => {
        const { lines, log } = captureLog()

        const code = aiPreflight([badFile()], { ALLOW_PROD_WITHOUT_AI: 'true' }, log)

        expect(code).toBe(0)
        expect(lines.some((l) => l.startsWith('::warning::AI_PLATFORM_CONTEXT_SECRET is shorter'))).toBe(true)
        expect(lines.some((l) => l.startsWith('::error::'))).toBe(false)
    })

    it('[TC-AIREL-278] --warn-only (staging) never fails, even without the env file', () => {
        const { lines, log } = captureLog()

        const code = aiPreflight([path.join(dir, 'missing.local'), '--warn-only'], {}, log)

        expect(code).toBe(0)
        expect(lines[0]).toMatch(/^::warning::vercel pull did not produce/)
    })

    it('[TC-AIREL-278] a good file passes with exit 0; an empty secret adds a warning only', () => {
        const ok = captureLog()
        const empty = captureLog()

        const okCode = aiPreflight([envFile(`AI_PLATFORM_URL=https://ai.example.com\nAI_PLATFORM_CONTEXT_SECRET=${SECRET}\n`)], {}, ok.log)
        const emptyCode = aiPreflight([envFile('AI_PLATFORM_URL="https://ai.example.com"\nAI_PLATFORM_CONTEXT_SECRET=""\n')], {}, empty.log)

        expect(okCode).toBe(0)
        expect(ok.lines.join('\n')).not.toContain(SECRET)
        expect(emptyCode).toBe(0)
        expect(empty.lines[0]).toMatch(/^::warning::AI_PLATFORM_CONTEXT_SECRET is empty/)
    })
})

describe('[TC-AIREL-279] pg-tcp-check: one key, TCP probe, no value in the output', () => {
    let server: net.Server
    let port: number

    beforeEach(async () => {
        server = net.createServer((socket) => socket.end())
        await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
        port = (server.address() as net.AddressInfo).port
    })
    afterEach(async () => {
        await new Promise((resolve) => server.close(resolve))
    })

    it('[TC-AIREL-279] reachable host → exit 0, prints host:port only', async () => {
        const { lines, log } = captureLog()
        const file = envFile(`OTHER="$(touch /tmp/pwned)"\nDATABASE_URI="postgres://user:s3cr3t@127.0.0.1:${port}/app"\n`)

        const code = await pgTcpCheck([file, 'DATABASE_URI'], log)

        expect(code).toBe(0)
        expect(lines).toEqual([`pg tcp ok (127.0.0.1:${port})`])
    })

    it('[TC-AIREL-279] missing file, missing key and an unreachable host → ::error:: and exit 1', async () => {
        const missingFile = captureLog()
        const missingKey = captureLog()
        const refused = captureLog()
        await new Promise((resolve) => server.close(resolve))
        server = net.createServer()
        await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))

        const codes = [
            await pgTcpCheck([path.join(dir, 'nope.local'), 'DATABASE_URI'], missingFile.log),
            await pgTcpCheck([envFile('OTHER=1\n'), 'AI_PLATFORM_DATABASE_URL'], missingKey.log),
            await pgTcpCheck([envFile(`DATABASE_URI=postgres://u:p@127.0.0.1:${port}/app\n`), 'DATABASE_URI'], refused.log, 2000),
        ]

        expect(codes).toEqual([1, 1, 1])
        expect(missingFile.lines[0]).toMatch(/^::error::vercel pull did not produce/)
        expect(missingKey.lines[0]).toMatch(/^::error::AI_PLATFORM_DATABASE_URL not present in /)
        expect(refused.lines[0]).toMatch(/^::error::pg tcp err \(127\.0\.0\.1:\d+\)/)
    })

    it('[TC-AIREL-279] --forbid blocks a URI pointing at the forbidden endpoint before any probe', async () => {
        const { lines, log } = captureLog()
        const file = envFile('DATABASE_URI="postgres://u:secret@ep-blue-king-a1qufqjg.neon.tech/app"\n')

        const code = await pgTcpCheck(
            [file, 'DATABASE_URI', '--forbid', 'ep-blue-king-a1qufqjg', '--forbid-hint', 'Fix: add a qc-test override'],
            log,
        )

        expect(code).toBe(1)
        expect(lines).toEqual([
            '::error::DATABASE_URI matches the forbidden endpoint "ep-blue-king-a1qufqjg"',
            '::error::Fix: add a qc-test override',
        ])
    })

    it('[TC-AIREL-279] an invalid URL is reported by key name without echoing the value', async () => {
        const { lines, log } = captureLog()

        const code = await pgTcpCheck([envFile('DATABASE_URI=not a url with s3cr3t\n'), 'DATABASE_URI'], log)

        expect(code).toBe(1)
        expect(lines).toEqual(['::error::DATABASE_URI is not a valid URL'])
    })
})
