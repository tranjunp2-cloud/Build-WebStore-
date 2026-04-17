import { composeTemplate } from '../src/lib/ai/template-composer'
import { TEMPLATE_DEFINITIONS } from '../src/lib/ai/template-definitions'
import pg from 'pg'

async function main() {
    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URI })
    const seeds = TEMPLATE_DEFINITIONS.map(d => composeTemplate(d))
    let created = 0
    let failed = 0

    for (const seed of seeds) {
        try {
            const theme = seed.theme as Record<string, string>
            const cat = `{${seed.category}}`
            const res = await pool.query(
                `INSERT INTO templates (name, description, category, default_theme_primary_color, default_theme_secondary_color, default_theme_font_heading, default_theme_font_body, default_theme_color_mode, default_blocks, sort_order, is_premium, is_featured, usage_count, updated_at, created_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 0, $10, false, 0, now(), now())
                 RETURNING id`,
                [
                    seed.name, seed.description || '', cat,
                    theme.primaryColor || '#0ea5e9', theme.secondaryColor || '#d946ef',
                    theme.fontHeading || 'Outfit', theme.fontBody || 'Inter',
                    theme.colorMode || 'light',
                    JSON.stringify(seed.pages[0]?.layout || []),
                    seed.isPremium || false,
                ],
            )
            const templateId = res.rows[0].id

            // Insert template pages
            for (let i = 0; i < seed.pages.length; i++) {
                const page = seed.pages[i]
                await pool.query(
                    `INSERT INTO templates_template_pages (id, _order, _parent_id, _uuid, title, slug, is_homepage, layout)
                     VALUES (gen_random_uuid()::text, $1, $2, gen_random_uuid()::text, $3, $4, $5, $6)`,
                    [i, templateId, page.title || 'Home', page.slug || 'home', i === 0, JSON.stringify(page.layout || [])],
                )
            }
            created++
        } catch (err: unknown) {
            failed++
            const msg = err instanceof Error ? err.message.slice(0, 100) : 'unknown'
            console.error('Failed:', seed.name, msg)
        }
    }

    console.log(`Done: ${created} created, ${failed} failed, total: ${seeds.length}`)
    await pool.end()
}

main()
