'use client'

import { useI18n } from '@/i18n'

interface EditorStatusBarProps {
    statusText: string
    currentPageTitle: string
    blockCount: number
}

export function EditorStatusBar({
    statusText,
    currentPageTitle,
    blockCount,
}: EditorStatusBarProps) {
    const { t } = useI18n()
    const sb = t.editor.statusBar

    return (
        <div className="flex h-8 shrink-0 items-center justify-between border-t border-white/10 bg-[#0B1120] px-4 text-[11px] text-gray-500">
            <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5 text-emerald-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    {sb.connected}
                </span>
                <span>{statusText}</span>
            </div>

            <div className="flex items-center gap-4">
                <span>{sb.pageLabel} {currentPageTitle}</span>
                <span>{sb.blocksCount.replace('{count}', String(blockCount))}</span>
            </div>
        </div>
    )
}
