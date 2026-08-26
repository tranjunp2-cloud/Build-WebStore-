import { endOfDayKL } from './date-boundaries'

/**
 * Why a discount can't be saved as Active right now (form-side guard, GH-1282).
 *
 * Operates on the RAW form inputs (date-only `expiresAt` string), so it must replicate how the
 * value is persisted: the Discounts `beforeValidate` hook pins `expiresAt` to END OF DAY KL
 * (23:59:59.999 Asia/Kuala_Lumpur). A code dated "2026-06-22" is therefore valid THROUGH the end of
 * that KL day — comparing with `new Date()` (midnight UTC) would wrongly expire it ~16h early and
 * contradict the list badge, which reads the already-pinned stored value. Hence `endOfDayKL` here.
 *
 * Pure function — `now` injected — fully unit-testable.
 *
 * @param input.expiresAt   date-only string from the form ("YYYY-MM-DD") or null
 * @param input.usageLimit  numeric limit (null/NaN = unlimited)
 * @param input.usageCount  persisted redemption count
 */
export function discountActivationBlocks(
    input: { expiresAt?: string | null; usageLimit?: number | null; usageCount?: number | null },
    now: Date = new Date(),
): { expired: boolean; atLimit: boolean } {
    const expired = !!input.expiresAt && endOfDayKL(input.expiresAt).getTime() < now.getTime()
    const atLimit =
        input.usageLimit != null && !Number.isNaN(input.usageLimit) && (input.usageCount ?? 0) >= input.usageLimit
    return { expired, atLimit }
}
