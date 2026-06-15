'use client'

import { Globe } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LanguageToggleProps {
    /** Current active locale ('en' | 'ms'); kept as string so this stays i18n-agnostic. */
    locale: string
    toggleLocale: () => void
    className?: string
}

/**
 * Presentation-only MY/EN language pill (extracted from the dashboard sidebar footer).
 * No i18n import — the caller passes `locale` + `toggleLocale`, so it stays pure/testable and
 * is reusable by both the dashboard sidebar and the editor drawer. Styling uses the same
 * `--dash-*` tokens + `#2DD4BF` accent as the original so the dashboard looks unchanged.
 */
export function LanguageToggle({ locale, toggleLocale, className }: LanguageToggleProps) {
    return (
        <div className={cn('flex items-center gap-2', className)}>
            <Globe className="h-4 w-4 shrink-0 text-dash-text" />
            <div className="flex flex-1 items-center rounded-[16px] border border-dash-border bg-dash-surface px-1 h-[38px]">
                <button
                    onClick={() => locale !== 'ms' && toggleLocale()}
                    className={cn(
                        'flex-1 flex items-center justify-center rounded-[12px] h-[28px] bg-transparent border-none outline-none text-[12px] font-semibold leading-[1.33] cursor-pointer transition-all',
                        locale === 'ms'
                            ? '!bg-[#2DD4BF] !text-[#0B1120] shadow-[0_0_12px_rgba(45,212,191,0.4)]'
                            : 'text-dash-text-muted hover:text-dash-text',
                    )}
                >
                    MY
                </button>
                <button
                    onClick={() => locale !== 'en' && toggleLocale()}
                    className={cn(
                        'flex-1 flex items-center justify-center rounded-[12px] h-[28px] bg-transparent border-none outline-none text-[12px] font-semibold leading-[1.33] cursor-pointer transition-all',
                        locale === 'en'
                            ? '!bg-[#2DD4BF] !text-[#0B1120] shadow-[0_0_12px_rgba(45,212,191,0.4)]'
                            : 'text-dash-text-muted hover:text-dash-text',
                    )}
                >
                    EN
                </button>
            </div>
        </div>
    )
}
