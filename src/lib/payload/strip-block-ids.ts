/**
 * Recursively drop `id` and `_uuid` from every row of an array of Payload
 * block/array items (including nested arrays inside each item).
 *
 * Why:
 *
 * Payload's live block tables (`pages_blocks_*`) use varchar PK
 * `id DEFAULT gen_random_uuid()`. When we pass a `layout` array back to
 * `payload.update()` with each block's existing `id` baked in, Drizzle
 * `upsertRow` INSERTs that exact value into the live PK column
 * (`node_modules/@payloadcms/drizzle/dist/transform/write/blocks.js` —
 * the `id → _uuid` rename only fires for versioned tables where
 * `disableUnique` is true). Pre-insert, `blocksToDelete` only clears rows
 * under the current page's `_parent_id`, so a block UUID that exists under
 * a DIFFERENT page's `_parent_id` — common when AI generate-site seeds
 * multiple pages with colliding block UUIDs — triggers PG error 23505,
 * which Payload wraps as
 *     ValidationError{ path: 'id', message: 'Value must be unique' }.
 *
 * Stripping `id` / `_uuid` lets the column defaults regenerate fresh UUIDs.
 * Pattern matches upstream Payload PR #11887 (copyToLocale).
 *
 * Scope: intended for `data.layout` (and any recursive nested arrays
 * inside blocks). Don't hand this a top-level document — it removes `id`
 * unconditionally.
 */
export function stripArrayItemIds(items: unknown): unknown {
    if (!Array.isArray(items)) return items
    return items.map((item) => {
        if (!item || typeof item !== 'object') return item
        const cleaned: Record<string, unknown> = {}
        for (const [k, v] of Object.entries(item as Record<string, unknown>)) {
            if (k === 'id' || k === '_uuid') continue
            cleaned[k] = Array.isArray(v) ? stripArrayItemIds(v) : v
        }
        return cleaned
    })
}
