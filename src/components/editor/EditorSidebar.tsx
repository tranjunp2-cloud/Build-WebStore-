'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

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
                <div className="border-b border-white/10 bg-[rgba(11,17,32,0.5)] px-0">
                    <div className="flex items-stretch">
                        {tabs.map(tab => {
                            const isActive = tab.id === activeTab

                            return (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => onTabChange(tab.id)}
                                    className={cn(
                                        'relative flex min-h-[64px] flex-1 items-center justify-center gap-2 px-3 text-xs font-medium uppercase tracking-[0.12em] transition-colors',
                                        isActive
                                            ? 'bg-[rgba(30,41,59,0.45)] text-[#2DD4BF]'
                                            : 'text-slate-400 hover:bg-white/5 hover:text-white',
                                    )}
                                >
                                    <span className="shrink-0">{tab.icon}</span>
                                    <span className={cn('truncate', tab.id === 'chat' && 'max-w-[64px] leading-4 text-left')}>
                                        {tab.id === 'chat' ? 'AI CHAT' : tab.label.toUpperCase()}
                                    </span>
                                    {isActive ? (
                                        <span className="absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r from-[#3B82F6] to-[#2DD4BF]" />
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
        <aside className="flex h-full w-[380px] shrink-0 flex-col border-r border-[rgba(59,130,246,0.07)] bg-[#0F172A]">
            <div className="border-b border-[rgba(59,130,246,0.07)] bg-[rgba(11,17,32,0.5)]">
                <div className="flex items-stretch">
                    {tabs.map(tab => {
                        const isActive = tab.id === activeTab

                        return (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => onTabChange(tab.id)}
                                className={cn(
                                    'relative flex h-16 min-w-0 items-center justify-center gap-2 px-4 text-sm font-medium uppercase tracking-[0.02em] transition-colors',
                                    isActive
                                        ? 'bg-[rgba(30,41,59,0.3)] text-[#2DD4BF]'
                                        : 'text-slate-400 hover:bg-white/5 hover:text-white',
                                )}
                            >
                                <span className="shrink-0 text-base leading-none">{tab.icon}</span>
                                <span className={cn('truncate', tab.id === 'chat' && 'max-w-[72px] leading-5 text-left')}>
                                    {tab.id === 'chat' ? 'AI CHAT' : tab.label.toUpperCase()}
                                </span>
                                {isActive ? (
                                    <span className="absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r from-[#3B82F6] to-[#2DD4BF]" />
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
