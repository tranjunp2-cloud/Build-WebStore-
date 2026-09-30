import { describe, expect, it } from 'vitest'
import { MigrationMutex, runStorePool } from '@/lib/migration/pw1-concurrency'

function barrier() { let resolve!: () => void; const promise = new Promise<void>(r => { resolve = r }); return { promise, resolve } }
describe('[TC-F35.M37] Bounded in-process preparation', () => {
    it('overlaps different accounts, bounds active jobs and serializes one account', async () => {
        const started: number[] = [], release = barrier(), bothStarted = barrier()
        let active = 0, maximum = 0
        const runningAccounts = new Set<string>()
        const work = runStorePool([{ id: 1, user: 'a' }, { id: 2, user: 'a' }, { id: 3, user: 'b' }], 2, i => i.user, async item => {
            expect(runningAccounts.has(item.user)).toBe(false)
            runningAccounts.add(item.user); started.push(item.id); maximum = Math.max(maximum, ++active)
            if (started.length === 2) bothStarted.resolve()
            await release.promise
            active--; runningAccounts.delete(item.user)
        })
        await bothStarted.promise
        expect(started).toEqual([1,3])
        release.resolve(); await work
        expect(maximum).toBe(2)
        expect(started).toEqual([1,3,2])
    })
    it('drains active jobs before surfacing a fatal error and starts no remaining jobs', async () => {
        const release = barrier(), failed = barrier(), started: number[] = []
        let secondFinished = false
        const work = runStorePool([1,2,3], 2, String, async id => {
            started.push(id)
            if (id === 1) { failed.resolve(); throw new Error('fatal') }
            await release.promise; secondFinished = true
        })
        await failed.promise
        release.resolve()
        await expect(work).rejects.toThrow('fatal')
        expect(secondFinished).toBe(true)
        expect(started).toEqual([1,2])
    })
    it('serializes critical sections and releases after errors', async () => {
        const mutex = new MigrationMutex(), trace: string[] = [], release = barrier(), started = barrier()
        const first = mutex.run(async () => { trace.push('first'); started.resolve(); await release.promise; throw new Error('write failed') })
        const observed = expect(first).rejects.toThrow('write failed')
        const second = mutex.run(async () => { trace.push('second') })
        await started.promise
        expect(trace).toEqual(['first'])
        release.resolve(); await observed; await second
        expect(trace).toEqual(['first','second'])
    })
    it('rejects unsafe concurrency', async () => {
        await expect(runStorePool([], 0, String, async () => undefined)).rejects.toThrow('concurrency')
        await expect(runStorePool([], 10, String, async () => undefined)).rejects.toThrow('concurrency')
    })
})
