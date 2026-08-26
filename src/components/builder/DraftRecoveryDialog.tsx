'use client'

interface DraftMeta {
    siteName: string
    industry: string
    status: string
    savedAt: number
}

interface DraftRecoveryDialogProps {
    draft: DraftMeta
    onContinue: () => void
    onDiscard: () => void
}

function formatRelativeTime(timestamp: number): string {
    const diff = Date.now() - timestamp
    const minutes = Math.floor(diff / 60000)
    if (minutes < 1) return 'just now'
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    return `${Math.floor(hours / 24)}d ago`
}

export function DraftRecoveryDialog({ draft, onContinue, onDiscard }: DraftRecoveryDialogProps) {
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
            <div className="relative w-full max-w-sm rounded-2xl border border-white/10 bg-[#0F172A] p-6 shadow-2xl">
                <h3 className="text-lg font-semibold text-white">Continue your draft?</h3>
                <p className="mt-2 text-sm text-slate-400">
                    You have an unfinished website draft.
                </p>

                <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-2">
                    {draft.siteName && (
                        <div className="flex justify-between text-xs">
                            <span className="text-slate-500">Site</span>
                            <span className="font-medium text-white">{draft.siteName}</span>
                        </div>
                    )}
                    {draft.industry && (
                        <div className="flex justify-between text-xs">
                            <span className="text-slate-500">Industry</span>
                            <span className="text-slate-300">{draft.industry}</span>
                        </div>
                    )}
                    <div className="flex justify-between text-xs">
                        <span className="text-slate-500">Saved</span>
                        <span className="text-slate-300">{formatRelativeTime(draft.savedAt)}</span>
                    </div>
                </div>

                <div className="mt-5 flex gap-3">
                    <button
                        type="button"
                        onClick={onDiscard}
                        className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:bg-white/10"
                    >
                        Start fresh
                    </button>
                    <button
                        type="button"
                        onClick={onContinue}
                        autoFocus
                        className="flex-1 rounded-xl bg-gradient-to-r from-blue-500 to-teal-400 px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                    >
                        Continue draft
                    </button>
                </div>
            </div>
        </div>
    )
}
