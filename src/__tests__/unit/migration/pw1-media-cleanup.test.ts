import { describe, expect, it } from 'vitest'
import { migrationMediaStem, validateCleanupOptions } from '@/lib/migration/pw1-media-cleanup'

describe('[TC-F35.M35] Cleanup ownership and retention', () => {
    it('defaults to a seven-day retention and bounded scan', () => {
        expect(validateCleanupOptions({ store: '205' })).toMatchObject({ olderThanHours: 168, limit: 20 })
    })
    it.each([{ store: 'x' }, { store: '1', olderThanHours: 0 }, { store: '1', olderThanHours: 0.5 }, { store: '1', limit: 101 }])('rejects unsafe options %o', options => {
        expect(() => validateCleanupOptions(options)).toThrow()
    })
    it('requires the tenant and hash encoded in the exact imported filename', () => {
        const source_hash = 'a'.repeat(64)
        const candidate = { id: 10, tenant_id: 1, source_hash, filename: `pw1-1-${source_hash.slice(0,20)}.png` }
        expect(migrationMediaStem(candidate)).toBe(`pw1-1-${source_hash.slice(0,20)}`)
        expect(migrationMediaStem({...candidate,filename:`pw1-1-${source_hash.slice(0,20)}.ico`})).toBe(`pw1-1-${source_hash.slice(0,20)}`)
        expect(migrationMediaStem({ ...candidate, tenant_id: 2 })).toBeNull()
        expect(migrationMediaStem({ ...candidate, filename: 'manual-upload.png' })).toBeNull()
        expect(migrationMediaStem({ ...candidate, source_hash: 'invalid' })).toBeNull()
    })
})
