import { after } from 'next/server'

/**
 * Run background work after the HTTP response is sent (Vercel keeps the function
 * alive for `after()` callbacks). Outside a request scope (scripts, tests) `after()`
 * throws, so the task runs immediately instead — same behaviour as before.
 *
 * The task must NOT use the request's `req` / transaction: it outlives the request.
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
