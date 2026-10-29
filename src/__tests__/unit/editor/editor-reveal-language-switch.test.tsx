/**
 * TC-AIREL-263 — "Show" on a translation line of another page: the page changes first, the language switch
 * starts when that page is the one in the editor (a switch begun while the old page's sections are still in the
 * store would work on, and save into, the wrong page). A newer reveal ends a switch still waiting.
 * TC-AIREL-264 — the live site's language switcher (menu): offers the site's languages, a choice is kept in a cookie
 * and the page is served again; inside the editor it keeps talking to the editor.
 * Real: use-editor-reveal.ts (listener + page wait), the editor store, live-language.tsx, the switcher component.
 * Faked: sonner, the page-selecting callback (it loads the page later, as the editor does), window.location.reload.
 */

import { act, fireEvent, render, renderHook, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NavLangSwitcherPlaceholder } from '@/blocks/navigation/language-switcher-placeholder'
import { editorBlockId, EDITOR_AI_LOCATE_EVENT } from '@/components/editor/agent/editor-agent-context'
import { type EditorRevealDeps, useEditorReveal } from '@/components/editor/agent/use-editor-reveal'
import { LiveLanguageProvider } from '@/components/site-renderer/live-language'
import type { RevealTarget } from '@/lib/editor/reveal/reveal-target'
import { type BlockData, useEditorStore } from '@/store/editorStore'

vi.mock('sonner', () => ({ toast: vi.fn() }))

const calls: string[] = []
const deps = (overrides: Partial<EditorRevealDeps> = {}): EditorRevealDeps => ({
    enabled: true,
    isCompactLayout: false,
    closeTools: vi.fn(),
    selectBlock: vi.fn(),
    selectPage: vi.fn(),
    switchLocale: vi.fn((locale: string) => void calls.push(`switch:${locale}@${useEditorStore.getState().currentPageId}`)),
    languageNotAdded: () => 'not added',
    requestSettingsTab: vi.fn(),
    sendToIframe: vi.fn(),
    openChat: vi.fn(),
    labels: () => ({ changed: 'Changed', missing: 'Missing' }),
    ...overrides,
})

const translationLine = (pageId: string): RevealTarget => ({ surface: 'block', pageId, blockId: 'hero-b', path: 'headline', where: 'Hero', after: 'Tajuk', locale: 'ms' })
const reveal = (target: RevealTarget) => act(() => void window.dispatchEvent(new CustomEvent(EDITOR_AI_LOCATE_EVENT, { detail: target })))
const tick = (ms = 0) => act(() => new Promise<void>((resolve) => setTimeout(resolve, ms)))
const openPage = (id: string, blocks: BlockData[] = []) =>
    act(() => {
        useEditorStore.getState().setCurrentPageId(id)
        useEditorStore.getState().init('1', blocks, {}, 'Kedai')
        useEditorStore.getState().setCurrentPageId(id)
    })

beforeEach(() => {
    calls.length = 0
    useEditorStore.getState().reset()
    useEditorStore.getState().setPrimaryLocale('en')
    useEditorStore.getState().setSecondaryLocale('ms')
    useEditorStore.getState().setGenerationLocale('en')
    useEditorStore.getState().setSiteLocale('en')
    useEditorStore.getState().setActiveLocale('en')
    useEditorStore.setState({ currentPageId: 'page-a' })
})
afterEach(() => vi.restoreAllMocks())

describe('a translation line on another page: the page first, then the language [TC-AIREL-263]', () => {
    it('does not switch the language while the other page is loading; switches once it is the editor\'s page', async () => {
        const selectPage = vi.fn(async (pageId: string) => {
            calls.push(`select:${pageId}`)
            // the editor saves, changes the address, then loads the page: a moment later
            setTimeout(() => openPage(pageId), 20)
        })
        renderHook(() => useEditorReveal(deps({ selectPage })))

        reveal(translationLine('page-b'))
        await tick(5)
        expect(calls).toEqual(['select:page-b'])

        await tick(60)
        // switched when page-b was the page in the store
        expect(calls).toEqual(['select:page-b', 'switch:ms@page-b'])
    })

    it('a reveal on the page already open switches at once, and one that is already in that language does not switch', async () => {
        const selectPage = vi.fn()
        const switchLocale = vi.fn()
        renderHook(() => useEditorReveal(deps({ selectPage, switchLocale })))

        reveal(translationLine('page-a'))
        await tick(5)
        expect(selectPage).not.toHaveBeenCalled()
        expect(switchLocale).toHaveBeenCalledWith('ms')

        switchLocale.mockClear()
        act(() => useEditorStore.getState().setActiveLocale('ms'))
        reveal(translationLine('page-a'))
        await tick(5)
        expect(switchLocale).not.toHaveBeenCalled()
    })

    it('a newer reveal ends a switch still waiting for its page; a language the site has not added is never switched to', async () => {
        const switchLocale = vi.fn()
        const selectPage = vi.fn(async () => undefined)
        renderHook(() => useEditorReveal(deps({ selectPage, switchLocale })))

        reveal(translationLine('page-b'))
        await tick(5)
        reveal({ surface: 'seo', pageId: 'page-a', where: 'SEO' })
        openPage('page-b')
        await tick(20)
        expect(switchLocale).not.toHaveBeenCalled()

        act(() => useEditorStore.getState().setSecondaryLocale(null))
        reveal({ ...translationLine('page-b'), locale: 'ms' })
        await tick(20)
        expect(switchLocale).not.toHaveBeenCalled()
    })
})

describe('the live site\'s language switcher [TC-AIREL-264]', () => {
    const reload = vi.fn()
    beforeEach(() => {
        document.cookie = 'pw_lang=; max-age=0; path=/'
        reload.mockClear()
        vi.spyOn(window, 'location', 'get').mockReturnValue({ ...window.location, reload } as unknown as Location)
    })

    it('offers the site\'s own languages (not the editor store\'s), names the one served, and keeps a choice in a cookie', () => {
        render(<LiveLanguageProvider languages={['ms', 'en']} active="ms"><NavLangSwitcherPlaceholder /></LiveLanguageProvider>)

        // the editor store says English is active; the live site serves Malay
        expect(screen.getByRole('button', { name: /MY/ })).toBeTruthy()
        fireEvent.mouseEnter(screen.getByLabelText('Language switcher'))
        const options = screen.getAllByRole('option')
        expect(options).toHaveLength(2)

        fireEvent.click(options.find((o) => o.getAttribute('aria-selected') === 'false')!)

        expect(document.cookie).toContain('pw_lang=en')
        expect(reload).toHaveBeenCalledTimes(1)
    })

    it('choosing the language already served does nothing; inside the editor (no provider) the choice goes to the editor', () => {
        const post = vi.spyOn(window.parent, 'postMessage').mockImplementation(() => undefined)
        const view = render(<LiveLanguageProvider languages={['en', 'ms']} active="en"><NavLangSwitcherPlaceholder /></LiveLanguageProvider>)
        fireEvent.mouseEnter(screen.getByLabelText('Language switcher'))
        fireEvent.click(screen.getAllByRole('option').find((o) => o.getAttribute('aria-selected') === 'true')!)
        expect(reload).not.toHaveBeenCalled()
        expect(document.cookie).not.toContain('pw_lang')
        view.unmount()

        useEditorStore.getState().setSecondaryLocale('ms')
        render(<NavLangSwitcherPlaceholder />)
        fireEvent.mouseEnter(screen.getByLabelText('Language switcher'))
        fireEvent.click(screen.getAllByRole('option')[1]!)
        expect(post).toHaveBeenCalledWith({ type: 'SWITCH_LOCALE', locale: 'ms' }, window.location.origin)
        expect(reload).not.toHaveBeenCalled()
    })
})
