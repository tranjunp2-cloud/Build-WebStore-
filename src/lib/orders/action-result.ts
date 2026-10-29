/**
 * What an order action answers: the HTTP status and JSON body its route sends. The routes and the
 * copilot share the order actions (cancel-order.ts, refund-order.ts, …); a route sends the result as
 * it is, the copilot reads `body.error.message` when `status` is not 2xx.
 */
export type ActionResult = { status: number; body: Record<string, any> }

export function respond(body: Record<string, any>, init?: { status?: number }): ActionResult {
    return { status: init?.status ?? 200, body }
}

export const succeeded = (result: ActionResult): boolean => result.status >= 200 && result.status < 300 && result.body.success !== false

/** The merchant-readable reason an action was refused (the route's own error message). */
export function failureOf(result: ActionResult): { code: string; message: string } {
    const error = result.body.error as { code?: unknown; message?: unknown } | undefined
    return {
        code: typeof error?.code === 'string' ? error.code : 'FAILED',
        message: typeof error?.message === 'string' ? error.message : 'The order could not be updated.',
    }
}
