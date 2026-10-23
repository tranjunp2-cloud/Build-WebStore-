import { after } from 'next/server'

/**
 * Run background work after the HTTP response is sent (Vercel keeps the function
 * alive for `after()` callbacks). Outside a request scope (scripts, tests) `after()`
 * throws, so the task runs immediately instead — same behaviour as before.
 *
 * The task must NOT use the request's `req` / transaction: it outlives the request.
 *
 * Caveat (scripts only): with no request scope the task starts immediately, so when
 * called from a Payload hook it runs while that hook's transaction is still open —
 * a signal may fire before commit and push work shares the pool with the open
 * transaction. Bulk scripts should pass `context.skipPush` (see notifyTenantOwners).
 */
export function runAfterResponse(label: string, task: () => Promise<unknown>): void {
    const run = () =>
        task().catch((err) => console.error(`[${label}] background task failed`, err))
    try {
        after(run)
    } catch {
        void run()
    }
}
