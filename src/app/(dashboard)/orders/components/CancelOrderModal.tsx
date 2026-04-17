import { useState } from 'react'
import { AlertCircle, X, Loader2 } from 'lucide-react'
import { useI18n } from '@/i18n'

export function CancelOrderModal({
    isOpen,
    onClose,
    onConfirm,
    isSubmitting
}: {
    isOpen: boolean
    onClose: () => void
    onConfirm: (reason: string) => void
    isSubmitting: boolean
}) {
    const { t } = useI18n()
    const c = t.dashboard.orders.cancel
    const [reason, setReason] = useState('')
    const [error, setError] = useState('')

    if (!isOpen) return null

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (!reason.trim()) {
            setError(c.reasonRequired)
            return
        }
        setError('')
        onConfirm(reason)
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={!isSubmitting ? onClose : undefined} />

            {/* Modal */}
            <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#0F172A] p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200 m-4">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2 text-red-500">
                        <AlertCircle className="h-5 w-5" />
                        <h2 className="text-lg font-bold">
                            {c.title}
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="rounded-full p-1.5 text-gray-400 hover:bg-white/10 hover:text-white transition-colors disabled:opacity-50"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <p className="text-sm text-gray-400 mb-6">
                    {c.warning}
                </p>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1.5">
                            {c.reasonLabel} <span className="text-red-500">*</span>
                        </label>
                        <textarea
                            value={reason}
                            onChange={(e) => {
                                setReason(e.target.value)
                                if (error) setError('')
                            }}
                            placeholder={c.reasonPlaceholder}
                            className="w-full min-h-[100px] rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white placeholder:text-gray-500 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 transition-colors"
                            disabled={isSubmitting}
                            autoFocus
                        />
                        {error && <p className="mt-1.5 text-xs text-red-500">{error}</p>}
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isSubmitting}
                            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-300 hover:bg-white/5 transition-colors disabled:opacity-50"
                        >
                            {c.keepOrder}
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="inline-flex items-center gap-2 rounded-lg bg-red-500/10 px-4 py-2 text-sm font-medium text-red-500 hover:bg-red-500/20 transition-colors border border-red-500/20 disabled:opacity-50"
                        >
                            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                            {c.confirmCancellation}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
