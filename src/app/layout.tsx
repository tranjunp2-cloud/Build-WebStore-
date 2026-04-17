import type { Metadata, Viewport } from 'next'

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

// Plan 260415 nav-bugfix hotfix: add viewport meta so mobile browsers render
// generated template pages at actual device width (375-428px) instead of the
// legacy 980px default. Without this, Tailwind `md:`/`lg:` responsive classes
// fire at the wrong viewport and sections like service-cards / contact / footer
// show desktop multi-column layouts squished into mobile screens (issue reported
// 2026-04-15 on staging).
export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 5,
}

/**
 * Root layout — minimal html/body wrapper (required by Next.js).
 *
 * IMPORTANT: Keep this minimal! Do NOT add:
 * - Google Fonts (next/font/google) — these go in AppShell
 * - globals.css import — goes in AppShell
 * - Font class names on <html>
 *
 * Payload CMS admin has its own RootLayout that adds data-theme
 * and other attributes. suppressHydrationWarning prevents conflicts.
 */
export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="en" suppressHydrationWarning data-scroll-behavior="smooth">
            <body>
                {children}
            </body>
        </html>
    )
}
