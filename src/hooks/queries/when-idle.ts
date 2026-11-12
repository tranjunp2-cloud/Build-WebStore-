/**
 * Run `task` when the browser is idle (or after `timeout` ms at the latest); returns a cancel function for effects.
 * Falls back to a short timer where requestIdleCallback is missing (Safari).
 */
export function whenIdle(task: () => void, timeout = 2000): () => void {
    if (typeof window === 'undefined') return () => {}
    if (typeof window.requestIdleCallback === 'function') {
        const handle = window.requestIdleCallback(() => task(), { timeout })
        return () => window.cancelIdleCallback(handle)
    }
    const timer = setTimeout(task, 200)
    return () => clearTimeout(timer)
}
