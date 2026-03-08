import type { BlockProps } from '../types'
import type { NewsletterConfig } from './config'

export function NewsletterBlock({ block, theme }: BlockProps<NewsletterConfig>) {
    const { headline, subheadline, buttonLabel = 'Subscribe', placeholder = 'your@email.com' } = block
    return (
        <section className="py-20">
            <div className="container mx-auto px-6 max-w-xl text-center">
                <h2 className="text-3xl font-bold font-heading mb-3">{headline || 'Stay Updated'}</h2>
                {subheadline && <p className="opacity-70 mb-8">{subheadline}</p>}
                <form className="flex gap-3">
                    <input type="email" placeholder={placeholder} className="flex-1 px-4 py-3 rounded-xl border bg-transparent focus:outline-none focus:ring-2" style={{ borderColor: `${theme.primaryColor}30`, outlineColor: theme.primaryColor }} />
                    <button type="submit" className="px-6 py-3 rounded-xl font-semibold text-white transition-all hover:opacity-90" style={{ background: theme.primaryColor }}>{buttonLabel}</button>
                </form>
            </div>
        </section>
    )
}
