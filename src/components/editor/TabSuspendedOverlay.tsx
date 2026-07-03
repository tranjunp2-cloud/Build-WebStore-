'use client'

import { Lock } from 'lucide-react'

interface TabSuspendedOverlayProps {
    onReclaim: () => void
    onReload: () => void
}

export function TabSuspendedOverlay({ onReclaim, onReload }: TabSuspendedOverlayProps) {
    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="flex w-[90%] max-w-md flex-col items-center rounded-[20px] border border-solid border-[var(--editor-border)] bg-[var(--editor-surface)] p-6 text-center shadow-2xl">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[hsl(var(--warning)/0.1)]">
                    <Lock className="h-6 w-6 text-[hsl(var(--warning))]" aria-hidden />
                </div>
                <h2 className="mb-2 text-xl font-bold text-[var(--editor-text)]">Session moved to another tab</h2>
                <p className="mb-6 text-sm leading-[1.5] text-[var(--editor-text-muted)]">
                    This editor is active in another browser tab. Only one tab can edit at a time.
                </p>
                <div className="flex w-full gap-3">
                    <button
                        type="button"
                        onClick={onReload}
                        className="flex h-11 flex-1 items-center justify-center rounded-[12px] border border-solid border-[var(--editor-text-muted)] text-sm font-medium text-[var(--editor-text)] transition-colors hover:bg-[var(--editor-overlay-hover)]"
                    >
                        Reload
                    </button>
                    <button
                        type="button"
                        onClick={onReclaim}
                        className="flex h-11 flex-1 items-center justify-center rounded-[12px] bg-gradient-to-r from-blue-500 to-teal-400 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                    >
                        Use this tab
                    </button>
                </div>
            </div>
        </div>
    )
}
