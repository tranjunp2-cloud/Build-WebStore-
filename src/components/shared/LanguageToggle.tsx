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
        // Single full-width box (edge-aligned with the profile/logout rows): leading Globe icon
        // at the same left inset as the other rows' icons, then the MY/EN segmented control fills.
        <div
            className={cn(
                'flex h-[42px] items-center gap-3 rounded-[16px] border border-dash-border bg-dash-surface pl-4 pr-1',
                className,
            )}
        >
            <Globe className="h-4 w-4 shrink-0 text-dash-text-muted" />
            <div className="flex flex-1 items-center gap-1">
                <button
                    onClick={() => locale !== 'ms' && toggleLocale()}
                    className={cn(
                        'flex-1 flex items-center justify-center rounded-[12px] h-[30px] bg-transparent border-none outline-none text-[12px] font-semibold leading-[1.33] cursor-pointer transition-all',
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
                        'flex-1 flex items-center justify-center rounded-[12px] h-[30px] bg-transparent border-none outline-none text-[12px] font-semibold leading-[1.33] cursor-pointer transition-all',
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
