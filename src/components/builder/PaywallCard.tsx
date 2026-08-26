'use client'

import Link from 'next/link'
import { Lock, Check, ArrowLeft } from 'lucide-react'

interface PaywallCardProps {
    onBack?: () => void
}

const PLANS = [
    {
        name: 'Starter',
        price: 'RM 29',
        period: '/mo',
        features: ['5 AI websites', 'Basic templates', 'Custom domain'],
        recommended: false,
    },
    {
        name: 'Pro',
        price: 'RM 49',
        period: '/mo',
        features: ['20 AI websites', 'Premium templates', 'Priority support', 'Advanced SEO'],
        recommended: true,
    },
]

export function PaywallCard({ onBack }: PaywallCardProps) {
    return (
        <div className="mx-auto w-full max-w-lg space-y-6 py-8">
            <div className="text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/20">
                    <Lock className="h-8 w-8 text-amber-400" aria-hidden />
                </div>
                <h2 className="mt-4 text-2xl font-bold text-white">Out of AI credits</h2>
                <p className="mt-2 text-sm text-slate-400">
                    Upgrade your plan to continue creating websites with AI.
                </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {PLANS.map((plan) => (
                    <div
                        key={plan.name}
                        className={`rounded-2xl border p-5 ${
                            plan.recommended
                                ? 'border-blue-500/30 bg-blue-500/5 shadow-lg shadow-blue-500/10'
                                : 'border-white/10 bg-white/[0.03]'
                        }`}
                    >
                        {plan.recommended && (
                            <span className="mb-3 inline-block rounded-full bg-blue-500/20 px-2.5 py-0.5 text-[10px] font-semibold uppercase text-blue-300">
                                Recommended
                            </span>
                        )}
                        <h3 className="text-lg font-bold text-white">{plan.name}</h3>
                        <div className="mt-1 flex items-baseline gap-1">
                            <span className="text-2xl font-bold text-white">{plan.price}</span>
                            <span className="text-sm text-slate-400">{plan.period}</span>
                        </div>
                        <ul className="mt-4 space-y-2">
                            {plan.features.map((f) => (
                                <li key={f} className="flex items-center gap-2 text-xs text-slate-300">
                                    <Check className="h-3.5 w-3.5 shrink-0 text-emerald-400" aria-hidden />
                                    {f}
                                </li>
                            ))}
                        </ul>
                        <Link
                            href={`/pricing?plan=${plan.name.toLowerCase()}&return=/builder/new`}
                            className={`mt-4 flex h-10 w-full items-center justify-center rounded-xl text-sm font-semibold transition-opacity hover:opacity-90 ${
                                plan.recommended
                                    ? 'bg-gradient-to-r from-blue-500 to-teal-400 text-white'
                                    : 'border border-white/10 bg-white/5 text-slate-300'
                            }`}
                        >
                            Upgrade now
                        </Link>
                    </div>
                ))}
            </div>

            <div className="text-center">
                <Link
                    href="/support"
                    className="text-xs text-slate-500 underline-offset-2 hover:text-slate-400 hover:underline"
                >
                    Need help? Contact support
                </Link>
            </div>

            {onBack && (
                <div className="text-center">
                    <button
                        type="button"
                        onClick={onBack}
                        className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-300"
                    >
                        <ArrowLeft className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        Go back
                    </button>
                </div>
            )}
        </div>
    )
}
