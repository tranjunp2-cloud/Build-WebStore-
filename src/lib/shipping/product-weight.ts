/**
 * Product weight → parcel grams (GH-1458 unit decision, 2026-07-06).
 *
 * Products.weight's canonical unit is KG (form label, AI estimation prompts, seed data).
 * The shipping pipeline works in integer GRAMS internally (orders.parcelWeight column,
 * aggregateWeightKg input, EP quote weight) — this is the single conversion point.
 * Unset/zero weight falls back to a 500 g per-item estimate.
 */

export const DEFAULT_ITEM_WEIGHT_GRAMS = 500

/** Convert a Products.weight value (kg) to integer grams; 500 g default when unset/0/invalid. */
export function productWeightToGrams(weightKg: number | null | undefined): number {
    return typeof weightKg === 'number' && Number.isFinite(weightKg) && weightKg > 0
        ? Math.round(weightKg * 1000)
        : DEFAULT_ITEM_WEIGHT_GRAMS
}
