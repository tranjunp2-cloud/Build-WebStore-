#!/usr/bin/env tsx
/**
 * Locale Coverage Report — F26-06
 * Audits which blocks have EN + BM content authored in the content registry.
 *
 * Run: npx tsx scripts/locale-coverage-report.ts
 * Output: console matrix + plans/reports/locale-coverage-YYMMDD.md
 */
import fs from 'fs'
import path from 'path'
import { getLocaleCoverage } from '../src/lib/ai/add-section-content'

// ── Pipeline block lists (from add-section.ts) ──────────────────────────────

/** Blocks that call resolveBlockContent → locale-aware, needsTranslation supported */
const PIPELINE_LOCALE_AWARE: string[] = [
    'about', 'accordion',
    'banner',       // falls through to 'cta' case → resolveBlockContent('cta', ...) (add-section.ts:325)
    'contact', 'cta', 'faq', 'features',
    'gallery', 'hero', 'newsletter', 'pricing',
    'products',
    'products-grid', // locale-aware via 'products' content key (add-section.ts:678)
    'service-cards', 'stats', 'team', 'testimonials',
]

/** Blocks with hardcoded EN text in add-section.ts — candidates for F26-04 AI translate */
const PIPELINE_HARDCODED_EN: string[] = [
    'announcement-bar', 'before-after', 'blog-list', 'booking-widget',
    'breadcrumb', 'carousel', 'class-schedule', 'client-logos',
    'countdown-timer', 'download-cta', 'feature-comparison', 'gallery-masonry',
    'logo-cloud', 'menu-food', 'portfolio-grid', 'pricing-table',
    'product-quick-view', 'products-featured', 'property-card',
    'review-cards', 'social-proof', 'step-process', 'video', 'video-background',
]

/** Widget/structural blocks — no meaningful text to localize */
const PIPELINE_NO_TEXT: string[] = [
    // NOTE: assumes package.json has no "type":"module" (CJS context for __dirname below)
    'cartWidget', 'custom-html', 'divider', 'doctor-profile',
    'google-maps', 'socialWidget', 'whatsapp-button',
]

// ── Run audit ────────────────────────────────────────────────────────────────

function pad(str: string, len: number): string {
    return str.padEnd(len, ' ')
}

function statusEmoji(v: boolean): string {
    return v ? '✅' : '❌'
}

function main(): void {
    const coverage = getLocaleCoverage()
    const registeredBlocks = Object.keys(coverage).sort()

    const lines: string[] = []
    const push = (line: string): void => { lines.push(line); console.log(line) }

    push('# Locale Coverage Report — F26-06')
    push(`Generated: ${new Date().toISOString()}`)
    push('')
    push('## Section 1: Content Registry (resolveBlockContent)')
    push('')
    push(`| Block                  | EN | BM | Status        |`)
    push(`|------------------------|----|----|---------------|`)

    let totalEn = 0; let totalMs = 0

    for (const block of registeredBlocks) {
        const { en, ms } = coverage[block]
        if (en) totalEn++
        if (ms) totalMs++
        const status = en && ms ? 'Full coverage' : en ? 'BM missing' : 'EN missing'
        push(`| ${pad(block, 22)} | ${statusEmoji(en)} | ${statusEmoji(ms)} | ${pad(status, 13)} |`)
    }

    push('')
    push(`**Registered total:** ${registeredBlocks.length} blocks | EN: ${totalEn}/${registeredBlocks.length} | BM: ${totalMs}/${registeredBlocks.length}`)

    push('')
    push('## Section 2: Pipeline Blocks — Hardcoded EN (→ F26-04 AI Translate)')
    push('')
    push(`| Block                  | Notes                           |`)
    push(`|------------------------|---------------------------------|`)

    for (const block of PIPELINE_HARDCODED_EN.sort()) {
        push(`| ${pad(block, 22)} | Hardcoded EN, needsTranslation via F26-04 |`)
    }

    push('')
    push(`**Count:** ${PIPELINE_HARDCODED_EN.length} blocks — handled by US-F26-04 AI translate fallback`)

    push('')
    push('## Section 3: Widget / Structural Blocks (no text to localize)')
    push('')
    push(PIPELINE_NO_TEXT.sort().join(', '))

    push('')
    push('## Summary')
    push('')
    push(`| Category                      | Count |`)
    push(`|-------------------------------|-------|`)
    push(`| Locale-aware (full EN+BM)     | ${totalMs}/${registeredBlocks.length} ✅ |`)
    push(`| Hardcoded EN (→ F26-04)       | ${PIPELINE_HARDCODED_EN.length}     |`)
    push(`| Widget/structural (no text)   | ${PIPELINE_NO_TEXT.length}      |`)
    push(`| Total pipeline blocks         | ${PIPELINE_LOCALE_AWARE.length + PIPELINE_HARDCODED_EN.length + PIPELINE_NO_TEXT.length}     |`)
    push('')

    const hasBmGaps = registeredBlocks.some(b => !coverage[b].ms)
    if (hasBmGaps) {
        push('⚠️  BM gaps detected in registry — fill in ms.ts before marking F26-06 complete.')
    } else {
        push(`✅ All ${registeredBlocks.length} registered blocks have both EN + BM content. No gaps.`)
    }

    // ── Write report file ──────────────────────────────────────────────────
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const reportDir = path.resolve(__dirname, '../plans/reports')
    const reportPath = path.join(reportDir, `locale-coverage-${dateStr}.md`)

    fs.mkdirSync(reportDir, { recursive: true })
    fs.writeFileSync(reportPath, lines.join('\n') + '\n', 'utf8')

    console.log('')
    console.log(`📄 Report saved: ${reportPath}`)
}

main()
