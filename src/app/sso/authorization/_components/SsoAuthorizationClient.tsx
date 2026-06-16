'use client'

import { useEffect } from 'react'
import Image from 'next/image'
import { Loader2 } from 'lucide-react'
import { useI18n } from '@/i18n'

export function SsoAuthorizationClient({ v2Token }: { v2Token?: string }) {
    const { t } = useI18n()

    useEffect(() => {
        if (!v2Token) {
            window.location.href = '/login?error=invalid_token'
            return
        }
        fetch('/api/auth/sso-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ v2_token: v2Token }),
        })
            .then((res) => res.json())
            .then((data) => {
                if (data?.ok) {
                    // Whitelist-guard: only allow known relative paths to prevent open redirect
                    const ALLOWED = new Set(['/dashboard', '/onboarding'])
                    const dest = ALLOWED.has(data.redirectTo) ? data.redirectTo : '/dashboard'
                    window.location.href = dest
                } else {
                    window.location.href = '/login?error=invalid_token'
                }
            })
            .catch(() => {
                window.location.href = '/login?error=invalid_token'
            })
    }, [v2Token])

    return (
        <main className="flex flex-1 w-full max-w-2xl flex-col justify-center items-center px-6 text-center">
            <div className="flex flex-col items-center w-full max-w-[345px] sm:max-w-md gap-[48px]">
                {/* Logo */}
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

                <div className="flex flex-col items-center w-full gap-[32px]">
                    {/* Header */}
                    <div className="flex flex-col items-center gap-4">
                        <h1 className="text-[36px] font-bold text-[#F8FAFC] leading-[1.11]">
                            {t.onboarding.welcome.title}
                        </h1>
                        <p className="text-[18px] text-[#64748B] leading-[1.55] max-w-xl">
                            {t.onboarding.welcome.subtitle}
                        </p>
                    </div>

                    {/* Sparkle divider */}
                    <div className="flex items-center justify-center gap-2 w-full">
                        <div className="h-1 w-[80px] rounded-full bg-gradient-to-r from-transparent via-blue-500/30 to-blue-500/30"></div>
                        <div className="flex h-[24px] w-[24px] items-center justify-center bg-slate-800/40 rounded-full">
                            <Image src="/assets/builder/sparkle.svg" alt="Sparkle" width={24} height={24} />
                        </div>
                        <div className="h-1 w-[80px] rounded-full bg-gradient-to-l from-transparent via-teal-400/30 to-teal-400/30"></div>
                    </div>

                    {/* Loading spinner — replaces buttons section from WelcomeScreenClient */}
                    <div className="flex flex-col items-center w-full gap-6">
                        <Loader2 className="h-8 w-8 animate-spin text-blue-400" aria-label="Authorizing" />
                    </div>
                </div>
            </div>
        </main>
    )
}
