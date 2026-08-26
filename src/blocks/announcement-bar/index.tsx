'use client'

import { useState } from 'react'
import type { BlockProps } from '../types'
import type { AnnouncementBarConfig } from './config'
import { CSS_VARS } from '@/lib/theme/resolve'
import { Body } from '../shared/Typography'
import { useLocalHref } from '@/lib/hooks/use-local-href'
import { SmartLink } from '@/blocks/_shared/smart-link'
import { CONTAINER, TOUCH_TARGET } from '@/lib/design-tokens'

function getLinkAttrs(url: string, isInternal?: boolean): { target?: string; rel?: string } {
    if (isInternal) return {}
    if (url.startsWith('http://') || url.startsWith('https://')) {
        return { target: '_blank', rel: 'noopener noreferrer' }
    }
    return {}
}

export function AnnouncementBarBlock({ block, theme: _theme }: BlockProps<AnnouncementBarConfig>) {
    void _theme
    const { message, showLink, linkText, linkUrl, linkIsInternal, backgroundColor, backgroundColor2, textColor } = block
    const spacing = (block as Record<string, unknown>).blockSpacing as { paddingTop?: number; paddingBottom?: number } | undefined
    // Use ?? (not destructuring default) — Payload returns null (not undefined) for unset DB columns,
    // which makes destructuring defaults ineffective for boolean/enum/number fields.
    const dismissible = ((block as Record<string, unknown>).dismissible as boolean | null | undefined) ?? true
    const variant = ((block as Record<string, unknown>).variant as string | null | undefined) ?? 'gradient'
    const paddingY = ((block as Record<string, unknown>).paddingY as number | null | undefined) ?? 12
    const paddingTop = spacing?.paddingTop ?? paddingY
    const paddingBottom = spacing?.paddingBottom ?? paddingY
    const resolveHref = useLocalHref()
    const [dismissed, setDismissed] = useState(false)

    if (dismissed) return null

    const bgStyle = (() => {
        const bg = backgroundColor || CSS_VARS.primary
        switch (variant) {
            case 'gradient':
                return { background: `linear-gradient(135deg, ${bg}, ${backgroundColor2 || CSS_VARS.secondary})` }
            case 'solid':
                return { backgroundColor: bg }
            case 'minimal':
                return { backgroundColor: 'transparent', borderBottom: `1px solid rgba(var(--brand-primary-rgb), 0.125)` }
            default:
                return {}
        }
    })()

    const resolvedTextColor = variant === 'minimal' ? (textColor ?? undefined) : (textColor || '#ffffff')

    return (
        <section className="sticky top-0 z-50" role="banner" data-no-text-edit>
            <div
                className="px-6"
                style={{ ...bgStyle, color: resolvedTextColor, paddingTop, paddingBottom }}
            >
                <div className={`${CONTAINER.default} mx-auto flex items-center justify-center gap-3`}>
                    <Body size="small" className="font-medium text-center" data-text-editable>
                        {message}
                        {showLink !== false && linkText && linkText.trim() && linkUrl && !linkUrl.startsWith('javascript:') && (
                            <>
                                {' '}
                                <SmartLink
                                    href={resolveHref(linkUrl)}
                                    className="underline underline-offset-2 font-semibold hover:opacity-80 transition-opacity"
                                    {...getLinkAttrs(linkUrl, linkIsInternal)}
                                >
                                    {linkText} &rarr;
                                </SmartLink>
                            </>
                        )}
                    </Body>
                    {dismissible && (
                        <button
                            type="button"
                            onClick={() => setDismissed(true)}
                            className={`ml-4 flex-shrink-0 opacity-70 hover:opacity-100 transition-opacity ${TOUCH_TARGET.min} min-w-[44px] flex items-center justify-center`}
                            aria-label="Dismiss announcement"
                        >
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                                <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                            </svg>
                        </button>
                    )}
                </div>
            </div>
        </section>
    )
}
