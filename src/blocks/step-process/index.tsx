'use client'

import type { ReactNode } from 'react'
import type { BlockProps } from '../types'
import type { StepProcessConfig } from './config'
import { CSS_VARS as _CSS_VARS } from '@/lib/theme/resolve'
import { AnimatedSection } from '../shared/animations'
import { RichText } from '../shared/RichText'
import { Heading, Body } from '../shared/Typography'
import { SectionWrapper } from '../shared/SectionWrapper'

void _CSS_VARS

function StepProcessSection({ children }: { children: ReactNode }) {
    return (
        <AnimatedSection>
            <SectionWrapper as="div" padding="default" container="default" background="transparent">
                {children}
            </SectionWrapper>
        </AnimatedSection>
    )
}

type StepProcessHeaderProps = {
    headline: StepProcessConfig['headline']
    subheadline?: StepProcessConfig['subheadline']
}

function StepProcessHeader({ headline, subheadline }: StepProcessHeaderProps) {
    return (
        <div className="text-center max-w-2xl mx-auto mb-16">
            <RichText text={headline} as="h2" className="text-4xl md:text-5xl font-bold font-heading mb-5 leading-tight" />
            {subheadline && <RichText text={subheadline} as="p" className="text-lg opacity-50 leading-relaxed" />}
        </div>
    )
}

type StepBadgeProps = {
    size?: 'md' | 'lg'
    children: ReactNode
}

function StepBadge({ size = 'md', children }: StepBadgeProps) {
    const sizeCls = size === 'lg' ? 'w-16 h-16 text-xl' : 'w-12 h-12 text-sm'
    return (
        <div
            className={`${sizeCls} rounded-full flex items-center justify-center font-bold relative z-10 shrink-0`}
            style={{ background: `rgba(var(--brand-primary-rgb), 0.082)`, border: `2px solid rgba(var(--brand-primary-rgb), 0.251)`, color: 'var(--brand-primary)' }}
        >
            {children}
        </div>
    )
}

export function StepProcessBlock({ block }: BlockProps<StepProcessConfig>) {
    const { headline, subheadline, steps = [], variant = 'vertical' } = block

    if (variant === 'horizontal') {
        return (
            <StepProcessSection>
                <StepProcessHeader headline={headline} subheadline={subheadline} />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 relative">
                    {/* Connecting line */}
                    <div
                        className="hidden lg:block absolute top-8 left-[12.5%] right-[12.5%] h-0.5"
                        style={{ background: `linear-gradient(90deg, rgba(var(--brand-primary-rgb), 0.251), rgba(var(--brand-primary-rgb), 0.125))` }}
                    />
                    {steps.map((step, i) => (
                        <div key={i} className="relative text-center">
                            <div className="mx-auto mb-6 inline-block">
                                <StepBadge size="lg">{step.icon || i + 1}</StepBadge>
                            </div>
                            <Heading level={4} className="mb-2">{step.title}</Heading>
                            <Body size="small" className="opacity-50">{step.description}</Body>
                        </div>
                    ))}
                </div>
            </StepProcessSection>
        )
    }

    if (variant === 'alternating') {
        return (
            <StepProcessSection>
                <StepProcessHeader headline={headline} subheadline={subheadline} />
                <div className="relative max-w-3xl mx-auto">
                    {/* Center line */}
                    <div
                        className="absolute left-1/2 top-0 bottom-0 w-0.5 -translate-x-1/2"
                        style={{ background: `linear-gradient(180deg, rgba(var(--brand-primary-rgb), 0.251), rgba(var(--brand-primary-rgb), 0.063))` }}
                    />
                    {steps.map((step, i) => {
                        const isLeft = i % 2 === 0
                        return (
                            <div key={i} className={`relative flex items-start mb-12 ${isLeft ? 'md:flex-row' : 'md:flex-row-reverse'}`}>
                                {/* Content */}
                                <div className={`flex-1 ${isLeft ? 'md:pr-12 md:text-right' : 'md:pl-12 md:text-left'} pl-16 md:pl-0`}>
                                    <Heading level={3} className="mb-2">{step.title}</Heading>
                                    <Body size="small" className="opacity-50">{step.description}</Body>
                                </div>
                                {/* Number circle */}
                                <div className="absolute left-0 md:left-1/2 md:-translate-x-1/2">
                                    <StepBadge>{step.icon || i + 1}</StepBadge>
                                </div>
                                {/* Spacer for opposite side */}
                                <div className="hidden md:block flex-1" />
                            </div>
                        )
                    })}
                </div>
            </StepProcessSection>
        )
    }

    // Default: vertical
    return (
        <StepProcessSection>
            <StepProcessHeader headline={headline} subheadline={subheadline} />
            <div className="relative max-w-2xl mx-auto">
                {/* Vertical line */}
                <div
                    className="absolute left-6 top-0 bottom-0 w-0.5"
                    style={{ background: `linear-gradient(180deg, rgba(var(--brand-primary-rgb), 0.251), rgba(var(--brand-primary-rgb), 0.063))` }}
                />
                {steps.map((step, i) => (
                    <div key={i} className="relative flex items-start gap-8 mb-12 last:mb-0">
                        <StepBadge>{step.icon || i + 1}</StepBadge>
                        <div className="pt-2">
                            <Heading level={3} className="mb-2">{step.title}</Heading>
                            <Body size="small" className="opacity-50">{step.description}</Body>
                        </div>
                    </div>
                ))}
            </div>
        </StepProcessSection>
    )
}
