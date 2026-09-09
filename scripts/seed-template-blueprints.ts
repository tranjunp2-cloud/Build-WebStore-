import { getPayload } from 'payload'
import config from '../src/payload.config'
import { computeBlockSchemaVersion } from '../src/lib/ai/block-schema-version'
import { composeFromBlueprint } from '../src/lib/ai/template-composer'
import { SPORTS_RETAIL_PRESETS } from '../src/lib/ai/template-presets-sports-retail'
import {
    buildRequiredSeedInventory,
    hasSeedInventoryFailure,
    isManagedSeedTemplate,
} from '../src/lib/templates/seed-inventory'

async function seedTemplateBlueprints(payload: Awaited<ReturnType<typeof getPayload>>) {
    const blockSchemaVersion = computeBlockSchemaVersion()
    const inventory = buildRequiredSeedInventory(SPORTS_RETAIL_PRESETS, composeFromBlueprint)
    const existingTemplates = await payload.find({
        collection: 'templates',
        pagination: false,
        overrideAccess: true,
        where: { name: { in: inventory.pairs.map(({ seed }) => seed.name) } },
    })
    const existingByName = new Map<string, typeof existingTemplates.docs>()
    for (const template of existingTemplates.docs) {
        const matches = existingByName.get(template.name) ?? []
        matches.push(template)
        existingByName.set(template.name, matches)
    }

    let created = 0
    let skipped = 0
    let failed = 0

    console.log(`[templates:seed] Seeding ${inventory.pairs.length} blueprint templates...`)

    for (const { preset, seed } of inventory.pairs) {
        const nameMatches = existingByName.get(seed.name) ?? []
        const existing = nameMatches.find((template) => (
            isManagedSeedTemplate(template.blockSchemaVersion)
        ))
        if (existing) {
            // Preserve operator edits, including publishing and premium settings.
            skipped += 1
            continue
        }

        if (nameMatches.length > 0) {
            failed += 1
            console.error(
                `[templates:seed] Refusing to overwrite unmanaged template named "${seed.name}"`,
            )
            continue
        }

        try {
            await payload.create({
                collection: 'templates',
                overrideAccess: true,
                data: {
                    name: seed.name,
                    description: seed.description,
                    category: [seed.category],
                    defaultTheme: seed.theme as Record<string, unknown>,
                    defaultBlocks: seed.pages[0]?.layout ?? [],
                    templatePages: seed.pages.map((page, index) => ({
                        title: page.title || (index === 0 ? 'Home' : `Page ${index + 1}`),
                        slug: page.slug || (index === 0 ? 'home' : `page-${index + 1}`),
                        isHomepage: index === 0,
                        layout: page.layout,
                    })),
                    tags: [seed.category, preset.personality, ...preset.tags].map((tag) => ({ tag })),
                    sortOrder: 0,
                    isPremium: seed.isPremium,
                    isFeatured: false,
                    blockSchemaVersion,
                },
            })
            created += 1
        } catch (error: unknown) {
            failed += 1
            console.error(`[templates:seed] Failed to create "${seed.name}":`, error)
        }
    }

    console.log(
        `[templates:seed] Complete: created=${created}, skipped=${skipped}, failed=${failed}, composerSkipped=${inventory.missingCount}`,
    )

    if (hasSeedInventoryFailure(failed, inventory.missingCount)) process.exitCode = 1
}

async function main() {
    const payload = await getPayload({ config })
    try {
        await seedTemplateBlueprints(payload)
    } finally {
        await payload.destroy()
    }
}

main().catch((error: unknown) => {
    console.error('[templates:seed] Failed:', error)
    process.exitCode = 1
})
