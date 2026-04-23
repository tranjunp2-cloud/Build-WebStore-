'use client'

import type { ReactNode, ComponentType } from 'react'
import type { BlockProps } from '../types'
import type { ContactConfig, FormField } from './config'
import { useContactForm, PHONE_PATTERN_MY } from './useContactForm'
import { AnimatedSection } from '../shared/animations'
import { GradientBlob, SectionLabel, GlassCard } from '../shared/decorative'
import { motion } from 'framer-motion'
import { mergeContactInfoWithSite } from '@/lib/site-settings'
import { Mail, Phone, MapPin, Loader2 } from 'lucide-react'
import { CSS_VARS } from '@/lib/theme/resolve'
import { RichText } from '../shared/RichText'
import { Heading, Body, Caption } from '../shared/Typography'
import { TOUCH_TARGET, CARD_PADDING } from '@/lib/design-tokens'
import { SectionWrapper } from '../shared/SectionWrapper'

// ── Local helpers (Phase 05 refactor) ───────────────────────────────────────

type ContactSectionProps = {
    showBlob?: boolean
    compact?: boolean
    children: ReactNode
}

/** Outer wrapper for 5/6 variants. Minimal-inline uses py-8 custom. */
function ContactSection({ showBlob = true, compact = false, children }: ContactSectionProps) {
    return (
        <AnimatedSection className="relative overflow-hidden">
            {showBlob && (
                <GradientBlob color={CSS_VARS.primary} className="top-[20%] left-[-5%]" size={400} opacity={0.06} />
            )}
            <SectionWrapper
                as="div"
                padding={compact ? 'compact' : 'default'}
                container="default"
                background="transparent"
                innerClassName="relative z-10"
            >
                {children}
            </SectionWrapper>
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
    type?: 'email' | 'phone' | 'address'
    layout?: 'inline' | 'center'
    iconBoxSize?: 'sm' | 'lg'
}

/**
 * Plan 260415 contact-bugfix — derive interactive href cho value.
 * Email → mailto:, phone → tel:, address → Google Maps link.
 * User tap trên mobile mở đúng app thay vì plain text.
 */
function hrefForContactValue(type: ContactInfoCardProps['type'], value: string): string | undefined {
    if (!value) return undefined
    if (type === 'email') return `mailto:${value}`
    if (type === 'phone') return `tel:${value.replace(/[^\d+]/g, '')}`
    if (type === 'address') return `https://maps.google.com/?q=${encodeURIComponent(value)}`
    return undefined
}

/**
 * Contact info card with icon + label + value. Used 9+ times across
 * info-only / split / form (default) variants. Two layouts:
 * - inline: icon-left + text-right (split/form)
 * - center: icon-top + text-center (info-only)
 *
 * Plan 260415 contact-bugfix — value giờ là interactive link (mailto/tel/maps)
 * thay vì plain text. Mobile users có thể tap để mở native app tương ứng.
 */
function ContactInfoCard({ icon: Icon, label, value, type, layout = 'inline', iconBoxSize = 'sm' }: ContactInfoCardProps) {
    const iconSize = iconBoxSize === 'lg' ? 22 : 18
    const iconBoxClass = iconBoxSize === 'lg' ? 'w-12 h-12' : 'w-10 h-10'
    const padding = iconBoxSize === 'lg' ? CARD_PADDING.md : 'p-5'
    const href = hrefForContactValue(type, value)
    const isExternal = href?.startsWith('http')

    const valueNode = href ? (
        <a
            href={href}
            target={isExternal ? '_blank' : undefined}
            rel={isExternal ? 'noopener noreferrer' : undefined}
            className="font-medium break-all hover:opacity-80 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)]/40 rounded"
        >
            {value}
        </a>
    ) : (
        <span className="font-medium break-all">{value}</span>
    )

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
                <Body size="small">{valueNode}</Body>
            </GlassCard>
        )
    }

    return (
        <GlassCard color={CSS_VARS.primary} className={padding}>
            <div className="flex items-start gap-4">
                <div
                    className={`${iconBoxClass} shrink-0 rounded-xl flex items-center justify-center text-lg`}
                    style={{ background: `rgba(var(--brand-primary-rgb), 0.082)`, color: 'var(--brand-primary)' }}
                >
                    <Icon size={iconSize} />
                </div>
                <div className="min-w-0 flex-1">
                    <Caption className="opacity-40 mb-0.5 block">{label}</Caption>
                    <Body size="small">{valueNode}</Body>
                </div>
            </div>
        </GlassCard>
    )
}

type ContactFormProps = {
    formFields: FormField[]
    siteId?: string
    className?: string
    submitLabel?: string
    inline?: boolean
}

/**
 * Plan 260415 contact-bugfix — Standard form wired vào useContactForm hook.
 * - POST tới /api/contact-submit
 * - Client validation (required, email, phone pattern)
 * - Per-field error inline
 * - Submit error alert area
 * - Loading spinner + disabled button
 * - Success state replaces form với "Thanks" message
 * - Honeypot field (name="website") ẩn cho bot
 */
function ContactForm({ formFields, siteId, className = 'space-y-5', submitLabel = 'Send Message →', inline = false }: ContactFormProps) {
    const requiredFieldNames = formFields
        .filter(f => f.required)
        .map(f => f.fieldName || f.fieldType || 'message')

    const { state, errors, submitError, handleSubmit } = useContactForm({
        siteId,
        requiredFieldNames,
    })

    if (state === 'success') {
        return (
            <div
                className={`flex flex-col items-center justify-center text-center py-8 px-4 rounded-xl ${className.includes('space-y') ? '' : className}`}
                role="status"
                aria-live="polite"
                style={{
                    background: `rgba(var(--brand-primary-rgb), 0.04)`,
                    border: `1px solid rgba(var(--brand-primary-rgb), 0.15)`,
                }}
            >
                <div
                    className="w-14 h-14 rounded-full flex items-center justify-center mb-4"
                    style={{ background: `rgba(var(--brand-primary-rgb), 0.12)`, color: 'var(--brand-primary)' }}
                >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M20 6 9 17l-5-5" />
                    </svg>
                </div>
                <Heading level={4} className="mb-1">Thanks for reaching out!</Heading>
                <Body size="small" className="opacity-60">We will get back to you shortly.</Body>
            </div>
        )
    }

    return (
        <form className={className} onSubmit={handleSubmit} noValidate>
            {formFields.map((field, i) => {
                const fieldName = field.fieldName || field.fieldType || `field-${i}`
                const error = errors[fieldName as keyof typeof errors]
                const errorId = error ? `${fieldName}-error` : undefined
                return (
                    <div key={`${i}-${fieldName}`} className={inline ? 'flex-1 min-w-[180px]' : ''}>
                        <label htmlFor={fieldName} className="block text-sm font-medium mb-2 opacity-70">
                            {field.label}
                            {field.required && <span style={{ color: 'var(--brand-primary)' }}> *</span>}
                        </label>
                        <FormFieldInput field={field} error={!!error} errorId={errorId} inlineRows={inline ? 1 : undefined} />
                        {error && (
                            <p id={errorId} className="mt-1 text-xs" style={{ color: '#ef4444' }} role="alert">
                                {error}
                            </p>
                        )}
                    </div>
                )
            })}

            {submitError && (
                <div
                    role="alert"
                    className="px-4 py-3 rounded-lg text-sm"
                    style={{
                        background: 'rgba(239,68,68,0.08)',
                        border: '1px solid rgba(239,68,68,0.25)',
                        color: '#ef4444',
                    }}
                >
                    {submitError}
                </div>
            )}

            <SubmitButton label={submitLabel} isSubmitting={state === 'loading'} />

            {/* Honeypot at end — avoids space-y margin being applied to the first visible field */}
            <div style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, overflow: 'hidden' }} aria-hidden="true">
                <label>
                    Website
                    <input type="text" name="website" tabIndex={-1} autoComplete="off" />
                </label>
            </div>
        </form>
    )
}

// ── Shared form input classes ─────────────────────────────────────────────────
// Plan 260415 contact-bugfix — thay inline handleFocus/handleBlur mutation bằng
// Tailwind focus-visible classes. Không mutate DOM style trực tiếp, hỗ trợ a11y
// (focus-visible chỉ hiện khi keyboard nav, không khi click chuột).

const INPUT_BASE_CLASS =
    'w-full px-4 py-3 rounded-xl text-sm outline-none transition-colors bg-[rgba(var(--brand-primary-rgb),0.03)] border border-[rgba(var(--brand-primary-rgb),0.12)] focus-visible:border-[rgba(var(--brand-primary-rgb),0.45)] focus-visible:ring-2 focus-visible:ring-[rgba(var(--brand-primary-rgb),0.18)] disabled:opacity-50 disabled:cursor-not-allowed'

function FormFieldInput({ field, error, errorId, inlineRows }: { field: FormField; error?: boolean; errorId?: string; inlineRows?: number }) {
    const name = field.fieldName || field.fieldType || 'field'
    const isTextarea = field.fieldType === 'textarea'
    const type = field.fieldType === 'email' ? 'email' : field.fieldType === 'phone' ? 'tel' : 'text'

    // Plan 260415 contact-bugfix — autoComplete hints giúp browser password
    // manager / 1Password gợi ý fill đúng field.
    const autoComplete =
        field.fieldType === 'email'
            ? 'email'
            : field.fieldType === 'phone'
              ? 'tel'
              : name === 'name'
                ? 'name'
                : 'off'

    const errorClass = error ? ' border-[#ef4444] focus-visible:ring-[#ef4444]/30' : ''
    const commonProps = {
        id: name,
        name,
        required: field.required,
        'aria-required': field.required,
        'aria-invalid': error,
        'aria-describedby': errorId,
        placeholder: field.placeholder || field.label,
        className: INPUT_BASE_CLASS + errorClass,
    }

    if (isTextarea) {
        return <textarea {...commonProps} rows={inlineRows ?? 4} className={INPUT_BASE_CLASS + errorClass + ' resize-none'} />
    }

    return (
        <input
            {...commonProps}
            type={type}
            autoComplete={autoComplete}
            pattern={field.fieldType === 'phone' ? PHONE_PATTERN_MY : undefined}
        />
    )
}

function SubmitButton({ label = 'Send Message →', isSubmitting = false }: { label?: string; isSubmitting?: boolean }) {
    return (
        <motion.button
            type="submit"
            disabled={isSubmitting}
            whileHover={isSubmitting ? undefined : { scale: 1.02, y: -1 }}
            whileTap={isSubmitting ? undefined : { scale: 0.98 }}
            className={`w-full py-3.5 rounded-xl font-semibold text-sm text-white transition-all duration-300 ${TOUCH_TARGET.min} flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed`}
            style={{
                background: `linear-gradient(135deg, var(--brand-primary), rgba(var(--brand-primary-rgb), 0.800))`,
                boxShadow: `0 6px 25px rgba(var(--brand-primary-rgb), 0.188)`,
            }}
        >
            {isSubmitting && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
            {isSubmitting ? 'Sending…' : label}
        </motion.button>
    )
}

// ── Main Component ───────────────────────────────────────────────────────────

export function ContactBlock({ block, theme, site }: BlockProps<ContactConfig>) {
    const mergedBlock = mergeContactInfoWithSite(block, site?.contactInfo)
    const { headline, subtext, email, phone, address, formFields = [], variant = 'form' } = mergedBlock
    const siteId = site?.id ? String(site.id) : undefined

    // ── Card Float variant ────────────────────────────────────────────────
    if (variant === 'card-float') {
        return (
            <AnimatedSection className="relative overflow-hidden">
                <div
                    className="absolute inset-0"
                    style={{ background: `linear-gradient(180deg, rgba(var(--brand-primary-rgb), 0.05), transparent)` }}
                />
                <SectionWrapper as="div" padding="default" container="default" background="transparent" innerClassName="relative z-10">
                    <ContactHeader headline={headline} subtext={subtext} className="text-center max-w-2xl mx-auto mb-10" />

                    {/* Plan 260415 contact-bugfix — Floating card dùng theme surface
                        thay vì hardcode bg-white/dark:bg-zinc-900. Dark theme + brand
                        colors giờ render đúng card bg theo token. */}
                    <div
                        className={`shadow-xl rounded-2xl ${CARD_PADDING.lg} mx-auto max-w-xl`}
                        style={{
                            background: `color-mix(in srgb, var(--surface, #ffffff) 95%, transparent)`,
                            border: `1px solid rgba(var(--brand-primary-rgb), 0.12)`,
                        }}
                    >
                        <ContactForm formFields={formFields} siteId={siteId} />
                    </div>

                    {/* Plan 260415 contact-bugfix — Info chips giờ là interactive
                        link (mailto/tel/maps) + max-w-full + truncate để dài không
                        tràn mobile 375px. */}
                    <div className="flex flex-wrap justify-center gap-4 mt-8 max-w-xl mx-auto">
                        {email && (
                            <a
                                href={`mailto:${email}`}
                                className="flex items-center gap-2 px-4 py-2 rounded-full text-sm max-w-full hover:opacity-80 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)]/40"
                                style={{ background: `rgba(var(--brand-primary-rgb), 0.063)`, color: 'var(--brand-primary)' }}
                            >
                                <Mail size={14} aria-hidden="true" className="shrink-0" />
                                <span className="truncate">{email}</span>
                            </a>
                        )}
                        {phone && (
                            <a
                                href={`tel:${phone.replace(/[^\d+]/g, '')}`}
                                className="flex items-center gap-2 px-4 py-2 rounded-full text-sm max-w-full hover:opacity-80 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)]/40"
                                style={{ background: `rgba(var(--brand-primary-rgb), 0.063)`, color: 'var(--brand-primary)' }}
                            >
                                <Phone size={14} aria-hidden="true" className="shrink-0" />
                                <span className="truncate">{phone}</span>
                            </a>
                        )}
                        {address && (
                            <a
                                href={`https://maps.google.com/?q=${encodeURIComponent(address)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 px-4 py-2 rounded-full text-sm max-w-full hover:opacity-80 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)]/40"
                                style={{ background: `rgba(var(--brand-primary-rgb), 0.063)`, color: 'var(--brand-primary)' }}
                            >
                                <MapPin size={14} aria-hidden="true" className="shrink-0" />
                                <span className="truncate">{address}</span>
                            </a>
                        )}
                    </div>
                </SectionWrapper>
            </AnimatedSection>
        )
    }

    // ── Map Split variant ─────────────────────────────────────────────────
    if (variant === 'map-split') {
        return (
            <ContactSection>
                <ContactHeader headline={headline} subtext={subtext} />

                {/* Plan 260415 — drop inner max-w-5xl; outer CONTACT_CONTAINER already caps at max-w-6xl. */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
                    {/* Map + Contact Info — mt-8 = CARD_PADDING.lg so card border aligns with "Name *" in GlassCard */}
                    <div
                        className="rounded-xl flex flex-col px-8 pb-8 overflow-hidden mt-8"
                        style={{
                            background: `rgba(var(--brand-primary-rgb), 0.04)`,
                            border: `1px solid rgba(var(--brand-primary-rgb), 0.082)`,
                        }}
                    >
                        {address ? (
                            <iframe
                                title="Location map"
                                src={`https://maps.google.com/maps?q=${encodeURIComponent(address)}&output=embed`}
                                className="w-full rounded-b-lg mb-4 border-0 -mx-8"
                                style={{ width: 'calc(100% + 4rem)', minHeight: '240px' }}
                                loading="lazy"
                                referrerPolicy="no-referrer-when-downgrade"
                            />
                        ) : (
                            <div
                                className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl mb-4 mt-8"
                                style={{ background: `rgba(var(--brand-primary-rgb), 0.082)`, color: 'var(--brand-primary)' }}
                                aria-hidden="true"
                            >
                                <MapPin size={28} />
                            </div>
                        )}
                        {address && <Body size="small" className="font-medium opacity-70">{address}</Body>}
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

                    {/* Contact form — GlassCard unchanged */}
                    <GlassCard color={CSS_VARS.primary} className={CARD_PADDING.lg}>
                        <ContactForm formFields={formFields} siteId={siteId} />
                    </GlassCard>
                </div>
            </ContactSection>
        )
    }

    // ── Minimal Inline variant ────────────────────────────────────────────
    // Compact py-8 layout, skip blob. Inline Send button gets TOUCH_TARGET.min.
    if (variant === 'minimal-inline') {
        return (
            <AnimatedSection className="relative">
                <SectionWrapper as="div" padding="compact" container="default" background="transparent">
                    {headline && (
                        <div className="mb-6">
                            <Heading level={3}>
                                <RichText text={headline} as="span" />
                            </Heading>
                            {subtext && <Body size="small" className="opacity-50 mt-1">{subtext}</Body>}
                        </div>
                    )}

                    {/* Plan 260415 contact-bugfix — minimal-inline giờ dùng ContactForm
                        hook wired. Layout wraps horizontal flex cho inputs nhưng vẫn
                        có full submit state + validation + honeypot. */}
                    <ContactForm
                        formFields={formFields}
                        siteId={siteId}
                        className="flex flex-wrap gap-4 items-end"
                        submitLabel="Send"
                        inline
                    />
                </SectionWrapper>
            </AnimatedSection>
        )
    }

    // ── Info Only variant ───────────────────────────────────────────────
    if (variant === 'info-only') {
        return (
            <ContactSection>
                <ContactHeader headline={headline} subtext={subtext} />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
                    {email && <ContactInfoCard icon={Mail} label="Email" value={email} type="email" layout="center" iconBoxSize="lg" />}
                    {phone && <ContactInfoCard icon={Phone} label="Phone" value={phone} type="phone" layout="center" iconBoxSize="lg" />}
                    {address && <ContactInfoCard icon={MapPin} label="Address" value={address} type="address" layout="center" iconBoxSize="lg" />}
                </div>
            </ContactSection>
        )
    }

    // ── Split variant ────────────────────────────────────────────────────
    if (variant === 'split') {
        return (
            <ContactSection>
                <ContactHeader headline={headline} subtext={subtext} />
                {/* Plan 260415 — drop inner max-w-5xl; outer CONTACT_CONTAINER already caps at max-w-6xl. */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
                    {/* Form */}
                    <GlassCard color={CSS_VARS.primary} className={CARD_PADDING.lg}>
                        <ContactForm formFields={formFields} siteId={siteId} />
                    </GlassCard>
                    {/* Contact Info */}
                    <div className="space-y-6 pt-8">
                        {email && <ContactInfoCard icon={Mail} label="Email" value={email} type="email" />}
                        {phone && <ContactInfoCard icon={Phone} label="Phone" value={phone} type="phone" />}
                        {address && <ContactInfoCard icon={MapPin} label="Address" value={address} type="address" />}
                    </div>
                </div>
            </ContactSection>
        )
    }

    // ── Default: form ────────────────────────────────────────────────────
    // Plan 260415 contact fix: drop the inner `max-w-5xl` (CONTACT_CONTAINER
    // already caps at max-w-6xl = 1152px, and the nested max-w-5xl was
    // shrinking the form to ~820px on desktop, leaving huge empty space)
    // and switch to a 1:2 split so the form column gets ~66% instead of 60%.
    const hasContactInfo = !!(email || phone || address)
    return (
        <ContactSection>
            <ContactHeader headline={headline} subtext={subtext} />
            {hasContactInfo ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                    {/* Contact Info */}
                    <div className="lg:col-span-1 space-y-6">
                        {email && <ContactInfoCard icon={Mail} label="Email" value={email} type="email" />}
                        {phone && <ContactInfoCard icon={Phone} label="Phone" value={phone} type="phone" />}
                        {address && <ContactInfoCard icon={MapPin} label="Address" value={address} type="address" />}
                    </div>
                    {/* Contact Form */}
                    <div className="lg:col-span-2">
                        <GlassCard color={CSS_VARS.primary} className={CARD_PADDING.lg}>
                            <ContactForm formFields={formFields} siteId={siteId} />
                        </GlassCard>
                    </div>
                </div>
            ) : (
                <div className="max-w-xl mx-auto">
                    <GlassCard color={CSS_VARS.primary} className={CARD_PADDING.lg}>
                        <ContactForm formFields={formFields} siteId={siteId} />
                    </GlassCard>
                </div>
            )}
        </ContactSection>
    )
}
