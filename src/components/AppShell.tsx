/**
 * AppShell — wrapper for non-Payload routes.
 * Imports globals.css (Tailwind) here so it ONLY applies to non-admin routes.
 * Root layout provides <html> and <body> — this is just a style boundary.
 */
import '../app/globals.css'

export function AppShell({ children }: { children: React.ReactNode }) {
    return <>{children}</>
}
