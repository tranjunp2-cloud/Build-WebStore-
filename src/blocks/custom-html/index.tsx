'use client'

import { useState, useEffect } from 'react'
import type { BlockProps } from '../types'
import type { CustomHtmlConfig } from './config'
import { CSS_VARS } from '@/lib/theme/resolve'
import { AnimatedSection } from '../shared/animations'

export function CustomHtmlBlock({ block }: BlockProps<CustomHtmlConfig>) {
    const { html = '' } = block
    const [sanitizedHtml, setSanitizedHtml] = useState('')

    useEffect(() => {
        let isMounted = true

        async function sanitize() {
            const { default: createDOMPurify } = await import('dompurify')
            const DOMPurify = createDOMPurify(window)

            if (!isMounted) return
            setSanitizedHtml(DOMPurify.sanitize(html))
        }

        void sanitize()

        return () => {
            isMounted = false
        }
    }, [html])

    return (
        <AnimatedSection className="py-16 relative overflow-hidden custom-html-block">
            <div className="container mx-auto px-6 relative z-10 w-full prose prose-lg dark:prose-invert max-w-none prose-headings:font-heading prose-a:text-[var(--brand-primary)]">
                <div dangerouslySetInnerHTML={{ __html: sanitizedHtml }} />
            </div>
        </AnimatedSection>
    )
}
