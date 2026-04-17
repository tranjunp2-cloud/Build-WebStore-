import type { BlockProps } from '../types'
import type { TeamConfig } from './config'

const FALLBACK_MEMBERS: TeamConfig['members'] = [
    { name: 'Team Lead', role: 'Founder' },
    { name: 'Senior Specialist', role: 'Expert' },
    { name: 'Customer Success', role: 'Support' },
]

export function TeamBlock({ block, theme }: BlockProps<TeamConfig>) {
    const { headline, subheadline, members: rawMembers = [] } = block
    const members = rawMembers.length > 0 ? rawMembers : FALLBACK_MEMBERS
    return (
        <section className="py-24">
            <div className="container mx-auto px-6">
                {headline && <h2 className="text-4xl font-bold font-heading text-center mb-4">{headline}</h2>}
                {subheadline && <p className="text-center opacity-70 mb-12">{subheadline}</p>}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                    {members.map((m, i) => (
                        <div key={i} className="text-center p-6 rounded-2xl border transition-all hover:shadow-lg" style={{ borderColor: `${theme.primaryColor}15` }}>
                            {m.avatar?.url && <img src={m.avatar.url} alt={m.avatar.alt || m.name} className="w-24 h-24 rounded-full mx-auto mb-4 object-cover" />}
                            <h3 className="font-bold font-heading text-lg">{m.name}</h3>
                            <p className="text-sm opacity-60 mb-2" style={{ color: theme.primaryColor }}>{m.role}</p>
                            {m.bio && <p className="text-sm opacity-70">{m.bio}</p>}
                        </div>
                    ))}
                </div>
            </div>
        </section>
    )
}
