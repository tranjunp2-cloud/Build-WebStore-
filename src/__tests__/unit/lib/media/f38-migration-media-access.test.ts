// @vitest-environment node
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { Media } from '@/collections/Media'

const DB_SETUP = fs.readFileSync(
    path.resolve(process.cwd(), 'scripts/db-setup.js'),
    'utf8',
)

describe('F38 additive schema and Media ownership', () => {
    it('[TC-F38-MIG-01] creates only the catalog table and search indexes additively', () => {
        // Arrange / Act
        const f38 = DB_SETUP.slice(
            DB_SETUP.indexOf("name: 'stock_image_catalog.create_table'"),
            DB_SETUP.indexOf('// ── F08 issue #1587'),
        )

        // Assert
        expect(f38).toContain('CREATE TABLE IF NOT EXISTS stock_image_catalog')
        expect(f38).toContain('CREATE INDEX IF NOT EXISTS stock_image_catalog_search_idx')
        expect(f38).not.toContain('site_stock_image_assignments')
        expect(f38).not.toContain('pixabay_response_cache')
        expect(f38).toContain('ALTER TABLE sites ADD COLUMN IF NOT EXISTS image_library jsonb')
        expect(f38).not.toMatch(/\bDROP\b/i)
    })

    it('[TC-F38-MIG-02] adds nullable Media provenance columns without rebuild', () => {
        // Arrange / Act / Assert
        for (const column of [
            'source_provider',
            'source_url',
            'license_name',
            'license_url',
            'attribution',
        ]) {
            expect(DB_SETUP).toContain(`ALTER TABLE media ADD COLUMN IF NOT EXISTS ${column}`)
        }
    })

    it('[TC-F38-SEC-04] tenant access cannot update or delete stock Media', async () => {
        // Arrange
        const update = Media.access?.update
        const remove = Media.access?.delete
        const args = { req: { user: { id: 1 } } }

        // Act
        const updateWhere = typeof update === 'function'
            ? await update(args as never)
            : update
        const deleteWhere = typeof remove === 'function'
            ? await remove(args as never)
            : remove

        // Assert
        expect(updateWhere).toEqual({
            or: [
                { sourceProvider: { exists: false } },
                { sourceProvider: { not_in: ['wikimedia', 'pixabay'] } },
            ],
        })
        expect(deleteWhere).toEqual(updateWhere)
        expect(Media.access?.read?.(args as never)).toBe(true)
    })
})
