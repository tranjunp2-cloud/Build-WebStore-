import { ImageIcon, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface BuilderSitePreviewLabels {
    caption: string
    placeholderName: string
    placeholderSlug: string
    textNote: string
    itemsTitle: string
    nav: string[]
}

interface BuilderSitePreviewProps {
    businessName: string
    slug: string
    domain: string
    products: string
    labels: BuilderSitePreviewLabels
}

const MAX_ITEMS = 6

/** Split the "what you sell" text the same way a reader would: commas or new lines. */
export function splitPreviewItems(products: string): string[] {
    return products
        .split(/[,\n]/)
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, MAX_ITEMS)
}

/**
 * Right rail of the builder form: a calm, client-only sketch of the site the form
 * describes. No AI and no network — headline/body stay as placeholders until the
 * site is created.
 */
export function BuilderSitePreview({ businessName, slug, domain, products, labels }: BuilderSitePreviewProps) {
    const name = businessName.trim() || labels.placeholderName
    const items = splitPreviewItems(products)

    return (
        <section aria-label={labels.caption} className="flex h-[calc(100dvh-5rem)] w-full flex-col gap-3">
            <p className="text-xs text-[#94a3b8]">{labels.caption}</p>
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl bg-white [border:1px_solid_rgba(148,163,184,0.25)]">
                <div className="flex h-10 shrink-0 items-center gap-3 bg-slate-100 px-4 [border-bottom:1px_solid_#e2e8f0]">
                    <div className="flex gap-1.5" aria-hidden>
                        <span className="size-2.5 rounded-full bg-slate-300" />
                        <span className="size-2.5 rounded-full bg-slate-300" />
                        <span className="size-2.5 rounded-full bg-slate-300" />
                    </div>
                    <div className="mx-auto flex min-w-0 items-center gap-1.5 rounded-md bg-white px-3 py-1 text-xs text-slate-600">
                        <Lock className="size-3 shrink-0" aria-hidden />
                        <span className="truncate" data-testid="preview-address">
                            {slug || labels.placeholderSlug}.{domain}
                        </span>
                    </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto text-slate-900">
                    <div className="flex items-center justify-between gap-6 px-6 py-4 [border-bottom:1px_solid_#e2e8f0]">
                        <span className={cn('truncate text-base font-semibold', !businessName.trim() && 'text-slate-400')}>
                            {name}
                        </span>
                        <nav className="hidden gap-4 text-sm text-slate-500 xl:flex" aria-hidden>
                            {labels.nav.map((link, index) => (
                                <span key={link} className={index === 0 ? 'font-medium text-slate-900' : undefined}>{link}</span>
                            ))}
                        </nav>
                    </div>

                    <div className="grid grid-cols-2 items-center gap-6 px-6 py-8">
                        <div className="flex flex-col gap-3">
                            <div className="h-5 w-4/5 rounded bg-slate-100" />
                            <div className="h-5 w-1/2 rounded bg-slate-100" />
                            <div className="mt-2 h-3 w-full rounded bg-slate-100" />
                            <div className="h-3 w-3/4 rounded bg-slate-100" />
                            <p className="mt-3 text-xs text-slate-500">{labels.textNote}</p>
                        </div>
                        <div className="flex aspect-[4/3] items-center justify-center rounded-lg bg-slate-100 text-slate-400">
                            <ImageIcon className="size-6" aria-hidden />
                        </div>
                    </div>

                    <div className="px-6 pb-8 pt-6 [border-top:1px_solid_#e2e8f0]">
                        <h3 className="text-lg font-semibold">{labels.itemsTitle}</h3>
                        <ul className="mt-4 grid grid-cols-3 gap-4">
                            {(items.length ? items : ['', '', '']).map((item, index) => (
                                <li key={`${item}-${index}`} className="flex flex-col gap-2">
                                    <div className="flex aspect-square items-center justify-center rounded-lg bg-slate-100 text-slate-400">
                                        <ImageIcon className="size-5" aria-hidden />
                                    </div>
                                    {item ? (
                                        <span className="truncate text-sm font-medium">{item}</span>
                                    ) : (
                                        <span className="h-3 w-2/3 rounded bg-slate-100" />
                                    )}
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </div>
        </section>
    )
}
