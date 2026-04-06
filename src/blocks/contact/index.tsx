'use client'

import type { BlockProps } from '../types'
import type { ContactConfig, FormField } from './config'
import { AnimatedSection } from '../shared/animations'
import { GradientBlob, SectionLabel, GlassCard } from '../shared/decorative'
import { motion } from 'framer-motion'
import { mergeContactInfoWithSite } from '@/lib/site-settings'
import { Mail, Phone, MapPin } from 'lucide-react'

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
            className="w-full py-3.5 rounded-xl font-semibold text-sm text-white transition-all duration-300"
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
            <AnimatedSection className="py-24 relative overflow-hidden">
                <div
                    className="absolute inset-0"
                    style={{ background: `linear-gradient(180deg, rgba(var(--brand-primary-rgb), 0.05), transparent)` }}
                />
                <div className="container mx-auto px-6 relative z-10">
                    {/* Header */}
                    <div className="text-center max-w-2xl mx-auto mb-10">
                        <SectionLabel color={theme.primaryColor}>Contact</SectionLabel>
                        <h2 className="text-4xl md:text-5xl font-bold font-heading mb-4">{headline || 'Contact Us'}</h2>
                        {subtext && <p className="text-lg opacity-50 leading-relaxed">{subtext}</p>}
                    </div>

                    {/* Floating card */}
                    <div className="bg-white dark:bg-zinc-900 shadow-xl rounded-2xl p-8 mx-auto max-w-xl" style={{ border: `1px solid rgba(var(--brand-primary-rgb), 0.063)` }}>
                        <form className="space-y-5" onSubmit={e => e.preventDefault()}>
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
                    </div>

                    {/* Info chips below card */}
                    <div className="flex flex-wrap justify-center gap-4 mt-8 max-w-xl mx-auto">
                        {email && (
                            <div className="flex items-center gap-2 px-4 py-2 rounded-full text-sm" style={{ background: `rgba(var(--brand-primary-rgb), 0.063)`, color: 'var(--brand-primary)' }}>
                                <Mail size={14} />
                                <span>{email}</span>
                            </div>
                        )}
                        {phone && (
                            <div className="flex items-center gap-2 px-4 py-2 rounded-full text-sm" style={{ background: `rgba(var(--brand-primary-rgb), 0.063)`, color: 'var(--brand-primary)' }}>
                                <Phone size={14} />
                                <span>{phone}</span>
                            </div>
                        )}
                        {address && (
                            <div className="flex items-center gap-2 px-4 py-2 rounded-full text-sm" style={{ background: `rgba(var(--brand-primary-rgb), 0.063)`, color: 'var(--brand-primary)' }}>
                                <MapPin size={14} />
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
            <AnimatedSection className="py-24 relative overflow-hidden">
                <GradientBlob color={theme.primaryColor} className="top-[20%] left-[-5%]" size={400} opacity={0.06} />
                <div className="container mx-auto px-6 relative z-10">
                    {/* Header */}
                    <div className="text-center max-w-2xl mx-auto mb-16">
                        <SectionLabel color={theme.primaryColor}>Contact</SectionLabel>
                        <h2 className="text-4xl md:text-5xl font-bold font-heading mb-4">{headline || 'Contact Us'}</h2>
                        {subtext && <p className="text-lg opacity-50 leading-relaxed">{subtext}</p>}
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 max-w-5xl mx-auto">
                        {/* Map placeholder */}
                        <div
                            className="rounded-xl aspect-video lg:aspect-auto flex flex-col items-center justify-center p-8"
                            style={{
                                background: `rgba(var(--brand-primary-rgb), 0.04)`,
                                border: `1px solid rgba(var(--brand-primary-rgb), 0.082)`,
                            }}
                        >
                            <div
                                className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl mb-4"
                                style={{ background: `rgba(var(--brand-primary-rgb), 0.082)`, color: 'var(--brand-primary)' }}
                            >
                                <MapPin size={28} />
                            </div>
                            {address && <p className="text-sm font-medium text-center opacity-70">{address}</p>}
                            {email && (
                                <p className="text-sm opacity-50 mt-2">
                                    <Mail size={12} className="inline mr-1" style={{ color: 'var(--brand-primary)' }} />
                                    {email}
                                </p>
                            )}
                            {phone && (
                                <p className="text-sm opacity-50 mt-1">
                                    <Phone size={12} className="inline mr-1" style={{ color: 'var(--brand-primary)' }} />
                                    {phone}
                                </p>
                            )}
                        </div>

                        {/* Contact form */}
                        <GlassCard color={theme.primaryColor} className="p-8">
                            <form className="space-y-5" onSubmit={e => e.preventDefault()}>
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
                        </GlassCard>
                    </div>
                </div>
            </AnimatedSection>
        )
    }

    // ── Minimal Inline variant ────────────────────────────────────────────
    if (variant === 'minimal-inline') {
        return (
            <AnimatedSection className="py-8 relative">
                <div className="container mx-auto px-6">
                    {headline && (
                        <div className="mb-6">
                            <h2 className="text-2xl font-bold font-heading">{headline}</h2>
                            {subtext && <p className="text-sm opacity-50 mt-1">{subtext}</p>}
                        </div>
                    )}

                    <form className="flex flex-wrap gap-4 items-end" onSubmit={e => e.preventDefault()}>
                        {formFields.map((field, i) => (
                            <div key={i} className="flex-1 min-w-[200px]">
                                <label className="block text-xs font-medium mb-1 opacity-50">{field.label}</label>
                                {field.fieldType === 'textarea' ? (
                                    <input
                                        type="text"
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
                                ) : (
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
                                )}
                            </div>
                        ))}
                        <motion.button
                            type="submit"
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className="px-6 py-2 rounded-lg font-semibold text-sm text-white transition-all duration-300"
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

    // ── Default: form / info-only / split (existing) ──────────────────────
    return (
        <AnimatedSection className="py-24 relative overflow-hidden">
            <GradientBlob color={theme.primaryColor} className="top-[20%] left-[-5%]" size={400} opacity={0.06} />

            <div className="container mx-auto px-6 relative z-10">
                {/* Header */}
                <div className="text-center max-w-2xl mx-auto mb-16">
                    <SectionLabel color={theme.primaryColor}>Contact</SectionLabel>
                    <h2 className="text-4xl md:text-5xl font-bold font-heading mb-4">{headline || 'Contact Us'}</h2>
                    {subtext && <p className="text-lg opacity-50 leading-relaxed">{subtext}</p>}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-5 gap-10 max-w-5xl mx-auto">
                    {/* Contact Info */}
                    <div className="lg:col-span-2 space-y-6">
                        {email && (
                            <GlassCard color={theme.primaryColor} className="p-5">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
                                        style={{ background: `rgba(var(--brand-primary-rgb), 0.082)`, color: 'var(--brand-primary)' }}>
                                        ✉️
                                    </div>
                                    <div>
                                        <p className="text-xs opacity-40 mb-0.5">Email</p>
                                        <p className="text-sm font-medium">{email}</p>
                                    </div>
                                </div>
                            </GlassCard>
                        )}
                        {phone && (
                            <GlassCard color={theme.primaryColor} className="p-5">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
                                        style={{ background: `rgba(var(--brand-primary-rgb), 0.082)`, color: 'var(--brand-primary)' }}>
                                        📞
                                    </div>
                                    <div>
                                        <p className="text-xs opacity-40 mb-0.5">Phone</p>
                                        <p className="text-sm font-medium">{phone}</p>
                                    </div>
                                </div>
                            </GlassCard>
                        )}
                        {address && (
                            <GlassCard color={theme.primaryColor} className="p-5">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
                                        style={{ background: `rgba(var(--brand-primary-rgb), 0.082)`, color: 'var(--brand-primary)' }}>
                                        📍
                                    </div>
                                    <div>
                                        <p className="text-xs opacity-40 mb-0.5">Address</p>
                                        <p className="text-sm font-medium">{address}</p>
                                    </div>
                                </div>
                            </GlassCard>
                        )}
                    </div>

                    {/* Contact Form */}
                    <div className="lg:col-span-3">
                        <GlassCard color={theme.primaryColor} className="p-8">
                            <form className="space-y-5" onSubmit={e => e.preventDefault()}>
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
                        </GlassCard>
                    </div>
                </div>
            </div>
        </AnimatedSection>
    )
}
