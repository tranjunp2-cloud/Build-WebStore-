/**
 * Preset validator — catches invalid block variants BEFORE harness:gen runs.
 *
 * Run standalone: npm run harness:validate
 * Also called at the start of harness:gen (cli.ts imports validateAllPresets).
 *
 * Rules enforced:
 *   1. Hero variant must be a known CMS value (not Wix-style name)
 *   2. Homepage hero must NOT use the default variant ('centered')
 *   3. Navigation variant must be a known CMS value
 */

import { heroMeta } from '../../src/blocks/hero/config'
import { navigationMeta } from '../../src/blocks/navigation/config'
import { TEMPLATE_PRESETS } from '../../src/lib/ai/template-definitions'
import type { TemplatePreset, BlockSpec, PageBlueprint } from '../../src/lib/ai/template-definitions'

const VALID_HERO_VARIANTS = new Set(heroMeta.variants)
const HERO_DEFAULT = heroMeta.defaultVariant
const VALID_NAV_VARIANTS = new Set(navigationMeta.variants)

type ValidationError = { presetId: string; page: string; blockType: string; rule: string; found: string }

function validatePage(preset: TemplatePreset, page: PageBlueprint, errors: ValidationError[]) {
    const isHome = page.isHomepage ?? page.slug === '/'
    for (const block of page.blocks) {
        if (block.blockType === 'hero' && block.variant != null) {
            if (!VALID_HERO_VARIANTS.has(block.variant)) {
                errors.push({
                    presetId: preset.id,
                    page: page.slug,
                    blockType: 'hero',
                    rule: 'invalid-variant',
                    found: block.variant,
                })
            } else if (isHome && block.variant === HERO_DEFAULT) {
                errors.push({
                    presetId: preset.id,
                    page: page.slug,
                    blockType: 'hero',
                    rule: 'homepage-default-variant',
                    found: block.variant,
                })
            }
        }
        if (block.blockType === 'navigation' && block.variant != null) {
            if (!VALID_NAV_VARIANTS.has(block.variant)) {
                errors.push({
                    presetId: preset.id,
                    page: page.slug,
                    blockType: 'navigation',
                    rule: 'invalid-variant',
                    found: block.variant,
                })
            }
        }
    }
}

export function validateAllPresets(presets: TemplatePreset[] = TEMPLATE_PRESETS): void {
    const errors: ValidationError[] = []
    for (const preset of presets) {
        for (const page of preset.pages) {
            validatePage(preset, page, errors)
        }
    }
    if (errors.length === 0) return

    const lines = errors.map((e) => {
        if (e.rule === 'invalid-variant') {
            return `  ${e.presetId} [${e.page}] ${e.blockType}: variant="${e.found}" not in CMS schema`
        }
        return `  ${e.presetId} [${e.page}] ${e.blockType}: variant="${e.found}" is the default — homepage hero needs a non-default variant`
    })
    throw new Error(`[validate-presets] ${errors.length} violation(s):\n${lines.join('\n')}`)
}

// ── CLI entry ────────────────────────────────────────────────────────────────
if (import.meta.url === new URL(process.argv[1]!, import.meta.url).href
    || process.argv[1]?.endsWith('validate-presets.ts')
    || process.argv[1]?.endsWith('validate-presets.js')) {
    try {
        validateAllPresets()
        console.log(`[validate-presets] ✓ all ${TEMPLATE_PRESETS.length} presets valid`)
    } catch (e) {
        console.error((e as Error).message)
        process.exit(1)
    }
}
