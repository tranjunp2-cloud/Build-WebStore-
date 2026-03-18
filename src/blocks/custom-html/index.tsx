'use client'

import DOMPurify from 'isomorphic-dompurify'
import { useState, useEffect } from 'react'
import type { BlockProps } from '../types'
import type { CustomHtmlConfig } from './config'

export function CustomHtmlBlock({ block }: BlockProps<CustomHtmlConfig>) {
    const { html = '' } = block
    const [sanitizedHtml, setSanitizedHtml] = useState('')

    useEffect(() => {
        // Sanitize the HTML to prevent XSS only on the client
        // This avoids `enoent` jsdom errors during Next.js SSR
        setSanitizedHtml(DOMPurify.sanitize(html))
    }, [html])

    return (

        <section className="py-16 relative overflow-hidden custom-html-block">
            <div className="container mx-auto px-6 relative z-10 w-full prose prose-lg dark:prose-invert max-w-none prose-headings:font-heading prose-a:text-[var(--brand-primary)]">
                <div dangerouslySetInnerHTML={{ __html: sanitizedHtml }} />
            </div>
        </section>
    )
}
