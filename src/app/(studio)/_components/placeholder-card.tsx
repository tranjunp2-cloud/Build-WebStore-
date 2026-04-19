/**
 * PlaceholderCard — shared "Coming soon" card for Phase 01 stub routes.
 * Displays title, phase badge (or "Roadmap"), and description.
 */
import { Clock } from 'lucide-react'

type Props = {
    title: string
    /** Phase number that implements this route. null = roadmap. */
    phase: number | null
    description?: string
}

export function PlaceholderCard({ title, phase, description }: Props) {
    const badge = phase !== null ? `Phase ${phase}` : 'Roadmap'
    const badgeColor = phase !== null ? 'var(--accent)' : 'var(--text-3)'

    return (
        <div
            className="flex flex-col items-center justify-center min-h-[40vh] rounded-xl border p-10 text-center gap-4"
            style={{ borderColor: 'var(--border)', background: 'var(--bg-elev)' }}
        >
            <Clock size={36} style={{ color: 'var(--text-3)' }} />

            <div>
                <span
                    className="inline-block text-xs font-semibold px-2.5 py-1 rounded-full mb-3"
                    style={{
                        color: badgeColor,
                        background: 'color-mix(in srgb, currentColor 12%, transparent)',
                    }}
                >
                    {badge}
                </span>
                <h2 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>
                    {title}
                </h2>
                {description && (
                    <p className="mt-1 text-sm max-w-sm mx-auto" style={{ color: 'var(--text-2)' }}>
                        {description}
                    </p>
                )}
            </div>

            {phase !== null && (
                <p className="text-xs" style={{ color: 'var(--text-3)' }}>
                    Coming in Phase {phase} — check back after the milestone is shipped.
                </p>
            )}
        </div>
    )
}
