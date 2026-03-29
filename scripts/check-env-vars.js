#!/usr/bin/env node
/**
 * CI Check: Detect new environment variables in PR that are missing from:
 * 1. sync-do-envs.py SECRET_MAP (won't be synced to DO)
 * 2. .env.example (dev won't know it's needed)
 * 3. ci.yml deploy env block (CI won't pass it to sync script)
 *
 * Usage: node scripts/check-env-vars.js [base-branch]
 * Exit 0 = ok | Exit 1 = missing env vars detected
 */
const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const BASE_BRANCH = process.argv[2] || 'origin/staging'

// Env vars that are always available (built-in or set by platform)
const BUILT_IN_VARS = new Set([
    'NODE_ENV', 'PORT', 'HOSTNAME', 'HOME', 'PATH', 'CI', 'VERCEL',
    'NEXT_PUBLIC_SERVER_URL', 'DATABASE_URI', 'DATABASE_URL',
    'NEXT_RUNTIME', 'NEXT_PHASE', 'npm_lifecycle_event',
    '__NEXT_PRIVATE_PREBUNDLED_REACT',
    // Test vars (only used in CI runner, not in app)
    'BASE_URL', 'TEST_EMAIL', 'TEST_PASSWORD', 'HEADLESS',
])

// ─── Parse registered env vars from sync script ──────────────────
function getSyncedVars() {
    const syncPath = path.join(__dirname, '..', '.github', 'scripts', 'sync-do-envs.py')
    const content = fs.readFileSync(syncPath, 'utf8')
    const vars = new Set()
    const regex = /"([A-Z][A-Z0-9_]+)"\s*:/g
    let match
    while ((match = regex.exec(content)) !== null) {
        vars.add(match[1])
    }
    return vars
}

// ─── Parse .env.example vars ─────────────────────────────────────
function getExampleVars() {
    const envPath = path.join(__dirname, '..', '.env.example')
    if (!fs.existsSync(envPath)) return new Set()
    const content = fs.readFileSync(envPath, 'utf8')
    const vars = new Set()
    for (const line of content.split('\n')) {
        const match = line.match(/^([A-Z][A-Z0-9_]+)=/)
        if (match) vars.add(match[1])
    }
    return vars
}

// ─── Parse ci.yml deploy env block ───────────────────────────────
function getCIVars() {
    const ciPath = path.join(__dirname, '..', '.github', 'workflows', 'ci.yml')
    const content = fs.readFileSync(ciPath, 'utf8')
    const vars = new Set()
    // Match: KEY: ${{ secrets.KEY }}
    const regex = /^\s+([A-Z][A-Z0-9_]+):\s+\$\{\{\s*secrets\./gm
    let match
    while ((match = regex.exec(content)) !== null) {
        vars.add(match[1])
    }
    return vars
}

// ─── Find new process.env.* references in PR diff ────────────────
function getNewEnvVarsFromDiff() {
    const newVars = new Map() // var -> file
    try {
        const diff = execSync(
            `git diff ${BASE_BRANCH} -- 'src/**/*.ts' 'src/**/*.tsx' | grep "^+" | grep "process\\.env\\." || true`,
            { encoding: 'utf8' }
        ).trim()
        if (!diff) return newVars

        const regex = /process\.env\.([A-Z][A-Z0-9_]+)/g
        for (const line of diff.split('\n')) {
            let match
            while ((match = regex.exec(line)) !== null) {
                if (!BUILT_IN_VARS.has(match[1])) {
                    newVars.set(match[1], 'src/')
                }
            }
        }
    } catch { /* skip */ }
    return newVars
}

// ─── Main ────────────────────────────────────────────────────────
function main() {
    console.log(`[env-check] Comparing against ${BASE_BRANCH}...\n`)

    const syncedVars = getSyncedVars()
    const exampleVars = getExampleVars()
    const ciVars = getCIVars()
    const newVars = getNewEnvVarsFromDiff()

    if (newVars.size === 0) {
        console.log('[env-check] ✅ No new environment variables detected in PR')
        process.exit(0)
    }

    console.log(`[env-check] Found ${newVars.size} env var(s) in PR diff:`)
    for (const [v] of newVars) {
        console.log(`   process.env.${v}`)
    }

    const errors = []
    const warnings = []

    for (const [varName] of newVars) {
        const inSync = syncedVars.has(varName)
        const inExample = exampleVars.has(varName)
        const inCI = ciVars.has(varName)

        if (!inSync) {
            errors.push({
                var: varName,
                message: `Missing from sync-do-envs.py SECRET_MAP → will NOT be deployed to DO`,
                fix: `Add "${varName}": "${varName}" to SECRET_MAP in .github/scripts/sync-do-envs.py`,
            })
        }
        if (!inExample) {
            warnings.push({
                var: varName,
                message: `Missing from .env.example → other devs won't know it's needed`,
                fix: `Add ${varName}=your-value-here to .env.example`,
            })
        }
        if (!inCI) {
            errors.push({
                var: varName,
                message: `Missing from ci.yml deploy env block → CI won't pass it to sync script`,
                fix: `Add "${varName}: \${{ secrets.${varName} }}" to deploy-staging env block in .github/workflows/ci.yml`,
            })
        }
    }

    if (warnings.length > 0) {
        console.log(`\n⚠️  ${warnings.length} warning(s):\n`)
        for (const w of warnings) {
            console.log(`  ⚠️  ${w.var}: ${w.message}`)
            console.log(`     Fix: ${w.fix}\n`)
        }
    }

    if (errors.length > 0) {
        console.error(`\n❌ ${errors.length} error(s) — env vars won't work on staging/production:\n`)
        for (const e of errors) {
            console.error(`  🔴 ${e.var}: ${e.message}`)
            console.error(`     Fix: ${e.fix}\n`)
        }
        console.error('─── Required steps when adding a new env var ───')
        console.error('1. gh secret set MY_KEY --body "value"')
        console.error('2. Add to .github/scripts/sync-do-envs.py SECRET_MAP')
        console.error('3. Add to .github/workflows/ci.yml deploy env block')
        console.error('4. Add placeholder to .env.example')
        console.error('────────────────────────────────────────────────\n')
        process.exit(1)
    }

    console.log('\n[env-check] ✅ All new env vars are properly registered')
    process.exit(0)
}

main()
