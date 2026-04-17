import type { BlockProps } from '../types'
import type { StatsConfig } from './config'

const FALLBACK_STATS: StatsConfig['stats'] = [
    { value: '500+', label: 'Happy Customers' },
    { value: '10+', label: 'Years Experience' },
    { value: '4.9', label: 'Average Rating', suffix: '★' },
]

export function StatsBlock({ block, theme }: BlockProps<StatsConfig>) {
    const { headline, stats: rawStats = [] } = block
    const stats = rawStats.length > 0 ? rawStats : FALLBACK_STATS
    return (
        <section className="py-20">
            <div className="container mx-auto px-6">
                {headline && <h2 className="text-3xl font-bold font-heading text-center mb-12">{headline}</h2>}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                    {stats.map((stat, i) => (
                        <div key={i} className="text-center">
                            <p className="text-4xl md:text-5xl font-bold font-heading mb-2" style={{ color: theme.primaryColor }}>
                                {stat.prefix}{stat.value}{stat.suffix}
                            </p>
                            <p className="text-sm opacity-60">{stat.label}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    )
}
