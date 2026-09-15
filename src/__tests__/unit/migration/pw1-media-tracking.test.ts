import { describe, expect, it } from 'vitest'
import { recordCreatedPw1Media, withPw1MediaTracking } from '@/lib/migration/pw1-media-tracking'

describe('[TC-F35.M36] Store-scoped upload tracking', () => {
    it('isolates async scopes and retains created IDs across retries', async () => {
        const first = new Set<number>(), second = new Set<number>()
        await Promise.all([
            withPw1MediaTracking(first, async () => { await Promise.resolve(); recordCreatedPw1Media(1) }),
            withPw1MediaTracking(second, async () => { recordCreatedPw1Media(2); await Promise.resolve(); recordCreatedPw1Media(3) }),
        ])
        await withPw1MediaTracking(first, async () => { recordCreatedPw1Media(4) })
        recordCreatedPw1Media(99)
        expect([...first]).toEqual([1,4])
        expect([...second]).toEqual([2,3])
    })
})
