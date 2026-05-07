import { sql } from 'drizzle-orm'
import type { Payload } from 'payload'

// Fire-and-forget helper — called after getOrCreateCrateCartonIdAction deletes+recreates
// a stale crate-carton placeholder. Fixes products.images[] rows still pointing at oldId.
// Raw SQL because Payload v3 nested array-relationship where queries are unreliable.
export async function repairStaleProductImageRefs(
    payload: Payload,
    oldId: number,
    newId: number,
): Promise<void> {
    if (oldId === newId) return
    try {
        await payload.db.drizzle.execute(
            sql`UPDATE products_images SET image_id = ${newId} WHERE image_id = ${oldId}`,
        )
    } catch (err) {
        console.warn('[repairStaleProductImageRefs] Failed to update stale refs:', err)
    }
}
