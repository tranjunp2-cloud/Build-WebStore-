'use client'

import type { ComponentProps } from 'react'
import { FileText, MessageCircle, Settings2, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/i18n'
import { AIChatPanel } from './AIChatPanel'
import { BlockLibraryPanel } from './BlockLibraryPanel'
import { PageManagerPanel } from './PageManagerPanel'
import { SettingsPanel } from './SettingsPanel'

export type ToolsSheetTab = 'chat' | 'components' | 'pages' | 'settings'

/** One prop bundle per hosted panel — built in page.tsx from the SAME handlers the
 * desktop sidebar/right-panel mounts already use (no forked business logic). */
export interface ToolsSheetPanelProps {
    chat: ComponentProps<typeof AIChatPanel>
    components: ComponentProps<typeof BlockLibraryPanel>
    pages: ComponentProps<typeof PageManagerPanel>
    settings: ComponentProps<typeof SettingsPanel>
}

export interface EditorToolsSheetProps {
    open: boolean
    activeTab: ToolsSheetTab
    onTabChange: (tab: ToolsSheetTab) => void
    onClose: () => void
    panelProps: ToolsSheetPanelProps
}

/**
 * F05 main bottom sheet — bottom bar "Open AI Chat & Tools" opens this 4-tab sheet
 * (AI Chat · Components · Pages · Settings). Settings hosts `SettingsPanel`'s OWN
 * Global/Menu/SEO sub-tabs unchanged. This file is a HOST ONLY: drag handle + tab bar
 * + panel switch — it renders the existing desktop panels as-is, never restyles or
 * reimplements their internals (DRY, matches the Phase 02 block-settings sheet
 * precedent in `CompactEditorLayout.tsx`).
 *
 * No inline "X" in the tab row — F05's main tools sheet (`.bs-tabs`, unlike its
 * separate block/site-settings sheets) closes via backdrop tap only; matching 1:1.
 */
export function EditorToolsSheet({ open, activeTab, onTabChange, onClose, panelProps }: EditorToolsSheetProps) {
    const { t } = useI18n()

    if (!open) return null

    const visibleTabs = [
        { id: 'chat' as const, label: t.editor.sidebar.aiChat, icon: <MessageCircle className="h-4 w-4" aria-hidden /> },
        { id: 'components' as const, label: t.editor.sidebar.components, icon: <Zap className="h-4 w-4" aria-hidden /> },
        { id: 'pages' as const, label: t.editor.sidebar.pages, icon: <FileText className="h-4 w-4" aria-hidden /> },
        { id: 'settings' as const, label: t.editor.sidebar.settings, icon: <Settings2 className="h-4 w-4" aria-hidden /> },
    ]

    return (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
            <div
                className="absolute inset-0 bg-black/60"
                onClick={onClose}
                onKeyDown={(e) => e.key === 'Escape' && onClose()}
                role="button"
                tabIndex={0}
                aria-label="Close tools"
            />
            <div className="relative flex max-h-[88vh] landscape:max-h-[94vh] flex-col overflow-hidden rounded-t-2xl border-t border-[var(--editor-border)] bg-[var(--editor-surface)] pb-[env(safe-area-inset-bottom)]">
                <div className="flex shrink-0 justify-center pt-2">
                    <span className="h-1 w-9 rounded-full bg-[var(--editor-text-muted)]/35" aria-hidden />
                </div>

                <div className="flex shrink-0 items-center gap-1 border-b border-[var(--editor-border)] px-2 pb-1 pt-1.5" role="tablist" aria-label="Editor tools">
                    {visibleTabs.map(tab => (
                        <button
                            key={tab.id}
                            type="button"
                            role="tab"
                            aria-selected={activeTab === tab.id}
                            onClick={() => onTabChange(tab.id)}
                            className={cn(
                                'relative flex min-h-[44px] flex-1 items-center justify-center gap-1.5 px-2 text-[11px] font-medium transition-colors',
                                activeTab === tab.id
                                    ? "text-[hsl(var(--primary))] after:absolute after:inset-x-3 after:-bottom-px after:h-0.5 after:rounded-full after:bg-[hsl(var(--primary))] after:content-['']"
                                    : 'rounded-lg text-[var(--editor-text-muted)] hover:bg-[var(--editor-overlay-hover)]',
                            )}
                        >
                            {tab.icon}
                            <span className="whitespace-nowrap">{tab.label}</span>
                        </button>
                    ))}
                </div>

                <div className="min-h-0 flex-1">
                    {activeTab === 'chat' ? <AIChatPanel {...panelProps.chat} /> : null}
                    {activeTab === 'components' ? <BlockLibraryPanel {...panelProps.components} /> : null}
                    {activeTab === 'pages' ? <PageManagerPanel {...panelProps.pages} /> : null}
                    {activeTab === 'settings' ? <SettingsPanel {...panelProps.settings} fullWidth /> : null}
                </div>
            </div>
        </div>
    )
}
