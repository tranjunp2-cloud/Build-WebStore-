/**
 * AppShell — wrapper for non-Payload routes.
 * Provides <html>/<body> with Google Fonts + Tailwind CSS.
 * Root layout is a pass-through ({children}) because Payload admin
 * provides its own <html data-theme>/<body> via RootLayout.
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
            <body>{children}</body>
        </html>
    )
}
