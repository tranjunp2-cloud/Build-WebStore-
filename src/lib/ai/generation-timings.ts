export type GenerationPhaseOutcome = 'success' | 'error'

export type GenerationPhaseTiming = {
    durationMs: number
    runs: number
    outcome: GenerationPhaseOutcome
}

export type GenerationTimingSnapshot = Record<string, GenerationPhaseTiming>

const REQUEST_ID_RE = /^[a-zA-Z0-9_-]{8,64}$/

export function percentile(values: number[], fraction: number): number | null {
    if (values.length === 0) return null
    const sorted = [...values].sort((a, b) => a - b)
    return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)]!
}

export function normalizeGenerationRequestId(value: string | null | undefined): string {
    const candidate = value?.trim()
    if (candidate && REQUEST_ID_RE.test(candidate)) return candidate
    return crypto.randomUUID()
}

/** Request-scoped wall-clock recorder. Phases may overlap; never sum them as total latency. */
export class GenerationTimings {
    readonly startedAt: number
    private readonly phases = new Map<string, GenerationPhaseTiming>()

    constructor(startedAt = Date.now()) {
        this.startedAt = startedAt
    }

    async track<T>(name: string, fn: () => Promise<T>): Promise<T> {
        const startedAt = Date.now()
        try {
            const value = await fn()
            this.record(name, Date.now() - startedAt, 'success')
            return value
        } catch (error) {
            this.record(name, Date.now() - startedAt, 'error')
            throw error
        }
    }

    record(name: string, durationMs: number, outcome: GenerationPhaseOutcome = 'success'): void {
        const previous = this.phases.get(name)
        this.phases.set(name, {
            durationMs: (previous?.durationMs ?? 0) + Math.max(0, Math.round(durationMs)),
            runs: (previous?.runs ?? 0) + 1,
            outcome: outcome === 'error' || previous?.outcome === 'error' ? 'error' : 'success',
        })
    }

    totalMs(now = Date.now()): number {
        return Math.max(0, now - this.startedAt)
    }

    snapshot(): GenerationTimingSnapshot {
        return Object.fromEntries(this.phases.entries())
    }

    compact(): string {
        return [...this.phases.entries()]
            .map(([name, timing]) => `${name}=${timing.durationMs}ms${timing.outcome === 'error' ? ':error' : ''}`)
            .join(' ')
    }
}
