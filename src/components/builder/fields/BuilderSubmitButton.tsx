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
}

export function BuilderSubmitButton({
    loading,
    disabled,
    children,
    type = 'submit',
    onClick,
}: BuilderSubmitButtonProps) {
    const { t } = useI18n()
    return (
        <button
            aria-disabled={disabled}
            // Compact design-system primary (36px, centered): blue→teal when active, dark muted surface when disabled.
            className="mx-auto flex h-9 w-fit min-w-[200px] items-center justify-center gap-2 rounded-lg px-6 bg-[linear-gradient(90deg,#3b82f6_0%,#2dd4bf_100%)] text-[13px] font-semibold text-white shadow-md shadow-blue-500/20 transition-all duration-200 hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-none disabled:bg-[#1e293b] disabled:text-[#64748b] disabled:shadow-none disabled:hover:opacity-100 disabled:active:scale-100"
            disabled={disabled}
            onClick={onClick}
            type={type}
        >
            {loading ? (
                <>
                    <span className="size-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                    <span>{t.onboarding.form.initializing}</span>
                </>
            ) : (
                <>
                    <span className="leading-5">{children}</span>
                    <ArrowRight aria-hidden className="size-4" />
                </>
            )}
        </button>
    )
}
