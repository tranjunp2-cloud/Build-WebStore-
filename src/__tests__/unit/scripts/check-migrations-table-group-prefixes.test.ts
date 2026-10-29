/**
 * check-migrations.js: a group prefix that only exists on one table (Tenants.settings → settings_*)
 * must not let a new top-level field on ANOTHER table "match" an unrelated settings_<field> column.
 * TC-AIREL-273 (docs/qa/F-ai-release.md) — PR #2059 review L16.
 */
import { describe, it, expect } from 'vitest'

const { getMigrationColumns } = require('../../../../scripts/check-migrations.js') as {
    getMigrationColumns: (content: string) => Set<string>
}

describe('[TC-AIREL-273] check-migrations: settings_* prefix applies to tenants only', () => {
    it('[TC-AIREL-273] a tenants settings_<x> column registers the group field name <x>', () => {
        const columns = getMigrationColumns(
            'ALTER TABLE tenants ADD COLUMN IF NOT EXISTS settings_automations jsonb;',
        )

        expect(columns.has('tenants.settings_automations')).toBe(true)
        expect(columns.has('tenants.automations')).toBe(true)
    })

    it('[TC-AIREL-273] a settings_<x> column on another table does not cover a new top-level field <x>', () => {
        const columns = getMigrationColumns(
            'ALTER TABLE blogs ADD COLUMN IF NOT EXISTS settings_featured boolean;',
        )

        expect(columns.has('blogs.settings_featured')).toBe(true)
        expect(columns.has('blogs.featured')).toBe(false)
    })

    it('[TC-AIREL-273] global group prefixes still apply to every table', () => {
        const columns = getMigrationColumns(
            'ALTER TABLE products ADD COLUMN IF NOT EXISTS seo_meta_title varchar;',
        )

        expect(columns.has('products.meta_title')).toBe(true)
    })
})
