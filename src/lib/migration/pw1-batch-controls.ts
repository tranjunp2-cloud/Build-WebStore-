import { MigrationError } from './pw1-errors'

export type BatchLimits = {
    maxGenerationAttempts?: number
    maxBatchSeconds?: number
    maxStoreSeconds?: number
    minGenerationIntervalSeconds?: number
    maxDesignTokens?: number
}

export function validateBatchLimits(limits: BatchLimits): BatchLimits {
    for (const [key, value] of Object.entries(limits)) {
        if (value !== undefined && (!Number.isSafeInteger(value) || value < 1 || value > (key.endsWith('Seconds') ? 86400 : 2_000_000_000))) {
            throw new Error(`${key} must be a positive integer (seconds: at most 86400; other limits: at most 2000000000)`)
        }
    }
    return limits
}

/** Budgets are checked at safe boundaries. Never race an unresolved persistence promise. */
export class BatchControls {
    readonly startedAt: number
    generationAttempts = 0
    designTokens = 0
    private lastGenerationAt: number | undefined
    constructor(readonly limits: BatchLimits, private readonly now = Date.now) {
        validateBatchLimits(limits)
        this.startedAt = now()
    }
    checkTime(storeStartedAt?: number) {
        if (this.limits.maxBatchSeconds && this.now() - this.startedAt >= this.limits.maxBatchSeconds * 1000) {
            throw new MigrationError('BATCH_TIME_LIMIT', 'Batch time budget reached; retry unprocessed stores')
        }
        if (storeStartedAt !== undefined && this.limits.maxStoreSeconds && this.now() - storeStartedAt >= this.limits.maxStoreSeconds * 1000) {
            throw new MigrationError('STORE_TIME_LIMIT', 'Store time budget reached; retry this store separately')
        }
    }
    checkGenerationBudget() {
        this.checkTime()
        if (this.limits.maxGenerationAttempts && this.generationAttempts >= this.limits.maxGenerationAttempts) {
            throw new MigrationError('GENERATION_LIMIT', 'Batch generation attempt budget reached')
        }
        if (this.limits.maxDesignTokens && this.designTokens >= this.limits.maxDesignTokens) {
            throw new MigrationError('DESIGN_TOKEN_LIMIT', 'Observed native-design token budget reached')
        }
    }
    waitMs(storeStartedAt?: number) {
        const spacing = this.lastGenerationAt === undefined ? 0 : Math.max(0, this.lastGenerationAt + (this.limits.minGenerationIntervalSeconds ?? 0) * 1000 - this.now())
        const batchRemaining = this.limits.maxBatchSeconds ? Math.max(0, this.startedAt + this.limits.maxBatchSeconds * 1000 - this.now()) : Infinity
        const storeRemaining = storeStartedAt !== undefined && this.limits.maxStoreSeconds ? Math.max(0, storeStartedAt + this.limits.maxStoreSeconds * 1000 - this.now()) : Infinity
        return Math.min(spacing, batchRemaining, storeRemaining)
    }
    beginGeneration() {
        this.checkGenerationBudget()
        this.generationAttempts++
        this.lastGenerationAt = this.now()
    }
    recordDesignTokens(tokens: number) {
        if (Number.isSafeInteger(tokens) && tokens >= 0) this.designTokens += tokens
    }
}
