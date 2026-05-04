#!/usr/bin/env node
/**
 * AI Issue Estimate — Auto-estimate effort + set Project Board fields
 *
 * Triggered by issue-lifecycle.yml when issue labeled with size:*
 * Sets: Estimate (hours), Start Date, End Date on Project Board
 *
 * Logic: size label base hours + AC count adjustment + complexity multipliers
 */
const { execSync } = require('child_process')
const fs = require('fs')

// ── Config ──────────────────────────────────────────────────────────
const PROJECT_NUMBER = process.env.PROJECT_NUMBER
const ESTIMATE_FIELD_ID = 'PVTF_lADOAchabM4BRnjNzhBTBVs'
const START_DATE_FIELD_ID = 'PVTF_lADOAchabM4BRnjNzhBRX7c'
const END_DATE_FIELD_ID = 'PVTF_lADOAchabM4BRnjNzhBRYHk'

// Base hours per size (AI-first estimate with CC+gstack)
const SIZE_MAP = {
    'size:S':  { base: 0.5, acThreshold: 2 },
    'size:M':  { base: 1.5, acThreshold: 3 },
    'size:L':  { base: 3,   acThreshold: 4 },
    'size:XL': { base: 6,   acThreshold: 5 },
}

// Complexity keywords → multiplier
const COMPLEXITY = [
    { keywords: ['database', 'migration', 'schema', 'db-setup', 'prisma'], multiplier: 1.3 },
    { keywords: ['security', 'auth', 'payment', 'stripe', 'jwt'], multiplier: 1.5 },
    { keywords: ['i18n', 'localization', 'locale', 'translation'], multiplier: 1.2 },
    { keywords: ['api', 'endpoint', 'route'], multiplier: 1.1 },
    { keywords: ['mobile', 'responsive', '375px'], multiplier: 1.1 },
]

// ── Helpers ──────────────────────────────────────────────────────────
function countACs(body) {
    if (!body) return 0
    // Count checkbox items (- [ ] or - [x]) + numbered AC patterns (AC-N:)
    const checkboxes = (body.match(/^[\s]*[-*]\s*\[[ x]\]/gm) || []).length
    const acPatterns = (body.match(/AC-?\d+/gi) || []).length
    return Math.max(checkboxes, acPatterns)
}

function detectComplexity(body, labels) {
    if (!body && !labels) return []
    const text = `${body || ''} ${(labels || []).join(' ')}`.toLowerCase()
    return COMPLEXITY.filter(c => c.keywords.some(k => text.includes(k)))
}

function addBusinessDays(startDate, days) {
    const date = new Date(startDate)
    let remaining = Math.ceil(days)
    while (remaining > 0) {
        date.setDate(date.getDate() + 1)
        const day = date.getDay()
        if (day !== 0 && day !== 6) remaining-- // skip weekends
    }
    return date.toISOString().split('T')[0]
}

function gh(args) {
    try {
        return execSync(`gh ${args}`, { encoding: 'utf8', timeout: 30000 }).trim()
    } catch (e) {
        console.error(`gh command failed: ${args}`, e.message)
        return null
    }
}

// ── Main ────────────────────────────────────────────────────────────
function main() {
    // Read event payload
    const eventPath = process.env.GITHUB_EVENT_PATH
    if (!eventPath) {
        console.log('No GITHUB_EVENT_PATH — running locally?')
        return
    }

    const event = JSON.parse(fs.readFileSync(eventPath, 'utf8'))
    const issue = event.issue
    if (!issue) {
        console.log('No issue in event payload')
        return
    }

    const labels = (issue.labels || []).map(l => l.name)
    const sizeLabel = labels.find(l => l.startsWith('size:'))
    if (!sizeLabel || !SIZE_MAP[sizeLabel]) {
        console.log(`No valid size label found. Labels: ${labels.join(', ')}`)
        return
    }

    const isBug = labels.some(l => l === 'bug')
    const { base, acThreshold } = SIZE_MAP[sizeLabel]
    const acCount = countACs(issue.body)
    const complexity = detectComplexity(issue.body, labels)

    // Calculate estimate
    let hours = base + Math.max(0, acCount - acThreshold) * 0.25
    for (const c of complexity) {
        hours *= c.multiplier
    }
    if (isBug) hours *= 0.7 // bugs typically smaller
    hours = Math.round(hours * 2) / 2 // round to 0.5h

    const days = Math.ceil(hours / 4) // 4 productive hours/day
    const today = new Date().toISOString().split('T')[0]
    const endDate = addBusinessDays(today, days)

    console.log(`Issue #${issue.number}: ${issue.title}`)
    console.log(`  Size: ${sizeLabel}, ACs: ${acCount}, Bug: ${isBug}`)
    console.log(`  Complexity: ${complexity.map(c => c.keywords[0]).join(', ') || 'none'}`)
    console.log(`  Estimate: ${hours}h (${days} days)`)
    console.log(`  Dates: ${today} → ${endDate}`)

    if (!PROJECT_NUMBER) {
        console.log('PROJECT_NUMBER not set — skipping board update')
        return
    }

    // Find item ID on project board
    const itemQuery = gh(`project item-list ${PROJECT_NUMBER} --owner primeproduction --limit 300 --format json`)
    if (!itemQuery) return

    const items = JSON.parse(itemQuery).items || []
    const item = items.find(i => i.title === issue.title || i.id?.includes(String(issue.number)))

    if (!item) {
        console.log(`Issue #${issue.number} not found on project board — may need to be added first`)
        return
    }

    const projectId = 'PVT_kwDOAchabM4BRnjN'

    // Set Estimate field
    gh(`project item-edit --project-id ${projectId} --id ${item.id} --field-id ${ESTIMATE_FIELD_ID} --number ${hours}`)
    console.log(`  ✅ Set Estimate: ${hours}h`)

    // Set Start Date
    gh(`project item-edit --project-id ${projectId} --id ${item.id} --field-id ${START_DATE_FIELD_ID} --date ${today}`)
    console.log(`  ✅ Set Start Date: ${today}`)

    // Set End Date
    gh(`project item-edit --project-id ${projectId} --id ${item.id} --field-id ${END_DATE_FIELD_ID} --date ${endDate}`)
    console.log(`  ✅ Set End Date: ${endDate}`)
}

main()
