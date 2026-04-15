'use client'

import { useState } from 'react'
import type { BlockProps } from '../types'
import type { DownloadCTAConfig } from './config'
import { CSS_VARS } from '@/lib/theme/resolve'
import { AnimatedSection } from '../shared/animations'
import { RichText } from '../shared/RichText'
import { Heading, Body } from '../shared/Typography'
import { CONTAINER, INNER_PADDING, SECTION_PADDING, TOUCH_TARGET, CARD_PADDING } from '@/lib/design-tokens'

const DC_CONTAINER = `${CONTAINER.default} mx-auto ${INNER_PADDING}`

function DownloadIcon({ color }: { color: string }) {
    return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{ color }}>
            <path d="M12 3v13m0 0l-4-4m4 4l4-4M5 20h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    )
}

function DownloadButton({ fileUrl, label }: { fileUrl: string; label: string; pc?: string }) {
    return (
        <a
            href={fileUrl}
            download
            className={`inline-flex items-center gap-2 px-8 py-3.5 rounded-xl font-semibold text-sm text-white transition-all duration-300 hover:opacity-90 ${TOUCH_TARGET.min}`}
            style={{ background: `linear-gradient(135deg, var(--brand-primary), rgba(var(--brand-primary-rgb), 0.800))`, boxShadow: `0 8px 30px rgba(var(--brand-primary-rgb), 0.208)` }}
        >
            <DownloadIcon color="#fff" />
            {label}
        </a>
    )
}

function EmailGate({ onSubmit, label }: { onSubmit: () => void; pc?: string; label: string }) {
    const [email, setEmail] = useState('')
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (email.trim()) onSubmit()
    }
    return (
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 w-full max-w-md">
            <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
                className="flex-1 px-4 py-3 rounded-xl bg-white/5 text-base outline-none transition-colors"
                style={{ border: `1px solid rgba(var(--brand-primary-rgb), 0.188)` }}
            />
            <button
                type="submit"
                className={`inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm text-white transition-all duration-300 hover:opacity-90 whitespace-nowrap ${TOUCH_TARGET.min}`}
                style={{ background: 'var(--brand-primary)' }}
            >
                <DownloadIcon color="#fff" />
                {label}
            </button>
        </form>
    )
}

export function DownloadCTABlock({ block, theme: _theme }: BlockProps<DownloadCTAConfig>) {
    void _theme
    const {
        variant = 'card',
        headline,
        description,
        fileUrl,
        fileName,
        fileSize,
        buttonLabel = 'Download',
        requireEmail = false,
    } = block
    const [unlocked, setUnlocked] = useState(!requireEmail)

    const fileMeta = (fileName || fileSize) && (
        <Body size="small" className="opacity-40 mt-2">
            {fileName}{fileName && fileSize && ' · '}{fileSize}
        </Body>
    )

    const action = unlocked ? (
        <DownloadButton fileUrl={fileUrl} label={buttonLabel} />
    ) : (
        <EmailGate onSubmit={() => setUnlocked(true)} label={buttonLabel} />
    )

    if (variant === 'minimal') {
        return (
            <AnimatedSection className={SECTION_PADDING.default}>
                <div className={`${DC_CONTAINER} text-center`}>
                    <Heading level={3} className="mb-3">
                        <RichText text={headline} as="span" />
                    </Heading>
                    {description && <Body className="opacity-50 mb-6 max-w-lg mx-auto">{description}</Body>}
                    <div className="flex flex-col items-center gap-2">
                        {action}
                        {fileMeta}
                    </div>
                </div>
            </AnimatedSection>
        )
    }

    if (variant === 'banner') {
        return (
            <AnimatedSection className={SECTION_PADDING.default}>
                <div className={DC_CONTAINER}>
                    <div
                        className="rounded-3xl p-10 md:p-16 flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden"
                        style={{
                            background: `linear-gradient(135deg, rgba(var(--brand-primary-rgb), 0.094) 0%, rgba(var(--brand-primary-rgb), 0.024) 100%)`,
                            border: `1px solid rgba(var(--brand-primary-rgb), 0.125)`,
                        }}
                    >
                        <div className="flex-1">
                            <Heading level={2} className="mb-3">
                                <RichText text={headline} as="span" />
                            </Heading>
                            {description && <Body className="opacity-50 max-w-lg">{description}</Body>}
                            {fileMeta}
                        </div>
                        <div className="shrink-0">{action}</div>
                    </div>
                </div>
            </AnimatedSection>
        )
    }

    // card (default)
    return (
        <AnimatedSection className={SECTION_PADDING.default}>
            <div className={`${DC_CONTAINER} flex justify-center`}>
                <div
                    className={`rounded-2xl ${CARD_PADDING.lg} md:p-12 text-center max-w-lg w-full`}
                    style={{ background: `rgba(var(--brand-primary-rgb), 0.031)`, border: `1px solid rgba(var(--brand-primary-rgb), 0.125)` }}
                >
                    <div
                        className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6"
                        style={{ background: `rgba(var(--brand-primary-rgb), 0.082)` }}
                    >
                        <DownloadIcon color={CSS_VARS.primary} />
                    </div>
                    <Heading level={3} className="mb-3">
                        <RichText text={headline} as="span" />
                    </Heading>
                    {description && <Body className="opacity-50 mb-6 max-w-sm mx-auto">{description}</Body>}
                    <div className="flex flex-col items-center gap-2">
                        {action}
                        {fileMeta}
                    </div>
                </div>
            </div>
        </AnimatedSection>
    )
}
