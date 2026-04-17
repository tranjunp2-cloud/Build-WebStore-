'use client'

import type { BlockProps } from '../types'
import type { ServiceCardsConfig, ServiceItem } from './config'
import { CSS_VARS as _CSS_VARS } from '@/lib/theme/resolve'
import { AnimatedSection } from '../shared/animations'
import { RichText } from '../shared/RichText'
import { Heading, Body } from '../shared/Typography'
import { TOUCH_TARGET, CARD_PADDING } from '@/lib/design-tokens'
import { SectionWrapper } from '../shared/SectionWrapper'

void _CSS_VARS

export function ServiceCardsBlock({ block, theme: _theme }: BlockProps<ServiceCardsConfig>) {
    void _theme
    const { headline, subheadline, services = [], variant = 'grid' } = block

    const ServiceCTA = ({ cta }: { cta: ServiceItem['cta'] }) => {
        if (!cta) return null
        return (
            <a
                href={cta?.url}
                className={`inline-flex items-center gap-1 text-sm font-semibold mt-4 transition-opacity hover:opacity-80 ${TOUCH_TARGET.min}`}
                style={{ color: 'var(--brand-primary)' }}
            >
                {cta.label}
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
            </a>
        )
    }

    /* Plan 260415 service-cards-bugfix — stable keys + opacity WCAG fix + truncate price */
    const renderGridCard = (service: ServiceItem, i: number) => (
        <div
            key={`${service.title}-${i}`}
            className={`${CARD_PADDING.lg} rounded-2xl transition-all duration-300 hover:shadow-lg group`}
            style={{ background: `linear-gradient(135deg, rgba(var(--brand-primary-rgb), 0.024), transparent)`, border: `1px solid rgba(var(--brand-primary-rgb), 0.071)` }}
        >
            <div
                className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl mb-5 group-hover:scale-110 transition-transform duration-300"
                style={{ background: `rgba(var(--brand-primary-rgb), 0.082)` }}
                aria-hidden="true"
            >
                {service.icon}
            </div>
            <Heading level={3} className="mb-3">{service.title}</Heading>
            {/* Lỗi D — opacity-50 fail WCAG contrast → opacity-70 */}
            <Body size="small" className="opacity-70 leading-relaxed mb-4">{service.description}</Body>
            {service.price && (
                <p className="text-xl sm:text-2xl font-bold mb-1 break-words" style={{ color: 'var(--brand-primary)' }}>
                    {service.price}
                    {service.priceUnit && <span className="text-sm font-normal opacity-70 ml-1">{service.priceUnit}</span>}
                </p>
            )}
            <ServiceCTA cta={service.cta} />
        </div>
    )

    const renderListCard = (service: ServiceItem, i: number) => (
        <div
            key={`${service.title}-${i}`}
            className={`flex flex-col sm:flex-row items-center sm:items-start gap-6 ${CARD_PADDING.md} rounded-2xl transition-all duration-300 hover:shadow-lg`}
            style={{ border: `1px solid rgba(var(--brand-primary-rgb), 0.071)` }}
        >
            <div
                className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl shrink-0"
                style={{ background: `rgba(var(--brand-primary-rgb), 0.082)` }}
                aria-hidden="true"
            >
                {service.icon}
            </div>
            <div className="flex-1 text-center sm:text-left min-w-0">
                <Heading level={3} className="mb-2">{service.title}</Heading>
                <Body size="small" className="opacity-70 leading-relaxed">{service.description}</Body>
                <ServiceCTA cta={service.cta} />
            </div>
            {service.price && (
                <div className="shrink-0 text-center sm:text-right">
                    <p className="text-xl sm:text-2xl font-bold break-words" style={{ color: 'var(--brand-primary)' }}>{service.price}</p>
                    {service.priceUnit && <Body size="small" className="opacity-70">{service.priceUnit}</Body>}
                </div>
            )}
        </div>
    )

    const renderFeatured = () => {
        if (services.length === 0) return null
        const [featured, ...rest] = services
        return (
            <>
                {/* Featured large card */}
                <div
                    className="p-10 rounded-2xl mb-8 relative overflow-hidden"
                    style={{ background: `linear-gradient(135deg, rgba(var(--brand-primary-rgb), 0.082), rgba(var(--brand-primary-rgb), 0.02))`, border: `1px solid rgba(var(--brand-primary-rgb), 0.125)` }}
                >
                    <div
                        className="w-16 h-16 rounded-xl flex items-center justify-center text-3xl mb-6"
                        style={{ background: `rgba(var(--brand-primary-rgb), 0.125)` }}
                    >
                        {featured.icon}
                    </div>
                    <Heading level={2} className="mb-4">{featured.title}</Heading>
                    <Body size="lg" className="opacity-60 leading-relaxed max-w-xl mb-4">{featured.description}</Body>
                    {featured.price && (
                        <p className="text-3xl font-bold mb-2" style={{ color: 'var(--brand-primary)' }}>
                            {featured.price}
                            {featured.priceUnit && <span className="text-base font-normal opacity-60">{featured.priceUnit}</span>}
                        </p>
                    )}
                    {featured.cta && (
                        <a
                            href={featured.cta?.url}
                            className={`inline-flex items-center justify-center mt-4 px-6 py-3 rounded-xl font-semibold text-white transition-opacity hover:opacity-90 ${TOUCH_TARGET.min}`}
                            style={{ background: 'var(--brand-primary)' }}
                        >
                            {featured.cta.label}
                        </a>
                    )}
                </div>
                {/* Rest as grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {rest.map((service, i) => renderGridCard(service, i))}
                </div>
            </>
        )
    }

    /* Plan 260415 Lỗi B — empty state thay vì silent null return */
    if (!services || services.length === 0) {
        if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
            console.warn('[service-cards] services array empty — block rendered nothing')
        }
        return null
    }

    return (
        <AnimatedSection>
            <SectionWrapper as="div" padding="default" container="default" background="transparent">
                {/* Header */}
                <div className="text-center max-w-2xl mx-auto mb-16">
                    <Heading level={2} className="mb-5 leading-tight">
                        <RichText text={headline} as="span" />
                    </Heading>
                    {subheadline && (
                        <Body size="lg" className="opacity-70 leading-relaxed">
                            <RichText text={subheadline} as="span" />
                        </Body>
                    )}
                </div>

                {/* Content */}
                {variant === 'grid' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {services.map((service, i) => renderGridCard(service, i))}
                    </div>
                )}

                {variant === 'list' && (
                    <div className="max-w-3xl mx-auto space-y-4">
                        {services.map((service, i) => renderListCard(service, i))}
                    </div>
                )}

                {variant === 'featured' && renderFeatured()}
            </SectionWrapper>
        </AnimatedSection>
    )
}
