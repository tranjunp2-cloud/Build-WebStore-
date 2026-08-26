'use client'

import type { ReactNode } from 'react'
import { EDITOR_SIDEBAR_WIDTH } from './layout-constants'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

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
    // Shared <Tabs variant="underline"> trigger bar (design-system, khớp dashboard nav).
    // Content render ngoài (parent điều khiển theo activeTab) nên chỉ dùng List + Trigger.
    const tabBar = (
        // bg-[var(--editor-bg)]/60 cũ = class chết (Tailwind v3 không compile alpha trên var đục) — bỏ, render không đổi
        <div>
            <Tabs value={activeTab} onValueChange={(v) => onTabChange(v as EditorSidebarTabId)}>
                <TabsList variant="underline" className={compact ? 'px-1 pt-1' : 'px-2 pt-1'}>
                    {tabs.map(tab => (
                        <TabsTrigger
                            key={tab.id}
                            value={tab.id}
                            variant="underline"
                            // GH-1511 #45.1: hover wash scoped here (NOT in the shared underline
                            // variant — dashboard tabs elsewhere must stay bg-less). Same token as
                            // the Global/SEO/Menu pills in SettingsPanel (hover:bg-white/5).
                            // pb-0 overrides the variant's pb-2.5 (via twMerge) so the label sits
                            // dead-center in the cell — the wash made the offset visible.
                            className={compact
                                ? 'min-h-[44px] flex-1 justify-center px-2 pb-0 text-[11px] hover:bg-white/5'
                                : 'h-11 flex-1 justify-center px-3 pb-0 text-[12px] hover:bg-white/5'}
                        >
                            <span className="shrink-0 text-sm leading-none">{tab.icon}</span>
                            <span className="whitespace-nowrap normal-case">{tab.label}</span>
                        </TabsTrigger>
                    ))}
                </TabsList>
            </Tabs>
        </div>
    )

    if (compact) {
        return (
            <aside className="flex h-full flex-1 flex-col bg-[var(--editor-surface)]">
                {tabBar}
                <div className="min-h-0 flex-1">{children}</div>
            </aside>
        )
    }

    return (
        <aside
            className="flex h-full shrink-0 flex-col border-r border-white/[0.06] bg-[var(--editor-surface)]"
            style={{ width: EDITOR_SIDEBAR_WIDTH }}
        >
            {tabBar}
            <div className="min-h-0 flex-1 bg-[var(--editor-surface)]">{children}</div>
        </aside>
    )
}
