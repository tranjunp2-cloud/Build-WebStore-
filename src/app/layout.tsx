import type { Metadata } from 'next'
import { Inter, Outfit } from 'next/font/google'
import './globals.css'

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
        template: '%s | Web Store',
        default: 'Web Store — Build Beautiful Websites in Minutes',
    },
    description:
        'AI-powered website builder for SMEs. Create stunning, SEO-optimized websites with just a few clicks.',
    keywords: ['website builder', 'AI website', 'SME website', 'online store builder'],
    authors: [{ name: 'Web Store' }],
    creator: 'Web Store',
    openGraph: {
        type: 'website',
        locale: 'en_US',
        siteName: 'Web Store',
    },
    twitter: {
        card: 'summary_large_image',
    },
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="en" className={`${inter.variable} ${outfit.variable}`}>
            <body className="font-sans bg-gray-950 text-white antialiased">
                {children}
            </body>
        </html>
    )
}
