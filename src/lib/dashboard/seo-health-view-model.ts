import type { SeoHealthBucketViewModel } from './dashboard-types'

export const SEO_HEALTH_GOOD_THRESHOLD = 80

/**
 * Normalizes raw bucket progress at the UI boundary and owns the sole
 * qualitative-status threshold used by the F37-04 card.
 */
export function createSeoHealthBucketViewModel(progress: number): SeoHealthBucketViewModel {
    const normalizedProgress = Number.isFinite(progress)
        ? Math.min(100, Math.max(0, progress))
        : 0

    return {
        progress: normalizedProgress,
        status: normalizedProgress >= SEO_HEALTH_GOOD_THRESHOLD ? 'good' : 'needsWork',
    }
}
