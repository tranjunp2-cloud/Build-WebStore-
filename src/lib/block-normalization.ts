/**
 * Block normalization utilities for persisting editor blocks to Payload CMS.
 *
 * Exported for unit testing. Used by the save route at:
 *   src/app/api/sites/[siteId]/save/route.ts
 */

import { normalizeSocialWidgetConfig } from '@/blocks/social-widget/config'
import { blockRegistry } from '@/blocks/registry'

/** Upload/media field names that must be integer IDs (not objects or URLs) */
export const UPLOAD_FIELDS = ['image', 'backgroundImage', 'logo', 'avatar', 'ogImage'] as const

/**
 * Coerce an invalid block `variant` value to the block's default variant.
 *
 * Context: AI gen / preset layer sometimes emits variant strings that are
 * not in the Payload block's select-options enum (e.g. `blog-list` with
 * variant `"editorial"` when only `cards`/`list` are valid). Payload then
 * rejects the save with "This field has an invalid selection" and the
 * editor shows a 500. Drop to the default so persistence proceeds.
 *
 * Returns the block unchanged if:
 *   - `blockType` is missing / not a registered block
 *   - `variant` is missing / empty / already valid
 */
export function sanitizeBlockVariant(block: Record<string, unknown>): Record<string, unknown> {
    const blockType = typeof block.blockType === 'string' ? block.blockType : null
    if (!blockType) return block
    const meta = blockRegistry.getBlockMeta(blockType)
    if (!meta) return block
    const current = block.variant
    if (typeof current !== 'string' || current === '') return block
    if (meta.variants.includes(current)) return block
    console.warn(
        `[Save] Block "${blockType}" variant "${current}" not in enum [${meta.variants.join(', ')}] — coercing to default "${meta.defaultVariant}"`
    )
    return { ...block, variant: meta.defaultVariant }
}

/**
 * Normalize a media/upload field value to an integer ID or null.
 *
 * Rules:
 *   - null/undefined           → null
 *   - integer number           → keep as-is
 *   - string of digits         → convert to Number
 *   - string URL               → null (can't save as media ref)
 *   - object with .id          → extract id
 *   - object without .id       → null
 */
export function normalizeUploadField(value: unknown): unknown {
    if (value == null) return null
    // Already an integer ID — keep
    if (typeof value === 'number') return value
    // String integer — convert
    if (typeof value === 'string' && /^\d+$/.test(value)) return Number(value)
    // String URL (e.g., from AI) — can't save as media ref
    if (typeof value === 'string') return null
    // Object with id — extract just the id
    if (typeof value === 'object' && 'id' in (value as Record<string, unknown>)) {
        return (value as Record<string, unknown>).id
    }
    // Object without id — can't save
    return null
}

/**
 * Strip `id`/`_id` from every object inside an array so Payload
 * auto-generates valid UUIDs for nested items.
 */
export function stripNestedIds(arr: unknown[]): unknown[] {
    return arr.map(item => {
        if (item && typeof item === 'object' && !Array.isArray(item)) {
            const obj = { ...(item as Record<string, unknown>) }
            delete obj.id
            delete obj._id
            // Recurse into nested arrays
            for (const [k, v] of Object.entries(obj)) {
                if (Array.isArray(v)) obj[k] = stripNestedIds(v)
            }
            return obj
        }
        return item
    })
}

/**
 * Normalize all blocks in a layout array before persisting to Payload.
 *
 * Performs the following transformations on each block:
 *   1. Strip block-level id/_id (Payload generates UUIDs for layout blocks)
 *   2. Strip id/_id from nested arrays (ctaButtons, items, plans, links, columns…)
 *   3. Normalize upload/media fields to integer IDs
 *   4. Normalize upload fields inside nested array items (e.g. testimonials.avatar)
 *   5. Coerce empty/undefined headline to ''
 *   6. Normalize socialWidget block config (default links, platform validation)
 *   7. Sanitize navigation link labels/URLs (fallback to 'Link' / '#')
 *   8. Sanitize footer column links (same fallback logic)
 */
export function normalizeBlocksForPersistence(blocks: Record<string, unknown>[]) {
    return blocks.map(block => {
        let b = { ...block }

        // Strip block-level id/_id — Payload auto-generates valid UUIDs for layout blocks
        delete b.id
        delete b._id

        // Strip ids from all nested arrays (ctaButtons, items, plans, links, columns, etc.)
        for (const [key, val] of Object.entries(b)) {
            if (Array.isArray(val)) {
                b[key] = stripNestedIds(val)
            }
        }

        // Normalize upload/media fields — ensure they're integer IDs, not objects
        for (const field of UPLOAD_FIELDS) {
            if (field in b) {
                b[field] = normalizeUploadField(b[field])
            }
        }

        // Also normalize upload fields inside nested arrays (testimonials.avatar, etc.)
        for (const [key, val] of Object.entries(b)) {
            if (Array.isArray(val)) {
                b[key] = (val as unknown[]).map((item: unknown) => {
                    if (item && typeof item === 'object') {
                        const obj = { ...item as Record<string, unknown> }
                        for (const field of UPLOAD_FIELDS) {
                            if (field in obj) {
                                obj[field] = normalizeUploadField(obj[field])
                            }
                        }
                        return obj
                    }
                    return item
                })
            }
        }

        // Ensure headline is never empty/undefined — Payload rejects empty required text fields
        if ('headline' in b && !b.headline) {
            b.headline = ''
        }

        if (b.blockType === 'socialWidget') {
            b = normalizeSocialWidgetConfig(b) as Record<string, unknown>
        }

        // Coerce invalid variants to defaults — Payload rejects with
        // "invalid selection" when variant doesn't match block enum.
        b = sanitizeBlockVariant(b)

        // Defensively sanitize navigation links (legacy drafts might lack 'label')
        if (b.blockType === 'navigation' && Array.isArray(b.links)) {
            b.links = b.links.map((linkRaw: unknown) => {
                const link = (typeof linkRaw === 'object' && linkRaw !== null) ? linkRaw as Record<string, unknown> : {}
                return {
                    ...link,
                    label: String(link.label || link.text || link.title || link.name || 'Link'),
                    url: String(link.url || link.href || link.link || '#')
                }
            })
        }

        // Defensively sanitize menu-food categories — AI may use 'title' instead of 'name'
        if (b.blockType === 'menu-food' && Array.isArray(b.categories)) {
            b.categories = (b.categories as Record<string, unknown>[]).map(cat => {
                if (!cat || typeof cat !== 'object') return cat
                const c = { ...cat }
                c.name = String(c.name || c.title || c.label || c.category || 'Category')
                if (Array.isArray(c.items)) {
                    c.items = (c.items as Record<string, unknown>[]).map(item => {
                        if (!item || typeof item !== 'object') return item
                        return {
                            ...item,
                            name: String((item as Record<string, unknown>).name || (item as Record<string, unknown>).title || (item as Record<string, unknown>).label || 'Item'),
                            price: String((item as Record<string, unknown>).price || '0'),
                        }
                    })
                }
                return c
            })
        }

        // Defensively sanitize footer links
        if (b.blockType === 'footer' && Array.isArray(b.columns)) {
            b.columns = b.columns.map((col: Record<string, unknown>) => {
                if (!col || typeof col !== 'object') return col
                return {
                    ...col,
                    links: Array.isArray(col.links) ? col.links.map((linkRaw: unknown) => {
                        const link = (typeof linkRaw === 'object' && linkRaw !== null) ? linkRaw as Record<string, unknown> : {}
                        return {
                            ...link,
                            label: String(link.label || link.text || link.title || link.name || 'Link'),
                            url: String(link.url || link.href || link.link || '#')
                        }
                    }) : col.links
                }
            })
        }

        return b
    })
}
