'use client'

import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { CheckCircle2, Copy, ExternalLink, LayoutDashboard, PartyPopper, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import Link from 'next/link'
import { cn } from '@/lib/utils'

interface CongratsModalProps {
    isOpen: boolean
    onOpenChange: (open: boolean) => void
    siteUrl: string
    siteName: string
    siteId: string
    dashboardHref?: string
    dashboardLabel?: string
    onNavigate?: () => void
}

export function CongratsModal({
    isOpen,
    onOpenChange,
    siteUrl,
    siteName,
    siteId,
    dashboardHref = '/dashboard',
    dashboardLabel = 'Go to Dashboard',
    onNavigate,
}: CongratsModalProps) {
    const [copied, setCopied] = useState(false)

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(siteUrl)
            setCopied(true)
            toast.success('Link copied! 🎉')
            setTimeout(() => setCopied(false), 2000)
        } catch {
            toast.error('Failed to copy link')
        }
    }

    return (
        <Dialog.Root open={isOpen} onOpenChange={onOpenChange}>
            <AnimatePresence>
                {isOpen && (
                    <Dialog.Portal forceMount>
                        <Dialog.Overlay asChild>
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm"
                            />
                        </Dialog.Overlay>
                        <Dialog.Content asChild>
                            <motion.div
                                initial={{ opacity: 0, scale: 0.96 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.96 }}
                                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                                // Centering via motion's own transform so it composes with `scale` without
                                // clashing with Tailwind -translate classes (framer-motion writes inline
                                // `transform` which would otherwise drop the centering offset).
                                style={{ x: '-50%', y: '-50%' }}
                                className="fixed left-1/2 top-1/2 z-50 w-full max-w-md rounded-2xl border border-white/10 bg-[#0B1120] p-8 shadow-2xl focus:outline-none"
                            >
                                {/* Close button — subtle, top-right */}
                                <Dialog.Close
                                    aria-label="Close"
                                    className="absolute right-4 top-4 rounded-full p-1.5 text-gray-500 hover:bg-white/10 hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
                                >
                                    <X className="h-4 w-4" />
                                </Dialog.Close>

                                <div className="flex flex-col items-center text-center">
                                    {/* Celebration icon */}
                                    <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-tr from-emerald-500/25 to-teal-500/25 border border-emerald-400/40 shadow-[0_0_24px_rgba(16,185,129,0.25)]">
                                        <PartyPopper className="h-8 w-8 text-emerald-400" />
                                    </div>

                                    <Dialog.Title className="mb-3 text-2xl font-bold tracking-tight text-white">
                                        Congratulations!
                                    </Dialog.Title>

                                    <Dialog.Description className="mb-6 text-sm leading-relaxed text-gray-400">
                                        Your website <span className="font-semibold text-white">{siteName}</span> is now live and published to the internet.
                                    </Dialog.Description>

                                    {/* Domain Display & Copy */}
                                    <div className="mb-6 w-full">
                                        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] p-2 pl-4">
                                            <span className="flex-1 truncate text-left text-sm font-medium text-gray-300" title={siteUrl}>
                                                {siteUrl}
                                            </span>
                                            <button
                                                onClick={handleCopy}
                                                className={cn(
                                                    'flex shrink-0 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-all',
                                                    copied
                                                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                                                        : 'bg-white/10 text-gray-200 hover:bg-white/20 hover:text-white',
                                                )}
                                                title="Copy Link"
                                            >
                                                {copied ? (
                                                    <>
                                                        <CheckCircle2 className="h-3.5 w-3.5" />
                                                        <span>Copied</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Copy className="h-3.5 w-3.5" />
                                                        <span>Copy Link</span>
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Actions — primary (Open Editor) + secondary (Dashboard) */}
                                    <div className="flex w-full flex-col gap-3">
                                        <Link
                                            href={`/editor/${siteId}`}
                                            onClick={onNavigate}
                                            className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-blue-500 via-cyan-500 to-teal-400 px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-cyan-500/30 transition-all hover:shadow-cyan-400/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
                                        >
                                            <ExternalLink className="h-4 w-4" />
                                            <span>Open Editor</span>
                                        </Link>

                                        <Link
                                            href={dashboardHref}
                                            onClick={onNavigate}
                                            className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3.5 text-sm font-medium text-gray-200 hover:bg-white/10 hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
                                        >
                                            <LayoutDashboard className="h-4 w-4" />
                                            <span>{dashboardLabel}</span>
                                        </Link>
                                    </div>
                                </div>
                            </motion.div>
                        </Dialog.Content>
                    </Dialog.Portal>
                )}
            </AnimatePresence>
        </Dialog.Root>
    )
}
