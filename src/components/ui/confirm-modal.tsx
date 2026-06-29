'use client'

import * as React from 'react'
import { Loader2, Trash2 } from 'lucide-react'
import {
    Dialog,
    DialogContent,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog'

/**
 * GH-1290 Bug 5 — Shared confirm/alert dialog for the dashboard.
 * Modeled on the canonical reference `discount-delete-dialog.tsx`:
 * centered icon → title → description → Cancel + Confirm (no flex-1, compact).
 * Replaces the per-page hand-built delete popups so layout/spacing stay consistent.
 */
export interface ConfirmModalProps {
    open: boolean
    onConfirm: () => void
    onCancel: () => void
    title: React.ReactNode
    description?: React.ReactNode
    confirmLabel: string
    cancelLabel: string
    /** `danger` = destructive (red) confirm; `default` = primary confirm. */
    variant?: 'danger' | 'default'
    /** Spinner + disabled on the confirm button while an async action runs. */
    loading?: boolean
    /** Custom icon node; defaults to a trash icon for `danger`, none for `default`. */
    icon?: React.ReactNode
}

export function ConfirmModal({
    open,
    onConfirm,
    onCancel,
    title,
    description,
    confirmLabel,
    cancelLabel,
    variant = 'danger',
    loading = false,
    icon,
}: ConfirmModalProps) {
    const isDanger = variant === 'danger'
    const resolvedIcon =
        icon ?? (isDanger ? <Trash2 className="h-7 w-7 text-[hsl(var(--destructive))]" /> : null)

    return (
        <Dialog open={open} onOpenChange={(v) => { if (!v && !loading) onCancel() }}>
            <DialogContent
                className="max-w-sm rounded-lg text-center [&>button]:hidden"
                style={{ background: 'var(--dash-surface)', borderColor: 'var(--dash-border)' }}
            >
                {/* Icon — centered tinted square (danger = destructive, default = primary) */}
                {resolvedIcon && (
                    <div className="flex justify-center mb-3">
                        <div
                            className="flex items-center justify-center h-14 w-14 rounded-2xl shrink-0"
                            style={{ background: isDanger ? 'hsl(var(--destructive)/0.12)' : 'hsl(var(--primary)/0.12)' }}
                        >
                            {resolvedIcon}
                        </div>
                    </div>
                )}

                {/* Title (DialogTitle — required by Radix for a11y) */}
                <DialogTitle className="text-[16px] font-semibold" style={{ color: 'var(--dash-text)' }}>
                    {title}
                </DialogTitle>

                {/* Description — break-words so long names/emails wrap instead of overflowing */}
                {description != null && (
                    <DialogDescription
                        className="text-[14px] leading-relaxed mt-1.5 break-words"
                        style={{ color: 'var(--dash-text-muted)' }}
                    >
                        {description}
                    </DialogDescription>
                )}

                {/* Buttons — compact, centered (no flex-1 → no skew on long text) */}
                <div className="flex items-center justify-center gap-3 mt-5">
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={loading}
                        className="rounded-lg h-[40px] px-5 text-[14px] font-medium bg-transparent hover:opacity-80 transition-opacity cursor-pointer disabled:opacity-50"
                        style={{ color: 'var(--dash-text-muted)', border: '1px solid hsl(var(--input-border))' }}
                    >
                        {cancelLabel}
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={loading}
                        className="flex items-center justify-center gap-1.5 rounded-lg h-[40px] px-5 text-[14px] font-medium transition-opacity hover:opacity-90 cursor-pointer border-none disabled:opacity-50"
                        style={{ background: isDanger ? 'hsl(var(--destructive))' : 'hsl(var(--primary))', color: '#fff' }}
                    >
                        {loading ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                            isDanger && <Trash2 className="h-3.5 w-3.5" />
                        )}
                        {confirmLabel}
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
