'use client'

import './rich-text-content.css'
import { useState, useEffect, useRef } from 'react'
import dynamic from 'next/dynamic'
import type { BlockProps } from '../types'
import type { CustomHtmlConfig } from './config'
import { CSS_VARS as _CSS_VARS } from '@/lib/theme/resolve'
import { AnimatedSection } from '../shared/animations'
import { SectionWrapper } from '@/blocks/shared/SectionWrapper'
import { proseThemeVars } from '@/lib/theme/prose-theme'

void _CSS_VARS

const InlineRichTextEditor = dynamic(() => import('@/components/editor/RichTextBlockEditor'), { ssr: false })

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
                    <InlineRichTextEditor html={sanitizedHtml} onReady={() => setEditorReady(true)}
                        onApply={finish} onCancel={() => finish()} />
                </div>}
                {(!editing || !editorReady) && (
                    <div onClick={editorMode ? event => {
                        event.preventDefault()
                        event.stopPropagation()
                        if (editing) return
                        setEditorReady(false)
                        setEditing(true)
                        send('RICH_TEXT_INLINE_START')
                    } : undefined}>
                        <div dangerouslySetInnerHTML={{ __html: sanitizedHtml }} />
                    </div>
                )}
            </div>
        </SectionWrapper>
    )
}
