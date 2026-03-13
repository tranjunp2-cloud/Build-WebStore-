#!/usr/bin/env node
/**
 * Mine Git History — Seed PrimeBot Knowledge Base
 *
 * One-time script to process past commits and PRs into knowledge entries.
 * This seeds the bot with historical context so it can answer questions like:
 * "Ai build feature X cách đây 2 tháng?" or "Tại sao lại refactor middleware?"
 *
 * Usage: GITHUB_TOKEN=xxx node scripts/mine-git-history.js
 *
 * What it does:
 * 1. Fetches last N commits from GitHub API
 * 2. Fetches closed/merged PRs
 * 3. Sends each to the /api/lark/ingest endpoint (or Payload Local API)
 *
 * Note: This script uses the GitHub API, not local git,
 * so it works in CI or any environment.
 */
const GITHUB_TOKEN = process.env.GITHUB_TOKEN
const GITHUB_REPO = process.env.GITHUB_REPO || 'nicenathapong/ech-prime-web-v2'
const API_BASE = 'https://api.github.com'
const APP_URL = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'

if (!GITHUB_TOKEN) {
    console.error('❌ GITHUB_TOKEN is required')
    console.error('Usage: GITHUB_TOKEN=ghp_xxx node scripts/mine-git-history.js')
    process.exit(1)
}

const headers = {
    Authorization: `Bearer ${GITHUB_TOKEN}`,
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'PrimeBot-HistoryMiner/1.0',
}

// ─── Fetch Helpers ───────────────────────────────────────────────────────

async function githubFetch(path) {
    const res = await fetch(`${API_BASE}/repos/${GITHUB_REPO}${path}`, { headers })
    if (!res.ok) {
        const text = await res.text()
        throw new Error(`GitHub API ${res.status}: ${text.substring(0, 200)}`)
    }
    return res.json()
}

// ─── Mine Commits ────────────────────────────────────────────────────────

async function mineCommits(count = 100) {
    console.log(`\n📝 Mining last ${count} commits...`)

    const commits = await githubFetch(`/commits?per_page=${Math.min(count, 100)}`)
    const entries = []

    for (const commit of commits) {
        const message = commit.commit.message
        const firstLine = message.split('\n')[0]
        const body = message.split('\n').slice(1).join('\n').trim()
        const author = commit.author?.login || commit.commit.author?.name || 'unknown'
        const date = commit.commit.author?.date

        // Skip merge commits and boring commits
        if (firstLine.startsWith('Merge') || firstLine.length < 10) continue

        // Get changed files
        let files = []
        try {
            const detail = await githubFetch(`/commits/${commit.sha}`)
            files = detail.files?.map(f => f.filename) || []
        } catch {
            // Skip if rate limited
        }

        // Determine category
        let category = 'code_change'
        if (firstLine.startsWith('feat')) category = 'feature'
        else if (firstLine.startsWith('fix')) category = 'bug_fix'
        else if (firstLine.startsWith('refactor') || firstLine.startsWith('perf')) category = 'architecture'
        else if (firstLine.startsWith('ci') || firstLine.startsWith('chore')) category = 'deployment'

        entries.push({
            title: firstLine.substring(0, 120),
            content: [
                `Commit: ${firstLine}`,
                body ? `\nDetail: ${body}` : '',
                `\nAuthor: ${author}`,
                `Date: ${date}`,
                `SHA: ${commit.sha.substring(0, 7)}`,
                files.length > 0 ? `\nFiles:\n${files.map(f => `  - ${f}`).join('\n')}` : '',
            ].filter(Boolean).join('\n'),
            category,
            source: 'github_commit',
            sourceUrl: commit.html_url,
            sourceId: `commit:${commit.sha}`,
            author,
            relatedFiles: files.map(f => ({ path: f })),
            tags: extractTags(files),
            importance: category === 'feature' ? 'important' : 'normal',
        })

        // Rate limit: 1 request per 100ms
        await new Promise(r => setTimeout(r, 100))
    }

    console.log(`  → Found ${entries.length} meaningful commits`)
    return entries
}

// ─── Mine PRs ────────────────────────────────────────────────────────────

async function minePRs(count = 50) {
    console.log(`\n🔀 Mining last ${count} PRs...`)

    const prs = await githubFetch(`/pulls?state=all&per_page=${Math.min(count, 100)}&sort=updated&direction=desc`)
    const entries = []

    for (const pr of prs) {
        // Get PR files
        let files = []
        try {
            const prFiles = await githubFetch(`/pulls/${pr.number}/files?per_page=50`)
            files = prFiles.map(f => f.filename)
        } catch {
            // Skip if rate limited
        }

        // Determine category
        let category = 'feature'
        const titleLower = pr.title.toLowerCase()
        if (titleLower.includes('fix') || titleLower.includes('bug')) category = 'bug_fix'
        else if (titleLower.includes('refactor')) category = 'architecture'
        else if (titleLower.includes('deploy') || titleLower.includes('ci')) category = 'deployment'

        entries.push({
            title: `PR #${pr.number}: ${pr.title}`.substring(0, 120),
            content: [
                `PR #${pr.number}: ${pr.title}`,
                `\nAuthor: ${pr.user?.login || 'unknown'}`,
                `Branch: ${pr.head?.ref} → ${pr.base?.ref}`,
                `State: ${pr.state}${pr.merged_at ? ' (merged)' : ''}`,
                `Created: ${pr.created_at}`,
                pr.merged_at ? `Merged: ${pr.merged_at}` : '',
                `Changes: +${pr.additions || 0} / -${pr.deletions || 0} (${pr.changed_files || 0} files)`,
                pr.body ? `\n--- Description ---\n${pr.body.substring(0, 500)}` : '',
                files.length > 0 ? `\n--- Files (${files.length}) ---\n${files.slice(0, 20).map(f => `  - ${f}`).join('\n')}` : '',
            ].filter(Boolean).join('\n'),
            category,
            source: 'github_pr',
            sourceUrl: pr.html_url,
            sourceId: `pr:${pr.number}`,
            author: pr.user?.login || 'unknown',
            relatedFiles: files.map(f => ({ path: f })),
            tags: extractTags(files),
            branch: pr.head?.ref,
            importance: 'important',
        })

        await new Promise(r => setTimeout(r, 100))
    }

    console.log(`  → Found ${entries.length} PRs`)
    return entries
}

// ─── Tag Extraction ──────────────────────────────────────────────────────

function extractTags(files) {
    const tags = new Set()
    for (const f of files) {
        if (f.includes('src/components/')) tags.add('frontend')
        if (f.includes('src/app/(')) tags.add('frontend')
        if (f.includes('src/collections/')) tags.add('backend')
        if (f.includes('src/app/api/')) tags.add('api')
        if (f.includes('src/lib/ai/')) tags.add('AI')
        if (f.includes('src/lib/lark/')) tags.add('lark-bot')
        if (f.includes('src/blocks/')) tags.add('blocks')
        if (f.includes('.github/')) tags.add('CI/CD')
        if (f.includes('Dockerfile') || f.includes('.do/')) tags.add('deploy')
        if (f.includes('__tests__')) tags.add('testing')
    }
    return [...tags].map(t => ({ tag: t }))
}

// ─── Ingest to Payload ───────────────────────────────────────────────────

async function ingestEntries(entries) {
    console.log(`\n⬆️ Ingesting ${entries.length} entries to BotKnowledge...`)

    let success = 0
    let skip = 0
    let fail = 0

    for (const entry of entries) {
        try {
            // Use Payload REST API
            const res = await fetch(`${APP_URL}/api/bot-knowledge`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    // Use internal API key or super-admin token
                    // For now, collection access allows create: () => true
                },
                body: JSON.stringify(entry),
            })

            if (res.ok) {
                success++
            } else {
                const text = await res.text()
                if (text.includes('duplicate') || text.includes('already exists')) {
                    skip++
                } else {
                    fail++
                    if (fail <= 3) console.error(`  ❌ ${entry.title}: ${text.substring(0, 100)}`)
                }
            }
        } catch (error) {
            fail++
            if (fail <= 3) console.error(`  ❌ ${entry.title}: ${error.message}`)
        }

        // Don't overwhelm the API
        await new Promise(r => setTimeout(r, 50))
    }

    console.log(`\n📊 Results: ✅ ${success} ingested | ⏭️ ${skip} skipped | ❌ ${fail} failed`)
}

// ─── Main ────────────────────────────────────────────────────────────────

async function main() {
    console.log('🧠 PrimeBot — Mining Git History')
    console.log('=================================')
    console.log(`Repo: ${GITHUB_REPO}`)
    console.log(`Target: ${APP_URL}`)

    const commitEntries = await mineCommits(100)
    const prEntries = await minePRs(50)

    const allEntries = [...prEntries, ...commitEntries] // PRs first (more important)
    console.log(`\n📦 Total entries: ${allEntries.length}`)

    await ingestEntries(allEntries)

    console.log('\n=================================')
    console.log('✅ History mining complete!')
    console.log('💡 Bot now knows the project history. Try asking:')
    console.log('   "Ai đã build feature deploy pipeline?"')
    console.log('   "PR nào gần đây nhất về AI?"')
    console.log('   "Tại sao lại refactor middleware?"')
}

main().catch(e => {
    console.error('Fatal:', e)
    process.exit(1)
})
