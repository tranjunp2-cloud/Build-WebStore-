'use client'

import Link from 'next/link'
import { Wand2, LayoutTemplate, CheckCircle2, Circle, Globe, Rocket, AlertTriangle } from 'lucide-react'

interface OnboardingStep {
    id: string
    label: string
    icon: React.ReactNode
    done: boolean
    href: string
}

interface DashboardOnboardingProps {
    hasWebsite: boolean
    hasPublishedSite: boolean
    hasIncompleteSite?: boolean
    aiStatusFailed?: boolean
    siteId?: string | number | null
}

export function DashboardOnboarding({
    hasWebsite,
    hasPublishedSite,
    hasIncompleteSite = false,
    aiStatusFailed = false,
    siteId,
}: DashboardOnboardingProps) {
    const steps: OnboardingStep[] = [
        {
            id: 'website',
            label: 'Create your website',
            icon: <Globe className="h-4 w-4" />,
            done: hasWebsite && !hasIncompleteSite,
            href: '/builder/new',
        },
        {
            id: 'publish',
            label: 'Publish your site',
            icon: <Rocket className="h-4 w-4" />,
            done: hasPublishedSite,
            href: hasWebsite ? (siteId ? `/editor/${siteId}` : '#') : '/builder/new',
        },
    ]

    const completedCount = steps.filter(s => s.done).length
    const progressPct = Math.round((completedCount / steps.length) * 100)
    const allDone = completedCount === steps.length

    if (allDone) return null

    return (
        <div className="space-y-6">
            {/* AI Incomplete Banner */}
            {(hasIncompleteSite || aiStatusFailed) && (
                <div className="flex items-start gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/20">
                        <AlertTriangle className="h-4 w-4 text-amber-400" />
                    </div>
                    <div className="flex-1">
                        <h4 className="text-sm font-semibold text-amber-300">AI generation incomplete</h4>
                        <p className="mt-0.5 text-xs text-amber-400/80">Your website wasn&apos;t fully created. You can retry or choose a template.</p>
                        <div className="mt-3 flex gap-2">
                            <Link
                                href="/builder/new"
                                className="inline-flex h-8 items-center rounded-lg border border-amber-500/30 px-3 text-xs font-medium text-amber-300 transition-colors hover:bg-amber-500/10"
                            >
                                Retry AI
                            </Link>
                            <Link
                                href="/templates"
                                className="inline-flex h-8 items-center rounded-lg bg-gradient-to-r from-blue-500 to-teal-400 px-3 text-xs font-semibold text-white transition-opacity hover:opacity-90"
                            >
                                Choose Template
                            </Link>
                        </div>
                    </div>
                </div>
            )}

            {/* Quick Actions — Build or Template */}
            {(!hasWebsite || hasIncompleteSite) && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Link
                        href="/builder/new"
                        className="group relative overflow-hidden rounded-2xl border border-blue-500/30 bg-gradient-to-br from-blue-600/20 to-purple-600/10 p-6 transition-all hover:border-blue-400/50 hover:shadow-lg hover:shadow-blue-500/10"
                    >
                        <div className="flex items-center gap-4">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg shadow-blue-500/25">
                                <Wand2 className="h-6 w-6 text-white" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-white">Build with AI</h3>
                                <p className="mt-0.5 text-sm text-gray-400">Describe your business, AI creates your site</p>
                            </div>
                        </div>
                    </Link>

                    <Link
                        href="/templates"
                        className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition-all hover:border-white/20 hover:bg-white/[0.06]"
                    >
                        <div className="flex items-center gap-4">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/10">
                                <LayoutTemplate className="h-6 w-6 text-gray-300" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-white">Choose Template</h3>
                                <p className="mt-0.5 text-sm text-gray-400">Ready-made designs, easy to customize</p>
                            </div>
                        </div>
                    </Link>
                </div>
            )}

            {/* Setup Checklist */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-white">Setup Guide</h3>
                    <span className="text-xs text-gray-400">{completedCount}/{steps.length} completed</span>
                </div>

                {/* Progress bar */}
                <div className="mb-5 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                        className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all duration-500"
                        style={{ width: `${progressPct}%` }}
                    />
                </div>

                {/* Steps */}
                <div className="space-y-1">
                    {steps.map((step) => (
                        <Link
                            key={step.id}
                            href={step.done ? '#' : step.href}
                            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all ${
                                step.done
                                    ? 'opacity-50 cursor-default'
                                    : 'hover:bg-white/5 cursor-pointer'
                            }`}
                        >
                            {step.done ? (
                                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
                            ) : (
                                <Circle className="h-5 w-5 shrink-0 text-gray-500" />
                            )}
                            <span className="flex items-center gap-2 text-sm">
                                <span className="text-gray-400">{step.icon}</span>
                                <span className={step.done ? 'text-gray-500 line-through' : 'text-gray-200'}>
                                    {step.label}
                                </span>
                            </span>
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    )
}
