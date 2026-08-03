export class PixabayAttemptBudget {
    readonly limit: number
    private used = 0

    constructor(limit = 5) {
        if (!Number.isSafeInteger(limit) || limit < 0) {
            throw new RangeError('Pixabay attempt limit must be a non-negative safe integer')
        }
        this.limit = limit
    }

    get attemptsUsed(): number {
        return this.used
    }

    get remaining(): number {
        return this.limit - this.used
    }

    reservePrimary(laterUnresolvedReservoirs: number): boolean {
        const reservedForLater = Math.max(0, Math.trunc(laterUnresolvedReservoirs))
        if (this.remaining <= reservedForLater) return false
        this.used += 1
        return true
    }

    reserveFailover(): boolean {
        if (this.used >= this.limit) return false
        this.used += 1
        return true
    }
}
