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
 * Root layout — pass-through only.
 *
 * IMPORTANT: Do NOT add <html>/<body> tags here!
 * Payload CMS admin provides its own <html data-theme> and <body>.
 * Adding them here creates nested <html> tags = invalid HTML
 * = hydration failure = client-side 404.
 *
 * Each route group provides its own html/body wrapper:
 * - (payload) → Payload's RootLayout handles it
 * - (frontend)/(dashboard)/(auth)/(builder)/(editor) → AppShell handles it
 */
export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return children
}

