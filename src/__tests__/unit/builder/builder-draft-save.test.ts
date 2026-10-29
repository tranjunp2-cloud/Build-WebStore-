import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
    buildBuilderSaveBody,
    createBuilderDraftBase,
    isAutosavePaused,
    saveBuilderDraft,
} from '@/app/(builder)/builder/new/builder-draft-save'

// #2103 A4: the builder saves a DRAFT against the revision it read, like the editor does.

const state = { blocks: [{ _id: 'b1', blockType: 'hero' }], theme: { name: 'theme' } }

const json = (body: unknown, init: { ok?: boolean; status?: number; headers?: Record<string, string> } = {}) => ({
    ok: init.ok ?? true,
    status: init.status ?? 200,
    headers: new Headers(init.headers),
    json: async () => body,
}) as unknown as Response

const fetchMock = vi.fn()
const saveCalls = () => fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/save'))
const bodyOf = (call: unknown[]) => JSON.parse(String((call[1] as RequestInit).body)) as Record<string, unknown>

beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
})

describe('builder draft save (A4)', () => {
    it('TC-AIAUD-053: the save body is a draft and carries the draft revision as base', () => {
        expect(buildBuilderSaveBody(state, '3.5')).toEqual({ ...state, isDraft: true, base: '3.5' })
    })

    it('TC-AIAUD-053: with no known revision the body is still a draft, without base', () => {
        const body = buildBuilderSaveBody(state, null)
        expect(body).toEqual({ ...state, isDraft: true })
        expect(body).not.toHaveProperty('base')
    })

    it('TC-AIAUD-054: reads the revision from editor-data once, sends it, and keeps the one each save returns', async () => {
        fetchMock.mockImplementation(async (url: string) => {
            if (url.endsWith('/editor-data')) return json({ draftVersion: '2.4' })
            return json({ success: true }, { headers: { 'x-draft-version': '2.5' } })
        })
        const holder = createBuilderDraftBase()

        const first = await saveBuilderDraft('site-1', state, holder)
        const second = await saveBuilderDraft('site-1', state, holder)

        expect(first).toEqual({ ok: true })
        expect(second).toEqual({ ok: true })
        expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/editor-data'))).toHaveLength(1)
        const [firstSave, secondSave] = saveCalls()
        expect(bodyOf(firstSave)).toMatchObject({ isDraft: true, base: '2.4' })
        expect(bodyOf(secondSave)).toMatchObject({ isDraft: true, base: '2.5' })
        expect((firstSave[1] as RequestInit).method).toBe('PATCH')
    })

    it('TC-AIAUD-054: a revision lookup that fails does not block the save (sent as draft, unchecked)', async () => {
        fetchMock.mockImplementation(async (url: string) => {
            if (url.endsWith('/editor-data')) throw new Error('offline')
            return json({ success: true })
        })

        const result = await saveBuilderDraft('site-1', state, createBuilderDraftBase())

        expect(result).toEqual({ ok: true })
        const body = bodyOf(saveCalls()[0])
        expect(body.isDraft).toBe(true)
        expect(body).not.toHaveProperty('base')
    })

    it('TC-AIAUD-054: a refused save (DRAFT_CHANGED) reports a conflict and keeps the newer revision for the next save', async () => {
        let saves = 0
        fetchMock.mockImplementation(async (url: string) => {
            if (url.endsWith('/editor-data')) return json({ draftVersion: '1.1' })
            saves += 1
            return saves === 1
                ? json({ code: 'DRAFT_CHANGED', draftVersion: '1.9' }, { ok: false, status: 409 })
                : json({ success: true })
        })
        const holder = createBuilderDraftBase()

        const refused = await saveBuilderDraft('site-1', state, holder)
        const retried = await saveBuilderDraft('site-1', state, holder, { explicit: true })

        expect(refused).toEqual({ ok: false, conflict: true })
        expect(retried).toEqual({ ok: true })
        expect(bodyOf(saveCalls()[1])).toMatchObject({ base: '1.9' })
    })

    it('TC-AIAUD-054: any other failure is reported as a plain failure', async () => {
        fetchMock.mockImplementation(async (url: string) =>
            url.endsWith('/editor-data') ? json({}) : json({ error: 'boom' }, { ok: false, status: 500 }))

        expect(await saveBuilderDraft('site-1', state, createBuilderDraftBase())).toEqual({ ok: false, conflict: false })
    })

    it('TC-AIAUD-054: a different site does not reuse the previous site revision', async () => {
        fetchMock.mockImplementation(async (url: string) => {
            if (url.includes('site-1/editor-data')) return json({ draftVersion: '1.1' })
            if (url.includes('site-2/editor-data')) return json({ draftVersion: '8.8' })
            return json({ success: true })
        })
        const holder = createBuilderDraftBase()

        await saveBuilderDraft('site-1', state, holder)
        await saveBuilderDraft('site-2', state, holder)

        expect(bodyOf(saveCalls()[1])).toMatchObject({ base: '8.8' })
    })
})

describe('autosave after a conflict (TC-AIAUD-155)', () => {
    const conflictThenOk = () => {
        let saves = 0
        fetchMock.mockImplementation(async (url: string) => {
            if (url.endsWith('/editor-data')) return json({ draftVersion: '1.1' })
            saves += 1
            return saves === 1
                ? json({ code: 'DRAFT_CHANGED', draftVersion: '1.9' }, { ok: false, status: 409 })
                : json({ success: true }, { headers: { 'x-draft-version': '2.0' } })
        })
    }

    it('TC-AIAUD-155: after a 409 the next automatic save is not sent, however often it fires', async () => {
        conflictThenOk()
        const holder = createBuilderDraftBase()
        expect(isAutosavePaused(holder)).toBe(false)

        await saveBuilderDraft('site-1', state, holder)
        const second = await saveBuilderDraft('site-1', state, holder)
        const third = await saveBuilderDraft('site-1', state, holder)

        expect(isAutosavePaused(holder)).toBe(true)
        expect(second).toEqual({ ok: false, conflict: true, paused: true })
        expect(third).toEqual({ ok: false, conflict: true, paused: true })
        expect(saveCalls()).toHaveLength(1)
    })

    it('TC-AIAUD-155: an explicit save after the conflict goes through on the newer revision and resumes autosave', async () => {
        conflictThenOk()
        const holder = createBuilderDraftBase()
        await saveBuilderDraft('site-1', state, holder)

        const explicit = await saveBuilderDraft('site-1', state, holder, { explicit: true })
        const auto = await saveBuilderDraft('site-1', state, holder)

        expect(explicit).toEqual({ ok: true })
        expect(bodyOf(saveCalls()[1])).toMatchObject({ isDraft: true, base: '1.9' })
        expect(isAutosavePaused(holder)).toBe(false)
        expect(auto).toEqual({ ok: true })
        expect(bodyOf(saveCalls()[2])).toMatchObject({ base: '2.0' })
    })

    it('TC-AIAUD-155: an explicit save that is refused again keeps autosave paused', async () => {
        fetchMock.mockImplementation(async (url: string) =>
            url.endsWith('/editor-data') ? json({ draftVersion: '1.1' }) : json({ code: 'DRAFT_CHANGED', draftVersion: '3.0' }, { ok: false, status: 409 }))
        const holder = createBuilderDraftBase()

        await saveBuilderDraft('site-1', state, holder)
        const again = await saveBuilderDraft('site-1', state, holder, { explicit: true })

        expect(again).toEqual({ ok: false, conflict: true })
        expect(isAutosavePaused(holder)).toBe(true)
    })

    it('TC-AIAUD-155: a different site starts unpaused', async () => {
        conflictThenOk()
        const holder = createBuilderDraftBase()
        await saveBuilderDraft('site-1', state, holder)

        const other = await saveBuilderDraft('site-2', state, holder)

        expect(other).toEqual({ ok: true })
    })
})
