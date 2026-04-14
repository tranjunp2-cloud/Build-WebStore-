#!/usr/bin/env node
/**
 * CI Check: Detect new environment variables in PR that are missing from env files.
 *
 * Checks against both:
 * - .env.staging.example (staging deploy)
 * - .env.production.example (production deploy)
 *
 * How secrets work:
 * - GitHub Secrets auto-sync to DO on deploy (via sync-do-envs.py + toJSON(secrets))
 * - Dev only needs: 1) gh secret set KEY  2) Add to .env.{staging,production}.example
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
    'NEXT_PUBLIC_SERVER_URL', 'NEXT_PUBLIC_APP_ENV',
    'NEXT_PUBLIC_PLATFORM_DOMAIN',
    'DATABASE_URI', 'DATABASE_URL',
    'NEXT_RUNTIME', 'NEXT_PHASE', 'npm_lifecycle_event',
    '__NEXT_PRIVATE_PREBUNDLED_REACT',
    'BASE_URL', 'TEST_EMAIL', 'TEST_PASSWORD', 'HEADLESS',
])

// ─── Parse env vars from a file ──────────────────────────────────
function getEnvVarsFromFile(filePath) {
    if (!fs.existsSync(filePath)) return new Set()
    const content = fs.readFileSync(filePath, 'utf8')
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

    const envFiles = {
        staging: '.env.staging.example',
        production: '.env.production.example',
    }

    const envVars = {}
    for (const [env, file] of Object.entries(envFiles)) {
        envVars[env] = getEnvVarsFromFile(path.join(__dirname, '..', file))
        console.log(`[env-check] ${file}: ${envVars[env].size} vars`)
    }

    const newVars = getNewEnvVarsFromDiff()

    if (newVars.size === 0) {
        console.log('\n[env-check] ✅ No new environment variables detected in PR')
        process.exit(0)
    }

    console.log(`\n[env-check] Found ${newVars.size} env var(s) in PR diff:`)
    for (const [v] of newVars) {
        console.log(`   process.env.${v}`)
    }

    const errors = []

    for (const [varName] of newVars) {
        for (const [env, vars] of Object.entries(envVars)) {
            if (!vars.has(varName)) {
                errors.push({
                    var: varName,
                    env,
                    file: envFiles[env],
                })
            }
        }
    }

    if (errors.length > 0) {
        console.error(`\n❌ ${errors.length} missing env var(s):\n`)

        // Group by var
        const grouped = {}
        for (const e of errors) {
            if (!grouped[e.var]) grouped[e.var] = []
            grouped[e.var].push(e)
        }

        for (const [varName, envErrors] of Object.entries(grouped)) {
            const files = envErrors.map(e => e.file).join(', ')
            console.error(`  🔴 ${varName} — missing from: ${files}`)
        }

        console.error('\n─── How to fix ───')
        console.error('1. Add placeholder to .env.staging.example AND .env.production.example')
        console.error('2. Add real value:  gh secret set MY_KEY --body "value"')
        console.error('   (Secrets auto-sync to DO on deploy — no other config needed)')
        console.error('──────────────────\n')
        process.exit(1)
    }

    console.log('\n[env-check] ✅ All new env vars registered in staging + production env files')
    process.exit(0)
}

main()
