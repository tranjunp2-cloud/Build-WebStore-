export type MigrationFailure = { code: string; message: string; retryable: boolean }
export class MigrationError extends Error {
    constructor(public readonly code: string, message: string, public readonly retryable = false) { super(message); this.name = 'MigrationError' }
}
export function classifyMigrationError(error: unknown): MigrationFailure {
    if (error instanceof MigrationError) return { code: error.code, message: error.message, retryable: error.retryable }
    const e = error as { message?: string; code?: string; name?: string; cause?: unknown; status?: number }
    const message = e?.message || 'Unknown migration failure'
    const code = e?.code || ''
    if (e?.cause && e.cause !== error) {
        const cause = classifyMigrationError(e.cause)
        if (cause.retryable) return cause
    }
    const transient = ['ETIMEDOUT','ECONNRESET','ECONNREFUSED','EAI_AGAIN','UND_ERR_CONNECT_TIMEOUT','40001','40P01','53300','57P01'].includes(code)
        || e?.name === 'TimeoutError' || /timeout|timed out|HTTP (429|5\d\d)|rate.limit/i.test(message)
        || e?.status === 429 || (typeof e?.status === 'number' && e.status >= 500)
    return { code: code || (transient ? 'TRANSIENT' : 'VALIDATION_OR_PERMANENT'), message, retryable: transient }
}
export function retryDelayMs(attempt: number, random = Math.random()) {
    return Math.min(30_000, 1000 * 2 ** Math.max(0, attempt - 1)) + Math.floor(Math.max(0, Math.min(1, random)) * 500)
}
export function shouldRetry(failure: MigrationFailure, attempt: number, maxAttempts: number) {
    return failure.retryable && attempt < maxAttempts
}
