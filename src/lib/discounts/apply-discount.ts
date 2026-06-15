/**
 * Pure discount pricing engine — no I/O, fully unit-testable.
 *
 * All amounts in sen (integer). Used by:
 *   - POST /api/storefront/discounts/apply  (preview, advisory)
 *   - POST /api/orders/checkout             (authoritative, Phase 4)
 *   - POST /api/orders/stripe-checkout      (authoritative, Phase 4)
 *
 * The storefront preview is advisory only. Phase 4 re-runs this engine
 * server-side at order creation — client-sent discount amounts are never trusted.
 */

export type DiscountRow = {
    id: string | number
    code: string
    type: 'percentage' | 'fixed'
    value: number
    status: string
    usageLimit: number | null | undefined
    usageCount: number
    startsAt: string | Date | null | undefined
    expiresAt: string | Date | null | undefined
    tenant: string | number | { id: string | number }
}

export type ApplyResult =
    | { ok: true; discountSen: number; discount: { id: string | number; code: string; type: string; value: number } }
    | { ok: false; reason: 'not-found' | 'wrong-tenant' | 'inactive' | 'not-started' | 'expired' | 'at-limit' }

/**
 * Validate and compute discount amount.
 *
 * @param row     Discount record from DB, or null if code not found.
 * @param ctx     { subtotalSen: integer sen, tenantId: string|number, now: Date }
 */
export function applyDiscount(
    row: DiscountRow | null,
    ctx: { subtotalSen: number; tenantId: string | number; now: Date },
    opts?: { skipUsageLimit?: boolean },
): ApplyResult {
    const { subtotalSen, tenantId, now } = ctx

    if (!row) return { ok: false, reason: 'not-found' }

    // Tenant isolation — normalise both sides to string for comparison
    const rowTenantId = typeof row.tenant === 'object' ? String((row.tenant as any).id) : String(row.tenant)
    if (rowTenantId !== String(tenantId)) return { ok: false, reason: 'wrong-tenant' }

    if (row.status !== 'active') return { ok: false, reason: 'inactive' }

    if (row.startsAt != null) {
        const starts = new Date(row.startsAt as string)
        if (!isNaN(starts.getTime()) && starts > now) return { ok: false, reason: 'not-started' }
    }

    if (row.expiresAt != null) {
        const expires = new Date(row.expiresAt as string)
        if (!isNaN(expires.getTime()) && expires < now) return { ok: false, reason: 'expired' }
    }

    // skipUsageLimit: the caller already holds a reserved slot for this order (e.g. retry-payment, where
    // the slot was reserved at placement). Re-checking the limit here would count the order's OWN
    // reservation and falsely drop the discount — so a 1-slot code could never be retried. Authoritative
    // capacity is still enforced atomically at reserve time in recordDiscountRedemption().
    if (!opts?.skipUsageLimit && row.usageLimit != null && row.usageCount >= row.usageLimit) {
        return { ok: false, reason: 'at-limit' }
    }

    // Compute discount in sen
    let discountSen: number
    if (row.type === 'percentage') {
        discountSen = Math.round((subtotalSen * row.value) / 100)
    } else {
        // fixed: value is already in sen per spec
        discountSen = Math.round(row.value)
    }

    // Clamp: discount cannot exceed subtotal (total never goes negative)
    discountSen = Math.min(discountSen, subtotalSen)
    discountSen = Math.max(0, discountSen)

    return {
        ok: true,
        discountSen,
        discount: { id: row.id, code: row.code, type: row.type, value: row.value },
    }
}
