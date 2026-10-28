/**
 * TC-AIREL-306 — which applied changes touched the same parts (a newer one has to be undone first).
 * Real: lib/agent-changes/undo-touches.
 */
import { describe, expect, it } from 'vitest'
import { newerOverlapping, undoMarks } from '@/lib/agent-changes/undo-touches'

type Undo = { kind: string; payload: Record<string, unknown> }
const set = (id: string, at: string, undo: Undo, status = 'applied', title = id) =>
    ({ id, title, status, decidedAt: at, stagedAt: at, result: { entities: [], links: [], undo: { ...undo, until: '2999-01-01T00:00:00Z' } } }) as never

const page = (blockId: string, pageId = '12'): Undo => ({ kind: 'site.page_restore', payload: { pageId, restore: [{ blockId }] } })

describe('undoMarks', () => {
    it('reads sections, language copies, theme keys, SEO and menu parts from the undo record', () => {
        expect([...undoMarks(set('a', '1', { kind: 'site.page_restore', payload: { pageId: '12', restore: [{ blockId: 'hero' }], slots: { entries: { about: null } } } }))].sort()).toEqual(['block:12:about', 'block:12:hero'])
        expect([...undoMarks(set('a', '1', { kind: 'site.pages_restore', payload: { pages: [{ pageId: '1', restore: [{ blockId: 'x' }] }, { pageId: '2', restore: [{ blockId: 'y' }] }] } }))].sort()).toEqual(['block:1:x', 'block:2:y'])
        expect([...undoMarks(set('a', '1', { kind: 'site.locale_restore', payload: { pageId: '12', entries: { hero: null } } }))]).toEqual(['block:12:hero'])
        expect([...undoMarks(set('a', '1', { kind: 'site.theme_restore', payload: { changes: { primaryColor: '#fff' } } }))]).toEqual(['theme:primaryColor'])
        expect([...undoMarks(set('a', '1', { kind: 'site.seo_restore', payload: { pageId: '12' } }))]).toEqual(['seo:12'])
        expect([...undoMarks(set('a', '1', { kind: 'site.nav_restore', payload: { header: {}, footer: null } }))]).toEqual(['nav:header'])
    })

    it('has no marks for a change without undo data or of another kind', () => {
        expect(undoMarks({ result: undefined })).toEqual(new Set())
        expect(undoMarks(set('a', '1', { kind: 'blog.restore_fields', payload: {} })).size).toBe(0)
    })
})

describe('newerOverlapping', () => {
    const older = set('a', '2026-10-22T01:00:00Z', page('hero'))

    it('finds the newest later change on the same section', () => {
        const found = newerOverlapping(older, [older, set('b', '2026-10-22T02:00:00Z', page('hero'), 'applied', 'B'), set('c', '2026-10-22T03:00:00Z', page('hero'), 'applied', 'C')])

        expect(found).toEqual({ id: 'c', title: 'C' })
    })

    it('ignores older changes, other sections, other pages, undone ones and itself', () => {
        const others = [
            older,
            set('o', '2026-10-22T00:00:00Z', page('hero')),
            set('s', '2026-10-22T02:00:00Z', page('about')),
            set('p', '2026-10-22T02:00:00Z', page('hero', '99')),
            set('r', '2026-10-22T02:00:00Z', page('hero'), 'reverted'),
        ]

        expect(newerOverlapping(older, others)).toBeNull()
    })

    it('a theme change overlaps another theme change on the same key only', () => {
        const theme = (key: string, at: string, id: string) => set(id, at, { kind: 'site.theme_restore', payload: { changes: { [key]: 1 } } })

        expect(newerOverlapping(theme('primaryColor', '1', 'a'), [theme('primaryColor', '2', 'b')])).toEqual({ id: 'b', title: 'b' })
        expect(newerOverlapping(theme('primaryColor', '1', 'a'), [theme('fontFamily', '2', 'b')])).toBeNull()
    })
})
