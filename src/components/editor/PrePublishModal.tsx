'use client'

import * as Dialog from '@radix-ui/react-dialog'
import { AlertTriangle, CheckCircle2, Loader2, Rocket } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { Inter } from 'next/font/google'
import type { PageData } from '@/store/editorStore'
import { useI18n } from '@/i18n'

const inter = Inter({
    subsets: ['latin'],
    display: 'swap',
})

interface PrePublishModalProps {
    isOpen: boolean
    onOpenChange: (open: boolean) => void
    onPublish: () => void
    isPublishing: boolean
    hasUnsavedChanges: boolean
    pages: PageData[]
}

export function PrePublishModal({
    isOpen,
    onOpenChange,
    onPublish,
    isPublishing,
    hasUnsavedChanges,
    pages,
}: PrePublishModalProps) {
    const { t } = useI18n()
    const pm = t.editor.publishModal
    const eligiblePages = pages.filter((page) => !page.deletedAt)
    const missingSeoPages = eligiblePages.filter((page) => !page.seoTitle?.trim() || !page.seoDescription?.trim())
    const hasSeoWarning = !hasUnsavedChanges && missingSeoPages.length > 0

    const secondaryCard = hasUnsavedChanges
        ? {
            icon: AlertTriangle,
            borderClassName: 'border-[rgba(240,177,0,0.3)]',
            backgroundClassName: 'bg-[rgba(240,177,0,0.1)]',
            iconClassName: 'text-[#F0B100]',
            titleClassName: 'text-[#FFF085]',
            descriptionClassName: 'text-[rgba(255,240,133,0.7)]',
            title: pm.unsavedChanges,
            description: pm.unsavedChangesDesc,
        }
        : hasSeoWarning
            ? {
                icon: AlertTriangle,
                borderClassName: 'border-[rgba(240,177,0,0.3)]',
                backgroundClassName: 'bg-[rgba(240,177,0,0.1)]',
                iconClassName: 'text-[#F0B100]',
                titleClassName: 'text-[#FFF085]',
                descriptionClassName: 'text-[rgba(255,240,133,0.7)]',
                title: pm.seoNeeded,
                description: missingSeoPages.length > 1
                    ? pm.seoMissingMany.replace('{count}', String(missingSeoPages.length))
                    : pm.seoMissingOne.replace('{count}', String(missingSeoPages.length)),
            }
            : {
                icon: CheckCircle2,
                borderClassName: 'border-[rgba(0,201,80,0.3)]',
                backgroundClassName: 'bg-[rgba(0,201,80,0.1)]',
                iconClassName: 'text-[#00C950]',
                titleClassName: 'text-[#B9F8CF]',
                descriptionClassName: 'text-[rgba(185,248,207,0.7)]',
                title: pm.seoSet,
                description: pm.seoSetDesc,
            }

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
                                <div className={`editor-portal ${inter.className} w-[448px] max-w-[calc(100vw-2rem)] rounded-[16px] border border-[rgba(59,130,246,0.15)] dark:bg-[rgba(30,41,59,0.6)] bg-white dark:backdrop-blur-[25px] backdrop-blur-none p-6 shadow-[0_10px_15px_rgba(0,0,0,0.1),0_4px_6px_rgba(0,0,0,0.1)]`}>
                                    <Dialog.Title className="text-[20px] font-semibold leading-7 tracking-normal dark:text-[#F8FAFC] text-slate-900">
                                        <Rocket className="mr-2 inline-block h-5 w-5 align-text-bottom" aria-hidden />
                                        {pm.title}
                                    </Dialog.Title>

                                    <div className="mt-4 flex flex-col gap-3">
                                        <div className="flex min-h-[62px] items-start gap-3 rounded-[12px] border border-[rgba(0,201,80,0.3)] bg-[rgba(0,201,80,0.1)] px-[13px] pb-px pt-[13px]">
                                            <CheckCircle2 className="mt-0.5 h-[18px] w-[18px] shrink-0 text-[#00C950]" />
                                            <div className="min-w-0">
                                                <p className="text-[14px] font-medium leading-5 text-[#B9F8CF]">
                                                    {pm.homepageReady}
                                                </p>
                                                <p className="text-[12px] leading-4 text-[rgba(185,248,207,0.7)]">
                                                    {pm.homepageReadyDesc}
                                                </p>
                                            </div>
                                        </div>

                                        <div className={`flex min-h-[62px] items-start gap-3 rounded-[12px] border px-[13px] pb-px pt-[13px] ${secondaryCard.borderClassName} ${secondaryCard.backgroundClassName}`}>
                                            <secondaryCard.icon className={`mt-0.5 h-[18px] w-[18px] shrink-0 ${secondaryCard.iconClassName}`} />
                                            <div className="min-w-0">
                                                <p className={`text-[14px] font-medium leading-5 ${secondaryCard.titleClassName}`}>
                                                    {secondaryCard.title}
                                                </p>
                                                <p className={`text-[12px] leading-4 ${secondaryCard.descriptionClassName}`}>
                                                    {secondaryCard.description}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-6 flex items-start gap-3">
                                        <Dialog.Close asChild>
                                            <button
                                                type="button"
                                                className="h-[42px] flex-1 rounded-[12px] border dark:border-[rgba(59,130,246,0.07)] border-[rgba(0,0,0,0.1)] text-[14px] font-medium dark:text-[#F8FAFC] text-slate-700 transition-colors dark:hover:bg-white/[0.04] hover:bg-slate-50"
                                            >
                                                {pm.cancel}
                                            </button>
                                        </Dialog.Close>

                                        <button
                                            type="button"
                                            onClick={onPublish}
                                            disabled={isPublishing}
                                            className="h-[42px] flex-1 rounded-[12px] bg-[linear-gradient(90deg,#3B82F6_0%,#2DD4BF_100%)] text-[14px] font-semibold text-white shadow-[0_10px_15px_rgba(0,0,0,0.1),0_4px_6px_rgba(0,0,0,0.1)] transition-opacity hover:opacity-95 disabled:opacity-60"
                                        >
                                            {isPublishing ? (
                                                <span className="inline-flex items-center gap-2">
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                    {pm.publishingBtn}
                                                </span>
                                            ) : (
                                                pm.publishNow
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
