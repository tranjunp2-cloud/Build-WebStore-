'use client'

import { useState, useEffect } from 'react'
import type { BlockProps } from '../types'
import type { CustomHtmlConfig } from './config'
import { CSS_VARS as _CSS_VARS } from '@/lib/theme/resolve'
import { AnimatedSection } from '../shared/animations'
import { SectionWrapper } from '@/blocks/shared/SectionWrapper'
import { proseThemeVars } from '@/lib/theme/prose-theme'

void _CSS_VARS

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
        <SectionWrapper as={AnimatedSection} padding="compact" container="full" background="transparent" style={proseThemeVars} className="relative overflow-hidden custom-html-block" innerClassName="relative z-10 w-full prose prose-lg max-w-none prose-headings:font-heading prose-a:text-[var(--brand-primary)]">
            <div dangerouslySetInnerHTML={{ __html: sanitizedHtml }} />
        </SectionWrapper>
    )
}
