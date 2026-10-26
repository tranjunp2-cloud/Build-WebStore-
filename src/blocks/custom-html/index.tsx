'use client'

import './rich-text-content.css'
import { lazy, Suspense, useState, useEffect, useRef, useMemo } from 'react'
import { usePathname } from 'next/navigation'
import type { BlockProps } from '../types'
import type { CustomHtmlConfig } from './config'
import { CSS_VARS as _CSS_VARS } from '@/lib/theme/resolve'
import { AnimatedSection } from '../shared/animations'
import { SectionWrapper } from '@/blocks/shared/SectionWrapper'
import { proseThemeVars } from '@/lib/theme/prose-theme'

void _CSS_VARS

// Mounted only after an editor interaction, so no server render is needed.
// React.lazy avoids Next dynamic-import manifest generation in API routes
// that also import the block registry.
const InlineRichTextEditor = lazy(() => import('@/components/editor/RichTextBlockEditor'))

export function CustomHtmlBlock({ block }: BlockProps<CustomHtmlConfig>) {
    const { html = '' } = block
    const rootRef = useRef<HTMLDivElement>(null)
    const [editorMode, setEditorMode] = useState(false)
    const [editing, setEditing] = useState(false)
    const [editorReady, setEditorReady] = useState(false)
    useEffect(() => {
        setEditorMode(window.parent !== window && new URLSearchParams(window.location.search).get('editor') === '1')
    }, [])
    const send = (type: string, value?: string) => {
        const index = Number(rootRef.current?.closest('[data-block-index]')?.getAttribute('data-block-index'))
        window.parent.postMessage({ type, blockIndex: index, html: value }, window.location.origin)
    }
    const finish = (value?: string) => {
        setEditing(false)
        setEditorReady(false)
        send('RICH_TEXT_INLINE_END', value)
    }
    useEffect(() => () => {
        if (editing) window.parent.postMessage({ type: 'RICH_TEXT_INLINE_CANCEL' }, window.location.origin)
    }, [editing])
    const [sanitizedHtml, setSanitizedHtml] = useState('')
    const pathname = usePathname()
    // Rewrite only the rendered document; the editor continues to save portable URLs.
    const displayHtml = useMemo(() => {
        const base = pathname?.match(/^\/sites\/[^/]+/)?.[0]
        if (!base || !sanitizedHtml) return sanitizedHtml
        const document = new DOMParser().parseFromString(sanitizedHtml, 'text/html')
        document.querySelectorAll('a[href]').forEach(anchor => {
            const href = anchor.getAttribute('href')!
            if (/^\/(?!\/)/.test(href) && !/^\/(sites|preview)\//.test(href)) anchor.setAttribute('href', href === '/' ? base : `${base}${href}`)
        })
        return document.body.innerHTML
    }, [sanitizedHtml, pathname])

    useEffect(() => {
        let isMounted = true

        async function sanitize() {
            const { sanitizeRichHtml } = await import('./html-safety')

            if (!isMounted) return
            setSanitizedHtml(sanitizeRichHtml(html))
        }

        void sanitize()

        return () => {
            isMounted = false
        }
    }, [html])

    return (
        <SectionWrapper as={AnimatedSection} padding="compact" container="full" background="transparent" style={proseThemeVars} className={`relative overflow-hidden custom-html-block ${editing ? 'rich-text-inline-active' : ''}`} innerClassName="relative z-10 w-full prose prose-lg max-w-none prose-headings:font-heading prose-a:text-[var(--brand-primary)]">
            <div ref={rootRef} className="relative" data-editor-control={editorMode ? 'rich-text' : undefined}>
                {editing && <div style={editorReady ? undefined : { position: 'absolute', inset: 0, visibility: 'hidden', pointerEvents: 'none' }}
                    aria-hidden={!editorReady}>
                    <Suspense fallback={null}><InlineRichTextEditor html={sanitizedHtml} onReady={() => setEditorReady(true)}
                        onApply={finish} onCancel={() => finish()} /></Suspense>
                </div>}
                {(!editing || !editorReady) && (
                    // Min height in the editor: a block with no text must stay a click target to start editing
                    <div style={editorMode ? { minHeight: '3rem' } : undefined} onClick={editorMode ? event => {
                        event.preventDefault()
                        event.stopPropagation()
                        if (editing) return
                        setEditorReady(false)
                        setEditing(true)
                        send('RICH_TEXT_INLINE_START')
                    } : undefined}>
                        <div dangerouslySetInnerHTML={{ __html: displayHtml }} />
                    </div>
                )}
            </div>
        </SectionWrapper>
    )
}
