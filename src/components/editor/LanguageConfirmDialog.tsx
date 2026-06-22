'use client'

import * as Dialog from '@radix-ui/react-dialog'
import { Globe } from 'lucide-react'

const LOCALE_LABELS: Record<string, string> = {
    ms: 'Bahasa Melayu',
    en: 'English',
}

export type LanguageConfirmAction = 'confirm' | 'switch' | 'dismiss'

interface LanguageConfirmDialogProps {
    isOpen: boolean
    /** Locale that AI detected — shown in dialog copy */
    detectedLocale: string
    /** Called when user confirms, switches, or dismisses */
    onAction: (action: LanguageConfirmAction, locale: string) => void
}

/**
 * F26-01: Shown once after AI site generation to confirm the detected locale.
 * Lets user confirm or switch to the alternate language before editing.
 * Follows editor-portal light/dark pattern (globals.css .editor-portal).
 */
export function LanguageConfirmDialog({
    isOpen,
    detectedLocale,
    onAction,
}: LanguageConfirmDialogProps) {
    const detectedLabel = LOCALE_LABELS[detectedLocale] ?? detectedLocale
    const alternateLocale = detectedLocale === 'ms' ? 'en' : 'ms'
    const alternateLabel = LOCALE_LABELS[alternateLocale] ?? alternateLocale

    return (
        <Dialog.Root
            open={isOpen}
            // M1 fix: handle Escape key + backdrop click → dismiss
            onOpenChange={(open) => { if (!open) onAction('dismiss', detectedLocale) }}
        >
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 z-[9998] bg-black/60 backdrop-blur-sm" />
                {/* M2 fix: light/dark variants via editor-portal pattern instead of hardcoded dark */}
                <Dialog.Content
                    className="editor-portal fixed left-1/2 top-1/2 z-[9999] w-[90vw] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border p-6 shadow-2xl focus:outline-none font-sans
                        dark:border-white/10 dark:bg-[var(--editor-surface)]
                        border-slate-200 bg-white"
                >
                    {/* Icon */}
                    <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-indigo-500/20">
                        <Globe className="h-5 w-5 text-indigo-400" />
                    </div>

                    <Dialog.Title className="mb-1 text-base font-semibold dark:text-white text-slate-800">
                        Language Detected
                    </Dialog.Title>

                    <Dialog.Description className="mb-5 text-sm dark:text-white/60 text-slate-500">
                        AI created your site in{' '}
                        <span className="font-medium dark:text-white text-slate-800">{detectedLabel}</span>
                        {' '}— is that correct?
                    </Dialog.Description>

                    {/* Primary: confirm */}
                    <button
                        onClick={() => onAction('confirm', detectedLocale)}
                        className="mb-2 w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                        Yes, continue in {detectedLabel}
                    </button>

                    {/* Secondary: switch */}
                    <button
                        onClick={() => onAction('switch', alternateLocale)}
                        className="mb-3 w-full rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors focus:outline-none focus:ring-2
                            dark:border-white/10 dark:bg-white/5 dark:text-white/80 dark:hover:bg-white/10 dark:focus:ring-white/20
                            border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 focus:ring-slate-300"
                    >
                        No, switch to {alternateLabel}
                    </button>

                    {/* Dismiss */}
                    <button
                        onClick={() => onAction('dismiss', detectedLocale)}
                        className="w-full text-center text-xs transition-colors focus:outline-none dark:text-white/30 dark:hover:text-white/50 text-slate-400 hover:text-slate-600"
                    >
                        Dismiss
                    </button>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    )
}
