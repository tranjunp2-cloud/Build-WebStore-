'use client'

import { useEffect, useState } from 'react'

function getGreeting(): string {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 18) return 'Good afternoon'
    return 'Good evening'
}

export function DashboardGreeting({ userName }: { userName: string }) {
    const [greeting, setGreeting] = useState('Good morning')

    useEffect(() => {
        setGreeting(getGreeting())
    }, [])

    return (
        <div>
            <h1 className="text-2xl font-bold text-white">
                {greeting}, {userName}! 👋
            </h1>
            <p className="mt-1 text-sm text-gray-400">
                {new Date().toLocaleDateString('vi-VN', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                })}
            </p>
        </div>
    )
}
