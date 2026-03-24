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
}

export function EditorSidebar({
    tabs,
    activeTab,
    onTabChange,
    children,
}: EditorSidebarProps) {
    return (
        <aside className="flex h-full w-[380px] shrink-0 flex-col border-r border-white/10 bg-[#0B1120]">
            <div className="border-b border-white/10 px-1.5 pt-3">
                <div className="flex items-center gap-1">
                    {tabs.map(tab => {
                        const isActive = tab.id === activeTab

                        return (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => onTabChange(tab.id)}
                                className={cn(
                                    'flex min-w-0 items-center gap-2 rounded-t-xl border border-transparent px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] transition-colors',
                                    isActive
                                        ? 'border-white/10 border-b-[#0B1120] bg-[#111827] text-white'
                                        : 'text-gray-500 hover:bg-white/5 hover:text-gray-200',
                                )}
                            >
                                <span className="shrink-0">{tab.icon}</span>
                                <span className="truncate">{tab.label}</span>
                            </button>
                        )
                    })}
                </div>
            </div>

            <div className="min-h-0 flex-1">{children}</div>
        </aside>
    )
}
