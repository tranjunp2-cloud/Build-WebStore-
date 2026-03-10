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
 * Root layout — kept minimal so Payload admin CSS is not affected.
 * DO NOT import globals.css here — it must go in route-group layouts
 * that need it (e.g. (frontend), (auth), (dashboard), etc).
 *
 * Payload admin at (payload)/admin uses its own RootLayout which
 * renders its own full-page HTML with proper Payload CSS theme.
 */
export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="en" suppressHydrationWarning>
            <body>{children}</body>
        </html>
    )
}
