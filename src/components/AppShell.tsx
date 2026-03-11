/**
 * AppShell — wrapper for non-Payload routes that provides html/body tags.
 * Root layout.tsx returns only children (no html/body) to avoid nested HTML
 * with Payload admin's own html/body.
 */
import { Inter, Outfit } from 'next/font/google'
import '../app/globals.css'

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

export function AppShell({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en" className={`${inter.variable} ${outfit.variable}`}>
            <body className="font-sans bg-gray-950 text-white antialiased">
                {children}
            </body>
        </html>
    )
}
