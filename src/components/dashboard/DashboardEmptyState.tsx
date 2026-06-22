'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useI18n } from '@/i18n'

export function DashboardEmptyState() {
    const { t } = useI18n()

    return (
        <div className="flex w-full flex-col items-center justify-center px-6 py-16 md:py-24">
            <div className="flex w-full max-w-[448px] flex-col items-center justify-center gap-[18px]">
                {/* Illustration Area */}
                <div className="relative flex items-center justify-center">
                    {/* Background Glow */}
                    <div className="absolute inset-0 bg-[hsl(var(--primary)/0.2)] blur-[60px] rounded-xl" />

                    {/* Rocket Image */}
                    <div className="relative h-[200px] w-[200px] sm:h-[237px] sm:w-[256px]">
                        <Image
                            src="/images/dashboard/rocket-empty-state.png"
                            alt="Rocket launch illustration"
                            fill
                            className="object-contain"
                            priority
                        />
                    </div>
                </div>

                {/* Typography Content */}
                <h2 className="m-0 p-0 text-center text-[30px] font-[800] tracking-[-0.025em] leading-[1.2] text-[hsl(var(--foreground))]">
                    {t.dashboard.empty.title}
                </h2>
                <div className="m-0 p-0 text-center text-[16px] font-[500] leading-[1.625] text-[hsl(var(--muted-foreground))]">
                    {t.dashboard.empty.description}
                </div>

                {/* Main Call to Action */}
                <Link
                    href="/builder/new"
                    className="flex w-full max-w-[447px] no-underline items-center justify-center rounded-[12px] bg-gradient-to-r from-[hsl(var(--info))] to-[hsl(var(--primary))] py-[11px] text-[16px] font-semibold !text-white shadow-[0px_4px_6px_-4px_hsl(var(--info)/0.3),_0px_10px_15px_-3px_hsl(var(--info)/0.3)] transition-all hover:scale-[1.02]"
                >
                    {t.dashboard.empty.cta}
                </Link>
            </div>
        </div>
    )
}
