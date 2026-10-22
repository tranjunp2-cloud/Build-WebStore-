import { useEffect, useRef } from 'react'
import { Loader2 } from 'lucide-react'

interface DeleteConfirmInlineProps {
    message: string
    cancelLabel: string
    confirmLabel: string
    isPending: boolean
    onCancel: () => void
    onConfirm: () => void
}

/** Red confirm box rendered inside the page card. Focus starts on Cancel; Esc cancels. */
export function DeleteConfirmInline({ message, cancelLabel, confirmLabel, isPending, onCancel, onConfirm }: DeleteConfirmInlineProps) {
    const cancelRef = useRef<HTMLButtonElement>(null)
    useEffect(() => { cancelRef.current?.focus() }, [])

    return (
        <div
            role="alertdialog"
            aria-label={message}
            onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); onCancel() } }}
            className="mt-3 flex flex-col gap-2 rounded-lg border border-[hsl(var(--destructive)/0.25)] bg-[hsl(var(--destructive)/0.08)] p-2.5"
        >
            <p className="text-xs leading-[17px] text-[hsl(var(--destructive))]">{message}</p>
            <div className="grid grid-cols-2 gap-2">
                <button
                    ref={cancelRef}
                    type="button"
                    onClick={onCancel}
                    className="flex h-[30px] items-center justify-center rounded-lg bg-[var(--editor-overlay-bg)] text-[13px] font-medium text-[var(--editor-text)] transition-colors hover:bg-[var(--editor-overlay-hover)]"
                >
                    {cancelLabel}
                </button>
                <button
                    type="button"
                    disabled={isPending}
                    onClick={onConfirm}
                    className="flex h-[30px] items-center justify-center gap-2 rounded-lg bg-[hsl(var(--destructive))] text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-70"
                >
                    {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                    {confirmLabel}
                </button>
            </div>
        </div>
    )
}
