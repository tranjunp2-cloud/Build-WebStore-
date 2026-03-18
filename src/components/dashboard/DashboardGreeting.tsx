'use client'

import { useEffect, useState } from 'react'
import { useI18n } from '@/i18n'

export function DashboardGreeting({ userName }: { userName: string }) {
    const { t, locale } = useI18n()
    const [timeKey, setTimeKey] = useState<'morning' | 'afternoon' | 'evening'>('morning')

    useEffect(() => {
        const hour = new Date().getHours()
        if (hour < 12) setTimeKey('morning')
        else if (hour < 18) setTimeKey('afternoon')
        else setTimeKey('evening')
    }, [])

    return (
        <div>
            <h1 className="text-2xl font-bold text-white">
                {t.dashboard.overview.greeting} {t.dashboard.overview[timeKey]}, {userName}! 👋
            </h1>
            <p className="mt-1 text-sm text-gray-400">
                {new Date().toLocaleDateString(locale === 'ms' ? 'ms-MY' : 'en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                })}
            </p>
        </div>
    )
}
