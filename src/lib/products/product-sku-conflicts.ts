import { sql } from 'drizzle-orm'
import type { getPayload } from 'payload'

// NOTE: This check is best-effort, fast-path UX — two limitations apply:
//   1. NOT concurrent-safe on its own: two parallel saves with the same SKU can both pass this
//      SELECT before either INSERT commits (TOCTOU). The DB-level unique index
//      `products_sku_tenant_uniq` (per tenant, case-insensitive, scripts/db-setup.js F08-1032)
//      is the authoritative backstop for the base `sku` — see `translateDbSkuConflict` below,
//      which converts that constraint's rejection into the same FIELD_ERRORS shape thrown here,
//      so callers (incl. BulkCreateModal's SKU-retry loop) handle both layers identically.
//      Cross-product variant-sku uniqueness has NO DB-level backstop (only same-product variant
//      SKUs are DB-enforced, via `products_variants_sku_parent_uniq`) — remains app-check-only.
//   2. The candidate query compares `lower(sku)` exactly. It deliberately does not use
//      Payload's `like` operator: `_` and `%` are valid SKU characters but SQL wildcards.


// Converts a DB-level unique-constraint rejection (the rare TOCTOU race that slips past
// findConflictingSkus's non-atomic pre-check) into the same `{code:'FIELD_ERRORS', fieldErrors}`
// JSON shape findConflictingSkus already throws, so every caller — including
// BulkCreateModal.handleSave's SKU-retry loop — handles both layers identically.
//
// IMPORTANT — verified against the actual installed @payloadcms/drizzle source
// (node_modules/@payloadcms/drizzle/dist/upsertRow/handleUpsertError.js): Payload's adapter
// intercepts EVERY raw Postgres 23505 before it ever reaches this catch block and rethrows its
// own `ValidationError`. It can only resolve a friendly field name for constraints Payload itself
// created via a field's `unique:true` (looked up in `adapter.fieldConstraints`), or via a
// `Key (col)=(val)` regex on the raw driver error's `.detail` text — which BREAKS on our
// multi-column expression index `(tenant_id, lower(sku))` because `lower(sku)` embeds its own
// nested `)`, desyncing the regex. Both resolution paths fail for our raw-SQL
// `products_sku_tenant_uniq` / `products_variants_sku_parent_uniq` indexes (neither is a
// Payload-native unique field), so what reaches us here is a generic
// `ValidationError({ data: { collection: 'products', errors: [{ message: 'Value must be unique',
// path: null }] } })` — no constraint name, no field name, no original pg `.code`/`.message`.
// We CANNOT reliably tell a base-sku collision apart from a same-product variant-sku collision
// from this shape (both collapse to the same generic entry) — see TC-F08-04-50b. We treat any
// UNRESOLVED ("Value must be unique" with `path == null`) violation on `products` as a base-sku
// conflict (the far more common trigger for this action's callers). Checking `path == null` (Payload
// couldn't resolve a field name) rather than excluding `path === 'slug'` by name is deliberate: it's
// self-maintaining if another Payload-native `unique:true` field is ever added to Products later —
// Payload WOULD resolve that field's name via its own fieldConstraints map, so it's naturally
// excluded without this function needing to know that field's name in advance.
export function translateDbSkuConflict(err: unknown, data: Record<string, unknown>): Error {
    const anyErr = err as { name?: string; data?: { collection?: string; errors?: Array<{ message?: string; path?: string | null }> } } | null | undefined
    const errors = anyErr?.data?.errors ?? []
    const isUnresolvedUniqueViolation =
        anyErr?.name === 'ValidationError' &&
        anyErr?.data?.collection === 'products' &&
        errors.some(e => e?.message === 'Value must be unique' && e?.path == null)
    if (!isUnresolvedUniqueViolation) return err instanceof Error ? err : new Error(String(err))

    const skuValue = typeof data.sku === 'string' ? data.sku : ''
    return new Error(JSON.stringify({
        code: 'FIELD_ERRORS',
        fieldErrors: { baseSku: { code: 'SKU_ALREADY_IN_USE', values: [skuValue] } },
        message: `SKU already in use: ${skuValue}`,
    }))
}

export async function findConflictingSkus(
    payload: Awaited<ReturnType<typeof getPayload>>,
    skus: string[],
    tenantId: string | number | null,
    excludeId?: number
): Promise<string[]> {
    if (skus.length === 0) return []
    const submittedSkuByNormalized = new Map(skus.map(sku => [sku.toLowerCase(), sku]))
    const normalizedSkus = Array.from(submittedSkuByNormalized.keys())
    const skuValues = sql.join(normalizedSkus.map(sku => sql`${sku}`), sql`, `)
    // A null tenant means the caller is allowed to see all tenants; otherwise, scope both
    // base and variant SKU checks to the product's tenant.
    const tenantFilter = tenantId != null ? sql`AND p.tenant_id = ${tenantId}` : sql``
    const excludeFilter = excludeId !== undefined ? sql`AND p.id <> ${excludeId}` : sql``

    // `DISTINCT lower(...)` bounds the result to the submitted SKU set, rather than to every
    // product that happens to substring-match it. Values are parameterized, so `%` and `_`
    // remain literal, valid SKU characters.
    const result = await payload.db.drizzle.execute(sql`
        SELECT DISTINCT lower(conflicting_skus.sku) AS sku
        FROM (
            SELECT p.sku
            FROM products p
            WHERE p.deleted_at IS NULL
              AND p.sku IS NOT NULL
              ${tenantFilter}
              ${excludeFilter}
              AND lower(p.sku) IN (${skuValues})

            UNION ALL

            SELECT v.sku
            FROM products p
            INNER JOIN products_variants v ON v._parent_id = p.id
            WHERE p.deleted_at IS NULL
              AND v.sku IS NOT NULL
              ${tenantFilter}
              ${excludeFilter}
              AND lower(v.sku) IN (${skuValues})
        ) AS conflicting_skus
    `) as { rows: Array<{ sku: string | null }> }

    return result.rows.flatMap(row => {
        if (typeof row.sku !== 'string') return []
        return [submittedSkuByNormalized.get(row.sku) ?? row.sku]
    })
}
