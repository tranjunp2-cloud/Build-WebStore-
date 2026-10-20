import { describe, expect, it, vi } from 'vitest'
import { placeholderCandidates, pw1MediaFilename, pw1PlaceholderFilename, sourceUrls } from '@/lib/migration/pw1-placeholder-image-repair'
import { repointMedia } from '@/lib/migration/pw1-media-repoint'

const URL_A = 'https://pw1.test/a.jpg'
const URL_B = 'https://pw1.test/b.jpg'

// TC-F35.M72: placeholder image repair finds placeholders by source URL and repoints every reference
describe('pw1 placeholder image repair', () => {
    it('collects every absolute http(s) string in the contract', () => {
        const urls = sourceUrls({ a: [{ image: { url: URL_A } }], b: 'text', c: { logo: URL_B, d: '/relative.jpg' } })
        expect([...urls].sort()).toEqual([URL_A, URL_B])
    })
    it('names the placeholder after the stored copy the migration would have made', () => {
        expect(pw1PlaceholderFilename(7, URL_A)).toBe(pw1MediaFilename(7, URL_A).replace('.jpg', '-placeholder.jpg'))
        expect(pw1MediaFilename(7, URL_A)).toMatch(/^pw1-7-[0-9a-f]{20}\.jpg$/)
    })
    it('matches only URLs whose placeholder file exists for that tenant', () => {
        const placeholders = [{ id: 11, filename: pw1PlaceholderFilename(7, URL_A) }, { id: 12, filename: pw1PlaceholderFilename(8, URL_B) }]
        expect(placeholderCandidates([URL_A, URL_B], 7, placeholders)).toEqual([{ url: URL_A, placeholder: placeholders[0] }])
    })
    it('repoints foreign keys and copied URLs', async () => {
        const query = vi.fn(async (text: string) => {
            if (text.includes('pg_constraint')) return { rows: [{ tbl: 'pages_blocks_hero', col: 'image_id' }], rowCount: 1 }
            if (text.includes('information_schema')) return { rows: [{ table_name: 'pages_blocks_hero', column_name: 'slides', data_type: 'jsonb' }], rowCount: 1 }
            return { rows: [], rowCount: 2 }
        })
        const updated = await repointMedia(query as never, { id: 1, url: '/m/old.png' }, { id: 2, url: '/m/new.jpg' })
        expect(updated).toBe(4)
        expect(query).toHaveBeenCalledWith('UPDATE pages_blocks_hero SET "image_id" = $1 WHERE "image_id" = $2', [2, 1])
        expect(query).toHaveBeenCalledWith(expect.stringContaining('replace("slides"::text'), ['/m/old.png', '/m/new.jpg'])
    })
    it('skips the url rewrite when the URL did not change', async () => {
        const query = vi.fn(async () => ({ rows: [], rowCount: 0 }))
        await repointMedia(query as never, { id: 1, url: '/m/a.jpg' }, { id: 2, url: '/m/a.jpg' })
        expect(query).toHaveBeenCalledTimes(1)
    })
})
