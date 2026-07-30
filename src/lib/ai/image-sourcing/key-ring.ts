export type Clock = () => number

interface KeyState {
    disabled: boolean
    cooldownUntil: number
    consecutiveServerErrors: number
}

export interface SelectedPixabayKey {
    key: string
    index: number
}

export function parsePixabayKeys(listValue?: string, legacyValue?: string): string[] {
    const unique = (listValue ?? '')
        .split(',')
        .map((key) => key.trim())
        .filter((key) => key.length >= 10)
        .filter((key, index, all) => all.indexOf(key) === index)
    if (unique.length > 0) return unique
    const legacy = legacyValue?.trim()
    return legacy && legacy.length >= 10 ? [legacy] : []
}

export class PixabayKeyRing {
    private readonly keys: string[]
    private readonly states: KeyState[]
    private cursor = 0

    constructor(keys: readonly string[], private readonly clock: Clock = Date.now) {
        this.keys = [...keys]
        this.states = keys.map(() => ({
            disabled: false,
            cooldownUntil: 0,
            consecutiveServerErrors: 0,
        }))
    }

    static fromEnvironment(
        environment: NodeJS.ProcessEnv = process.env,
        clock: Clock = Date.now,
    ): PixabayKeyRing {
        return new PixabayKeyRing(
            parsePixabayKeys(environment.PIXABAY_API_KEYS, environment.PIXABAY_API_KEY),
            clock,
        )
    }

    select(): SelectedPixabayKey | null {
        if (this.keys.length === 0) return null
        const now = this.clock()
        for (let offset = 0; offset < this.keys.length; offset += 1) {
            const index = (this.cursor + offset) % this.keys.length
            const state = this.states[index]!
            if (state.disabled || now < state.cooldownUntil) continue
            this.cursor = (index + 1) % this.keys.length
            return { key: this.keys[index]!, index }
        }
        return null
    }

    recordResponse(index: number, status: number, rateLimitReset?: string | null): void {
        const state = this.states[index]
        if (!state) return
        if (status === 401 || status === 403) {
            state.disabled = true
            state.consecutiveServerErrors = 0
            return
        }
        if (status === 429) {
            const parsed = Number.parseInt(rateLimitReset ?? '', 10)
            const seconds = Number.isFinite(parsed) && parsed > 0 ? parsed : 60
            state.cooldownUntil = this.clock() + seconds * 1000
            state.consecutiveServerErrors = 0
            return
        }
        if (status >= 500) {
            state.consecutiveServerErrors += 1
            if (state.consecutiveServerErrors >= 3) {
                state.cooldownUntil = this.clock() + 60_000
                state.consecutiveServerErrors = 0
            }
            return
        }
        state.consecutiveServerErrors = 0
    }

    getSafeState(index: number): Readonly<KeyState> | null {
        const state = this.states[index]
        return state ? { ...state } : null
    }
}

let processKeyRing: { signature: string; ring: PixabayKeyRing } | null = null

export function getProcessPixabayKeyRing(
    environment: NodeJS.ProcessEnv = process.env,
    clock: Clock = Date.now,
): PixabayKeyRing {
    const keys = parsePixabayKeys(environment.PIXABAY_API_KEYS, environment.PIXABAY_API_KEY)
    const signature = JSON.stringify(keys)
    if (!processKeyRing || processKeyRing.signature !== signature) {
        processKeyRing = {
            signature,
            ring: new PixabayKeyRing(keys, clock),
        }
    }
    return processKeyRing.ring
}

export function resetProcessPixabayKeyRingForTests(): void {
    processKeyRing = null
}
