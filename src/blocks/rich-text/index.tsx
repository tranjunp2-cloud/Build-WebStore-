'use client'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import type { BlockProps } from '../types'
import type { RichTextConfig } from './config'
import { sanitizeRichTextHtml } from './sanitize'
import styles from './rich-text.module.css'
export function RichTextBlock({ block }: BlockProps<RichTextConfig>) {
    const [html, setHtml] = useState('')
    const pathname = usePathname()
    useEffect(() => {
        const document = new DOMParser().parseFromString(sanitizeRichTextHtml(block.html), 'text/html')
        const base = pathname?.match(/^\/sites\/[^/]+/)?.[0]
        if (base) document.querySelectorAll('a[href]').forEach(anchor => {
            const href = anchor.getAttribute('href')!
            if (/^\/(?!\/)/.test(href) && !/^\/(sites|preview)\//.test(href)) anchor.setAttribute('href', href === '/' ? base : `${base}${href}`)
        })
        setHtml(document.body.innerHTML)
    }, [block.html, pathname])
    return <section data-source-component={block.sourceComponentId} data-rich-text-document className={styles.document} style={{ paddingTop: block.paddingY, paddingBottom: block.paddingY }}>
        <div dangerouslySetInnerHTML={{ __html: html }} />
    </section>
}
