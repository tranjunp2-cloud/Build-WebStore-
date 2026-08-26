'use client'

import * as Dialog from '@radix-ui/react-dialog'
import { AlertTriangle, Loader2, Globe } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { Inter } from 'next/font/google'
import { useI18n } from '@/i18n'

const inter = Inter({
    subsets: ['latin'],
    display: 'swap',
})

interface UnpublishModalProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onUnpublish: () => void;
    isPublishing: boolean;
}

export function UnpublishModal({
    isOpen,
    onOpenChange,
    onUnpublish,
    isPublishing,
}: UnpublishModalProps) {
    const { t } = useI18n()
    const et = t.editor.unpublishModal
    return (
        <Dialog.Root open={isOpen} onOpenChange={onOpenChange}>
            <AnimatePresence>
                {isOpen ? (
                    <Dialog.Portal forceMount>
                        <Dialog.Overlay asChild>
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="fixed inset-0 z-50 bg-[rgba(0,0,0,0.95)]"
                            />
                        </Dialog.Overlay>

                        <Dialog.Content asChild>
                            <motion.div
                                initial={{ opacity: 0, scale: 0.96, y: 14 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.96, y: 14 }}
                                transition={{ duration: 0.18, ease: 'easeOut' }}
                                className="fixed inset-0 z-50 grid place-items-center p-4 focus:outline-none"
                            >
                                <div className={`editor-portal ${inter.className} w-[448px] max-w-[calc(100vw-2rem)] rounded-[16px] border border-[hsl(var(--destructive)/0.15)] bg-[var(--editor-surface)] backdrop-blur-[25px] p-6 shadow-[0_10px_15px_rgba(0,0,0,0.1),0_4px_6px_rgba(0,0,0,0.1)]`}>
                                    <Dialog.Title className="text-[20px] font-semibold leading-7 tracking-normal text-[var(--editor-text)]">
                                        <AlertTriangle className="mr-2 inline-block h-5 w-5 align-text-bottom" aria-hidden />
                                        {et.title}
                                    </Dialog.Title>

                                    <Dialog.Description className="sr-only">
                                        {et.title}
                                    </Dialog.Description>

                                    <div className="mt-4 flex flex-col gap-3">
                                        {/* Warning: Customers affected */}
                                        <div className="flex min-h-[62px] items-start gap-3 rounded-[12px] border border-[hsl(var(--destructive)/0.3)] bg-[hsl(var(--destructive)/0.1)] px-[13px] pb-px pt-[13px]">
                                            <AlertTriangle className="mt-0.5 h-[18px] w-[18px] shrink-0 text-[hsl(var(--destructive))]" />
                                            <div className="min-w-0">
                                                <p className="text-[14px] font-medium leading-5 text-[hsl(var(--destructive))]">
                                                    {et.warningTitle}
                                                </p>
                                                <p className="text-[12px] leading-4 text-[hsl(var(--destructive)/0.7)]">
                                                    {et.warningDesc}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Info: Owner still has access */}
                                        <div className="flex min-h-[62px] items-start gap-3 rounded-[12px] border border-[hsl(var(--info)/0.3)] bg-[hsl(var(--info)/0.1)] px-[13px] pb-px pt-[13px]">
                                            <Globe className="mt-0.5 h-[18px] w-[18px] shrink-0 text-[hsl(var(--info))]" />
                                            <div className="min-w-0">
                                                <p className="text-[14px] font-medium leading-5 text-[hsl(var(--info))]">
                                                    {et.ownerAccessTitle}
                                                </p>
                                                <p className="text-[12px] leading-4 text-[hsl(var(--info)/0.7)]">
                                                    {et.ownerAccessDesc}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-6 flex items-start gap-3">
                                        <Dialog.Close asChild>
                                            <button
                                                type="button"
                                                className="h-[42px] flex-1 rounded-[12px] border border-[hsl(var(--info)/0.07)] text-[14px] font-medium text-[var(--editor-text)] transition-colors hover:bg-[var(--editor-overlay-hover)]"
                                            >
                                                {et.cancel}
                                            </button>
                                        </Dialog.Close>

                                        <button
                                            type="button"
                                            onClick={onUnpublish}
                                            disabled={isPublishing}
                                            className="h-[42px] flex-1 rounded-[12px] bg-[hsl(var(--destructive))] text-[14px] font-semibold text-white shadow-[0_10px_15px_rgba(0,0,0,0.1),0_4px_6px_rgba(0,0,0,0.1)] transition-opacity hover:opacity-95 disabled:opacity-60"
                                        >
                                            {isPublishing ? (
                                                <span className="inline-flex items-center gap-2">
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                    {et.processing}
                                                </span>
                                            ) : (
                                                et.confirm
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        </Dialog.Content>
                    </Dialog.Portal>
                ) : null}
            </AnimatePresence>
        </Dialog.Root>
    )
}
