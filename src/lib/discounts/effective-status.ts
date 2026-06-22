/**
 * Effective discount status — derives the real lifecycle state of a discount
 * from its persisted fields, WITHOUT mutating the DB `status` column.
 *
 * The admin `status` field is a manual active/inactive toggle. On its own it
 * cannot tell whether an "active" discount has already expired, not yet started,
 * or burned through its usage limit. This helper computes the same outcome the
 * checkout engine enforces at runtime so the admin badge never disagrees with
 * what a shopper actually experiences.
 *
 * Semantics MUST mirror `applyDiscount()` in apply-discount.ts (raw instant
 * comparison — NOT KL day boundaries): a code is rejected the moment
 * `now > expiresAt` / accepted the moment `now >= startsAt`. Keep the two in sync.
 *
 * Pure function — no I/O — fully unit-testable.
 */

export type EffectiveDiscountStatus = 'active' | 'inactive' | 'scheduled' | 'expired' | 'used-up'

export interface EffectiveStatusInput {
    status: string
    startsAt?: string | Date | null
    expiresAt?: string | Date | null
    usageLimit?: number | null
    usageCount?: number | null
}

/**
 * Display priority when several conditions hold at once:
 *   Inactive > Expired > Used up > Scheduled > Active
 *
 * (e.g. a code that is both expired AND at its usage limit shows "Expired".)
 */
export function computeEffectiveDiscountStatus(
    d: EffectiveStatusInput,
    now: Date = new Date(),
): EffectiveDiscountStatus {
    // Manual off switch wins over everything else.
    if (d.status !== 'active') return 'inactive'

    // Expired — raw instant, mirrors applyDiscount (`expires < now`).
    if (d.expiresAt != null) {
        const expires = new Date(d.expiresAt)
        if (!isNaN(expires.getTime()) && expires < now) return 'expired'
    }

    // Used up — usageLimit null/undefined means unlimited; mirrors `usageCount >= usageLimit`.
    if (d.usageLimit != null && (d.usageCount ?? 0) >= d.usageLimit) return 'used-up'

    // Scheduled — not yet started, mirrors applyDiscount (`starts > now`).
    if (d.startsAt != null) {
        const starts = new Date(d.startsAt)
        if (!isNaN(starts.getTime()) && starts > now) return 'scheduled'
    }

    return 'active'
}
