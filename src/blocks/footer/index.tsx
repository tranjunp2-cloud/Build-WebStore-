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

function SocialIcon({ platform }: { platform: string }) {
    const Icon = SOCIAL_ICONS[platform.toLowerCase()]
    return Icon ? <Icon size={16} /> : <span>{(platform || '').charAt(0).toUpperCase()}</span>
}

export function FooterBlock({ block, theme, site }: BlockProps<FooterConfig>) {
    const mergedBlock = mergeFooterSocialsWithSite(block, site)
    const { logoText, tagline, columns = [], copyrightText, variant = 'simple' } = mergedBlock

    const copyrightLine = copyrightText
        ? copyrightText.replace(/\d{4}/, String(new Date().getFullYear()))
        : `\u00A9 ${new Date().getFullYear()} ${logoText || 'All rights reserved'}`

    const socialsArr = (mergedBlock.socials && Array.isArray(mergedBlock.socials) ? mergedBlock.socials : []) as { url?: string; platform?: string; label?: string }[]

    // ── Centered Stack variant ────────────────────────────────────────────
    if (variant === 'centered-stack') {
        return (
            <footer className="py-16 relative">
                <GradientLine from={theme.primaryColor} to={`rgba(var(--brand-primary-rgb), 0)`} className="absolute top-0 left-0" height={1} />
                <div className="container mx-auto px-6 text-center">
                    {/* Logo */}
                    <div className="font-bold text-2xl font-heading mb-4">
                        {mergedBlock.logo?.url ? (
                            <img src={mergedBlock.logo.url} alt={logoText} className="h-8 w-auto mx-auto" />
                        ) : (
                            <span style={{
                                background: `linear-gradient(135deg, var(--brand-primary), rgba(var(--brand-primary-rgb), 0.502))`,
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                backgroundClip: 'text',
                            }}>
                                {logoText}
                            </span>
                        )}
                    </div>
                    {tagline && <p className="opacity-40 text-sm mb-8 max-w-md mx-auto">{tagline}</p>}

                    {/* Link columns as horizontal lists */}
                    {columns.length > 0 && (
                        <div className="mb-8 space-y-4">
                            {columns.map((col, i) => (
                                <div key={i}>
                                    <h4 className="text-xs font-semibold uppercase tracking-widest opacity-50 mb-2">{col.title}</h4>
                                    <div className="flex flex-wrap justify-center gap-x-6 gap-y-1">
                                        {(col.links || []).map((link, j) => (
                                            <a key={j} href={link.url} className="text-sm opacity-40 hover:opacity-80 transition-opacity duration-200">
                                                {link.label}
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Social icons */}
                    {socialsArr.length > 0 && (
                        <div className="flex justify-center gap-3 mb-8">
                            {socialsArr.map((social, i) => (
                                <a
                                    key={i}
                                    href={social.url || '#'}
                                    className="w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200 hover:scale-110"
                                    style={{
                                        background: `rgba(var(--brand-primary-rgb), 0.063)`,
                                        border: `1px solid rgba(var(--brand-primary-rgb), 0.082)`,
                                        color: 'var(--brand-primary)',
                                    }}
                                >
                                    <SocialIcon platform={social.platform || ''} />
                                </a>
                            ))}
                        </div>
                    )}

                    {/* Copyright */}
                    <p className="text-xs opacity-30">{copyrightLine}</p>
                </div>
            </footer>
        )
    }

    // ── Mega Footer variant ───────────────────────────────────────────────
    if (variant === 'mega-footer') {
        return (
            <footer className="relative">
                {/* Top band */}
                <div
                    className="py-10"
                    style={{ background: `var(--brand-primary)` }}
                >
                    <div className="container mx-auto px-6 text-center">
                        <h3 className="text-xl font-bold text-white font-heading mb-2">Stay Connected</h3>
                        <p className="text-white/70 text-sm mb-4">Subscribe for the latest updates and news.</p>
                        <div className="flex gap-2 max-w-md mx-auto">
                            <input
                                type="email"
                                placeholder="Enter your email"
                                className="flex-1 px-4 py-2.5 rounded-lg text-sm bg-white/20 text-white placeholder-white/50 border border-white/20 outline-none focus:border-white/40 transition-colors"
                            />
                            <button className="px-5 py-2.5 rounded-lg text-sm font-semibold bg-white transition-opacity hover:opacity-90" style={{ color: 'var(--brand-primary)' }}>
                                Subscribe
                            </button>
                        </div>
                    </div>
                </div>

                {/* Main footer content */}
                <div className="pt-14 pb-8">
                    <div className="container mx-auto px-6">
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-8 mb-12">
                            {/* Brand column */}
                            <div className="col-span-2 md:col-span-1">
                                <div className="font-bold text-xl font-heading mb-3">
                                    {mergedBlock.logo?.url ? (
                                        <img src={mergedBlock.logo.url} alt={logoText} className="h-8 w-auto" />
                                    ) : (
                                        <span style={{
                                            background: `linear-gradient(135deg, var(--brand-primary), rgba(var(--brand-primary-rgb), 0.502))`,
                                            WebkitBackgroundClip: 'text',
                                            WebkitTextFillColor: 'transparent',
                                            backgroundClip: 'text',
                                        }}>
                                            {logoText}
                                        </span>
                                    )}
                                </div>
                                {tagline && <p className="opacity-40 text-sm leading-relaxed max-w-xs">{tagline}</p>}
                            </div>

                            {/* Link columns */}
                            {columns.map((col, i) => (
                                <div key={i}>
                                    <h4 className="font-semibold text-sm mb-4 opacity-80">{col.title}</h4>
                                    <ul className="space-y-2.5">
                                        {(col.links || []).map((link, j) => (
                                            <li key={j}>
                                                <a href={link.url} className="text-sm opacity-40 hover:opacity-80 transition-opacity duration-200">
                                                    {link.label}
                                                </a>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </div>

                        {/* Bottom bar */}
                        <div
                            className="pt-6 flex flex-col md:flex-row items-center justify-between gap-4"
                            style={{ borderTop: `1px solid rgba(var(--brand-primary-rgb), 0.063)` }}
                        >
                            <p className="text-xs opacity-30">{copyrightLine}</p>
                            <div className="flex items-center gap-4">
                                {socialsArr.length > 0 && (
                                    <div className="flex gap-2">
                                        {socialsArr.map((social, i) => (
                                            <a
                                                key={i}
                                                href={social.url || '#'}
                                                className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 hover:scale-110"
                                                style={{
                                                    background: `rgba(var(--brand-primary-rgb), 0.063)`,
                                                    color: 'var(--brand-primary)',
                                                }}
                                            >
                                                <SocialIcon platform={social.platform || ''} />
                                            </a>
                                        ))}
                                    </div>
                                )}
                                <div className="flex gap-4 text-xs opacity-30">
                                    <a href="#" className="hover:opacity-80 transition-opacity">Privacy</a>
                                    <a href="#" className="hover:opacity-80 transition-opacity">Terms</a>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </footer>
        )
    }

    // ── Dark Gradient variant ─────────────────────────────────────────────
    if (variant === 'dark-gradient') {
        return (
            <footer
                className="py-14 relative"
                style={{
                    background: `linear-gradient(to bottom, transparent, rgba(0,0,0,0.08))`,
                }}
            >
                <GradientLine from={theme.primaryColor} to={`rgba(var(--brand-primary-rgb), 0)`} className="absolute top-0 left-0" height={1} />
                <div className="container mx-auto px-6">
                    <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-10">
                        {/* Logo + tagline */}
                        <div className="lg:max-w-xs">
                            <div className="font-bold text-2xl font-heading mb-3">
                                {mergedBlock.logo?.url ? (
                                    <img src={mergedBlock.logo.url} alt={logoText} className="h-8 w-auto" />
                                ) : (
                                    <span style={{
                                        background: `linear-gradient(135deg, var(--brand-primary), rgba(var(--brand-primary-rgb), 0.502))`,
                                        WebkitBackgroundClip: 'text',
                                        WebkitTextFillColor: 'transparent',
                                        backgroundClip: 'text',
                                    }}>
                                        {logoText}
                                    </span>
                                )}
                            </div>
                            {tagline && <p className="opacity-40 text-sm leading-relaxed">{tagline}</p>}
                        </div>

                        {/* Link columns center */}
                        {columns.length > 0 && (
                            <div className="flex flex-wrap gap-10">
                                {columns.map((col, i) => (
                                    <div key={i}>
                                        <h4 className="font-semibold text-sm mb-4 opacity-80">{col.title}</h4>
                                        <ul className="space-y-2.5">
                                            {(col.links || []).map((link, j) => (
                                                <li key={j}>
                                                    <a href={link.url} className="text-sm opacity-40 hover:opacity-80 transition-opacity duration-200">
                                                        {link.label}
                                                    </a>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Socials right */}
                        {socialsArr.length > 0 && (
                            <div className="flex lg:flex-col gap-3">
                                {socialsArr.map((social, i) => (
                                    <a
                                        key={i}
                                        href={social.url || '#'}
                                        className="w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200 hover:scale-110"
                                        style={{
                                            background: `rgba(var(--brand-primary-rgb), 0.063)`,
                                            border: `1px solid rgba(var(--brand-primary-rgb), 0.082)`,
                                            color: 'var(--brand-primary)',
                                        }}
                                    >
                                        <SocialIcon platform={social.platform || ''} />
                                    </a>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Copyright */}
                    <div className="mt-10 pt-6 text-center" style={{ borderTop: `1px solid rgba(var(--brand-primary-rgb), 0.063)` }}>
                        <p className="text-xs opacity-30">{copyrightLine}</p>
                    </div>
                </div>
            </footer>
        )
    }

    // ── Default: simple / expanded / minimal (existing) ───────────────────
    return (
        <footer className="pt-20 pb-8 relative">
            {/* Top gradient line */}
            <GradientLine from={theme.primaryColor} to={`rgba(var(--brand-primary-rgb), 0)`} className="absolute top-0 left-0" height={1} />

            <div className="container mx-auto px-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 mb-16">
                    {/* Brand Column */}
                    <div className="md:col-span-1">
                        <div className="font-bold text-2xl font-heading mb-4">
                            {mergedBlock.logo?.url ? (
                                <img src={mergedBlock.logo.url} alt={logoText} className="h-8 w-auto" />
                            ) : (
                                <span style={{
                                    background: `linear-gradient(135deg, var(--brand-primary), rgba(var(--brand-primary-rgb), 0.502))`,
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
                        {socialsArr.length > 0 && (
                            <div className="flex gap-3 mt-6">
                                {socialsArr.map((social, i) => (
                                    <a
                                        key={i}
                                        href={social.url || '#'}
                                        className="w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold transition-all duration-200 hover:scale-110"
                                        style={{
                                            background: `rgba(var(--brand-primary-rgb), 0.063)`,
                                            border: `1px solid rgba(var(--brand-primary-rgb), 0.082)`,
                                            color: 'var(--brand-primary)',
                                        }}
                                    >
                                        <SocialIcon platform={social.platform || ''} />
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
                <div className="pt-8 text-center" style={{ borderTop: `1px solid rgba(var(--brand-primary-rgb), 0.063)` }}>
                    <p className="text-xs opacity-30">{copyrightLine}</p>
                </div>
            </div>
        </footer>
    )
}
