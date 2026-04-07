/**
 * Test apply-template by simulating the sanitization + Payload create directly.
 * No HTTP server needed — uses Payload Local API.
 */
import pg from 'pg'
import { readFileSync } from 'fs'

const envContent = readFileSync('.env.local', 'utf-8')
const DB_URI = envContent.match(/DATABASE_URI=(.*)/)?.[1]?.trim()
const pool = new pg.Pool({ connectionString: DB_URI })

// Get template with pages
const { rows: templates } = await pool.query('SELECT id, name FROM templates LIMIT 1')
const tplId = templates[0].id
console.log(`Template: ${templates[0].name} (id: ${tplId})`)

const { rows: pages } = await pool.query(
    'SELECT title, slug, layout FROM templates_template_pages WHERE _parent_id = $1 ORDER BY _order',
    [tplId]
)

// Same sanitization logic as apply-template/route.ts
const PAGES_BLOCK_WHITELIST = new Set([
    'navigation', 'hero', 'about', 'features', 'testimonials',
    'contact', 'gallery', 'footer', 'stats', 'pricing',
    'faq', 'team', 'socialWidget', 'cartWidget',
])

const PAGES_SCHEMA = {
    hero:         { field: 'variant', values: ['centered', 'split-left', 'split-right', 'fullscreen', 'video'], fallback: 'centered' },
    navigation:   { field: 'style',   values: ['fixed', 'sticky', 'static', 'transparent'], fallback: 'fixed' },
    about:        { field: 'layout',  values: ['image-right', 'image-left', 'centered', 'cards'], fallback: 'image-right' },
    features:     { field: 'layout',  values: ['grid-3', 'grid-2', 'alternating', 'centered-list'], fallback: 'grid-3' },
    testimonials: { field: 'variant', values: ['carousel', 'grid', 'masonry', 'single'], fallback: 'carousel' },
    gallery:      { field: 'layout',  values: ['masonry', 'grid', 'carousel', 'lightbox'], fallback: 'masonry' },
    socialWidget: { field: 'variant', values: ['floating', 'inline'], fallback: 'floating' },
    cartWidget:   { field: 'variant', values: ['floating', 'inline'], fallback: 'floating' },
}

const ALIASES = {
    hero: { 'split': 'split-left', 'split-image': 'split-left', 'editorial': 'centered', 'fullscreen-image': 'fullscreen', 'fullscreen-video': 'video', 'video-background': 'video', 'video-bg': 'video', 'overlay': 'fullscreen', 'story': 'split-left', 'magazine': 'split-left', 'minimal': 'centered', 'cards-overlay': 'fullscreen', 'gradient': 'centered', 'parallax': 'fullscreen', 'slideshow': 'centered', 'split-video': 'video' },
    about: { 'simple': 'centered', 'split': 'image-right', 'story': 'image-right', 'single-column': 'centered', 'two-column': 'image-right', 'timeline': 'image-right' },
    features: { 'grid': 'grid-3', 'list': 'centered-list', 'icon-grid': 'grid-3', 'card-grid': 'grid-3', 'cards': 'grid-3', 'detailed': 'centered-list', 'detailed-list': 'centered-list', 'icon-top': 'grid-3', 'icon-left': 'grid-2', 'zigzag': 'alternating', 'carousel': 'grid-3', 'minimal-list': 'centered-list' },
    testimonials: { 'cards': 'grid', 'simple': 'carousel', 'spotlight': 'single', 'minimal-quote': 'single', 'avatar-row': 'carousel', 'video-text': 'carousel', 'featured': 'single', 'marquee': 'carousel', 'quote': 'single', 'single-highlight': 'single', 'slider': 'carousel' },
    gallery: { 'filmstrip': 'carousel', 'justified': 'grid', 'fullscreen-grid': 'grid', 'slider': 'carousel', 'spotlight': 'lightbox' },
    navigation: { 'simple': 'fixed', 'centered': 'fixed', 'mega-menu': 'fixed', 'sidebar': 'fixed', 'pill': 'fixed' },
}

const PAGES_FIELDS = {
    hero: ['variant', 'headline', 'subheadline', 'image', 'backgroundImage', 'videoUrl'],
    navigation: ['style', 'logo', 'logoText', 'links', 'ctaButton'],
    about: ['layout', 'sectionLabel', 'headline', 'body', 'image', 'stats'],
    features: ['sectionLabel', 'headline', 'subheadline', 'layout', 'features'],
    testimonials: ['headline', 'variant', 'testimonials'],
    gallery: ['headline', 'layout', 'images'],
    contact: ['headline', 'subtext', 'email', 'phone', 'address', 'showMap', 'mapEmbedUrl'],
    footer: ['logoText', 'logo', 'tagline', 'columns', 'copyrightText', 'showSocialLinks'],
    stats: ['headline', 'stats'],
    pricing: ['headline', 'subheadline', 'plans'],
    faq: ['headline', 'faqs'],
    team: ['headline', 'members'],
    socialWidget: ['variant', 'headline', 'links'],
    cartWidget: ['variant', 'label', 'showLabel'],
}

function sanitizeBlocks(blockList) {
    return blockList
        .filter(b => PAGES_BLOCK_WHITELIST.has(b.blockType))
        .map(block => {
            const bt = block.blockType
            const schema = PAGES_SCHEMA[bt]
            const allowedFields = PAGES_FIELDS[bt] || []
            const result = { blockType: bt }

            for (const field of allowedFields) {
                if (block[field] !== undefined) result[field] = block[field]
            }

            if (schema) {
                const raw = block.variant ?? block.layout
                const aliased = raw && ALIASES[bt]?.[raw] ? ALIASES[bt][raw] : raw
                const resolved = aliased && schema.values.includes(aliased) ? aliased : schema.fallback
                delete result.variant
                delete result.layout
                result[schema.field] = resolved
            } else {
                delete result.variant
                delete result.layout
            }

            return result
        })
}

// Test each page
let totalBlocks = 0, keptBlocks = 0, issues = []

for (const page of pages) {
    const blocks = page.layout || []
    const sanitized = sanitizeBlocks(blocks)
    totalBlocks += blocks.length
    keptBlocks += sanitized.length

    console.log(`\n=== ${page.title} ===`)
    console.log(`  Original: ${blocks.length} blocks → Sanitized: ${sanitized.length} blocks (dropped: ${blocks.length - sanitized.length})`)

    for (const [i, s] of sanitized.entries()) {
        const schemaField = PAGES_SCHEMA[s.blockType]?.field
        const value = schemaField ? s[schemaField] : '(no variant)'
        console.log(`  ${i}: ${s.blockType} → ${schemaField || 'n/a'}=${value}`)

        // Verify value is valid
        if (schemaField && PAGES_SCHEMA[s.blockType]) {
            if (!PAGES_SCHEMA[s.blockType].values.includes(s[schemaField])) {
                issues.push(`${page.title} block ${i}: ${s.blockType}.${schemaField} = ${s[schemaField]} NOT IN ${PAGES_SCHEMA[s.blockType].values}`)
            }
        }
    }
}

console.log(`\n════════════════════════════════`)
console.log(`Total: ${totalBlocks} → ${keptBlocks} kept (${totalBlocks - keptBlocks} dropped)`)
if (issues.length) {
    console.log(`❌ ${issues.length} ISSUES:`)
    issues.forEach(i => console.log(`  - ${i}`))
} else {
    console.log(`✅ ALL BLOCKS VALID — no schema violations`)
}

await pool.end()
