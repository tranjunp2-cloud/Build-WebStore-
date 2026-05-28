import type { Payload } from 'payload'
import { sql } from 'drizzle-orm'

export type DecrementResult =
  | { ok: true; productId: string; decremented: number }
  | { ok: false; productId: string; reason: 'insufficient_stock' | 'product_not_found' | 'variant_not_found' | 'null_inventory' | 'write_failed'; available?: number }

export type RestockResult = {
  productId: string
  restocked: number
  skipped?: boolean
  reason?: 'product_not_found' | 'variant_not_found' | 'null_inventory' | 'write_failed'
}

/**
 * Atomically decrement per-variant stock via SQL CAS on products_variants table.
 * Concurrent-safe: exactly N successful decrements possible from stock=N (no oversell).
 * Recomputes products.inventory as SUM(variants.stock) after successful decrement —
 * required because Payload's beforeChange hook does not fire on raw SQL writes.
 * Returns reason: 'product_not_found' | 'variant_not_found' | 'insufficient_stock' | 'write_failed' on failure.
 */
export async function decrementVariantStock(
  payload: Payload,
  productId: string | number,
  variantName: string,
  quantity: number,
): Promise<DecrementResult> {
  const idStr = String(productId)
  const trimmedVariant = variantName.trim()
  const db = (payload.db.drizzle as any)

  // Guard: negative qty inverts SQL (stock - (-1) = stock + 1). NaN/Infinity also rejected.
  if (!Number.isFinite(quantity) || quantity < 0) {
    console.warn('[Decrement] Invalid quantity — must be >= 0', { productId: idStr, quantity })
    return { ok: false, productId: idStr, reason: 'write_failed' }
  }
  if (quantity === 0) {
    return { ok: true, productId: idStr, decremented: 0 }
  }

  try {
    // Verify product exists before CAS
    const productCheck = await db.execute(sql`
      SELECT id FROM products WHERE id = ${productId} LIMIT 1
    `)
    if (!productCheck.rows?.length) {
      return { ok: false, productId: idStr, reason: 'product_not_found' }
    }

    // Atomic CAS: decrement only if sufficient stock
    const result = await db.execute(sql`
      UPDATE products_variants
      SET stock = stock - ${quantity}
      WHERE _parent_id = ${productId}
        AND name = ${trimmedVariant}
        AND stock IS NOT NULL
        AND stock >= ${quantity}
      RETURNING id
    `)

    if (!result.rows?.length) {
      // Distinguish variant_not_found vs insufficient_stock
      const check = await db.execute(sql`
        SELECT stock FROM products_variants
        WHERE _parent_id = ${productId} AND name = ${trimmedVariant}
        LIMIT 1
      `)
      if (!check.rows?.length) {
        return { ok: false, productId: idStr, reason: 'variant_not_found' }
      }
      if (check.rows[0].stock === null) {
        // NULL stock = stock tracking disabled for this variant, not missing variant
        return { ok: false, productId: idStr, reason: 'null_inventory' }
      }
      return {
        ok: false,
        productId: idStr,
        reason: 'insufficient_stock',
        available: Number(check.rows[0].stock) || 0,
      }
    }

    // Recompute products.inventory = SUM(products_variants.stock) — bypassed by raw SQL.
    // Isolated: CAS already committed — recompute failure must not undo the ok:true result.
    try {
      await db.execute(sql`
        UPDATE products
        SET inventory = (
          SELECT COALESCE(SUM(stock), 0) FROM products_variants WHERE _parent_id = ${productId}
        )
        WHERE id = ${productId}
      `)
    } catch (recomputeErr) {
      console.warn(`[Decrement] Inventory recompute failed (non-critical, CAS committed):`, recomputeErr)
    }

    return { ok: true, productId: idStr, decremented: quantity }
  } catch (err) {
    console.warn(`[Decrement] SQL CAS failed for product ${idStr}:`, err)
    return { ok: false, productId: idStr, reason: 'write_failed' }
  }
}

/**
 * Restock a single order line. Variant path uses atomic SQL UPDATE on products_variants.
 * Non-variant path uses atomic SQL increment on products.inventory.
 * products.inventory aggregate recomputed via SUM after variant writes.
 *
 * NOTE (pre-#1082 order transition): Orders created before this fix never had
 * products_variants.stock decremented (checkout deferred per-variant decrement).
 * Calling restockItem for those pre-fix variant orders phantom-increments per-variant stock.
 * Requires a one-time migration to reconcile affected orders before deploying this fix
 * to any environment that already has production variant orders.
 */
export async function restockItem(
  payload: Payload,
  productId: string | number,
  variantName: string | null | undefined,
  quantity: number,
): Promise<RestockResult> {
  const idStr = String(productId)
  const db = (payload.db.drizzle as any)
  const trimmedVariant = typeof variantName === 'string' ? variantName.trim() : variantName

  // Guard: negative qty inverts SQL (stock + (-1) = stock - 1). NaN/Infinity also rejected.
  if (!Number.isFinite(quantity) || quantity < 0) {
    console.warn('[Restock] Invalid quantity — must be >= 0', { productId: idStr, quantity })
    return { productId: idStr, restocked: 0, skipped: true, reason: 'write_failed' }
  }
  if (quantity === 0) {
    return { productId: idStr, restocked: 0, skipped: true }
  }

  try {
    // Verify product exists + get has_variants flag
    const productCheck = await db.execute(sql`
      SELECT id, has_variants FROM products WHERE id = ${productId} LIMIT 1
    `)
    if (!productCheck.rows?.length) {
      return { productId: idStr, restocked: 0, skipped: true, reason: 'product_not_found' }
    }

    const hasVariants = Boolean(productCheck.rows[0].has_variants)

    if (hasVariants) {
      if (!trimmedVariant) {
        // Variant product but order line has no variant snapshot — data corruption
        console.warn('[Restock] Variant product but order line has no variant name', { productId: idStr, quantity })
        return { productId: idStr, restocked: 0, skipped: true, reason: 'variant_not_found' }
      }

      const result = await db.execute(sql`
        UPDATE products_variants
        SET stock = stock + ${quantity}
        WHERE _parent_id = ${productId} AND name = ${trimmedVariant} AND stock IS NOT NULL
        RETURNING id
      `)

      if (!result.rows?.length) {
        // Discriminate variant_not_found vs null_inventory (tracking disabled).
        // Mirror of decrementVariantStock pattern — keeps reason semantics consistent.
        const check = await db.execute(sql`
          SELECT stock FROM products_variants
          WHERE _parent_id = ${productId} AND name = ${trimmedVariant}
          LIMIT 1
        `)
        if (!check.rows?.length) {
          console.warn('[Restock] Variant name not found in product', { productId: idStr, variantName: trimmedVariant })
          return { productId: idStr, restocked: 0, skipped: true, reason: 'variant_not_found' }
        }
        if (check.rows[0].stock === null) {
          // NULL stock = per-variant tracking disabled; skip silently (not a data-integrity error).
          console.warn('[Restock] Variant has NULL stock — tracking disabled, skipped', { productId: idStr, variantName: trimmedVariant })
          return { productId: idStr, restocked: 0, skipped: true, reason: 'null_inventory' }
        }
        // Variant exists with non-NULL stock but UPDATE still missed — defensive fallback.
        console.warn('[Restock] Variant UPDATE returned 0 rows despite non-NULL stock', { productId: idStr, variantName: trimmedVariant })
        return { productId: idStr, restocked: 0, skipped: true, reason: 'write_failed' }
      }

      // Recompute products.inventory aggregate — isolated: restock committed, failure must not mask it.
      try {
        await db.execute(sql`
          UPDATE products
          SET inventory = (
            SELECT COALESCE(SUM(stock), 0) FROM products_variants WHERE _parent_id = ${productId}
          )
          WHERE id = ${productId}
        `)
      } catch (recomputeErr) {
        console.warn(`[Restock] Inventory recompute failed (non-critical, restock committed):`, recomputeErr)
      }

      return { productId: idStr, restocked: quantity }
    }

    // Non-variant: atomic SQL increment avoids read-modify-write race
    const result = await db.execute(sql`
      UPDATE products SET inventory = inventory + ${quantity}
      WHERE id = ${productId} AND inventory IS NOT NULL
      RETURNING id
    `)
    if (!result.rows?.length) {
      // Product exists (pre-checked above) but inventory IS NULL — tracking disabled, skip safely
      console.warn('[Restock] Non-variant product has NULL inventory — skipped', { productId: idStr })
      return { productId: idStr, restocked: 0, skipped: true, reason: 'null_inventory' }
    }
    return { productId: idStr, restocked: quantity }
  } catch (err) {
    console.warn(`[Restock] SQL failed for product ${idStr}:`, err)
    return { productId: idStr, restocked: 0, skipped: true, reason: 'write_failed' }
  }
}
