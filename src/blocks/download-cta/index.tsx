'use client'

import { useState } from 'react'
import type { BlockProps } from '../types'
import type { DownloadCTAConfig } from './config'
import { AnimatedSection } from '../shared/animations'

function DownloadIcon({ color }: { color: string }) {
    return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{ color }}>
            <path d="M12 3v13m0 0l-4-4m4 4l4-4M5 20h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    )
}

function DownloadButton({ fileUrl, label, pc }: { fileUrl: string; label: string; pc: string }) {
    return (
        <a
            href={fileUrl}
            download
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl font-semibold text-sm text-white transition-all duration-300 hover:opacity-90"
            style={{ background: `linear-gradient(135deg, var(--brand-primary), rgba(var(--brand-primary-rgb), 0.800))`, boxShadow: `0 8px 30px rgba(var(--brand-primary-rgb), 0.208)` }}
        >
            <DownloadIcon color="#fff" />
            {label}
        </a>
    )
}

function EmailGate({ onSubmit, pc, label }: { onSubmit: () => void; pc: string; label: string }) {
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
                className="flex-1 px-4 py-3 rounded-xl bg-white/5 text-sm outline-none transition-colors"
                style={{ border: `1px solid rgba(var(--brand-primary-rgb), 0.188)` }}
            />
            <button
                type="submit"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm text-white transition-all duration-300 hover:opacity-90 whitespace-nowrap"
                style={{ background: 'var(--brand-primary)' }}
            >
                <DownloadIcon color="#fff" />
                {label}
            </button>
        </form>
    )
}

export function DownloadCTABlock({ block, theme }: BlockProps<DownloadCTAConfig>) {
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
        <p className="text-sm opacity-40 mt-2">
            {fileName}{fileName && fileSize && ' · '}{fileSize}
        </p>
    )

    const action = unlocked ? (
        <DownloadButton fileUrl={fileUrl} label={buttonLabel} pc={theme.primaryColor} />
    ) : (
        <EmailGate onSubmit={() => setUnlocked(true)} pc={theme.primaryColor} label={buttonLabel} />
    )

    if (variant === 'minimal') {
        return (
            <AnimatedSection className="py-24">
                <div className="container mx-auto px-6 text-center">
                    <h2 className="text-2xl md:text-3xl font-bold font-heading mb-3">{headline}</h2>
                    {description && <p className="opacity-50 mb-6 max-w-lg mx-auto">{description}</p>}
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
            <AnimatedSection className="py-24">
                <div className="container mx-auto px-6">
                    <div
                        className="rounded-3xl p-10 md:p-16 flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden"
                        style={{
                            background: `linear-gradient(135deg, rgba(var(--brand-primary-rgb), 0.094) 0%, rgba(var(--brand-primary-rgb), 0.024) 100%)`,
                            border: `1px solid rgba(var(--brand-primary-rgb), 0.125)`,
                        }}
                    >
                        <div className="flex-1">
                            <h2 className="text-3xl md:text-4xl font-bold font-heading mb-3">{headline}</h2>
                            {description && <p className="opacity-50 max-w-lg">{description}</p>}
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
        <AnimatedSection className="py-24">
            <div className="container mx-auto px-6 flex justify-center">
                <div
                    className="rounded-2xl p-8 md:p-12 text-center max-w-lg w-full"
                    style={{ background: `rgba(var(--brand-primary-rgb), 0.031)`, border: `1px solid rgba(var(--brand-primary-rgb), 0.125)` }}
                >
                    <div
                        className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6"
                        style={{ background: `rgba(var(--brand-primary-rgb), 0.082)` }}
                    >
                        <DownloadIcon color={theme.primaryColor} />
                    </div>
                    <h2 className="text-2xl md:text-3xl font-bold font-heading mb-3">{headline}</h2>
                    {description && <p className="opacity-50 mb-6 max-w-sm mx-auto">{description}</p>}
                    <div className="flex flex-col items-center gap-2">
                        {action}
                        {fileMeta}
                    </div>
                </div>
            </div>
        </AnimatedSection>
    )
}
