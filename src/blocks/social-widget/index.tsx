'use client'

import type { BlockProps } from '../types'
import { getDefaultSocialWidgetLinks, normalizeSocialWidgetConfig, type SocialLinkItem, type SocialPlatform, type SocialWidgetConfig } from './config'
import { mergeSocialWidgetLinksWithSite } from '@/lib/site-settings'
import { Caption } from '../shared/Typography'
import { CONTAINER, INNER_PADDING, TOUCH_TARGET } from '@/lib/design-tokens'
import { Facebook, Instagram, Linkedin, Youtube, MessageCircle } from 'lucide-react'

const SW_CONTAINER = `${CONTAINER.default} mx-auto ${INNER_PADDING}`

const PLATFORM_META: Record<SocialPlatform, { label: string; icon: React.ComponentType<{ size?: number }>; accent: string }> = {
    facebook: { label: 'Facebook', icon: Facebook, accent: '#2563eb' },
    whatsapp: { label: 'WhatsApp', icon: MessageCircle, accent: '#16a34a' },
    instagram: { label: 'Instagram', icon: Instagram, accent: '#db2777' },
    linkedin: { label: 'LinkedIn', icon: Linkedin, accent: '#0284c7' },
    youtube: { label: 'YouTube', icon: Youtube, accent: '#dc2626' },
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

function getPlatformStyles(platform: SocialPlatform) {
    const accent = PLATFORM_META[platform].accent

    return {
        background: `linear-gradient(135deg, ${accent}20, rgba(var(--brand-primary-rgb), 0.086))`,
        borderColor: `${accent}40`,
        color: accent,
    }
}

function PlatformBadge({ platform }: { platform: SocialPlatform }) {
    const meta = PLATFORM_META[platform]
    const Icon = meta.icon

    return (
        <span
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border bg-white/90 shadow-[0_10px_24px_rgba(15,23,42,0.12)]"
            style={{ color: meta.accent, borderColor: `${meta.accent}22` }}
        >
            <Icon size={16} />
        </span>
    )
}

type SocialLinkAnchorProps = {
    platform: SocialPlatform
    url: string
    showLabelAlways?: boolean
    extraClassName?: string
}

/** Shared anchor for both inline + floating variants. Meets TOUCH_TARGET.min. */
function SocialLinkAnchor({ platform, url, showLabelAlways = false, extraClassName = '' }: SocialLinkAnchorProps) {
    const meta = PLATFORM_META[platform]
    const style = getPlatformStyles(platform)
    // Floating variant is icon-only — labels are screen-reader-only (not hover-shown).
    // Inline variant (showLabelAlways) renders visible text beside the icon.
    const labelCls = showLabelAlways
        ? 'text-sm font-medium text-white/85'
        : 'sr-only'
    return (
        <a
            href={normalizeUrl(platform, url)}
            target="_blank"
            rel="noreferrer"
            aria-label={meta.label}
            className={`group flex items-center gap-3 rounded-2xl border px-3 py-2 transition-transform duration-200 hover:-translate-y-0.5 ${TOUCH_TARGET.min} ${extraClassName}`.trim()}
            style={style}
        >
            <PlatformBadge platform={platform} />
            <span className={labelCls}>{meta.label}</span>
        </a>
    )
}

export function SocialWidgetBlock({ block, site }: BlockProps<SocialWidgetConfig>) {
    const normalizedBlock = normalizeSocialWidgetConfig(mergeSocialWidgetLinksWithSite(block, site?.socialLinks))
    let links = normalizedBlock.links.filter((item: SocialLinkItem) => item.enabled !== false)
    if (links.length === 0) {
        links = getDefaultSocialWidgetLinks().filter(item => item.enabled !== false)
    }

    // ── Inline variant ───────────────────────────────────────────────────
    if (block.variant === 'inline') {
        return (
            <section className="py-10">
                <div className={SW_CONTAINER}>
                    {normalizedBlock.headline ? (
                        <Caption className="mb-3 block font-medium text-slate-400">{normalizedBlock.headline}</Caption>
                    ) : null}
                    <div className="flex flex-wrap gap-3">
                        {links.map(item => (
                            <SocialLinkAnchor
                                key={item.platform}
                                platform={item.platform}
                                url={item.url}
                                showLabelAlways
                                extraClassName="shadow-[0_14px_32px_rgba(15,23,42,0.12)]"
                            />
                        ))}
                    </div>
                </div>
            </section>
        )
    }

    // ── Default: floating variant ────────────────────────────────────────
    return (
        <section className="fixed bottom-6 right-6 z-40">
            <div className="flex flex-col items-end gap-3">
                {normalizedBlock.headline ? (
                    <Caption className="mb-1 block font-medium text-slate-400">{normalizedBlock.headline}</Caption>
                ) : null}
                <div className="flex flex-col gap-3">
                    {links.map(item => (
                        <SocialLinkAnchor
                            key={item.platform}
                            platform={item.platform}
                            url={item.url}
                            extraClassName="shadow-[0_14px_32px_rgba(15,23,42,0.18)] backdrop-blur-sm"
                        />
                    ))}
                </div>
            </div>
        </section>
    )
}
