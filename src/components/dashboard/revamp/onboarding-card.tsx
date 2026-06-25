'use client'

/**
 * Onboarding checklist — design-styled card fed by REAL setup flags + routes.
 * Ports the design Onboarding (progress ring + step list); steps link to real pages.
 */
import Link from 'next/link'
import { Check, Pencil, Eye } from 'lucide-react'

export interface OnboardingStep {
    id: string
    name: string
    desc: string
    done: boolean
    href: string
    /** action label when not done, e.g. "Set up" / "Publish" */
    cta: string
}

export function OnboardingCard({ steps }: { steps: OnboardingStep[] }) {
    const done = steps.filter(s => s.done).length
    const remaining = steps.length - done
    const pct = steps.length ? Math.round((done / steps.length) * 100) : 0
    const r = 21
    const c = 2 * Math.PI * r
    const nextId = (steps.find(s => !s.done) || {}).id

    return (
        <div className="onb">
            <div className="onb-top">
                <div className="onb-ring">
                    <svg width="48" height="48">
                        <circle cx="24" cy="24" r={r} fill="none" stroke="var(--dr-surface-3)" strokeWidth="5" />
                        <circle cx="24" cy="24" r={r} fill="none" stroke="url(#onbGrad)" strokeWidth="5" strokeLinecap="round"
                            strokeDasharray={`${(pct / 100) * c} ${c}`} transform="rotate(-90 24 24)"
                            style={{ transition: 'stroke-dasharray .6s' }} />
                        <defs>
                            <linearGradient id="onbGrad" x1="0" y1="0" x2="1" y2="1">
                                <stop offset="0%" stopColor="#2563eb" /><stop offset="100%" stopColor="#2dd4bf" />
                            </linearGradient>
                        </defs>
                    </svg>
                    <span className="pct">{pct}%</span>
                </div>
                <div className="onb-titles">
                    <h3>Finish setting up your store</h3>
                    <p>Complete {remaining} more {remaining === 1 ? 'step' : 'steps'} to launch your website.</p>
                </div>
            </div>
            <div className="onb-steps">
                {steps.map(s => {
                    const isNext = s.id === nextId
                    const Ico = s.id === 'design' ? Pencil : Eye
                    return (
                        <div key={s.id} className={`onb-step ${s.done ? 'done' : isNext ? 'next' : ''}`}>
                            <span className="step-tick">{s.done ? <Check aria-hidden /> : null}</span>
                            <div className="step-body">
                                <div className="step-name">{s.name}</div>
                                <div className="step-desc" style={{ whiteSpace: 'pre-line' }}>{s.desc}</div>
                            </div>
                            <Link
                                href={s.href}
                                className={`btn btn-sm step-btn ${s.done ? 'btn-ghost' : isNext ? 'btn-primary' : 'btn-secondary'}`}
                            >
                                {s.done && <Ico aria-hidden />}
                                {s.done ? s.cta : `${s.cta} →`}
                            </Link>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
