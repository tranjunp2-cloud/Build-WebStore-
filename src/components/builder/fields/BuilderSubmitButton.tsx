'use client'

import type { ReactNode } from 'react'
import { useI18n } from '@/i18n'

interface BuilderSubmitButtonProps {
    loading?: boolean
    disabled?: boolean
    children: ReactNode
    type?: 'button' | 'submit'
    onClick?: () => void
}

const BUILDER_ARROW_URL = '/assets/builder/builder-arrow.svg'

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
            className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(90deg,#3b82f6_0%,#2dd4bf_100%)] text-sm font-semibold shadow-[0px_10px_15px_0px_rgba(0,0,0,0.1),0px_4px_6px_0px_rgba(0,0,0,0.1)] transition-all duration-300 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={disabled}
            onClick={onClick}
            type={type}
        >
            {loading ? (
                <>
                    <span className="size-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                    <span className="text-white">{t.onboarding.form.initializing}</span>
                </>
            ) : (
                <>
                    <span className="leading-5 text-white">{children}</span>
                    <img alt="" className="size-4" src={BUILDER_ARROW_URL} />
                </>
            )}
        </button>
    )
}
