'use client'
import { useEffect, useState } from 'react'
import type { BlockProps } from '../types'
import type { RichTextConfig } from './config'
import { sanitizeRichTextHtml } from './sanitize'
import styles from './rich-text.module.css'
export function RichTextBlock({ block }: BlockProps<RichTextConfig>) {
    const [html, setHtml] = useState('')
    useEffect(() => { setHtml(sanitizeRichTextHtml(block.html)) }, [block.html])
    return <section data-source-component={block.sourceComponentId} data-rich-text-document className={styles.document} style={{ paddingTop: block.paddingY, paddingBottom: block.paddingY }}>
        <div dangerouslySetInnerHTML={{ __html: html }} />
    </section>
}
