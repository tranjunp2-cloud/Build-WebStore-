'use client'

import { Loader2 } from 'lucide-react'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'

export interface SeoMetadataPreview {
    title?: string | null
    description?: string | null
}

interface SeoOverwriteDialogCopy {
    title: string
    description: string
    metaTitle: string
    metaDescription: string
    current: string
    proposed: string
    empty: string
    cancel: string
    replace: string
    replacing: string
}

interface SeoOverwriteConfirmDialogProps {
    open: boolean
    current: SeoMetadataPreview
    proposed: SeoMetadataPreview
    copy: SeoOverwriteDialogCopy
    isApplying?: boolean
    onCancel: () => void
    onConfirm: () => void
}

function MetadataComparison({
    label,
    current,
    proposed,
    copy,
    testId,
}: {
    label: string
    current?: string | null
    proposed?: string | null
    copy: Pick<SeoOverwriteDialogCopy, 'current' | 'proposed' | 'empty'>
    testId: string
}) {
    return (
        <section aria-label={label} className="space-y-2">
            <h3 className="text-xs font-semibold uppercase text-[var(--editor-text-muted)]">
                {label}
            </h3>
            <div className="grid gap-2 sm:grid-cols-2">
                <div className="min-w-0 rounded-[10px] border border-[var(--editor-border)] bg-[var(--editor-bg)] p-3">
                    <p className="mb-1.5 text-[10px] font-semibold uppercase text-[var(--editor-text-muted)]">
                        {copy.current}
                    </p>
                    <p
                        data-testid={`seo-current-${testId}`}
                        className="whitespace-pre-wrap break-words text-sm leading-5 text-[var(--editor-text)]"
                    >
                        {current || <span className="italic text-[var(--editor-text-muted)]">{copy.empty}</span>}
                    </p>
                </div>
                <div className="min-w-0 rounded-[10px] border-2 border-[hsl(var(--primary)/0.65)] bg-[hsl(var(--primary)/0.16)] p-3 dark:border dark:border-[hsl(var(--primary)/0.35)] dark:bg-[hsl(var(--primary)/0.08)]">
                    <p className="mb-1.5 text-[10px] font-semibold uppercase text-[hsl(var(--primary))]">
                        {copy.proposed}
                    </p>
                    <p
                        data-testid={`seo-proposed-${testId}`}
                        className="whitespace-pre-wrap break-words text-sm leading-5 text-[var(--editor-text)]"
                    >
                        {proposed || <span className="italic text-[var(--editor-text-muted)]">{copy.empty}</span>}
                    </p>
                </div>
            </div>
        </section>
    )
}

export function SeoOverwriteConfirmDialog({
    open,
    current,
    proposed,
    copy,
    isApplying = false,
    onCancel,
    onConfirm,
}: SeoOverwriteConfirmDialogProps) {
    return (
        <Dialog
            open={open}
            onOpenChange={(nextOpen) => {
                if (!nextOpen && !isApplying) onCancel()
            }}
        >
            <DialogContent
                data-testid="seo-overwrite-dialog"
                showCloseButton={false}
                className="editor-portal max-h-[85vh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto border-[var(--editor-border)] bg-[var(--editor-surface)] text-[var(--editor-text)]"
                onEscapeKeyDown={(event) => {
                    if (isApplying) event.preventDefault()
                }}
                onPointerDownOutside={(event) => {
                    if (isApplying) event.preventDefault()
                }}
            >
                <DialogHeader className="pr-6">
                    <DialogTitle className="text-[var(--editor-text)]">{copy.title}</DialogTitle>
                    <DialogDescription className="text-[var(--editor-text-muted)]">
                        {copy.description}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <MetadataComparison
                        label={copy.metaTitle}
                        current={current.title}
                        proposed={proposed.title}
                        copy={copy}
                        testId="title"
                    />
                    <MetadataComparison
                        label={copy.metaDescription}
                        current={current.description}
                        proposed={proposed.description}
                        copy={copy}
                        testId="description"
                    />
                </div>

                <DialogFooter className="gap-2 sm:gap-2">
                    <button
                        type="button"
                        disabled={isApplying}
                        onClick={onCancel}
                        className="min-h-10 flex-1 rounded-[10px] border border-[var(--editor-border)] px-4 py-2 text-[13px] font-medium text-[var(--editor-text-muted)] transition-colors hover:bg-[var(--editor-surface-elevated)] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {copy.cancel}
                    </button>
                    <button
                        type="button"
                        disabled={isApplying}
                        onClick={onConfirm}
                        className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-[10px] bg-[linear-gradient(90deg,hsl(var(--info))_0%,hsl(var(--primary))_100%)] px-4 py-2 text-[13px] font-medium !text-white shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {isApplying ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                        {isApplying ? copy.replacing : copy.replace}
                    </button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
