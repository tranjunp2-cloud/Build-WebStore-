'use client'

import { useState, useEffect } from 'react'
import type { BlockProps } from '../types'
import type { CountdownTimerConfig } from './config'
import { CSS_VARS as _CSS_VARS } from '@/lib/theme/resolve'
import { AnimatedSection } from '../shared/animations'
import { RichText } from '../shared/RichText'
import { Heading, Body, Caption } from '../shared/Typography'
import { CONTAINER, INNER_PADDING, SECTION_PADDING } from '@/lib/design-tokens'

void _CSS_VARS

const CT_CONTAINER = `${CONTAINER.default} mx-auto ${INNER_PADDING}`

function calcTimeLeft(target: string) {
    const diff = new Date(target).getTime() - Date.now()
    if (diff <= 0) return null
    return {
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((diff / (1000 * 60)) % 60),
        seconds: Math.floor((diff / 1000) % 60),
    }
}

function TimeBox({ value, label }: { value: number; label: string }) {
    return (
        <div
            className="flex flex-col items-center gap-2 rounded-xl px-4 py-3 md:px-6 md:py-4 min-w-[70px]"
            style={{ background: `rgba(var(--brand-primary-rgb), 0.071)`, border: `1px solid rgba(var(--brand-primary-rgb), 0.125)` }}
        >
            <span className="text-3xl md:text-5xl font-bold font-heading" style={{ color: 'var(--brand-primary)' }}>
                {String(value).padStart(2, '0')}
            </span>
            <Caption className="uppercase tracking-wider opacity-50">{label}</Caption>
        </div>
    )
}

export function CountdownTimerBlock({ block, theme: _theme }: BlockProps<CountdownTimerConfig>) {
    void _theme
    const {
        variant = 'banner',
        headline,
        targetDate,
        expiredMessage = 'This offer has expired',
        showDays = true,
        showHours = true,
        showMinutes = true,
        showSeconds = true,
    } = block
    const [timeLeft, setTimeLeft] = useState(calcTimeLeft(targetDate))

    useEffect(() => {
        const timer = setInterval(() => {
            const tl = calcTimeLeft(targetDate)
            setTimeLeft(tl)
            if (!tl) clearInterval(timer)
        }, 1000)
        return () => clearInterval(timer)
    }, [targetDate])

    const units = [
        showDays && timeLeft && { value: timeLeft.days, label: 'Days' },
        showHours && timeLeft && { value: timeLeft.hours, label: 'Hours' },
        showMinutes && timeLeft && { value: timeLeft.minutes, label: 'Minutes' },
        showSeconds && timeLeft && { value: timeLeft.seconds, label: 'Seconds' },
    ].filter(Boolean) as { value: number; label: string }[]

    if (variant === 'minimal') {
        return (
            <AnimatedSection className={SECTION_PADDING.default}>
                <div className={`${CT_CONTAINER} text-center`}>
                    <Heading level={3} className="mb-4">
                        <RichText text={headline} as="span" />
                    </Heading>
                    {!timeLeft ? (
                        <Body size="lg" className="opacity-60">{expiredMessage}</Body>
                    ) : (
                        <p className="text-xl md:text-2xl font-heading" style={{ color: 'var(--brand-primary)' }}>
                            {units.map((u, i) => (
                                <span key={u.label}>
                                    {i > 0 && <span className="opacity-30 mx-1">:</span>}
                                    <span className="font-bold">{String(u.value).padStart(2, '0')}</span>
                                    <span className="text-sm opacity-50 ml-1">{u.label}</span>
                                </span>
                            ))}
                        </p>
                    )}
                </div>
            </AnimatedSection>
        )
    }

    if (variant === 'card') {
        return (
            <AnimatedSection className={SECTION_PADDING.default}>
                <div className={`${CT_CONTAINER} flex justify-center`}>
                    <div
                        className="rounded-2xl p-8 md:p-12 text-center max-w-lg w-full"
                        style={{ background: `rgba(var(--brand-primary-rgb), 0.031)`, border: `1px solid rgba(var(--brand-primary-rgb), 0.125)` }}
                    >
                        <Heading level={2} className="mb-8">
                            <RichText text={headline} as="span" />
                        </Heading>
                        {!timeLeft ? (
                            <Body size="lg" className="opacity-60">{expiredMessage}</Body>
                        ) : (
                            <div className="flex justify-center gap-3 md:gap-4">
                                {units.map((u) => (
                                    <TimeBox key={u.label} value={u.value} label={u.label} />
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </AnimatedSection>
        )
    }

    // banner (default)
    return (
        <AnimatedSection className={SECTION_PADDING.default}>
            <div className={CT_CONTAINER}>
                <div
                    className="rounded-3xl p-10 md:p-16 text-center relative overflow-hidden"
                    style={{
                        background: `linear-gradient(135deg, rgba(var(--brand-primary-rgb), 0.094) 0%, rgba(var(--brand-primary-rgb), 0.024) 100%)`,
                        border: `1px solid rgba(var(--brand-primary-rgb), 0.125)`,
                    }}
                >
                    <Heading level={2} className="mb-10">
                        <RichText text={headline} as="span" />
                    </Heading>
                    {!timeLeft ? (
                        <Body size="lg" className="opacity-60">{expiredMessage}</Body>
                    ) : (
                        <div className="flex justify-center gap-4 md:gap-6">
                            {units.map((u) => (
                                <TimeBox key={u.label} value={u.value} label={u.label} />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </AnimatedSection>
    )
}
