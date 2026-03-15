/**
 * AppShell — style wrapper for non-Payload routes.
 * Imports globals.css (Tailwind) here so it ONLY applies to non-admin routes.
 * Root layout provides <html> and <body> — this is just a style boundary.
 *
 * Google Fonts (Inter + Outfit) are loaded here so they:
 * 1. Apply only to non-admin routes (Payload admin has its own fonts)
 * 2. Set CSS variables (--font-inter, --font-outfit) used by tailwind.config.js
 */
import '../app/globals.css'
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

export function AppShell({ children }: { children: React.ReactNode }) {
    return (
        <div className={`${inter.variable} ${outfit.variable} font-sans antialiased`}>
            {children}
        </div>
    )
}
