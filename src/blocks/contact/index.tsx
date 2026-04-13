'use client'

import type { ReactNode, ComponentType } from 'react'
import type { BlockProps } from '../types'
import type { ContactConfig, FormField } from './config'
import { AnimatedSection } from '../shared/animations'
import { GradientBlob, SectionLabel, GlassCard } from '../shared/decorative'
import { motion } from 'framer-motion'
import { mergeContactInfoWithSite } from '@/lib/site-settings'
import { Mail, Phone, MapPin } from 'lucide-react'
import { CSS_VARS } from '@/lib/theme/resolve'
import { RichText } from '../shared/RichText'
import { Heading, Body, Caption } from '../shared/Typography'
import { CONTAINER, INNER_PADDING, SECTION_PADDING, TOUCH_TARGET, CARD_PADDING } from '@/lib/design-tokens'

// ── Local helpers (Phase 05 refactor) ───────────────────────────────────────

const CONTACT_CONTAINER = `${CONTAINER.default} mx-auto ${INNER_PADDING}`

type ContactSectionProps = {
    showBlob?: boolean
    compact?: boolean
    children: ReactNode
}

/** Outer wrapper for 5/6 variants. Minimal-inline uses py-8 custom. */
function ContactSection({ showBlob = true, compact = false, children }: ContactSectionProps) {
    const padding = compact ? 'py-8' : SECTION_PADDING.default
    return (
        <AnimatedSection className={`${padding} relative overflow-hidden`}>
            {showBlob && (
                <GradientBlob color={CSS_VARS.primary} className="top-[20%] left-[-5%]" size={400} opacity={0.06} />
            )}
            <div className={`${CONTACT_CONTAINER} relative z-10`}>
                {children}
            </div>
        </AnimatedSection>
    )
}

type ContactHeaderProps = {
    headline?: string
    subtext?: string
    className?: string
}

/** Section header: SectionLabel + h2 + subtext. Used 5 times. */
function ContactHeader({ headline, subtext, className = 'text-center max-w-2xl mx-auto mb-16' }: ContactHeaderProps) {
    return (
        <div className={className}>
            <SectionLabel color={CSS_VARS.primary}>Contact</SectionLabel>
            <Heading level={2} className="mb-4">
                {headline || 'Contact Us'}
            </Heading>
            {subtext && <Body size="lg" className="opacity-50 leading-relaxed">{subtext}</Body>}
        </div>
    )
}

type ContactInfoCardProps = {
    icon: ComponentType<{ size?: number }>
    label: string
    value: string
    layout?: 'inline' | 'center'
    iconBoxSize?: 'sm' | 'lg'
}

/**
 * Contact info card with icon + label + value. Used 9+ times across
 * info-only / split / form (default) variants. Two layouts:
 * - inline: icon-left + text-right (split/form)
 * - center: icon-top + text-center (info-only)
 */
function ContactInfoCard({ icon: Icon, label, value, layout = 'inline', iconBoxSize = 'sm' }: ContactInfoCardProps) {
    const iconSize = iconBoxSize === 'lg' ? 22 : 18
    const iconBoxClass = iconBoxSize === 'lg' ? 'w-12 h-12' : 'w-10 h-10'
    const padding = iconBoxSize === 'lg' ? CARD_PADDING.md : 'p-5'

    if (layout === 'center') {
        return (
            <GlassCard color={CSS_VARS.primary} className={`${padding} text-center`}>
                <div
                    className={`${iconBoxClass} rounded-xl flex items-center justify-center text-lg mx-auto mb-4`}
                    style={{ background: `rgba(var(--brand-primary-rgb), 0.082)`, color: 'var(--brand-primary)' }}
                >
                    <Icon size={iconSize} />
                </div>
                <Caption className="uppercase tracking-wider opacity-40 mb-1 block">{label}</Caption>
                <Body size="small" className="font-medium">{value}</Body>
            </GlassCard>
        )
    }

    return (
        <GlassCard color={CSS_VARS.primary} className={padding}>
            <div className="flex items-center gap-4">
                <div
                    className={`${iconBoxClass} rounded-xl flex items-center justify-center text-lg`}
                    style={{ background: `rgba(var(--brand-primary-rgb), 0.082)`, color: 'var(--brand-primary)' }}
                >
                    <Icon size={iconSize} />
                </div>
                <div>
                    <Caption className="opacity-40 mb-0.5 block">{label}</Caption>
                    <Body size="small" className="font-medium">{value}</Body>
                </div>
            </div>
        </GlassCard>
    )
}

type ContactFormProps = {
    formFields: FormField[]
    className?: string
}

/** Standard form with FormFieldInput loop + SubmitButton. Used 4 times. */
function ContactForm({ formFields, className = 'space-y-5' }: ContactFormProps) {
    return (
        <form className={className} onSubmit={e => e.preventDefault()}>
            {formFields.map((field, i) => (
                <div key={i}>
                    <label className="block text-sm font-medium mb-2 opacity-70">
                        {field.label}
                        {field.required && <span style={{ color: 'var(--brand-primary)' }}> *</span>}
                    </label>
                    <FormFieldInput field={field} />
                </div>
            ))}
            <SubmitButton />
        </form>
    )
}

// ── Shared form input styles ─────────────────────────────────────────────────

const inputStyle = {
    background: `rgba(var(--brand-primary-rgb), 0.024)`,
    border: `1px solid rgba(var(--brand-primary-rgb), 0.082)`,
    color: 'inherit',
}

function handleFocus(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) {
    e.currentTarget.style.borderColor = `rgba(var(--brand-primary-rgb), 0.251)`
    e.currentTarget.style.boxShadow = `0 0 0 3px rgba(var(--brand-primary-rgb), 0.063)`
}

function handleBlur(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) {
    e.currentTarget.style.borderColor = `rgba(var(--brand-primary-rgb), 0.082)`
    e.currentTarget.style.boxShadow = 'none'
}

function FormFieldInput({ field }: { field: FormField }) {
    if (field.fieldType === 'textarea') {
        return (
            <textarea
                placeholder={field.placeholder || field.label}
                rows={4}
                className="w-full px-4 py-3 rounded-xl text-sm transition-all duration-200 outline-none resize-none"
                style={inputStyle}
                onFocus={handleFocus}
                onBlur={handleBlur}
            />
        )
    }
    return (
        <input
            type={field.fieldType === 'email' ? 'email' : field.fieldType === 'phone' ? 'tel' : 'text'}
            placeholder={field.placeholder || field.label}
            className="w-full px-4 py-3 rounded-xl text-sm transition-all duration-200 outline-none"
            style={inputStyle}
            onFocus={handleFocus}
            onBlur={handleBlur}
        />
    )
}

function SubmitButton({ label = 'Send Message \u2192' }: { label?: string }) {
    return (
        <motion.button
            type="submit"
            whileHover={{ scale: 1.02, y: -1 }}
            whileTap={{ scale: 0.98 }}
            className={`w-full py-3.5 rounded-xl font-semibold text-sm text-white transition-all duration-300 ${TOUCH_TARGET.min} flex items-center justify-center`}
            style={{
                background: `linear-gradient(135deg, var(--brand-primary), rgba(var(--brand-primary-rgb), 0.800))`,
                boxShadow: `0 6px 25px rgba(var(--brand-primary-rgb), 0.188)`,
            }}
        >
            {label}
        </motion.button>
    )
}

// ── Main Component ───────────────────────────────────────────────────────────

export function ContactBlock({ block, theme, site }: BlockProps<ContactConfig>) {
    const mergedBlock = mergeContactInfoWithSite(block, site?.contactInfo)
    const { headline, subtext, email, phone, address, formFields = [], variant = 'form' } = mergedBlock

    // ── Card Float variant ────────────────────────────────────────────────
    if (variant === 'card-float') {
        return (
            <AnimatedSection className={`${SECTION_PADDING.default} relative overflow-hidden`}>
                <div
                    className="absolute inset-0"
                    style={{ background: `linear-gradient(180deg, rgba(var(--brand-primary-rgb), 0.05), transparent)` }}
                />
                <div className={`${CONTACT_CONTAINER} relative z-10`}>
                    <ContactHeader headline={headline} subtext={subtext} className="text-center max-w-2xl mx-auto mb-10" />

                    {/* Floating card */}
                    <div className={`bg-white dark:bg-zinc-900 shadow-xl rounded-2xl ${CARD_PADDING.lg} mx-auto max-w-xl`} style={{ border: `1px solid rgba(var(--brand-primary-rgb), 0.063)` }}>
                        <ContactForm formFields={formFields} />
                    </div>

                    {/* Info chips below card */}
                    <div className="flex flex-wrap justify-center gap-4 mt-8 max-w-xl mx-auto">
                        {email && (
                            <div className="flex items-center gap-2 px-4 py-2 rounded-full text-sm" style={{ background: `rgba(var(--brand-primary-rgb), 0.063)`, color: 'var(--brand-primary)' }}>
                                <Mail size={14} aria-hidden="true" />
                                <span>{email}</span>
                            </div>
                        )}
                        {phone && (
                            <div className="flex items-center gap-2 px-4 py-2 rounded-full text-sm" style={{ background: `rgba(var(--brand-primary-rgb), 0.063)`, color: 'var(--brand-primary)' }}>
                                <Phone size={14} aria-hidden="true" />
                                <span>{phone}</span>
                            </div>
                        )}
                        {address && (
                            <div className="flex items-center gap-2 px-4 py-2 rounded-full text-sm" style={{ background: `rgba(var(--brand-primary-rgb), 0.063)`, color: 'var(--brand-primary)' }}>
                                <MapPin size={14} aria-hidden="true" />
                                <span>{address}</span>
                            </div>
                        )}
                    </div>
                </div>
            </AnimatedSection>
        )
    }

    // ── Map Split variant ─────────────────────────────────────────────────
    if (variant === 'map-split') {
        return (
            <ContactSection>
                <ContactHeader headline={headline} subtext={subtext} />

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 max-w-5xl mx-auto">
                    {/* Map + Contact Info */}
                    <div
                        className={`rounded-xl aspect-video lg:aspect-auto flex flex-col items-center justify-center ${CARD_PADDING.lg} overflow-hidden`}
                        style={{
                            background: `rgba(var(--brand-primary-rgb), 0.04)`,
                            border: `1px solid rgba(var(--brand-primary-rgb), 0.082)`,
                        }}
                    >
                        {address ? (
                            <iframe
                                title="Location map"
                                src={`https://maps.google.com/maps?q=${encodeURIComponent(address)}&output=embed`}
                                className="w-full h-48 rounded-lg mb-4 border-0"
                                loading="lazy"
                                referrerPolicy="no-referrer-when-downgrade"
                            />
                        ) : (
                            <div
                                className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl mb-4"
                                style={{ background: `rgba(var(--brand-primary-rgb), 0.082)`, color: 'var(--brand-primary)' }}
                                aria-hidden="true"
                            >
                                <MapPin size={28} />
                            </div>
                        )}
                        {address && <Body size="small" className="font-medium text-center opacity-70">{address}</Body>}
                        {email && (
                            <Body size="small" className="opacity-50 mt-2">
                                <Mail size={12} className="inline mr-1" style={{ color: 'var(--brand-primary)' }} aria-hidden="true" />
                                {email}
                            </Body>
                        )}
                        {phone && (
                            <Body size="small" className="opacity-50 mt-1">
                                <Phone size={12} className="inline mr-1" style={{ color: 'var(--brand-primary)' }} aria-hidden="true" />
                                {phone}
                            </Body>
                        )}
                    </div>

                    {/* Contact form */}
                    <GlassCard color={CSS_VARS.primary} className={CARD_PADDING.lg}>
                        <ContactForm formFields={formFields} />
                    </GlassCard>
                </div>
            </ContactSection>
        )
    }

    // ── Minimal Inline variant ────────────────────────────────────────────
    // Compact py-8 layout, skip blob. Inline Send button gets TOUCH_TARGET.min.
    if (variant === 'minimal-inline') {
        return (
            <AnimatedSection className="py-8 relative">
                <div className={CONTACT_CONTAINER}>
                    {headline && (
                        <div className="mb-6">
                            <Heading level={3}>
                                <RichText text={headline} as="span" />
                            </Heading>
                            {subtext && <Body size="small" className="opacity-50 mt-1">{subtext}</Body>}
                        </div>
                    )}

                    <form className="flex flex-wrap gap-4 items-end" onSubmit={e => e.preventDefault()}>
                        {formFields.map((field, i) => (
                            <div key={i} className="flex-1 min-w-[200px]">
                                <label className="block text-xs font-medium mb-1 opacity-50">{field.label}</label>
                                <input
                                    type={field.fieldType === 'email' ? 'email' : field.fieldType === 'phone' ? 'tel' : 'text'}
                                    placeholder={field.placeholder || field.label}
                                    className="w-full px-0 py-2 text-sm transition-all duration-200 outline-none bg-transparent"
                                    style={{
                                        borderBottom: `1px solid rgba(var(--brand-primary-rgb), 0.15)`,
                                        color: 'inherit',
                                    }}
                                    onFocus={e => {
                                        e.currentTarget.style.borderBottomColor = `var(--brand-primary)`
                                    }}
                                    onBlur={e => {
                                        e.currentTarget.style.borderBottomColor = `rgba(var(--brand-primary-rgb), 0.15)`
                                    }}
                                />
                            </div>
                        ))}
                        <motion.button
                            type="submit"
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className={`px-6 py-2 rounded-lg font-semibold text-sm text-white transition-all duration-300 ${TOUCH_TARGET.min} inline-flex items-center justify-center`}
                            style={{
                                background: `var(--brand-primary)`,
                            }}
                        >
                            Send
                        </motion.button>
                    </form>
                </div>
            </AnimatedSection>
        )
    }

    // ── Info Only variant ───────────────────────────────────────────────
    if (variant === 'info-only') {
        return (
            <ContactSection>
                <ContactHeader headline={headline} subtext={subtext} />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
                    {email && <ContactInfoCard icon={Mail} label="Email" value={email} layout="center" iconBoxSize="lg" />}
                    {phone && <ContactInfoCard icon={Phone} label="Phone" value={phone} layout="center" iconBoxSize="lg" />}
                    {address && <ContactInfoCard icon={MapPin} label="Address" value={address} layout="center" iconBoxSize="lg" />}
                </div>
            </ContactSection>
        )
    }

    // ── Split variant ────────────────────────────────────────────────────
    if (variant === 'split') {
        return (
            <ContactSection>
                <ContactHeader headline={headline} subtext={subtext} />
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 max-w-5xl mx-auto">
                    {/* Form */}
                    <GlassCard color={CSS_VARS.primary} className={CARD_PADDING.lg}>
                        <ContactForm formFields={formFields} />
                    </GlassCard>
                    {/* Contact Info */}
                    <div className="space-y-6">
                        {email && <ContactInfoCard icon={Mail} label="Email" value={email} />}
                        {phone && <ContactInfoCard icon={Phone} label="Phone" value={phone} />}
                        {address && <ContactInfoCard icon={MapPin} label="Address" value={address} />}
                    </div>
                </div>
            </ContactSection>
        )
    }

    // ── Default: form ────────────────────────────────────────────────────
    return (
        <ContactSection>
            <ContactHeader headline={headline} subtext={subtext} />
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-10 max-w-5xl mx-auto">
                {/* Contact Info */}
                <div className="lg:col-span-2 space-y-6">
                    {email && <ContactInfoCard icon={Mail} label="Email" value={email} />}
                    {phone && <ContactInfoCard icon={Phone} label="Phone" value={phone} />}
                    {address && <ContactInfoCard icon={MapPin} label="Address" value={address} />}
                </div>
                {/* Contact Form */}
                <div className="lg:col-span-3">
                    <GlassCard color={CSS_VARS.primary} className={CARD_PADDING.lg}>
                        <ContactForm formFields={formFields} />
                    </GlassCard>
                </div>
            </div>
        </ContactSection>
    )
}
