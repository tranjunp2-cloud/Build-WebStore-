'use client'

import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight } from 'lucide-react'
import { useI18n } from '@/i18n'

export function WelcomeScreenClient() {
    const { t } = useI18n()

    return (
        <main className="flex flex-1 w-full max-w-2xl flex-col justify-center items-center px-6 text-center">
            {/* Main Layout Container (gap-48px) */}
            <div className="flex flex-col items-center w-full max-w-[345px] sm:max-w-md gap-[48px]">
                
                {/* 1. Logo Container (gap-12px) */}
                <div className="flex items-center justify-center gap-3">
                    <Image 
                        src="/assets/builder/builder-logo.png" 
                        alt="PrimeWeb Logo" 
                        width={48}
                        height={48}
                        priority
                        className="w-[48px] h-[48px] object-contain drop-shadow-[0_0_24px_rgba(59,130,246,0.6)] !p-0 !m-0"
                    />
                    <span className="text-[30px] font-bold tracking-tight leading-[1.2]">
                        <span className="text-[#F8FAFC]">Prime</span>
                        <span className="bg-gradient-to-br from-blue-500 to-teal-400 bg-clip-text text-transparent">Web</span>
                    </span>
                </div>

                {/* 2. Content Container (gap-32px) */}
                <div className="flex flex-col items-center w-full gap-[32px]">
                    
                    {/* Header Text (gap-16px) */}
                    <div className="flex flex-col items-center gap-4">
                        <h1 className="text-[36px] font-bold text-[#F8FAFC] leading-[1.11]">
                            {t.onboarding.welcome.title}
                        </h1>
                        <p className="text-[18px] text-[#64748B] leading-[1.55] max-w-xl">
                            {t.onboarding.welcome.subtitle}
                        </p>
                    </div>

                    {/* Progress Sparkle Line (gap-8px) */}
                    <div className="flex items-center justify-center gap-2 w-full">
                        <div className="h-1 w-[80px] rounded-full bg-gradient-to-r from-transparent via-blue-500/30 to-blue-500/30"></div>
                        <div className="flex h-[24px] w-[24px] items-center justify-center bg-slate-800/40 rounded-full">
                            <Image src="/assets/builder/sparkle.svg" alt="Sparkle" width={24} height={24} />
                        </div>
                        <div className="h-1 w-[80px] rounded-full bg-gradient-to-l from-transparent via-teal-400/30 to-teal-400/30"></div>
                    </div>

                    {/* Buttons (gap-24px) */}
                    <div className="flex flex-col items-center w-full gap-6">
                        <Link 
                            href="/builder/new" 
                            prefetch={true}
                            className="group flex no-underline hover:no-underline h-[56px] w-full items-center justify-center gap-2 rounded-[16px] bg-gradient-to-r from-blue-500 to-teal-400 text-[18px] font-semibold text-white shadow-[0_0_24px_rgba(59,130,246,0.4)] transition-all hover:scale-[1.02] hover:shadow-[0_0_32px_rgba(45,212,191,0.5)] active:scale-[0.98]"
                        >
                            <span>{t.onboarding.welcome.createStore}</span>
                            <ArrowRight className="h-5 w-5 opacity-70 group-hover:translate-x-1 group-hover:opacity-100 transition-transform hidden sm:block" />
                        </Link>

                        <Link 
                            href="/dashboard"
                            className="text-[14px] font-medium leading-[1.42] text-[#64748B] transition-colors hover:text-slate-300"
                        >
                            {t.onboarding.welcome.skip}
                        </Link>
                    </div>

                </div>

            </div>
        </main>
    )
}
