'use client'

import type { BlockProps } from '../types'
import type { SocialLinkItem, SocialPlatform, SocialWidgetConfig } from './config'

const PLATFORM_META: Record<SocialPlatform, { label: string; mark: string; accent: string }> = {
    facebook: { label: 'Facebook', mark: 'f', accent: '#2563eb' },
    whatsapp: { label: 'WhatsApp', mark: 'wa', accent: '#16a34a' },
    instagram: { label: 'Instagram', mark: 'ig', accent: '#db2777' },
    linkedin: { label: 'LinkedIn', mark: 'in', accent: '#0284c7' },
    youtube: { label: 'YouTube', mark: '▶', accent: '#dc2626' },
}

function normalizeUrl(platform: SocialPlatform, value: string) {
    const trimmed = value.trim()
    if (!trimmed) return '#'
    if (/^https?:\/\//i.test(trimmed)) return trimmed

    if (platform === 'whatsapp') {
        const digits = trimmed.replace(/[^\d]/g, '')
        return digits ? `https://wa.me/${digits}` : '#'
    }

    return `https://${trimmed}`
}

function getPlatformStyles(platform: SocialPlatform, primaryColor: string) {
    const accent = PLATFORM_META[platform].accent

    return {
        background: `linear-gradient(135deg, ${accent}20, ${primaryColor}16)`,
        borderColor: `${accent}40`,
        color: accent,
    }
}

function PlatformBadge({ platform }: { platform: SocialPlatform }) {
    const meta = PLATFORM_META[platform]

    return (
        <span
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border bg-white/90 text-[11px] font-black uppercase tracking-[0.04em] shadow-[0_10px_24px_rgba(15,23,42,0.12)]"
            style={{ color: meta.accent, borderColor: `${meta.accent}22` }}
        >
            {meta.mark}
        </span>
    )
}

export function SocialWidgetBlock({ block, theme }: BlockProps<SocialWidgetConfig>) {
    let links = (block.links || []).filter((item: SocialLinkItem) => item.enabled !== false)
    const isFloating = block.variant !== 'inline'

    if (links.length === 0) {
        links = [
            { platform: 'facebook', url: '', enabled: true },
            { platform: 'whatsapp', url: '', enabled: true },
            { platform: 'instagram', url: '', enabled: true },
        ]
    }

    return (
        <section className={isFloating ? 'fixed bottom-6 right-6 z-40' : 'py-10'}>
            <div className={isFloating ? 'flex flex-col items-end gap-3' : 'container mx-auto px-6'}>
                {block.headline ? (
                    <p className="mb-1 text-sm font-medium text-slate-400">{block.headline}</p>
                ) : null}
                <div className={`flex ${isFloating ? 'flex-col' : 'flex-wrap'} gap-3`}>
                    {links.map(item => {
                        const platform = item.platform
                        const meta = PLATFORM_META[platform]
                        const style = getPlatformStyles(platform, theme.primaryColor)

                        return (
                            <a
                                key={platform}
                                href={normalizeUrl(platform, item.url)}
                                target="_blank"
                                rel="noreferrer"
                                aria-label={meta.label}
                                className={isFloating
                                    ? 'group flex items-center gap-3 rounded-2xl border px-3 py-2 shadow-[0_14px_32px_rgba(15,23,42,0.18)] backdrop-blur-sm transition-transform duration-200 hover:-translate-y-0.5'
                                    : 'group flex items-center gap-3 rounded-2xl border px-3 py-2 shadow-[0_14px_32px_rgba(15,23,42,0.12)] transition-transform duration-200 hover:-translate-y-0.5'
                                }
                                style={style}
                            >
                                <PlatformBadge platform={platform} />
                                <span className={isFloating ? 'hidden text-sm font-medium text-white/85 group-hover:block' : 'text-sm font-medium text-white/85'}>
                                    {meta.label}
                                </span>
                            </a>
                        )
                    })}
                </div>
            </div>
        </section>
    )
}
