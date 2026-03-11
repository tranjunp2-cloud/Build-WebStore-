import type { Metadata } from 'next'

export const metadata: Metadata = {
    title: {
        template: '%s | PrimeWeb',
        default: 'PrimeWeb — Build Beautiful Websites in Minutes',
    },
    description:
        'AI-powered website builder for SMEs. Create stunning, SEO-optimized websites with just a few clicks.',
    keywords: ['website builder', 'AI website', 'SME website', 'online store builder'],
    authors: [{ name: 'PrimeWeb' }],
    creator: 'PrimeWeb',
    openGraph: {
        type: 'website',
        locale: 'en_US',
        siteName: 'PrimeWeb',
    },
    twitter: {
        card: 'summary_large_image',
    },
}

/**
 * Root layout — returns ONLY children, no <html> or <body>.
 *
 * Why: Payload admin's RootLayout renders its own <html data-theme="..."><body>.
 * If we wrap it in another <html><body>, it creates invalid nested HTML which
 * breaks Payload's CSS targeting (data-theme attribute, :root styles, etc).
 *
 * Each route group provides its own html/body wrapper:
 * - (payload): uses @payloadcms/next RootLayout which renders html+body
 * - (frontend), (auth), (dashboard): use AppShell which wraps in html+body
 */
export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    // eslint-disable-next-line react/jsx-no-useless-fragment
    return <>{children}</>
}
