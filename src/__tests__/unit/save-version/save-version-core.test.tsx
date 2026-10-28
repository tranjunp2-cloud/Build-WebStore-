/**
 * TC-AICP-322 — the version check itself (lib/save-version): no expected version = no check; versions are compared as
 * instants (a different spelling of the same moment is fresh); `null` expects "no row yet"; a vanished record is stale;
 * the conflict result and the server-action wrapper.
 * TC-AICP-323 — useSaveVersion (the form's side): `set` moves the baseline and clears a conflict, `refused` recognises a
 * refused save and turns `conflicted` on, `overwrite` takes the version the server reported.
 * TC-AICP-324 — SaveConflictNotice: same look as the agent notice, message per record, two buttons.
 * Real: save-version, useSaveVersion, SaveConflictNotice, en + ms strings.
 */
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react'
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SaveConflictNotice } from '@/components/agent/agent-changed-notice'
import { I18nProvider } from '@/i18n'
import en from '@/i18n/locales/en.json'
import ms from '@/i18n/locales/ms.json'
import {
    assertFreshVersion,
    isStaleVersion,
    isVersionConflict,
    VersionConflictError,
    withVersionGuard,
} from '@/lib/save-version/save-version'
import { useSaveVersion } from '@/lib/save-version/use-save-version'

afterEach(cleanup)

describe('version check [TC-AICP-322]', () => {
    it('TC-AICP-322: nothing expected = nothing checked', () => {
        expect(isStaleVersion(undefined, '2026-10-22T01:00:00.000Z')).toBe(false)
        expect(isStaleVersion(undefined, null)).toBe(false)
        expect(() => assertFreshVersion(undefined, '2026-10-22T01:00:00.000Z')).not.toThrow()
    })

    it('TC-AICP-322: compares instants, not spellings', () => {
        expect(isStaleVersion('2026-10-22T01:00:00.000Z', new Date('2026-10-22T01:00:00.000Z'))).toBe(false)
        expect(isStaleVersion('2026-10-22T09:00:00.000+08:00', '2026-10-22T01:00:00.000Z')).toBe(false)
        expect(isStaleVersion('2026-10-22T01:00:00.000Z', '2026-10-22T01:00:00.001Z')).toBe(true)
    })

    it('TC-AICP-322: null expects no row; a vanished record is stale; an odd stamp equals itself', () => {
        expect(isStaleVersion(null, null)).toBe(false)
        expect(isStaleVersion(null, '2026-10-22T01:00:00.000Z')).toBe(true)
        expect(isStaleVersion('2026-10-22T01:00:00.000Z', null)).toBe(true)
        expect(isStaleVersion('u7', 'u7')).toBe(false)
        expect(isStaleVersion('u7', 'u8')).toBe(true)
    })

    it('TC-AICP-322: a stale save throws the typed conflict carrying the stored version; the wrapper turns it into a result', async () => {
        let thrown: unknown
        try { assertFreshVersion('2026-10-22T01:00:00.000Z', '2026-10-22T02:00:00.000Z') } catch (e) { thrown = e }
        expect(thrown).toBeInstanceOf(VersionConflictError)
        expect(thrown).toMatchObject({ current: '2026-10-22T02:00:00.000Z' })

        const refused = await withVersionGuard(async () => { throw thrown })
        expect(refused).toEqual({ ok: false, code: 'VERSION_CONFLICT', current: '2026-10-22T02:00:00.000Z' })
        expect(isVersionConflict(refused)).toBe(true)
        expect(await withVersionGuard(async () => ({ id: 1 }))).toEqual({ id: 1 })
        await expect(withVersionGuard(async () => { throw new Error('db down') })).rejects.toThrow('db down')
        expect(isVersionConflict({ ok: true, updatedAt: 'x' })).toBe(false)
        expect(isVersionConflict(null)).toBe(false)
    })
})

describe('useSaveVersion [TC-AICP-323]', () => {
    it('TC-AICP-323: starts from the loaded version; set moves it; refused turns the conflict on; overwrite takes the reported version', () => {
        const { result } = renderHook(() => useSaveVersion('v1'))
        expect(result.current.current()).toBe('v1')
        expect(result.current.conflicted).toBe(false)

        act(() => result.current.set('v2'))
        expect(result.current.current()).toBe('v2')

        expect(result.current.refused({ id: 5, updatedAt: 'v3' })).toBe(false)
        expect(result.current.conflicted).toBe(false)
        let was = false
        act(() => { was = result.current.refused({ ok: false, code: 'VERSION_CONFLICT', current: 'v9' }) })
        expect(was).toBe(true)
        expect(result.current.conflicted).toBe(true)
        expect(result.current.current()).toBe('v2')

        act(() => result.current.overwrite())
        expect(result.current.current()).toBe('v9')
        expect(result.current.conflicted).toBe(false)
    })

    it('TC-AICP-323: a conflict whose record has no version any more (null) overwrites with null; load clears the conflict', () => {
        const { result } = renderHook(() => useSaveVersion('v1'))
        act(() => { result.current.refused({ ok: false, code: 'VERSION_CONFLICT', current: null }) })
        expect(result.current.conflicted).toBe(true)
        act(() => result.current.overwrite())
        expect(result.current.current()).toBeNull()

        act(() => { result.current.refused({ ok: false, code: 'VERSION_CONFLICT', current: 'v4' }) })
        act(() => result.current.set('v4'))
        expect(result.current.conflicted).toBe(false)
    })
})

describe('SaveConflictNotice [TC-AICP-324]', () => {
    const mount = (record: 'product' | 'post' | 'discount' | 'customer' | 'template', locale: 'en' | 'ms' = 'en') => {
        const onLoadLatest = vi.fn()
        const onSaveAnyway = vi.fn()
        render(<I18nProvider defaultLocale={locale}><SaveConflictNotice record={record} onLoadLatest={onLoadLatest} onSaveAnyway={onSaveAnyway} /></I18nProvider>)
        return { onLoadLatest, onSaveAnyway }
    }

    it('TC-AICP-324: says what changed per record, and both buttons call back', () => {
        const { onLoadLatest, onSaveAnyway } = mount('product')
        expect(screen.getByRole('status')).toHaveTextContent('This product was changed after you opened it.')

        fireEvent.click(screen.getByRole('button', { name: 'Load the latest' }))
        fireEvent.click(screen.getByRole('button', { name: 'Save mine anyway (replaces their changes)' }))
        expect(onLoadLatest).toHaveBeenCalledTimes(1)
        expect(onSaveAnyway).toHaveBeenCalledTimes(1)
    })

    it('TC-AICP-324: one message per record in English and Malay', () => {
        for (const record of ['product', 'post', 'discount', 'customer', 'template'] as const) {
            expect(en.dashboard.agentChanged.conflict[record]).toMatch(/was changed after you opened it\.$/)
            expect(ms.dashboard.agentChanged.conflict[record]).toMatch(/telah diubah selepas anda membukanya\.$/)
        }
        expect(ms.dashboard.agentChanged.saveAnyway).toBeTruthy()
        expect(en.dashboard.agentChanged.changedElsewhere).toBe('Changed elsewhere — refreshed')
        cleanup()
        mount('template', 'ms')
        expect(screen.getByRole('status')).toHaveTextContent(ms.dashboard.agentChanged.conflict.template)
    })
})
