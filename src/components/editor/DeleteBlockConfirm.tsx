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
                        <div className="w-full max-w-[360px] rounded-[18px] border border-[rgba(59,130,246,0.16)] dark:bg-[linear-gradient(180deg,rgba(20,30,48,0.98)_0%,rgba(11,17,32,0.98)_100%)] bg-white px-6 pb-6 pt-6 shadow-[0_24px_48px_rgba(2,6,23,0.45)]">

                            {/* Icon */}
                            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-[rgba(251,44,54,0.28)] bg-[rgba(127,29,29,0.22)] text-[#FCA5A5]">
                                <AlertTriangle className="h-7 w-7" />
                            </div>

                            {/* Text */}
                            <div className="mt-4 text-center">
                                <Dialog.Title className="text-xl font-semibold dark:text-white text-slate-900">
                                    {isGlobal ? 'Remove from all pages?' : 'Delete block?'}
                                </Dialog.Title>
                                <Dialog.Description className="mt-2 text-sm leading-6 dark:text-[#CBD5E1] text-slate-500">
                                    {isGlobal ? (
                                        <>
                                            The{' '}
                                            <span className="font-medium capitalize text-[#2DD4BF]">{label}</span>{' '}
                                            widget will be removed from every page on this site.
                                        </>
                                    ) : (
                                        <>
                                            Block{' '}
                                            <span className="font-medium capitalize text-[#2DD4BF]">
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
                                        className="flex h-11 items-center justify-center rounded-[10px] border border-[rgba(59,130,246,0.04)] dark:bg-[rgba(255,255,255,0.05)] bg-slate-100 text-sm font-medium dark:text-white text-slate-700 transition-colors dark:hover:bg-[rgba(255,255,255,0.08)] hover:bg-slate-200"
                                    >
                                        Cancel
                                    </button>
                                </Dialog.Close>
                                <button
                                    type="button"
                                    onClick={onConfirm}
                                    className="flex h-11 items-center justify-center gap-2 rounded-[10px] border border-[rgba(251,44,54,0.4)] bg-[#FF1F3D] text-sm font-medium text-white transition-colors hover:bg-[#ff3550]"
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
