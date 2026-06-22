'use client'

import { Lock } from 'lucide-react'

interface TabSuspendedOverlayProps {
    onReclaim: () => void
    onReload: () => void
}

export function TabSuspendedOverlay({ onReclaim, onReload }: TabSuspendedOverlayProps) {
    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[var(--editor-bg)]/95 backdrop-blur-sm">
            <div className="w-full max-w-sm text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10">
                    <Lock className="h-8 w-8" aria-hidden />
                </div>
                <h2 className="mt-4 text-xl font-bold text-white">Session moved to another tab</h2>
                <p className="mt-2 text-sm text-slate-400">
                    This editor is active in another browser tab. Only one tab can edit at a time.
                </p>
                <div className="mt-6 flex justify-center gap-3">
                    <button
                        type="button"
                        onClick={onReload}
                        className="rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:bg-white/10"
                    >
                        Reload
                    </button>
                    <button
                        type="button"
                        onClick={onReclaim}
                        className="rounded-xl bg-gradient-to-r from-blue-500 to-teal-400 px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                    >
                        Use this tab
                    </button>
                </div>
            </div>
        </div>
    )
}
