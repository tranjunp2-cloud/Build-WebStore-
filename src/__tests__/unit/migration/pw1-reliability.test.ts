import { describe, expect, it } from 'vitest'
import { validateMigrationBatch } from '@/lib/migration/pw1-batch-validation'
import { classifyStoreAttemptError, classifyMigrationError, MigrationError, retryDelayMs, shouldRetry } from '@/lib/migration/pw1-errors'
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
    it.each(['UND_ERR_SOCKET', 'UND_ERR_HEADERS_TIMEOUT', 'UND_ERR_BODY_TIMEOUT'])('retries interrupted HTTP transport %s within the attempt limit', code => {
        // Arrange — actual fetch failure shape observed during store 18 migration.
        const error = new TypeError('terminated', { cause: Object.assign(new Error('other side closed'), { code }) })
        // Act
        const failure = classifyMigrationError(error)
        // Assert
        expect(failure).toMatchObject({ code, retryable: true })
        expect(shouldRetry(failure, 1, 3)).toBe(true)
        expect(shouldRetry(failure, 3, 3)).toBe(false)
    })
    it('does not retry deliberate interruption or classify arbitrary termination as a network failure', () => {
        // Arrange
        const interrupted = new MigrationError('INTERRUPTED', 'terminated')
        // Act / Assert
        expect(classifyMigrationError(interrupted).retryable).toBe(false)
        expect(classifyMigrationError(new Error('terminated')).retryable).toBe(false)
    })
    it('bounds exponential waits and jitter', () => {
        expect(retryDelayMs(1, 0)).toBe(1000)
        expect(retryDelayMs(3, 0)).toBe(4000)
        expect(retryDelayMs(100, 1)).toBe(30500)
    })
})

describe('[TC-F35.M29] Store execution retry policy', () => {
    it.each(['Category listings require native cards or portfolio layout', 'terminated', 'Invalid generated block'])('retries %s until the configured attempt limit', message => {
        // Arrange
        const error = new Error(message)
        // Act
        const failure = classifyStoreAttemptError(error)
        // Assert
        expect(failure).toMatchObject({ code: 'STORE_ATTEMPT_FAILED', retryable: true })
        expect([1, 2, 3].map(attempt => shouldRetry(failure, attempt, 3))).toEqual([true, true, false])
    })
    it.each(['INTERRUPTED', 'BATCH_TIME_LIMIT', 'STORE_TIME_LIMIT', 'GENERATION_LIMIT', 'DESIGN_TOKEN_LIMIT', 'IDENTITY_CONFLICT', 'BE_MAPPING_INVALID', 'BE_DATA_MISSING', 'PUBLISHED_SITE', 'CONCURRENT_EDIT'])('respects the %s stop condition', code => {
        // Arrange
        const error = new MigrationError(code, 'stop')
        // Act
        const failure = classifyStoreAttemptError(error)
        // Assert
        expect(shouldRetry(failure, 1, 3)).toBe(false)
    })
})
