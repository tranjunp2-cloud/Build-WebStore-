'use client'

/**
 * Onboarding checklist — design-styled card fed by REAL setup flags + routes.
 * Ports the design Onboarding (progress ring + step list); steps link to real pages.
 * Step text (name/desc/cta) is sourced from t.dashboard.revamp.onboarding.steps[id].
 */
import Link from 'next/link'
import { Check, Pencil, Eye } from 'lucide-react'
import { useI18n } from '@/i18n'
import { Button } from '@/components/ui/button'

export interface OnboardingStep {
    id: 'products' | 'design' | 'shipping' | 'launch'
    done: boolean
    href: string
}

export function OnboardingCard({ steps }: { steps: OnboardingStep[] }) {
    const { t, tp } = useI18n()
    const r = t.dashboard.revamp

    const done = steps.filter(s => s.done).length
    const remaining = steps.length - done
    const pct = steps.length ? Math.round((done / steps.length) * 100) : 0
    const r2 = 21
    const c = 2 * Math.PI * r2
    const nextId = (steps.find(s => !s.done) || {}).id

    return (
        <div className="onb">
            <div className="onb-top">
                <div className="onb-ring">
                    <svg width="48" height="48">
                        <circle cx="24" cy="24" r={r2} fill="none" stroke="var(--dr-surface-3)" strokeWidth="5" />
                        <circle cx="24" cy="24" r={r2} fill="none" stroke="url(#onbGrad)" strokeWidth="5" strokeLinecap="round"
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
                    <h3>{r.onboarding.title}</h3>
                    <p>{tp(r.onboarding.subtitle, remaining)}</p>
                </div>
            </div>
            <div className="onb-steps">
                {steps.map(s => {
                    const isNext = s.id === nextId
                    const Ico = s.id === 'design' ? Pencil : Eye
                    const stepT = r.onboarding.steps[s.id]
                    return (
                        <div key={s.id} className={`onb-step ${s.done ? 'done' : isNext ? 'next' : ''}`}>
                            <span className="step-tick">{s.done ? <Check aria-hidden /> : null}</span>
                            <div className="step-body">
                                <div className="step-name">{stepT.name}</div>
                                <div className="step-desc" style={{ whiteSpace: 'pre-line' }}>{stepT.desc}</div>
                            </div>
                            <Button
                                asChild
                                size="sm"
                                variant={s.done ? 'dashGhost' : isNext ? 'dashPrimary' : 'dashSecondary'}
                                className="shrink-0"
                            >
                                <Link href={s.href}>
                                    {s.done && <Ico aria-hidden />}
                                    {s.done ? stepT.cta : `${stepT.cta} →`}
                                </Link>
                            </Button>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
