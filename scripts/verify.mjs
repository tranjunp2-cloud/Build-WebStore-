#!/usr/bin/env node
/**
 * Local copy of the CI PR gates, scoped to what changed since origin/staging.
 * Runs from the husky pre-push hook and as `npm run verify` (for people and agents).
 *
 *   gates     check-migrations · check-env-vars · check-payload-cycles   (< 1 s)
 *   lint      npm run lint:fast (oxlint; CI runs the full ESLint `npm run lint`) (~2 s)
 *   typecheck npm run typecheck (tsc --noEmit)                            (~40 s)
 *   test      vitest related <changed .ts/.tsx under src>, CI=true (2 workers) (seconds)
 *
 * Typecheck and tests are skipped when the diff only touches docs/plans/agent folders/*.md.
 * Base ref: VERIFY_BASE (default origin/staging). Run `git fetch origin staging` if it is stale.
 */
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

const BASE = process.env.VERIFY_BASE || 'origin/staging'
const DOC_ONLY = /^(docs\/|plans\/|\.claude\/|\.opencode\/|\.cursor\/|\.gemini\/|[^/]+\.md$)/

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim()

function mergeBase() {
    try {
        return git('merge-base', 'HEAD', BASE)
    } catch {
        console.error(`[verify] ${BASE} not found — run: git fetch origin staging`)
        process.exit(1)
    }
}

function changedFiles(base) {
    const committed = git('diff', '--name-only', base, 'HEAD')
    const working = git('diff', '--name-only', 'HEAD')
    return [...new Set(`${committed}\n${working}`.split('\n').filter(Boolean))]
}

function run(label, cmd, args, env = {}) {
    const started = Date.now()
    process.stdout.write(`[verify] ${label} …\n`)
    // shell on Windows so npm/npx resolve to their .cmd shims
    const res = spawnSync(cmd, args, { stdio: 'inherit', env: { ...process.env, ...env }, shell: process.platform === 'win32' })
    const secs = ((Date.now() - started) / 1000).toFixed(1)
    if (res.status !== 0) {
        console.error(`\n[verify] ✗ ${label} failed (${secs}s) — fix it before pushing; CI runs the same check.`)
        process.exit(res.status ?? 1)
    }
    console.log(`[verify] ✓ ${label} (${secs}s)`)
}

const base = mergeBase()
const files = changedFiles(base)
if (files.length === 0) {
    console.log(`[verify] nothing changed since ${BASE} — skipping`)
    process.exit(0)
}
const codeChanged = files.some((f) => !DOC_ONLY.test(f))
console.log(`[verify] ${files.length} changed file(s) vs ${BASE}${codeChanged ? '' : ' (docs only)'}`)
// Same rule as ci.yml `changes`: global config and the CI definition make CI run the FULL suite.
const GLOBAL = /^(package\.json|package-lock\.json|tsconfig[^/]*\.json|vitest\.config\.[^/]+|\.nvmrc|node-polyfill\.js|src\/__tests__\/(helpers|mocks)\/.*|\.github\/workflows\/(ci|unit-tests|staging-full-tests)\.yml|\.github\/actions\/setup-[^/]+\/.*)$/
const globalChanges = files.filter((f) => GLOBAL.test(f))
const movedCode = git('diff', '--name-only', '--diff-filter=DR', base).split('\n').filter((f) => /\.(ts|tsx|js|mjs|cjs)$/.test(f))
if (globalChanges.length || movedCode.length) {
    const why = globalChanges[0] ?? `${movedCode[0]} deleted/renamed`
    console.log(`[verify] note: ${why} — CI runs the full test suite for this PR; run \`npm test\` locally if unsure`)
}
// CI also runs every spec that reads files (locale JSON, scripts/db-setup.js, vercel.json…);
// locally only the specs related to changed src files run.

run('DB migrations check', 'node', ['scripts/check-migrations.js', BASE])
run('env var manifests check', 'node', ['scripts/check-env-vars.js', BASE])
run('Payload import cycles check', 'node', ['scripts/check-payload-cycles.mjs'])
// --quiet: errors only (warnings are informational; the CI gate is ESLint `npm run lint`)
run('lint (oxlint)', 'npm', ['run', '--silent', 'lint:fast', '--', '--quiet'])

if (codeChanged) {
    run('typecheck', 'npm', ['run', '--silent', 'typecheck'], { NODE_OPTIONS: '--max-old-space-size=4096' })
    // `vitest related <files>` (not --changed): --changed falls back to the WHOLE suite when
    // package.json / lockfile / tsconfig change, which is too heavy for a pre-push hook on a dev
    // machine. CI runs the full suite for those diffs. Absolute paths: src/app/(group)/[id] would
    // otherwise be read as glob filters. CI=true caps vitest at 2 workers (vitest.config.ts).
    // Shared test helpers/mocks are forceRerunTriggers (vitest.config.ts): `related` on them would
    // run the whole suite, so leave those to CI (which runs the full suite for such a PR).
    const shared = files.filter((f) => /^src\/__tests__\/(helpers|mocks)\//.test(f))
    if (shared.length) console.log(`[verify] note: shared test helpers changed (${shared[0]}) — not run locally; CI runs the full suite`)
    const srcTs = files
        .filter((f) => /^src\/.*\.tsx?$/.test(f) && !/^src\/__tests__\/(helpers|mocks)\//.test(f) && existsSync(f))
        .map((f) => resolve(f))
    if (srcTs.length) {
        run(`tests related to ${srcTs.length} changed src file(s)`, 'npx', ['vitest', 'related', '--run', '--passWithNoTests', ...srcTs], { CI: 'true' })
    } else {
        console.log('[verify] no src/**/*.ts(x) changed — skipping related tests')
    }
}

console.log('[verify] all checks passed')
