import type { PricingConfig, PricingPlan } from './config'

const MATRIX_VARIANTS = ['table', 'comparison'] as const
type MatrixVariant = typeof MATRIX_VARIANTS[number]

export const isMatrixVariant = (v?: string): v is MatrixVariant =>
    MATRIX_VARIANTS.includes(v as MatrixVariant)

const featureText = (f: PricingPlan['features'][number]): string =>
    typeof f === 'string' ? f : f.text

/**
 * Computes incremental data changes when switching pricing variants.
 * Preserves both shapes (featureMatrix + plan.features) in DB — only derives
 * missing data to avoid overwriting user edits.
 *
 * Rules:
 *  Standard → Matrix: auto-build featureMatrix from plan.features (only if empty)
 *  Matrix → Standard: auto-fill plan.features from featureMatrix (only if plan.features is empty)
 *  All other transitions: no-op (returns {})
 */
export function mapVariantData(
    prevBlock: PricingConfig,
    nextVariant: PricingConfig['variant'],
): Partial<PricingConfig> {
    const wasMatrix = isMatrixVariant(prevBlock.variant)
    const willBeMatrix = isMatrixVariant(nextVariant)

    if (wasMatrix === willBeMatrix) return {}

    const plans = prevBlock.plans ?? []

    if (!wasMatrix && willBeMatrix) {
        // Standard → Matrix: derive featureMatrix only when it's not already populated
        if ((prevBlock.featureMatrix ?? []).length > 0) return {}

        // Use insertion-order de-dup via Map to preserve feature ordering
        const seen = new Map<string, Map<number, boolean>>()
        plans.forEach((plan, planIdx) => {
            ;(plan.features ?? []).forEach(f => {
                const text = featureText(f)
                const entry = seen.get(text) ?? new Map<number, boolean>()
                entry.set(planIdx, typeof f !== 'string' ? (f.included !== false) : true)
                seen.set(text, entry)
            })
        })

        const featureMatrix = Array.from(seen.entries()).map(([text, byPlan]) => ({
            featureName: text,
            values: plans.map((_, i) => ({ included: byPlan.get(i) ?? false })),
        }))

        return { featureMatrix }
    }

    // Matrix → Standard: fill plan.features only for plans that currently have none
    const matrix = prevBlock.featureMatrix ?? []
    if (plans.every(p => (p.features ?? []).length > 0)) return {}
    const updatedPlans: PricingPlan[] = plans.map((plan, planIdx) => {
        if ((plan.features ?? []).length > 0) return plan
        const features = matrix
            .filter(row => row.values[planIdx]?.included)
            .map(row => ({ text: row.featureName, included: true as const }))
        return { ...plan, features }
    })

    return { plans: updatedPlans }
}
