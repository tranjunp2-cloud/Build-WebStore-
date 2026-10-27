import type { ReactNode } from 'react'
import { Lock } from 'lucide-react'
import { cn } from '@/lib/utils'

interface BuilderMiniBrowserProps {
    /** Site address shown in the URL bar; a placeholder bar is drawn while unknown. */
    urlHost?: string | null
    /** Brighten the address (its source field is focused). */
    urlActive?: boolean
    /** Animate the placeholder bar while the address is still being worked out. */
    urlLoading?: boolean
    className?: string
    children: ReactNode
}

/** Small browser window (traffic dots + address bar) framing builder previews. */
export function BuilderMiniBrowser({ urlHost, urlActive, urlLoading, className, children }: BuilderMiniBrowserProps) {
    return (
        <div
            className={cn(
                'overflow-hidden rounded-xl border border-solid border-[rgba(148,163,184,.14)] bg-[#0b1222] shadow-[0_14px_30px_-14px_rgba(0,0,0,.7)]',
                className,
            )}
        >
            <div className="flex h-8 flex-none items-center gap-2.5 border-b border-solid border-[rgba(148,163,184,.1)] bg-[#0f1729] px-3">
                <div aria-hidden className="flex w-[34px] flex-none gap-[5px]">
                    <span className="size-[7px] rounded-full bg-[#334155]" />
                    <span className="size-[7px] rounded-full bg-[#334155]" />
                    <span className="size-[7px] rounded-full bg-[#334155]" />
                </div>
                <div className="flex min-w-0 flex-1 justify-center">
                    <div className="box-border flex h-5 min-w-0 max-w-full items-center gap-1.5 rounded-md border border-solid border-[rgba(148,163,184,.1)] bg-[#172033] px-2.5 text-[#64748b]">
                        <Lock aria-hidden className="size-2.5 flex-none" strokeWidth={2.5} />
                        {urlHost ? (
                            <span
                                className={cn(
                                    'bld-fade min-w-0 truncate text-[10.5px] leading-[14px] transition-colors duration-200',
                                    urlActive ? 'text-[#7dd3fc]' : 'text-[#94a3b8]',
                                )}
                            >
                                {urlHost}
                            </span>
                        ) : (
                            <span
                                aria-hidden
                                className={cn(
                                    'block h-1.5 w-[130px] rounded-[3px]',
                                    urlLoading ? 'bld-shimmer' : 'bg-[rgba(148,163,184,.18)]',
                                )}
                            />
                        )}
                    </div>
                </div>
                <span aria-hidden className="w-[34px] flex-none" />
            </div>
            {children}
        </div>
    )
}

/** Public address for a site slug, matching the domain the slug picker shows. */
export function builderSiteHost(slug: string | null | undefined): string | null {
    if (!slug) return null
    const domain = process.env.NEXT_PUBLIC_PLATFORM_DOMAIN || 'primeweb.app'
    return `${slug}.${domain}`
}
