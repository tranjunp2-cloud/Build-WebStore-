'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { EDITOR_SIDEBAR_WIDTH } from './layout-constants'

export type EditorSidebarTabId = 'chat' | 'components' | 'pages'

export type EditorSidebarTab = {
    id: EditorSidebarTabId
    label: string
    icon: ReactNode
}

interface EditorSidebarProps {
    tabs: EditorSidebarTab[]
    activeTab: EditorSidebarTabId
    onTabChange: (tabId: EditorSidebarTabId) => void
    children: ReactNode
    compact?: boolean
}

export function EditorSidebar({
    tabs,
    activeTab,
    onTabChange,
    children,
    compact = false,
}: EditorSidebarProps) {
    if (compact) {
        return (
            <aside className="flex h-full flex-1 flex-col bg-[#0F172A]">
                <div className="border-b border-white/[0.06] bg-[#0B1120]/60">
                    <div className="flex items-stretch px-1 pt-1">
                        {tabs.map(tab => {
                            const isActive = tab.id === activeTab

                            return (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => onTabChange(tab.id)}
                                    className={cn(
                                        'relative flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-t-lg px-2 text-[11px] font-medium tracking-wide transition-all',
                                        isActive
                                            ? 'bg-[#0F172A] text-white'
                                            : 'text-slate-500 hover:text-slate-300',
                                    )}
                                >
                                    <span className="shrink-0 text-sm">{tab.icon}</span>
                                    <span className="truncate uppercase">
                                        {tab.label}
                                    </span>
                                    {isActive ? (
                                        <span className="absolute inset-x-3 bottom-0 h-[2px] rounded-full bg-gradient-to-r from-[#3B82F6] to-[#2DD4BF]" />
                                    ) : null}
                                </button>
                            )
                        })}
                    </div>
                </div>

                <div className="min-h-0 flex-1">{children}</div>
            </aside>
        )
    }

    return (
        <aside
            className="flex h-full shrink-0 flex-col border-r border-white/[0.06] bg-[#0F172A]"
            style={{ width: EDITOR_SIDEBAR_WIDTH }}
        >
            <div className="border-b border-white/[0.06] bg-[#0B1120]/60">
                <div className="flex items-stretch px-2 pt-1">
                    {tabs.map(tab => {
                        const isActive = tab.id === activeTab

                        return (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => onTabChange(tab.id)}
                                className={cn(
                                    'relative flex h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-t-lg px-3 text-[12px] font-medium tracking-wide transition-all',
                                    isActive
                                        ? 'bg-[#0F172A] text-white'
                                        : 'text-slate-500 hover:text-slate-300',
                                )}
                            >
                                <span className="shrink-0 text-sm leading-none">{tab.icon}</span>
                                <span className="truncate uppercase">
                                    {tab.label}
                                </span>
                                {isActive ? (
                                    <span className="absolute inset-x-4 bottom-0 h-[2px] rounded-full bg-gradient-to-r from-[#3B82F6] to-[#2DD4BF]" />
                                ) : null}
                            </button>
                        )
                    })}
                </div>
            </div>

            <div className="min-h-0 flex-1 bg-[#0F172A]">{children}</div>
        </aside>
    )
}
