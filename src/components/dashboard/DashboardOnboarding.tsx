'use client'

import Link from 'next/link'
import { Clock, CheckCircle2 } from 'lucide-react'
import { SetupAlertBanner } from './SetupAlertBanner'
import { useI18n } from '@/i18n'

interface OnboardingStep {
    id: string
    label: string
    description: string
    done: boolean
    href: string
}

type StepState = 'completed' | 'active'

interface DashboardOnboardingProps {
    hasPublishedSite: boolean
    siteId?: string | null
    hasProducts?: boolean
    isDesignCustomized?: boolean
    hasPaymentConfigured?: boolean
    hasShippingConfigured?: boolean
}

function getStepState(step: OnboardingStep): StepState {
    return step.done ? 'completed' : 'active'
}

export function DashboardOnboarding({
    hasPublishedSite,
    siteId,
    hasProducts = false,
    isDesignCustomized = false,
    hasPaymentConfigured = false,
    hasShippingConfigured = false,
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
            done: hasPaymentConfigured && hasShippingConfigured,
            href: '/settings/shipping',
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
                        <p className="text-2xl font-bold text-[hsl(var(--primary))]">{progressPct}%</p>
                        <p className="text-xs text-dash-text-muted">{o.completeLabel}</p>
                    </div>
                </div>

                <div className="space-y-3">
                    {steps.map((step) => {
                        const state = getStepState(step)
                        if (state === 'completed') {
                            return (
                                <div key={step.id} className="flex h-16 items-center gap-3 rounded-xl border border-[hsl(var(--success)/0.2)] bg-[hsl(var(--success)/0.1)] px-3 py-3.5">
                                    <CheckCircle2 className="h-5 w-5 shrink-0 text-[hsl(var(--success))]" />
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-medium text-[hsl(var(--success))]">{step.label}</p>
                                        <p className="text-xs text-dash-text-muted">{step.description}</p>
                                    </div>
                                </div>
                            )
                        }
                        return (
                            <div key={step.id} className="flex items-center justify-between rounded-xl border border-[hsl(var(--primary)/0.3)] bg-[hsl(var(--primary)/0.1)] p-[13px] shadow-[0_0_15px_hsl(var(--primary)/0.2)]">
                                <div className="flex min-w-0 items-center gap-3">
                                    <Clock className="h-5 w-5 shrink-0 text-[hsl(var(--primary))]" />
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium text-[hsl(var(--primary))]">{step.label}</p>
                                        <p className="text-xs text-dash-text-muted">{step.description}</p>
                                    </div>
                                </div>
                                <Link
                                    href={step.href}
                                    className="ml-3 inline-flex h-7 shrink-0 items-center rounded-xl bg-gradient-to-r from-[hsl(var(--info))] to-[hsl(var(--primary))] px-3 text-xs font-medium !text-white transition-opacity hover:opacity-90"
                                >
                                    {o.continueBtn}
                                </Link>
                            </div>
                        )
                    })}
                </div>

                <div className="h-2 w-full overflow-hidden rounded-full bg-dash-secondary-bg">
                    <div
                        className="h-full rounded-full bg-gradient-to-r from-[hsl(var(--info))] to-[hsl(var(--primary))] transition-all duration-500"
                        style={{ width: `${progressPct}%` }}
                    />
                </div>
            </div>

            <SetupAlertBanner hasPaymentConfigured={hasPaymentConfigured} />
        </div>
    )
}
