'use client'

import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, Rocket } from 'lucide-react'
import { useI18n } from '@/i18n'

export function WelcomeScreenClient() {
    const { t } = useI18n()

    return (
        <main className="flex w-full flex-1 items-center justify-center px-4 py-12 text-center">
            <div className="flex w-full max-w-[448px] flex-col items-center">
                {/* Logo with a soft cyan glow behind it */}
                <div className="relative flex items-center justify-center gap-3.5">
                    <div
                        aria-hidden
                        className="pointer-events-none absolute -left-[30px] top-1/2 h-[120px] w-[120px] -translate-y-1/2 rounded-full bg-cyan-400/[.12] blur-[30px]"
                    />
                    <Image
                        src="/assets/builder/builder-logo.png"
                        alt="Web Store Logo"
                        width={44}
                        height={44}
                        priority
                        className="relative h-11 w-11 object-contain drop-shadow-[0_0_10px_rgba(34,211,238,0.4)]"
                    />
                    <span className="relative text-[28px] font-bold leading-9 text-white">
                        Web <span className="text-[#3ba7e6]">Store</span>
                    </span>
                </div>

                <h1 className="mt-10 text-[36px] font-bold leading-[44px] text-white">
                    {t.onboarding.welcome.title}
                </h1>
                <p className="mt-5 text-[17px] leading-7 text-[#7c8799] [text-wrap:pretty]">
                    {t.onboarding.welcome.subtitle}
                </p>

                {/* Sparkle divider */}
                <div aria-hidden className="mt-7 flex items-center gap-2.5">
                    <span className="h-0.5 w-20 rounded-sm bg-gradient-to-r from-transparent to-[#1e4f8a]" />
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="text-teal-400">
                        <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" />
                        <path d="M19 3v4" />
                        <path d="M21 5h-4" />
                    </svg>
                    <span className="h-0.5 w-20 rounded-sm bg-gradient-to-r from-[#1b6b5e] to-transparent" />
                </div>

                <Link
                    href="/builder/new"
                    prefetch={true}
                    className="mt-7 flex h-14 w-full items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-teal-400 text-[17px] font-semibold text-white no-underline shadow-[0_10px_30px_-8px_rgba(45,212,191,0.45)] transition-all duration-200 hover:no-underline hover:brightness-[1.08] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0e17]"
                >
                    <Rocket className="h-[18px] w-[18px] shrink-0" aria-hidden />
                    <span>{t.onboarding.welcome.createStore}</span>
                    <ArrowRight className="h-4 w-4 shrink-0" aria-hidden />
                </Link>

                <Link
                    href="/dashboard"
                    className="mt-6 text-sm leading-5 text-[#8b95a7] transition-colors hover:text-slate-300"
                >
                    {t.onboarding.welcome.skip}
                </Link>
            </div>
        </main>
    )
}
