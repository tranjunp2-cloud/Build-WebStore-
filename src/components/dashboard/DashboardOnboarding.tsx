'use client'

import Link from 'next/link'
import { Clock, Circle, CheckCircle2 } from 'lucide-react'
import { SetupAlertBanner } from './SetupAlertBanner'
import { useI18n } from '@/i18n'

interface OnboardingStep {
    id: string
    label: string
    description: string
    done: boolean
    href: string
}

type StepState = 'completed' | 'active' | 'locked'

interface DashboardOnboardingProps {
    hasPublishedSite: boolean
    siteId?: string | null
    hasProducts?: boolean
    isDesignCustomized?: boolean
    hasPaymentConfigured?: boolean
}

function getStepState(index: number, steps: OnboardingStep[]): StepState {
    if (steps[index].done) return 'completed'
    const firstIncompleteIdx = steps.findIndex(s => !s.done)
    return index === firstIncompleteIdx ? 'active' : 'locked'
}

export function DashboardOnboarding({
    hasPublishedSite,
    siteId,
    hasProducts = false,
    isDesignCustomized = false,
    hasPaymentConfigured = false,
}: DashboardOnboardingProps) {
    const { t } = useI18n()
    const o = t.dashboard.onboarding
    const steps: OnboardingStep[] = [
        {
            id: 'products',
            label: o.steps.products.label,
            description: o.steps.products.description,
            done: hasProducts,
            href: '/products/new',
        },
        {
            id: 'design',
            label: o.steps.design.label,
            description: o.steps.design.description,
            done: isDesignCustomized,
            href: siteId ? `/editor/${siteId}` : '/builder/new',
        },
        {
            id: 'payment',
            label: o.steps.payment.label,
            description: o.steps.payment.description,
            done: hasPaymentConfigured,
            href: '/settings/payments',
        },
        {
            id: 'publish',
            label: o.steps.publish.label,
            description: o.steps.publish.description,
            done: hasPublishedSite,
            href: siteId ? `/editor/${siteId}` : '/builder/new',
        },
    ]

    const completedCount = steps.filter(s => s.done).length
    const progressPct = Math.round((completedCount / steps.length) * 100)

    if (completedCount === steps.length) return null

    return (
        <div className="space-y-[30px]">
            {/* Get Your Store Ready — 4-step checklist */}
            <div className="flex flex-col gap-[40px] rounded-2xl border border-white/10 bg-gradient-to-br from-dash-surface-hover to-dash-surface p-[25px] shadow-sm">
                <div className="flex items-start justify-between">
                    <div>
                        <h3 className="text-lg font-semibold text-dash-text">{o.title}</h3>
                        <p className="text-sm text-dash-text-muted">{o.subtitle}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-2xl font-bold text-blue-500">{progressPct}%</p>
                        <p className="text-xs text-dash-text-muted">{o.completeLabel}</p>
                    </div>
                </div>

                <div className="space-y-3">
                    {steps.map((step, index) => {
                        const state = getStepState(index, steps)
                        if (state === 'completed') {
                            return (
                                <div key={step.id} className="flex h-16 items-center gap-3 rounded-xl border border-[rgba(0,201,80,0.2)] bg-[rgba(0,201,80,0.1)] px-3 py-3.5">
                                    <CheckCircle2 className="h-5 w-5 shrink-0 text-[#05df72]" />
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-medium text-[#05df72]">{step.label}</p>
                                        <p className="text-xs text-dash-text-muted">{step.description}</p>
                                    </div>
                                </div>
                            )
                        }
                        if (state === 'active') {
                            return (
                                <div key={step.id} className="flex items-center justify-between rounded-xl border border-[rgba(59,130,246,0.3)] bg-[rgba(59,130,246,0.1)] p-[13px] shadow-[0_0_15px_rgba(59,130,246,0.2)]">
                                    <div className="flex min-w-0 items-center gap-3">
                                        <Clock className="h-5 w-5 shrink-0 text-blue-400" />
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium text-blue-500">{step.label}</p>
                                            <p className="text-xs text-dash-text-muted">{step.description}</p>
                                        </div>
                                    </div>
                                    <Link
                                        href={step.href}
                                        className="ml-3 inline-flex h-7 shrink-0 items-center rounded-xl bg-gradient-to-r from-blue-500 to-teal-400 px-3 text-xs font-medium text-white transition-opacity hover:opacity-90"
                                    >
                                        {o.continueBtn}
                                    </Link>
                                </div>
                            )
                        }
                        return (
                            <div key={step.id} className="flex h-16 items-center gap-3 rounded-xl border border-dash-border bg-dash-secondary-bg px-3 py-3.5">
                                <Circle className="h-5 w-5 shrink-0 text-dash-text-muted" />
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium text-dash-text-muted">{step.label}</p>
                                    <p className="text-xs text-dash-text-muted">{step.description}</p>
                                </div>
                            </div>
                        )
                    })}
                </div>

                <div className="h-2 w-full overflow-hidden rounded-full bg-dash-secondary-bg">
                    <div
                        className="h-full rounded-full bg-gradient-to-r from-blue-500 to-teal-400 transition-all duration-500"
                        style={{ width: `${progressPct}%` }}
                    />
                </div>
            </div>

            <SetupAlertBanner hasPaymentConfigured={hasPaymentConfigured} />
        </div>
    )
}
