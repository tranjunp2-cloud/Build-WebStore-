import { describe, expect, it } from 'vitest'
import { validateMigrationBatch } from '@/lib/migration/pw1-batch-validation'
import { classifyMigrationError, MigrationError, retryDelayMs, shouldRetry } from '@/lib/migration/pw1-errors'
const fixture = (id: string) => ({ sourceUserId: id, sourceStoreId: id, owner: { email: `owner${id}@example.com`, firstName: 'Owner' }, source: { websiteUrl: 'https://shop.example' }, website: { name: 'Shop', locale: 'en', branding: { logoUrl: 'https://shop.example/logo.png' }, navigation: [], footer: { copyright: '', columns: [] }, pages: [{ sourceId: '1', title: 'Home', path: '/', components: [{ sourceId: '2', type: 'rich_text', content: { html: '<p>Source</p>' } }] }] } })
describe('[TC-F35.M28] Batch isolation', () => {
    it('keeps valid stores when another store is malformed', () => {
        const input = [fixture('1'), { ...fixture('2'), website: null }, fixture('3')]
        const parsed = validateMigrationBatch(input)
        expect(parsed.entries.map(e => e.sourceStoreId)).toEqual(['1','3'])
        expect(parsed.errors).toEqual([expect.objectContaining({ sourceStoreId: '2', stage: 'validation' })])
    })
    it('quarantines both duplicate entries even if one is malformed', () => {
        const parsed = validateMigrationBatch([fixture('1'), { ...fixture('1'), website: null }, fixture('2')])
        expect(parsed.entries.map(e => e.sourceStoreId)).toEqual(['2'])
        expect(parsed.errors).toHaveLength(2)
    })
    it('quarantines conflicting account identities without affecting unrelated stores', () => {
        const parsed = validateMigrationBatch([fixture('1'), { ...fixture('2'), sourceUserId: '1' }, fixture('3')])
        expect(parsed.entries.map(e => e.sourceStoreId)).toEqual(['3'])
        expect(parsed.errors).toHaveLength(2)
    })
    it('rejects corrupt top-level input', () => {
        expect(() => validateMigrationBatch({})).toThrow('nonempty JSON array')
        expect(() => validateMigrationBatch([])).toThrow('nonempty JSON array')
    })
})
describe('[TC-F35.M29] Bounded retries', () => {
    it.each(['HTTP 429','HTTP 503','operation timed out'])('retries %s only within the budget', message => {
        const failure = classifyMigrationError(new Error(message))
        expect(shouldRetry(failure, 1, 3)).toBe(true)
        expect(shouldRetry(failure, 3, 3)).toBe(false)
    })
    it('recognizes nested network causes and rejects permanent validation errors', () => {
        expect(classifyMigrationError(new Error('fetch failed', { cause: { code: 'ECONNRESET', message: 'reset' } })).retryable).toBe(true)
        expect(classifyMigrationError(new MigrationError('IDENTITY_CONFLICT', 'wrong owner')).retryable).toBe(false)
        expect(classifyMigrationError(new Error('Invalid block')).retryable).toBe(false)
    })
    it('bounds exponential waits and jitter', () => {
        expect(retryDelayMs(1, 0)).toBe(1000)
        expect(retryDelayMs(3, 0)).toBe(4000)
        expect(retryDelayMs(100, 1)).toBe(30500)
    })
})
