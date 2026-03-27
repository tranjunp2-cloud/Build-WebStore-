'use client'

import type { BlockProps } from '../types'
import type { ContactConfig } from './config'
import { AnimatedSection } from '../shared/animations'
import { GradientBlob, SectionLabel, GlassCard } from '../shared/decorative'
import { motion } from 'framer-motion'
import { mergeContactInfoWithSite } from '@/lib/site-settings'

export function ContactBlock({ block, theme, site }: BlockProps<ContactConfig>) {
    const mergedBlock = mergeContactInfoWithSite(block, site?.contactInfo)
    const { headline, subtext, email, phone, address, formFields = [] } = mergedBlock
    const pc = theme.primaryColor

    return (
        <AnimatedSection className="py-24 relative overflow-hidden">
            <GradientBlob color={pc} className="top-[20%] left-[-5%]" size={400} opacity={0.06} />

            <div className="container mx-auto px-6 relative z-10">
                {/* Header */}
                <div className="text-center max-w-2xl mx-auto mb-16">
                    <SectionLabel color={pc}>Contact</SectionLabel>
                    <h2 className="text-4xl md:text-5xl font-bold font-heading mb-4">{headline || 'Contact Us'}</h2>
                    {subtext && <p className="text-lg opacity-50 leading-relaxed">{subtext}</p>}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-5 gap-10 max-w-5xl mx-auto">
                    {/* Contact Info */}
                    <div className="lg:col-span-2 space-y-6">
                        {email && (
                            <GlassCard color={pc} className="p-5">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
                                        style={{ background: `${pc}15`, color: pc }}>
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
                            <GlassCard color={pc} className="p-5">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
                                        style={{ background: `${pc}15`, color: pc }}>
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
                            <GlassCard color={pc} className="p-5">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
                                        style={{ background: `${pc}15`, color: pc }}>
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
                        <GlassCard color={pc} className="p-8">
                            <form className="space-y-5" onSubmit={e => e.preventDefault()}>
                                {formFields.map((field, i) => (
                                    <div key={i}>
                                        <label className="block text-sm font-medium mb-2 opacity-70">
                                            {field.label}
                                            {field.required && <span style={{ color: pc }}> *</span>}
                                        </label>
                                        {field.fieldType === 'textarea' ? (
                                            <textarea
                                                placeholder={field.placeholder || field.label}
                                                rows={4}
                                                className="w-full px-4 py-3 rounded-xl text-sm transition-all duration-200 outline-none resize-none"
                                                style={{
                                                    background: `${pc}06`,
                                                    border: `1px solid ${pc}15`,
                                                    color: 'inherit',
                                                }}
                                                onFocus={e => {
                                                    e.currentTarget.style.borderColor = `${pc}40`
                                                    e.currentTarget.style.boxShadow = `0 0 0 3px ${pc}10`
                                                }}
                                                onBlur={e => {
                                                    e.currentTarget.style.borderColor = `${pc}15`
                                                    e.currentTarget.style.boxShadow = 'none'
                                                }}
                                            />
                                        ) : (
                                            <input
                                                type={field.fieldType === 'email' ? 'email' : field.fieldType === 'phone' ? 'tel' : 'text'}
                                                placeholder={field.placeholder || field.label}
                                                className="w-full px-4 py-3 rounded-xl text-sm transition-all duration-200 outline-none"
                                                style={{
                                                    background: `${pc}06`,
                                                    border: `1px solid ${pc}15`,
                                                    color: 'inherit',
                                                }}
                                                onFocus={e => {
                                                    e.currentTarget.style.borderColor = `${pc}40`
                                                    e.currentTarget.style.boxShadow = `0 0 0 3px ${pc}10`
                                                }}
                                                onBlur={e => {
                                                    e.currentTarget.style.borderColor = `${pc}15`
                                                    e.currentTarget.style.boxShadow = 'none'
                                                }}
                                            />
                                        )}
                                    </div>
                                ))}

                                <motion.button
                                    type="submit"
                                    whileHover={{ scale: 1.02, y: -1 }}
                                    whileTap={{ scale: 0.98 }}
                                    className="w-full py-3.5 rounded-xl font-semibold text-sm text-white transition-all duration-300"
                                    style={{
                                        background: `linear-gradient(135deg, ${pc}, ${pc}cc)`,
                                        boxShadow: `0 6px 25px ${pc}30`,
                                    }}
                                >
                                    Send Message →
                                </motion.button>
                            </form>
                        </GlassCard>
                    </div>
                </div>
            </div>
        </AnimatedSection>
    )
}
