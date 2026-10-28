// @vitest-environment node
/**
 * db-setup.js migration runner: `required: true` entries are cached like any other entry, but a
 * failure fails the build (throws) instead of a warning. Non-required failures still warn, and a
 * failed entry is never recorded in _db_setup_state, so the next build retries it.
 * TC-AIREL-274, TC-AIREL-275 (docs/qa/F-ai-release.md) — PR #2059 review L17.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'

type Migration = { name: string; sql: string; critical?: boolean; required?: boolean }

const { applyMigrationList, MIGRATIONS } = require('../../../../scripts/db-setup.js') as {
    applyMigrationList: (pool: unknown, migrations: Migration[]) => Promise<{ failed: number; ran: number; skipped: number }>
    MIGRATIONS: Migration[]
}

/** In-memory stand-in for pg.Pool: `_db_setup_state` is a Set; SQL 'FAIL' throws. */
function fakePool(alreadyApplied: string[] = []) {
    const state = new Set(alreadyApplied)
    const executed: string[] = []
    const pool = {
        async query(sql: string, params?: string[]) {
            if (sql.startsWith('SELECT name FROM _db_setup_state')) return { rows: [...state].map((name) => ({ name })) }
            if (sql.startsWith('INSERT INTO _db_setup_state')) {
                state.add(params![0])
                return { rows: [] }
            }
            if (sql.startsWith('CREATE TABLE IF NOT EXISTS _db_setup_state')) return { rows: [] }
            executed.push(sql)
            if (sql === 'FAIL') throw new Error('column "x" of relation "blogs" does not exist')
            return { rows: [] }
        },
    }
    return { pool, state, executed }
}

afterEach(() => vi.restoreAllMocks())

describe('[TC-AIREL-274] db-setup runner: required migrations fail the build', () => {
    it('[TC-AIREL-274] a failing required entry throws and is not recorded as applied', async () => {
        vi.spyOn(console, 'log').mockImplementation(() => {})
        vi.spyOn(console, 'error').mockImplementation(() => {})
        const { pool, state } = fakePool()

        await expect(
            applyMigrationList(pool, [
                { name: 'a.ok', sql: 'SELECT 1' },
                { name: 'blogs.deleted_at', sql: 'FAIL', required: true },
            ]),
        ).rejects.toThrow('does not exist')

        expect(state.has('a.ok')).toBe(true)
        expect(state.has('blogs.deleted_at')).toBe(false)
    })

    it('[TC-AIREL-274] a failing non-required entry only warns, the run continues, and the next run retries it', async () => {
        vi.spyOn(console, 'log').mockImplementation(() => {})
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
        const { pool, state, executed } = fakePool()
        const list: Migration[] = [
            { name: 'x.flaky', sql: 'FAIL' },
            { name: 'y.after', sql: 'SELECT 2' },
        ]

        const summary = await applyMigrationList(pool, list)
        await applyMigrationList(pool, list)

        expect(summary.failed).toBe(1)
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('x.flaky'))
        expect(state.has('x.flaky')).toBe(false)
        expect(executed.filter((sql) => sql === 'FAIL')).toHaveLength(2) // retried
        expect(executed.filter((sql) => sql === 'SELECT 2')).toHaveLength(1) // cached after success
    })

    it('[TC-AIREL-274] an applied required entry is cached (not re-run every deploy like critical)', async () => {
        vi.spyOn(console, 'log').mockImplementation(() => {})
        const { pool, executed } = fakePool(['media.tenant_id'])

        const summary = await applyMigrationList(pool, [
            { name: 'media.tenant_id', sql: 'ALTER TABLE media ADD COLUMN IF NOT EXISTS tenant_id integer;', required: true },
        ])

        expect(summary.skipped).toBe(1)
        expect(executed).toHaveLength(0)
    })
})

describe('[TC-AIREL-275] db-setup: AI release columns/tables Payload reads are required, not critical', () => {
    const hotPath = [
        'blogs.deleted_at',
        'blogs.ai_change_set_id',
        'media.tenant_id',
        'sites.editor_revision',
        'pages.editor_revision',
        'pages.published_locale_content',
        'tenants.settings_automations',
        'contact_submissions_replies.create_table',
        'pages_blocks_products_featured_images.create_table',
        '_pages_v_blocks_products_featured_images.create_table',
        'ai_change_set_applies.create_table',
    ]

    it('[TC-AIREL-275] each hot-path entry is required and cached (no ACCESS EXCLUSIVE lock every deploy)', () => {
        for (const name of hotPath) {
            const entry = MIGRATIONS.find((m) => m.name === name)
            expect(entry, name).toBeDefined()
            expect(entry!.required, name).toBe(true)
            expect(entry!.critical, name).not.toBe(true)
        }
    })

    it('[TC-AIREL-275] the index entries stay best-effort', () => {
        for (const name of ['blogs.deleted_at_idx', 'media.tenant_idx', 'ai_change_set_applies.unrecorded_idx']) {
            expect(MIGRATIONS.find((m) => m.name === name)?.required, name).not.toBe(true)
        }
    })
})
