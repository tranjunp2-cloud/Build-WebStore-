import type { RateOption } from './easyparcel/types'

/**
 * COD eligibility — single source of truth for the R1/R2/R3 rules (PD-021, follow-EP model).
 *
 * EasyParcel enforces COD limits only in its Portal UI; the API accepts anything
 * (verified sandbox 2026-07-03, docs/plans/reports/260703-ep-cod-proof/brief.md).
 * Our code must therefore self-enforce, per-route, LIVE from the quotation response:
 *   R1: codAmount ≤ courier max_cod_amount
 *   R2: codAmount ≥ courier min_cod_amount
 *   R3: courier cod.available === true
 *   R4: NO hardcoded region block — eligibility is emergent from cod.available per route
 *   R5: COD fee = max(4%, RM7 flat) — informational only, never blocks
 *
 * Pure function — framework-agnostic, safe in both server and client code.
 */

export type CodIneligibleReason = 'no_cod_courier' | 'over_max' | 'under_min'

export interface CodEligibilityResult {
    /** Rates that satisfy R1+R2+R3 for this COD amount (empty when ineligible). */
    eligible: RateOption[]
    /** Why nothing qualified — only set when `eligible` is empty. */
    reason?: CodIneligibleReason
}

/**
 * Evaluate which of the quoted rates can carry this COD amount.
 * `codAmountSen` ≤ 0 means "not a COD order" — every rate passes untouched.
 *
 * Reason resolution when nothing qualifies: no COD-capable courier at all →
 * 'no_cod_courier' (R3); otherwise 'over_max' if any COD-capable courier failed
 * its max (R1), else 'under_min' (R2).
 */
export function evaluateCodEligibility(rates: RateOption[], codAmountSen: number): CodEligibilityResult {
    if (codAmountSen <= 0) return { eligible: rates }

    const codCapable = rates.filter((r) => r.codAvailable === true)
    if (codCapable.length === 0) return { eligible: [], reason: 'no_cod_courier' }

    const eligible = codCapable.filter(
        (r) =>
            (r.codMaxSen == null || codAmountSen <= r.codMaxSen) &&
            (r.codMinSen == null || codAmountSen >= r.codMinSen),
    )
    if (eligible.length > 0) return { eligible }

    const anyOverMax = codCapable.some((r) => r.codMaxSen != null && codAmountSen > r.codMaxSen)
    return { eligible: [], reason: anyOverMax ? 'over_max' : 'under_min' }
}
