'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown, LogOut, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/i18n'
import { toast } from 'sonner'

type UserAvatarMenuProps = {
    userName: string
    userInitial: string
    userEmail: string
}

export function UserAvatarMenu({ userName, userInitial, userEmail }: UserAvatarMenuProps) {
    const [open, setOpen] = useState(false)
    const menuRef = useRef<HTMLDivElement>(null)
    const { t } = useI18n()

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const handleLogout = async () => {
        try {
            const res = await fetch('/api/auth/logout', {
                method: 'POST',
                credentials: 'include',
            })
            if (res.ok) {
                document.cookie = 'payload-token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax'
                window.location.href = '/login'
            } else {
                toast.error('Logout failed.')
            }
        } catch {
            toast.error('Network error. You may need to refresh.')
        }
    }

    return (
        <div className="relative" ref={menuRef}>
            {/* Avatar Trigger Button */}
            <button
                onClick={() => setOpen(!open)}
                className="flex h-12 items-center gap-2 rounded-[16px] bg-transparent pl-2 pr-3 border-none outline-none hover:bg-white/5 cursor-pointer transition-colors"
                aria-haspopup="true"
                aria-expanded={open}
            >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-sm font-semibold text-white shadow-[0_0_0_2px_rgba(59,130,246,0.3)]">
                    {userInitial}
                </div>
                <ChevronDown className="h-4 w-4 text-gray-400" />
            </button>

            {/* PopperContent Dropdown */}
            {open && (
                <div className="absolute right-0 top-full mt-2 w-[224px] rounded-[16px] bg-[#1E293B]/95 p-2 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)] border border-white/10 backdrop-blur-md z-50 animate-in fade-in zoom-in-95 duration-200">
                    {/* User Info */}
                    <div className="flex flex-col px-3 py-2">
                        <span className="text-[14px] font-semibold leading-[1.43] text-[#F8FAFC]">
                            {userName}
                        </span>
                        <span className="text-[12px] leading-[1.33] text-[rgba(248,250,252,0.6)] truncate">
                            {userEmail || `${userName.toLowerCase().replace(' ', '')}@primeweb.my`}
                        </span>
                    </div>

                    <div className="my-1 h-px bg-white/10" />

                    {/* Profile */}
                    <button className="flex w-full items-center gap-3 rounded-[12px] px-3 py-2 bg-transparent border-none outline-none hover:bg-white/5 cursor-pointer transition-colors text-left text-[14px] font-normal leading-[1.43] text-[#F8FAFC]">
                        <User className="h-4 w-4" />
                        {t.cms.profile}
                    </button>

                    <div className="my-1 h-px bg-white/10" />

                    {/* Logout */}
                    <button
                        onClick={handleLogout}
                        className="flex w-full items-center gap-3 rounded-[12px] px-3 py-2 bg-transparent border-none outline-none hover:bg-white/5 cursor-pointer transition-colors text-left text-[14px] font-normal leading-[1.43] text-[#FF6467]"
                    >
                        <LogOut className="h-4 w-4" />
                        {t.cms.logout}
                    </button>
                </div>
            )}
        </div>
    )
}
