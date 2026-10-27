'use client'

import type { ReactNode } from 'react'
import { ArrowRight } from 'lucide-react'
import { useI18n } from '@/i18n'
import { BUILDER_FOCUS_RING } from '@/components/ui/focus-ring'
import { cn } from '@/lib/utils'

interface BuilderSubmitButtonProps {
    loading?: boolean
    disabled?: boolean
    children: ReactNode
    type?: 'button' | 'submit'
    onClick?: () => void
    /** Id of the helper line that explains why the button is disabled. */
    describedBy?: string
}

export function BuilderSubmitButton({
    loading,
    disabled,
    children,
    type = 'submit',
    onClick,
    describedBy,
}: BuilderSubmitButtonProps) {
    const { t } = useI18n()
    return (
        <button
            aria-describedby={describedBy}
            aria-disabled={disabled}
            // The builder is always dark, so the teal is pinned to the dark-theme value instead of --primary.
            className={cn(
                'flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-[background-color,transform] duration-200 active:scale-[0.98]',
                'bg-[hsl(var(--p-teal-400))] text-[hsl(var(--p-slate-950))] hover:bg-[color:color-mix(in_srgb,hsl(var(--p-teal-400))_90%,black)] active:bg-[color:color-mix(in_srgb,hsl(var(--p-teal-400))_80%,black)]',
                BUILDER_FOCUS_RING,
                'disabled:cursor-not-allowed disabled:bg-[rgba(148,163,184,0.16)] disabled:text-[#94a3b8] disabled:active:scale-100',
            )}
            disabled={disabled}
            onClick={onClick}
            type={type}
        >
            {loading ? (
                <>
                    <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    <span>{t.onboarding.form.initializing}</span>
                </>
            ) : (
                <>
                    <span className="leading-5">{children}</span>
                    <ArrowRight className="size-4" aria-hidden />
                </>
            )}
        </button>
    )
}
