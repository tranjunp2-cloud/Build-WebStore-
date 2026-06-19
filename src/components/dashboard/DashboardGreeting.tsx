'use client'

import { useI18n } from '@/i18n'

export function DashboardGreeting() {
    const { t } = useI18n()
    return (
        <div className="flex flex-col w-full m-0 p-0">
            <h1 className="m-0 p-0 text-[30px] font-bold leading-[36px] text-[hsl(var(--foreground))]">
                {t.dashboard.overview.welcomeTitle}
            </h1>
            <div className="m-0 p-0 mt-[8px] text-[14px] leading-[1.42em] text-[hsl(var(--foreground)/0.6)] max-w-[330px] sm:max-w-none">
                {t.dashboard.overview.welcomeSubtitle}
            </div>
        </div>
    )
}
