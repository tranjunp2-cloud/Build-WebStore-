#!/usr/bin/env node
/**
 * CI Check: Detect new environment variables in PR that are missing from .env.example.
 *
 * How secrets work:
 * - GitHub Secrets auto-sync to DO on deploy (via sync-do-envs.py + toJSON(secrets))
 * - Dev only needs: 1) gh secret set KEY  2) Add to .env.example
 * - This script catches case 2 — missing .env.example entry
 *
 * Usage: node scripts/check-env-vars.js [base-branch]
 * Exit 0 = ok | Exit 1 = missing env vars detected
 */
const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const BASE_BRANCH = process.argv[2] || 'origin/staging'

// Env vars that are always available (built-in, not secrets)
const BUILT_IN_VARS = new Set([
    'NODE_ENV', 'PORT', 'HOSTNAME', 'HOME', 'PATH', 'CI', 'VERCEL',
    'NEXT_PUBLIC_SERVER_URL', 'DATABASE_URI', 'DATABASE_URL',
    'NEXT_RUNTIME', 'NEXT_PHASE', 'npm_lifecycle_event',
    '__NEXT_PRIVATE_PREBUNDLED_REACT',
    'BASE_URL', 'TEST_EMAIL', 'TEST_PASSWORD', 'HEADLESS',
])

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

// ─── Find new process.env.* references in PR diff ────────────────
function getNewEnvVarsFromDiff() {
    const newVars = new Map()
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

    const exampleVars = getExampleVars()
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

    for (const [varName] of newVars) {
        if (!exampleVars.has(varName)) {
            errors.push({
                var: varName,
                message: `Missing from .env.example — devs and CI won't know this secret is needed`,
            })
        }
    }

    if (errors.length > 0) {
        console.error(`\n❌ ${errors.length} env var(s) missing from .env.example:\n`)
        for (const e of errors) {
            console.error(`  🔴 ${e.var}: ${e.message}`)
        }
        console.error('\n─── How to fix ───')
        console.error('1. Add placeholder to .env.example:  MY_KEY=your-value-here')
        console.error('2. Add real value to GitHub Secrets:  gh secret set MY_KEY --body "value"')
        console.error('   (Secrets auto-sync to DO on deploy — no other config needed)')
        console.error('──────────────────\n')
        process.exit(1)
    }

    console.log('\n[env-check] ✅ All new env vars registered in .env.example')
    process.exit(0)
}

main()
