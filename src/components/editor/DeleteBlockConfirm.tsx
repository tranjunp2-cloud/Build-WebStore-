'use client'

import * as Dialog from '@radix-ui/react-dialog'
import { AlertTriangle, Trash2 } from 'lucide-react'

interface DeleteBlockConfirmProps {
    blockName: string
    open: boolean
    onConfirm: () => void
    onCancel: () => void
    scope?: 'page' | 'global'
}

export function DeleteBlockConfirm({ blockName, open, onConfirm, onCancel, scope = 'page' }: DeleteBlockConfirmProps) {
    const label = blockName.replace(/-/g, ' ')
    const isGlobal = scope === 'global'

    return (
        <Dialog.Root open={open} onOpenChange={(v) => { if (!v) onCancel() }}>
            {open && (
                <Dialog.Portal>
                    <Dialog.Overlay className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm animate-in fade-in-0 duration-150" />

                    <Dialog.Content
                        className="fixed inset-0 z-[201] flex items-center justify-center p-4 animate-in fade-in-0 zoom-in-95 duration-150 focus:outline-none"
                        onPointerDownOutside={onCancel}
                        onEscapeKeyDown={onCancel}
                    >
                        <div className="w-full max-w-[360px] rounded-[18px] border border-[var(--editor-border)] bg-[var(--editor-surface)] px-6 pb-6 pt-6 shadow-[0_24px_48px_rgba(2,6,23,0.45)]">

                            {/* Icon */}
                            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-[hsl(var(--destructive)/0.28)] bg-[hsl(var(--destructive)/0.12)] text-[hsl(var(--destructive))]">
                                <AlertTriangle className="h-7 w-7" />
                            </div>

                            {/* Text */}
                            <div className="mt-4 text-center">
                                <Dialog.Title className="text-xl font-semibold dark:text-white text-slate-900">
                                    {isGlobal ? 'Remove from all pages?' : 'Delete block?'}
                                </Dialog.Title>
                                <Dialog.Description className="mt-2 text-sm leading-6 text-[var(--editor-text-muted)]">
                                    {isGlobal ? (
                                        <>
                                            The{' '}
                                            <span className="font-medium capitalize text-[hsl(var(--primary))]">{label}</span>{' '}
                                            widget will be removed from every page on this site.
                                        </>
                                    ) : (
                                        <>
                                            Block{' '}
                                            <span className="font-medium capitalize text-[hsl(var(--primary))]">
                                                &quot;{label}&quot;
                                            </span>{' '}
                                            will be permanently removed.
                                        </>
                                    )}
                                </Dialog.Description>
                            </div>

                            {/* Actions */}
                            <div className="mt-6 grid grid-cols-2 gap-3">
                                <Dialog.Close asChild>
                                    <button
                                        type="button"
                                        className="flex h-11 items-center justify-center rounded-[10px] border border-[var(--editor-border)] bg-white/5 text-sm font-medium text-[var(--editor-text)] transition-colors hover:bg-white/8"
                                    >
                                        Cancel
                                    </button>
                                </Dialog.Close>
                                <button
                                    type="button"
                                    onClick={onConfirm}
                                    className="flex h-11 items-center justify-center gap-2 rounded-[10px] border border-[hsl(var(--destructive)/0.4)] bg-[hsl(var(--destructive))] text-sm font-medium text-white transition-colors hover:opacity-90"
                                >
                                    <Trash2 className="h-4 w-4" />
                                    Delete
                                </button>
                            </div>
                        </div>
                    </Dialog.Content>
                </Dialog.Portal>
            )}
        </Dialog.Root>
    )
}
