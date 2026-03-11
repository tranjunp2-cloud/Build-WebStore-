import type { Metadata } from 'next'
import { Inter, Outfit } from 'next/font/google'

const inter = Inter({
    subsets: ['latin'],
    variable: '--font-inter',
    display: 'swap',
})

const outfit = Outfit({
    subsets: ['latin'],
    variable: '--font-outfit',
    display: 'swap',
})

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
 * Root layout — provides html/body tags (required by Next.js).
 *
 * IMPORTANT: Do NOT import globals.css here!
 * Tailwind's @tailwind base (Preflight) resets all browser styles globally
 * and overrides Payload admin panel CSS. globals.css must only be imported
 * in non-admin route group layouts via AppShell.
 */
export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="en" className={`${inter.variable} ${outfit.variable}`} suppressHydrationWarning>
            <body>{children}</body>
        </html>
    )
}
