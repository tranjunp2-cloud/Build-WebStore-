'use client'

import type { BlockProps } from '../types'
import type { FooterConfig } from './config'
import { GradientLine } from '../shared/decorative'
import { mergeFooterSocialsWithSite } from '@/lib/site-settings'
import { Facebook, Instagram, Twitter, Linkedin, Youtube, Globe } from 'lucide-react'

const SOCIAL_ICONS: Record<string, React.ComponentType<{ size?: number }>> = {
    facebook: Facebook,
    instagram: Instagram,
    twitter: Twitter,
    x: Twitter,
    linkedin: Linkedin,
    youtube: Youtube,
    tiktok: Globe,
}

export function FooterBlock({ block, theme, site }: BlockProps<FooterConfig>) {
    const mergedBlock = mergeFooterSocialsWithSite(block, site)
    const { logoText, tagline, columns = [], copyrightText } = mergedBlock
    const pc = theme.primaryColor

    return (
        <footer className="pt-20 pb-8 relative">
            {/* Top gradient line */}
            <GradientLine from={pc} to={`${pc}00`} className="absolute top-0 left-0" height={1} />

            <div className="container mx-auto px-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 mb-16">
                    {/* Brand Column */}
                    <div className="md:col-span-1">
                        <div className="font-bold text-2xl font-heading mb-4">
                            {mergedBlock.logo?.url ? (
                                <img src={mergedBlock.logo.url} alt={logoText} className="h-8 w-auto" />
                            ) : (
                                <span style={{
                                    background: `linear-gradient(135deg, ${pc}, ${pc}80)`,
                                    WebkitBackgroundClip: 'text',
                                    WebkitTextFillColor: 'transparent',
                                    backgroundClip: 'text',
                                }}>
                                    {logoText}
                                </span>
                            )}
                        </div>
                        {tagline && <p className="opacity-40 text-sm leading-relaxed max-w-xs">{tagline}</p>}

                        {/* Social icons placeholder */}
                        {mergedBlock.socials && Array.isArray(mergedBlock.socials) && mergedBlock.socials.length > 0 && (
                            <div className="flex gap-3 mt-6">
                                {mergedBlock.socials.map((social: { url?: string; platform?: string; label?: string }, i: number) => (
                                    <a
                                        key={i}
                                        href={social.url || '#'}
                                        className="w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold transition-all duration-200 hover:scale-110"
                                        style={{
                                            background: `${pc}10`,
                                            border: `1px solid ${pc}15`,
                                            color: pc,
                                        }}
                                    >
                                        {(() => {
                                            const platform = (social.platform || '').toLowerCase()
                                            const Icon = SOCIAL_ICONS[platform]
                                            return Icon ? <Icon size={16} /> : (social.platform || '•').charAt(0).toUpperCase()
                                        })()}
                                    </a>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Link Columns */}
                    {columns.map((col, i) => (
                        <div key={i}>
                            <h4 className="font-semibold text-sm mb-5 opacity-80">{col.title}</h4>
                            <ul className="space-y-3">
                                {(col.links || []).map((link, j) => (
                                    <li key={j}>
                                        <a
                                            href={link.url}
                                            className="text-sm opacity-40 hover:opacity-80 transition-all duration-200 hover:translate-x-1 inline-block"
                                        >
                                            {link.label}
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>

                {/* Bottom bar */}
                <div className="pt-8 text-center" style={{ borderTop: `1px solid ${pc}10` }}>
                    <p className="text-xs opacity-30">
                        {copyrightText
                            ? copyrightText.replace(/\d{4}/, String(new Date().getFullYear()))
                            : `© ${new Date().getFullYear()} ${logoText || 'All rights reserved'}`}
                    </p>
                </div>
            </div>
        </footer>
    )
}
