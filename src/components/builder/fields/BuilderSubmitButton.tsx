'use client'

import type { ReactNode } from 'react'
import { ArrowRight } from 'lucide-react'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/utils'

interface BuilderSubmitButtonProps {
    loading?: boolean
    disabled?: boolean
    /** All required details are valid — only the colours change, size and shape stay. */
    ready?: boolean
    children: ReactNode
    type?: 'button' | 'submit'
    onClick?: () => void
}

/**
 * Compact 200×36 generate button. Quiet slate until the form is ready (still
 * clickable so the user can see what is missing), then the primary gradient.
 */
export function BuilderSubmitButton({
    loading,
    disabled,
    ready,
    children,
    type = 'submit',
    onClick,
}: BuilderSubmitButtonProps) {
    const { t } = useI18n()
    return (
        <button
            aria-disabled={disabled}
            className={cn(
                'mx-auto box-border flex h-9 w-[200px] flex-none items-center justify-center gap-2 rounded-[10px] border border-solid text-[13px] font-medium transition-[background-color,color,border-color,filter] duration-200 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60',
                ready
                    ? 'border-transparent text-white [background-image:linear-gradient(90deg,#3b82f6,#2dd4bf)]'
                    : 'border-[rgba(148,163,184,.1)] bg-[#1e293b] text-[#64748b]',
            )}
            data-ready={ready ? 'true' : 'false'}
            disabled={disabled}
            onClick={onClick}
            type={type}
        >
            {loading ? (
                <>
                    <span className="size-3.5 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                    <span>{t.onboarding.form.initializing}</span>
                </>
            ) : (
                <>
                    <span>{children}</span>
                    <ArrowRight aria-hidden className="size-3.5" />
                </>
            )}
        </button>
    )
}
