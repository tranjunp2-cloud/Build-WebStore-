'use client'

import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { CheckCircle2, Copy, ExternalLink, FileText, Globe, LayoutDashboard, PartyPopper, Search, X } from 'lucide-react'
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
    /** Number of published pages — shown in the stats section. 0 hides the row. */
    pagesCount?: number
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
    pagesCount = 0,
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
        } catch (err) {
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
                                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                                className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/10 bg-[#0B1120] p-6 shadow-2xl focus:outline-none"
                            >
                                {/* Close button */}
                                <Dialog.Close className="absolute right-4 top-4 rounded-full p-1.5 text-gray-400 hover:bg-white/10 hover:text-white transition-colors">
                                    <X className="h-5 w-5" />
                                </Dialog.Close>

                                <div className="flex flex-col items-center text-center">
                                    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-tr from-green-500/20 to-emerald-500/20 border border-green-500/30">
                                        <PartyPopper className="h-8 w-8 text-green-400" />
                                    </div>
                                    
                                    <Dialog.Title className="mb-2 text-2xl font-bold tracking-tight text-white">
                                        Congratulations! 🎉
                                    </Dialog.Title>
                                    
                                    <Dialog.Description className="mb-6 text-sm text-gray-400">
                                        Your website <strong>{siteName}</strong> is now live and published to the internet.
                                    </Dialog.Description>

                                    {/* Domain Display & Copy */}
                                    <div className="mb-4 w-full">
                                        <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-3">
                                            <div className="flex items-center gap-3 overflow-hidden">
                                                <Globe className="h-5 w-5 shrink-0 text-blue-400" />
                                                <span className="truncate text-sm font-medium text-white">{siteUrl}</span>
                                            </div>
                                            <button
                                                onClick={handleCopy}
                                                className={cn(
                                                    "ml-3 flex shrink-0 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all min-w-[100px]",
                                                    copied
                                                        ? "bg-green-500/20 text-green-400 border border-green-500/30"
                                                        : "bg-white/10 text-gray-300 hover:bg-white/20 hover:text-white"
                                                )}
                                                title="Copy Link"
                                            >
                                                {copied ? (
                                                    <>
                                                        <CheckCircle2 className="h-4 w-4" />
                                                        <span>Copied ✓</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Copy className="h-4 w-4" />
                                                        <span>Copy Link</span>
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Stats — per design spec docs/design/F01-wireframe-lowfi.md#post-publish */}
                                    <div className="mb-6 flex w-full flex-col gap-2 rounded-xl border border-white/5 bg-white/[0.03] p-3 text-left">
                                        {pagesCount > 0 && (
                                            <div className="flex items-center gap-2 text-xs text-gray-300">
                                                <FileText className="h-3.5 w-3.5 text-blue-400" />
                                                <span>
                                                    <strong className="font-semibold text-white">{pagesCount}</strong>{' '}
                                                    {pagesCount === 1 ? 'page' : 'pages'} published
                                                </span>
                                            </div>
                                        )}
                                        <div className="flex items-center gap-2 text-xs text-gray-300">
                                            <Search className="h-3.5 w-3.5 text-emerald-400" />
                                            <span>SEO metadata auto-generated</span>
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex w-full flex-col gap-3">
                                        <a
                                            href={siteUrl}
                                            onClick={onNavigate}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-3 text-sm font-medium text-white hover:from-blue-500 hover:to-purple-500 transition-all shadow-lg shadow-purple-500/25"
                                        >
                                            <ExternalLink className="h-4 w-4" /> View Live Site
                                        </a>
                                        
                                        <Link
                                            href={dashboardHref}
                                            onClick={onNavigate}
                                            className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white hover:bg-white/10 transition-colors"
                                        >
                                            <LayoutDashboard className="h-4 w-4" /> {dashboardLabel}
                                        </Link>

                                        <Link
                                            href={`/editor/${siteId}`}
                                            onClick={onNavigate}
                                            className="mt-2 text-xs font-medium text-gray-400 hover:text-white transition-colors"
                                        >
                                            Continue Editing
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
