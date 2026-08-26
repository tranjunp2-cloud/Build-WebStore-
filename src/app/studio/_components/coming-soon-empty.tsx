/**
 * ComingSoonEmpty — on-brand "Coming Phase 2" empty state for placeholder routes.
 * Uses .empty-state class from studio.css + admin visual tokens.
 * DRY: single component reused across analytics / settings / tags pages.
 */
import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'

export interface ComingSoonEmptyProps {
    icon: LucideIcon
    title: string
    description: string
    ctaHref?: string
    ctaLabel?: string
}

export function ComingSoonEmpty({
    icon: Icon,
    title,
    description,
    ctaHref,
    ctaLabel,
}: ComingSoonEmptyProps) {
    return (
        <div
            className="empty-state"
            style={{ maxWidth: 480, margin: '0 auto' }}
            aria-label={title}
        >
            {/* Accent icon */}
            <div
                style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 48,
                    height: 48,
                    borderRadius: 'var(--radius-lg)',
                    background: 'var(--accent-soft)',
                    marginBottom: 16,
                }}
                aria-hidden
            >
                <Icon size={22} style={{ color: 'var(--accent)' }} />
            </div>

            {/* Badge */}
            <div style={{ marginBottom: 8 }}>
                <span
                    style={{
                        display: 'inline-block',
                        fontSize: 11,
                        fontWeight: 600,
                        padding: '2px 10px',
                        borderRadius: 20,
                        background: 'var(--accent-soft)',
                        color: 'var(--accent)',
                        letterSpacing: '0.02em',
                    }}
                >
                    Coming Phase 2
                </span>
            </div>

            <h3>{title}</h3>
            <p>{description}</p>

            {/* Optional CTA */}
            {ctaHref && ctaLabel && (
                <div style={{ marginTop: 20 }}>
                    <Link
                        href={ctaHref}
                        aria-label={ctaLabel}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            fontSize: 13,
                            fontWeight: 600,
                            color: 'var(--accent)',
                            padding: '7px 16px',
                            border: '1px solid var(--accent-border)',
                            borderRadius: 'var(--radius)',
                            background: 'var(--accent-soft)',
                            textDecoration: 'none',
                            transition: 'background 120ms ease',
                        }}
                    >
                        {ctaLabel}
                    </Link>
                </div>
            )}
        </div>
    )
}
