'use client'

import { useState } from 'react'
import type { BlockProps } from '../types'
import type { AnnouncementBarConfig } from './config'
import { CSS_VARS } from '@/lib/theme/resolve'
import { Body } from '../shared/Typography'
import { CONTAINER, TOUCH_TARGET } from '@/lib/design-tokens'

export function AnnouncementBarBlock({ block, theme: _theme }: BlockProps<AnnouncementBarConfig>) {
    void _theme
    const { message, linkText, linkUrl, dismissible = true, variant = 'gradient', backgroundColor } = block
    const [dismissed, setDismissed] = useState(false)

    if (dismissed) return null

    const bgStyle = (() => {
        const bg = backgroundColor || CSS_VARS.primary
        switch (variant) {
            case 'gradient':
                return { background: `linear-gradient(135deg, ${bg}, ${bg}cc)` }
            case 'solid':
                return { backgroundColor: bg }
            case 'minimal':
                return { backgroundColor: 'transparent', borderBottom: `1px solid rgba(var(--brand-primary-rgb), 0.125)` }
            default:
                return {}
        }
    })()

    const textColor = variant === 'minimal' ? undefined : '#ffffff'

    return (
        <section className="sticky top-0 z-50" role="banner">
            <div
                className="py-3 px-6"
                style={{ ...bgStyle, color: textColor }}
            >
                <div className={`${CONTAINER.default} mx-auto flex items-center justify-center gap-3`}>
                    <Body size="small" className="font-medium text-center">
                        {message}
                        {linkText && linkUrl && (
                            <>
                                {' '}
                                <a
                                    href={linkUrl}
                                    className="underline underline-offset-2 font-semibold hover:opacity-80 transition-opacity"
                                >
                                    {linkText} &rarr;
                                </a>
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
