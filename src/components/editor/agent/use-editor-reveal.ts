'use client'

import { useEffect, useLayoutEffect, useRef } from 'react'
import { toast } from 'sonner'
import { type RevealTarget, valueAtRevealPath } from '@/lib/editor/reveal/reveal-target'
import { revealSettingsField } from '@/lib/editor/reveal/settings-reveal'
import { siteLanguages } from '@/lib/site-languages'
import { useEditorStore } from '@/store/editorStore'
import { useWorkspaceStore } from '@/store/workspaceStore'
import {
    EDITOR_AI_ASK_EVENT,
    EDITOR_AI_HOVER_EVENT,
    EDITOR_AI_LOCATE_EVENT,
    type EditorAiHoverDetail,
    type EditorAiLocateDetail,
    editorBlockId,
} from './editor-agent-context'

type SettingsTabRequest = { tab: 'global' | 'seo' | 'menu' | 'block'; section?: string; focus?: string }

export type EditorRevealDeps = {
    enabled: boolean
    isCompactLayout: boolean
    closeTools: () => void
    /** select a section (its fields in Settings), or the menu / footer */
    selectBlock: (blockIndex: number | null, blockType?: string) => void
    selectPage: (pageId: string) => unknown
    /** show the canvas in this language (a translation's line); only shows it — nothing is translated by it */
    switchLocale: (locale: string) => unknown
    /** a translation into a language the site has not added: what to say instead of showing it */
    languageNotAdded: (locale: string) => string
    requestSettingsTab: (request: SettingsTabRequest) => void
    sendToIframe: (message: Record<string, unknown>) => void
    /** the chat tab (and its sidebar) is opened for Ask AI */
    openChat: () => void
    labels: () => { changed: string; missing: string }
}

/**
 * Resolves true once `pageId` is the page the editor holds, with its sections loaded (the editor sets the page
 * and then fills the store in the same task, so one more task is waited), false after `timeoutMs`.
 */
function pageReady(pageId: string, timeoutMs = 8000): Promise<boolean> {
    const isCurrent = () => String(useEditorStore.getState().currentPageId ?? '') === pageId
    const settled = () => new Promise<boolean>((resolve) => window.setTimeout(() => resolve(true), 0))
    if (isCurrent()) return settled()
    return new Promise<boolean>((resolve) => {
        let timer = 0
        const unsubscribe = useEditorStore.subscribe(() => {
            if (!isCurrent()) return
            unsubscribe()
            window.clearTimeout(timer)
            void settled().then(resolve)
        })
        timer = window.setTimeout(() => {
            unsubscribe()
            resolve(false)
        }, timeoutMs)
    })
}

/** What the canvas looks for inside a section: the field's stored text, the picture's address. */
function canvasHint(block: object | undefined, target: RevealTarget): { text?: string; src?: string; path?: string } {
    // a translation is in the language's own copy: the section's stored text is the other language
    if (target.locale) return { ...(target.after ? { text: target.after } : {}), ...(target.path ? { path: target.path } : {}) }
    const stored = valueAtRevealPath(block, target.path)
    const url = stored && typeof stored === 'object' ? (stored as { url?: unknown }).url : undefined
    const src = typeof url === 'string' ? url : typeof stored === 'string' && /^(https?:)?\/\/|^\/(?!\/)/.test(stored) ? stored : undefined
    const text = typeof stored === 'string' && !src ? stored : target.after
    return { ...(text ? { text } : {}), ...(src ? { src } : {}), ...(target.path ? { path: target.path } : {}) }
}

const settingsPanel = () => document.querySelector<HTMLElement>('[data-testid="settings-panel"]')

function openSettingsPanel(compact: boolean) {
    if (!compact && !useWorkspaceStore.getState().rightSidebarVisible) useWorkspaceStore.getState().toggleRight()
}

/**
 * The editor side of the reveal kit: a `RevealTarget` (a change's "Show", a
 * step of the change walker) → its page opened, the right Settings tab, the
 * section selected, the element outlined on the canvas and its field pulsed.
 * Also: chat chips light their element up on hover, and Ask AI opens the chat.
 *
 * The iframe may still be loading a page, so a section is looked for every
 * 250 ms (1.5 s on this page, 8 s after a page switch) with one token; the
 * iframe acts on the first message that finds it.
 */
export function useEditorReveal(deps: EditorRevealDeps): void {
    const latest = useRef(deps)
    // the listeners below read the newest callbacks without re-subscribing
    useLayoutEffect(() => {
        latest.current = deps
    })

    // reveals work without the assistant too (a refused publish's "Show"); Ask AI only with it
    useEffect(() => {
        let timer: number | null = null
        let cancelField: (() => void) | null = null
        // a newer reveal (or unmount) ends a language switch still waiting for its page
        let generation = 0
        const stop = () => {
            generation++
            if (timer !== null) window.clearInterval(timer)
            timer = null
            cancelField?.()
            cancelField = null
        }

        const onLocate = (event: Event) => {
            const target = (event as CustomEvent<EditorAiLocateDetail>).detail
            const d = latest.current
            stop()
            if (d.isCompactLayout) d.closeTools()
            const token = `${Date.now()}-${Math.random().toString(36).slice(2)}`
            const label = `${d.labels().changed} · ${target.where}`
            const onPage = () => !target.pageId || String(useEditorStore.getState().currentPageId ?? '') === target.pageId
            const mine = generation
            const pageChange = target.pageId && !onPage() ? Promise.resolve(d.selectPage(target.pageId)) : null
            if (target.locale) {
                const locale = target.locale
                const state = useEditorStore.getState()
                // never a language the site has not added (Quick language): the canvas has no such view
                if (!siteLanguages(state).includes(locale)) {
                    toast(d.languageNotAdded(locale))
                    return
                }
                if (state.activeLocale !== locale || pageChange) {
                    // the page first, then the language: a switch starts from the sections on screen, so one
                    // begun while the other page is still loading would work on (and save into) the wrong page
                    void (async () => {
                        if (pageChange && target.pageId) {
                            await pageChange.catch(() => undefined)
                            if (!(await pageReady(target.pageId))) return
                        }
                        if (mine !== generation || useEditorStore.getState().activeLocale === locale) return
                        await latest.current.switchLocale(locale)
                    })()
                }
            }

            if (target.surface === 'menu' || target.surface === 'footer') {
                const region = target.surface === 'footer' ? 'footer' : 'navigation'
                d.selectBlock(null, region)
                openSettingsPanel(d.isCompactLayout)
                d.sendToIframe({ type: 'AI_LOCATE', token, blockType: region, label, hint: { text: target.after?.split('\n')[0], path: target.path } })
                cancelField = revealSettingsField(settingsPanel, { value: target.after?.split('\n')[0] })
                return
            }
            if (target.surface === 'seo') {
                d.requestSettingsTab({ tab: 'seo', ...(target.path ? { focus: target.path } : {}) })
                openSettingsPanel(d.isCompactLayout)
                cancelField = revealSettingsField(settingsPanel, { focus: target.path, value: target.after }, 3000)
                return
            }
            if (target.surface === 'page' || !target.blockId) return

            const started = Date.now()
            let foundAt = 0
            timer = window.setInterval(() => {
                const state = useEditorStore.getState()
                const here = onPage()
                const index = here ? state.blocks.findIndex((block, i) => editorBlockId(block, i) === target.blockId) : -1
                if (index >= 0) {
                    const block = state.blocks[index]
                    const hint = canvasHint(block, target)
                    if (!foundAt) {
                        foundAt = Date.now()
                        latest.current.selectBlock(index, block?.blockType)
                        openSettingsPanel(latest.current.isCompactLayout)
                        // the field's marker first (an empty required field has no value to match), else its value
                        if (target.path || hint.text) cancelField = revealSettingsField(settingsPanel, { focus: target.path, value: hint.text })
                    }
                    latest.current.sendToIframe({ type: 'AI_LOCATE', token, index, label, hint })
                    if (Date.now() - foundAt > 4000) {
                        if (timer !== null) window.clearInterval(timer)
                        timer = null
                    }
                } else if (Date.now() - started > (here ? 1500 : 8000)) {
                    // a section of a change not approved yet, or removed since
                    stop()
                    if (here) toast(latest.current.labels().missing)
                }
            }, 250)
        }

        const onHover = (event: Event) => {
            const target = (event as CustomEvent<EditorAiHoverDetail>).detail
            const d = latest.current
            if (!target || target.surface !== 'block' || !target.blockId) return d.sendToIframe({ type: 'AI_HIGHLIGHT' })
            const state = useEditorStore.getState()
            if (target.pageId && String(state.currentPageId ?? '') !== target.pageId) return
            const index = state.blocks.findIndex((block, i) => editorBlockId(block, i) === target.blockId)
            if (index >= 0) d.sendToIframe({ type: 'AI_HIGHLIGHT', index, hint: canvasHint(state.blocks[index], target) })
        }

        const onAsk = () => latest.current.openChat()

        window.addEventListener(EDITOR_AI_LOCATE_EVENT, onLocate)
        window.addEventListener(EDITOR_AI_HOVER_EVENT, onHover)
        if (deps.enabled) window.addEventListener(EDITOR_AI_ASK_EVENT, onAsk)
        return () => {
            window.removeEventListener(EDITOR_AI_LOCATE_EVENT, onLocate)
            window.removeEventListener(EDITOR_AI_HOVER_EVENT, onHover)
            window.removeEventListener(EDITOR_AI_ASK_EVENT, onAsk)
            stop()
        }
    }, [deps.enabled])
}
