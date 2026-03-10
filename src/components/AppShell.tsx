/**
 * AppShell — wrapper for non-Payload routes.
 * Imports globals.css here so Payload admin routes are not affected.
 * <html> and <body> are provided by the root layout.tsx.
 */
import '../app/globals.css'

export function AppShell({ children }: { children: React.ReactNode }) {
    return <>{children}</>
}
