'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import type { BlockProps } from '../types'
import type { DoctorProfileConfig, DoctorItem } from './config'
import { CSS_VARS as _CSS_VARS } from '@/lib/theme/resolve'
import { AnimatedSection } from '../shared/animations'
import { RichText } from '../shared/RichText'
import { Heading, Body } from '../shared/Typography'
import { CONTAINER, INNER_PADDING, SECTION_PADDING } from '@/lib/design-tokens'

void _CSS_VARS

const DAY_NAMES_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function AvailabilityBadges({ days }: { days: number[] }) {
    return (
        <div className="flex gap-1 flex-wrap">
            {DAY_NAMES_SHORT.map((name, i) => {
                const available = days.includes(i)
                return (
                    <span
                        key={i}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-medium"
                        style={{
                            background: available ? `rgba(var(--brand-primary-rgb), 0.125)` : `rgba(var(--brand-primary-rgb), 0.024)`,
                            color: available ? 'var(--brand-primary)' : 'inherit',
                            opacity: available ? 1 : 0.3,
                        }}
                    >
                        {name.charAt(0)}
                    </span>
                )
            })}
        </div>
    )
}

function DoctorAvatar({ doctor, size = 'md' }: { doctor: DoctorItem; size?: 'sm' | 'md' | 'lg' }) {
    const sizeClass = size === 'sm' ? 'w-12 h-12' : size === 'lg' ? 'w-32 h-32' : 'w-20 h-20'
    const textSize = size === 'sm' ? 'text-lg' : size === 'lg' ? 'text-4xl' : 'text-2xl'

    if (doctor.photoUrl) {
        return <img src={doctor.photoUrl} alt={doctor.name} className={`${sizeClass} rounded-2xl object-cover`} />
    }
    return (
        <div
            className={`${sizeClass} rounded-2xl flex items-center justify-center ${textSize} font-bold text-white`}
            style={{ background: 'var(--brand-primary)' }}
        >
            {doctor.name.charAt(0).toUpperCase()}
        </div>
    )
}

export function DoctorProfileBlock({ block }: BlockProps<DoctorProfileConfig>) {
    const {
        headline,
        subheadline,
        doctors = [],
        variant = 'cards',
    } = block

    const [expandedBio, setExpandedBio] = useState<number | null>(null)

    /* ── Cards variant ───────────────────────────────────────────────────────── */
    const renderCards = () => (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {doctors.map((doc, i) => (
                <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.05 }}
                    className="p-6 rounded-2xl text-center transition-shadow duration-300 hover:shadow-lg"
                    style={{ border: `1px solid rgba(var(--brand-primary-rgb), 0.082)` }}
                >
                    <div className="flex justify-center mb-4">
                        <DoctorAvatar doctor={doc} size="lg" />
                    </div>
                    <h3 className="text-lg font-bold font-heading mb-1">{doc.name}</h3>
                    <p className="text-sm mb-3" style={{ color: 'var(--brand-primary)' }}>{doc.specialisation}</p>

                    {doc.qualifications.length > 0 && (
                        <div className="flex flex-wrap justify-center gap-1.5 mb-4">
                            {doc.qualifications.map((q, qi) => (
                                <span
                                    key={qi}
                                    className="px-2 py-0.5 rounded-full text-xs"
                                    style={{ background: `rgba(var(--brand-primary-rgb), 0.063)` }}
                                >
                                    {q}
                                </span>
                            ))}
                        </div>
                    )}

                    {doc.consultationFee && (
                        <p className="text-lg font-bold mb-3" style={{ color: 'var(--brand-primary)' }}>
                            {doc.consultationFee}
                        </p>
                    )}

                    <div className="flex justify-center">
                        <AvailabilityBadges days={doc.availableDays} />
                    </div>

                    {doc.languages && (
                        <p className="text-xs opacity-40 mt-3">{doc.languages}</p>
                    )}
                </motion.div>
            ))}
        </div>
    )

    /* ── Detailed variant ────────────────────────────────────────────────────── */
    const renderDetailed = () => (
        <div className="max-w-4xl mx-auto space-y-8">
            {doctors.map((doc, i) => (
                <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.05 }}
                    className="p-8 rounded-2xl"
                    style={{ border: `1px solid rgba(var(--brand-primary-rgb), 0.082)` }}
                >
                    <div className="flex flex-col md:flex-row gap-6 items-start">
                        <DoctorAvatar doctor={doc} size="lg" />
                        <div className="flex-1">
                            <h3 className="text-2xl font-bold font-heading mb-1">{doc.name}</h3>
                            <p className="text-base mb-4" style={{ color: 'var(--brand-primary)' }}>{doc.specialisation}</p>

                            {doc.qualifications.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 mb-4">
                                    {doc.qualifications.map((q, qi) => (
                                        <span
                                            key={qi}
                                            className="px-3 py-1 rounded-full text-xs font-medium"
                                            style={{ background: `rgba(var(--brand-primary-rgb), 0.082)`, color: 'var(--brand-primary)' }}
                                        >
                                            {q}
                                        </span>
                                    ))}
                                </div>
                            )}

                            <div className="flex flex-wrap items-center gap-6 mb-4">
                                {doc.consultationFee && (
                                    <div>
                                        <p className="text-xs opacity-40">Consultation Fee</p>
                                        <p className="text-lg font-bold" style={{ color: 'var(--brand-primary)' }}>{doc.consultationFee}</p>
                                    </div>
                                )}
                                {doc.languages && (
                                    <div>
                                        <p className="text-xs opacity-40">Languages</p>
                                        <p className="text-sm font-medium">{doc.languages}</p>
                                    </div>
                                )}
                            </div>

                            <div className="mb-4">
                                <p className="text-xs opacity-40 mb-2">Available</p>
                                <AvailabilityBadges days={doc.availableDays} />
                            </div>

                            {doc.bio && (
                                <div>
                                    <p className={`text-sm opacity-60 leading-relaxed ${expandedBio !== i ? 'line-clamp-3' : ''}`}>
                                        {doc.bio}
                                    </p>
                                    {doc.bio.length > 150 && (
                                        <button
                                            onClick={() => setExpandedBio(expandedBio === i ? null : i)}
                                            className="text-sm font-semibold mt-2 transition-opacity hover:opacity-80"
                                            style={{ color: 'var(--brand-primary)' }}
                                        >
                                            {expandedBio === i ? 'Show less' : 'Read more'}
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </motion.div>
            ))}
        </div>
    )

    /* ── List variant ────────────────────────────────────────────────────────── */
    const renderList = () => (
        <div className="max-w-3xl mx-auto space-y-4">
            {doctors.map((doc, i) => (
                <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -8 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.05 }}
                    className="flex items-center gap-4 p-5 rounded-xl transition-shadow duration-200 hover:shadow-md"
                    style={{ border: `1px solid rgba(var(--brand-primary-rgb), 0.082)` }}
                >
                    <DoctorAvatar doctor={doc} size="sm" />
                    <div className="flex-1 min-w-0">
                        <h4 className="font-bold font-heading">{doc.name}</h4>
                        <p className="text-sm" style={{ color: 'var(--brand-primary)' }}>{doc.specialisation}</p>
                        {doc.languages && <p className="text-xs opacity-40">{doc.languages}</p>}
                    </div>
                    {doc.consultationFee && (
                        <span className="text-lg font-bold shrink-0" style={{ color: 'var(--brand-primary)' }}>
                            {doc.consultationFee}
                        </span>
                    )}
                </motion.div>
            ))}
        </div>
    )

    return (
        <AnimatedSection className={SECTION_PADDING.default}>
            <div className={`${CONTAINER.default} mx-auto ${INNER_PADDING}`}>
                <div className="text-center max-w-2xl mx-auto mb-12">
                    <Heading level={2} className="mb-5 leading-tight">
                        <RichText text={headline} as="span" />
                    </Heading>
                    {subheadline && (
                        <Body size="lg" className="opacity-50 leading-relaxed">
                            <RichText text={subheadline} as="span" />
                        </Body>
                    )}
                </div>

                {variant === 'cards' && renderCards()}
                {variant === 'detailed' && renderDetailed()}
                {variant === 'list' && renderList()}
            </div>
        </AnimatedSection>
    )
}
