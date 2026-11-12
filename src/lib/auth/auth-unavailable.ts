import { NextResponse } from 'next/server'

/**
 * The session could not be checked (database down, pool exhausted, network): not the same as "not signed in".
 * getCurrentUser throws it so a DB incident answers 503 / shows a retry state instead of a 401 or a login redirect.
 */
export class AuthUnavailableError extends Error {
    readonly status = 503
    constructor(cause?: unknown) {
        super('The session could not be checked right now.', { cause })
        this.name = 'AuthUnavailableError'
    }
}

export function isAuthUnavailableError(error: unknown): error is AuthUnavailableError {
    return error instanceof AuthUnavailableError || (error instanceof Error && error.name === 'AuthUnavailableError')
}

/** Seconds a client should wait before retrying after a 503. */
export const AUTH_UNAVAILABLE_RETRY_AFTER_SECONDS = 5

/** The API answer for AuthUnavailableError: 503, retry in a few seconds, never cached. */
export function authUnavailableResponse(): NextResponse {
    return NextResponse.json(
        { error: 'Service busy, please retry' },
        {
            status: 503,
            headers: {
                'Retry-After': String(AUTH_UNAVAILABLE_RETRY_AFTER_SECONDS),
                'Cache-Control': 'no-store',
            },
        },
    )
}
