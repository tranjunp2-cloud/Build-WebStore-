/**
 * Smoke test for the fallback composer path (phase-06 step-06).
 * Runs composeFallbackResult() across 5 representative categories and asserts
 * signature blocks are present for each. Lightweight replacement for manual E2E
 * in dev/CI — real browser verification still recommended on staging.
 *
 * Usage: pnpm exec tsx scripts/ai/smoke-fallback.ts
 */

import { composeFallbackResult } from '../../src/lib/ai/fallback-adapter'

type Expectation = {
    label: string
    prompt: string
    seed: number
    extractedName?: string
    signatureBlocks: string[]
}

// NOTE: menu-display, booking-widget, portfolio-grid, gallery, before-after,
// review-cards are all dropped via unsupported-blocks.ts filter (no media pipeline /
// missing from Payload schema). Signature expectations below reflect what survives.
const SCENARIOS: Expectation[] = [
    {
        label: 'restaurant',
        prompt: 'Ristorante Bella Vista, family Italian in District 1, pasta and pizza',
        seed: 42,
        extractedName: 'Ristorante Bella Vista',
        signatureBlocks: ['hero', 'features', 'testimonials', 'faq'],
    },
    {
        label: 'health',
        prompt: 'Saigon Dental Clinic with 10 years experience, implant specialist',
        seed: 7,
        extractedName: 'Saigon Dental Clinic',
        signatureBlocks: ['doctor-profile', 'faq', 'features'],
    },
    {
        label: 'fitness',
        prompt: 'CrossFit Box 247, 24-hour access, women-only classes',
        seed: 11,
        extractedName: 'CrossFit Box 247',
        signatureBlocks: ['features', 'class-schedule', 'stats'],
    },
    {
        label: 'tech',
        prompt: 'TaskFlow SaaS for solo founders, $19 per month',
        seed: 3,
        extractedName: 'TaskFlow',
        signatureBlocks: ['pricing', 'features', 'faq'],
    },
    {
        label: 'creative',
        prompt: 'Minh Nguyen, wedding photographer in Hanoi portfolio',
        seed: 5,
        extractedName: 'Minh Nguyen Studio',
        signatureBlocks: ['video-showcase', 'features', 'testimonials'],
    },
]

function assert(cond: boolean, msg: string): void {
    if (!cond) {
        console.error(`  ❌ ${msg}`)
        process.exitCode = 1
    } else {
        console.log(`  ✅ ${msg}`)
    }
}

async function main() {
    console.log('🔬 Phase-06 smoke test — composeFallbackResult x 5 categories\n')

    for (const scenario of SCENARIOS) {
        console.log(`── ${scenario.label} ──`)
        try {
            const result = composeFallbackResult(
                scenario.prompt,
                scenario.seed,
                'en',
                scenario.extractedName,
            )

            const blockTypes = new Set(result.blocks.map((b) => b.blockType as string))
            console.log(`  siteName: ${result.siteName}`)
            console.log(`  blocks (${result.blocks.length}): ${[...blockTypes].join(', ')}`)
            console.log(`  theme: ${result.theme.fontHeading} / ${result.theme.fontBody} / ${result.theme.primaryColor}`)

            assert(result.siteName === scenario.extractedName, `siteName === "${scenario.extractedName}"`)
            assert(result.blocks.length >= 5, `blocks.length >= 5 (got ${result.blocks.length})`)
            assert(result.theme.fontHeading.length > 0, 'fontHeading resolved')
            assert(result.theme.fontBody.length > 0, 'fontBody resolved')

            // Signature check: at least 1 of the expected signature blocks must be present.
            const hit = scenario.signatureBlocks.some((sig) => blockTypes.has(sig))
            assert(hit, `has ≥1 signature block from [${scenario.signatureBlocks.join(', ')}]`)

            // Name propagation: stringify and search
            const blocksJson = JSON.stringify(result.blocks)
            assert(blocksJson.includes(scenario.extractedName!), `extractedName "${scenario.extractedName}" appears in blocks`)
        } catch (err) {
            console.error(`  ❌ threw: ${(err as Error).message}`)
            process.exitCode = 1
        }
        console.log('')
    }

    if (process.exitCode === 1) {
        console.error('❌ smoke test FAILED')
        process.exit(1)
    } else {
        console.log('✅ smoke test PASSED')
    }
}

main().catch((err) => {
    console.error(err)
    process.exit(1)
})
