'use client'

import type { ReactNode } from 'react'
import { ArrowRight } from 'lucide-react'
import { useI18n } from '@/i18n'

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
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[hsl(var(--primary))] text-sm font-semibold text-[hsl(var(--primary-foreground))] transition-colors duration-200 hover:bg-[hsl(var(--primary)/0.88)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b1120] disabled:cursor-not-allowed disabled:bg-[rgba(148,163,184,0.16)] disabled:text-[#94a3b8]"
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
