/** In-process bounded scheduler. Same-account stores never overlap; fatal errors drain active work. */
export async function runStorePool<T>(items: T[], concurrency: number, key: (item: T) => string, run: (item: T) => Promise<void>) {
    if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 5) throw new Error('concurrency must be 1–5')
    const waiting = [...items], active = new Set<Promise<void>>(), keys = new Set<string>()
    let failed = false, failure: unknown
    while (waiting.length || active.size) {
        while (!failed && active.size < concurrency) {
            const index = waiting.findIndex(item => !keys.has(key(item)))
            if (index < 0) break
            const [item] = waiting.splice(index, 1), account = key(item)
            keys.add(account)
            const task = Promise.resolve().then(() => run(item)).catch(error => { if (!failed) { failed = true; failure = error } }).finally(() => { active.delete(task); keys.delete(account) })
            active.add(task)
        }
        if (!active.size) break
        await Promise.race(active)
    }
    if (failed) throw failure
}

/** FIFO mutex used for short database writes and generation-start budget reservations. */
export class MigrationMutex {
    private tail: Promise<void> = Promise.resolve()
    async acquire(): Promise<() => void> {
        const previous = this.tail
        let release!: () => void
        this.tail = new Promise<void>(resolve => { release = resolve })
        await previous
        return release
    }
    async run<T>(operation: () => Promise<T>): Promise<T> {
        const release = await this.acquire()
        try { return await operation() } finally { release() }
    }
}
