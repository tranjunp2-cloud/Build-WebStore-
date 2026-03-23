'use client'

import { Bell } from 'lucide-react'

export function NotificationBell() {
    return (
        <button className="relative flex h-10 w-10 items-center justify-center rounded-[16px] bg-transparent border-none outline-none hover:bg-white/5 cursor-pointer transition-colors">
            <Bell className="h-5 w-5 text-[#F8FAFC]" />
        </button>
    )
}
