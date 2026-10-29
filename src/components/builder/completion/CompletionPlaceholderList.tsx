'use client'

import { TriangleAlert } from 'lucide-react'
import { useI18n } from '@/i18n'
import type { BuilderPlaceholder } from '@/store/builderStore'

const MAX_VISIBLE = 6

/**
 * "Replace before you publish": the sections that still hold placeholder content (SSE `done.placeholders`).
 * Informational only — never blocks Publish.
 */
export function CompletionPlaceholderList({ placeholders }: { placeholders: BuilderPlaceholder[] }) {
    const { t, ti } = useI18n()
    const c = t.onboarding.completion
    if (placeholders.length === 0) return null

    const visible = placeholders.slice(0, MAX_VISIBLE)
    const hidden = placeholders.length - visible.length

    return (
        <section
            aria-label={c.placeholdersTitle}
            className="rounded-2xl border border-amber-400/25 bg-amber-400/[0.06] p-4"
        >
            <div className="flex items-start gap-2.5">
                <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-amber-300" />
                <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#f8fafc]">{c.placeholdersTitle}</p>
                    <p className="mt-1 text-xs leading-5 text-[#94a3b8]">{c.placeholdersHint}</p>
                </div>
            </div>
            <ul className="mt-3 flex flex-col gap-1.5">
                {visible.map((item, index) => (
                    <li
                        className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2"
                        key={`${item.pageSlug}-${item.blockType}-${index}`}
                    >
                        <span className="min-w-0 truncate text-[13px] font-medium text-[#f8fafc]">{item.label}</span>
                        {item.pageSlug ? (
                            <span className="shrink-0 text-[11px] text-[#64748b]">/{item.pageSlug.replace(/^\//, '')}</span>
                        ) : null}
                    </li>
                ))}
            </ul>
            {hidden > 0 ? (
                <p className="mt-2 text-xs text-[#94a3b8]">{ti(c.placeholdersMore, { count: hidden })}</p>
            ) : null}
        </section>
    )
}
