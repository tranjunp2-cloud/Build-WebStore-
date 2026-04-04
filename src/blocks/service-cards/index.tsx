'use client'

import type { BlockProps } from '../types'
import type { ServiceCardsConfig, ServiceItem } from './config'

export function ServiceCardsBlock({ block, theme }: BlockProps<ServiceCardsConfig>) {
    const { headline, subheadline, services = [], variant = 'grid' } = block
    const pc = theme.primaryColor

    const ServiceCTA = ({ cta }: { cta: ServiceItem['cta'] }) => {
        if (!cta) return null
        return (
            <a
                href={cta.url}
                className="inline-flex items-center gap-1 text-sm font-semibold mt-4 transition-opacity hover:opacity-80"
                style={{ color: pc }}
            >
                {cta.label}
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
            </a>
        )
    }

    const renderGridCard = (service: ServiceItem, i: number) => (
        <div
            key={i}
            className="p-8 rounded-2xl transition-all duration-300 hover:shadow-lg group"
            style={{ background: `linear-gradient(135deg, ${pc}06, transparent)`, border: `1px solid ${pc}12` }}
        >
            <div
                className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl mb-5 group-hover:scale-110 transition-transform duration-300"
                style={{ background: `${pc}15` }}
            >
                {service.icon}
            </div>
            <h3 className="text-xl font-bold font-heading mb-3">{service.title}</h3>
            <p className="text-sm opacity-50 leading-relaxed mb-4">{service.description}</p>
            {service.price && (
                <p className="text-2xl font-bold mb-1" style={{ color: pc }}>
                    {service.price}
                    {service.priceUnit && <span className="text-sm font-normal opacity-60">{service.priceUnit}</span>}
                </p>
            )}
            <ServiceCTA cta={service.cta} />
        </div>
    )

    const renderListCard = (service: ServiceItem, i: number) => (
        <div
            key={i}
            className="flex flex-col md:flex-row items-start gap-6 p-6 rounded-2xl transition-all duration-300 hover:shadow-lg"
            style={{ border: `1px solid ${pc}12` }}
        >
            <div
                className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl shrink-0"
                style={{ background: `${pc}15` }}
            >
                {service.icon}
            </div>
            <div className="flex-1">
                <h3 className="text-xl font-bold font-heading mb-2">{service.title}</h3>
                <p className="text-sm opacity-50 leading-relaxed">{service.description}</p>
                <ServiceCTA cta={service.cta} />
            </div>
            {service.price && (
                <div className="shrink-0 text-right">
                    <p className="text-2xl font-bold" style={{ color: pc }}>{service.price}</p>
                    {service.priceUnit && <p className="text-sm opacity-50">{service.priceUnit}</p>}
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
                    style={{ background: `linear-gradient(135deg, ${pc}15, ${pc}05)`, border: `1px solid ${pc}20` }}
                >
                    <div
                        className="w-16 h-16 rounded-xl flex items-center justify-center text-3xl mb-6"
                        style={{ background: `${pc}20` }}
                    >
                        {featured.icon}
                    </div>
                    <h3 className="text-2xl md:text-3xl font-bold font-heading mb-4">{featured.title}</h3>
                    <p className="text-base opacity-60 leading-relaxed max-w-xl mb-4">{featured.description}</p>
                    {featured.price && (
                        <p className="text-3xl font-bold mb-2" style={{ color: pc }}>
                            {featured.price}
                            {featured.priceUnit && <span className="text-base font-normal opacity-60">{featured.priceUnit}</span>}
                        </p>
                    )}
                    {featured.cta && (
                        <a
                            href={featured.cta.url}
                            className="inline-block mt-4 px-6 py-3 rounded-xl font-semibold text-white transition-opacity hover:opacity-90"
                            style={{ background: pc }}
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

    return (
        <section className="py-24">
            <div className="container mx-auto px-6">
                {/* Header */}
                <div className="text-center max-w-2xl mx-auto mb-16">
                    <h2 className="text-4xl md:text-5xl font-bold font-heading mb-5 leading-tight">{headline}</h2>
                    {subheadline && <p className="text-lg opacity-50 leading-relaxed">{subheadline}</p>}
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
            </div>
        </section>
    )
}
