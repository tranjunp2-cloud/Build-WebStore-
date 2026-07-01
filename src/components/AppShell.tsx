/**
 * AppShell — style wrapper for non-Payload routes.
 * Imports globals.css (Tailwind) here so it ONLY applies to non-admin routes.
 * Root layout provides <html> and <body> — this is just a style boundary.
 *
 * Font CSS variables (--font-*) are declared in src/lib/fonts/variables.ts and
 * applied to <html> by the root layout so portals/modals that render outside
 * this subtree still resolve the correct Inter font family.
 *
 * Fonts cover every pairing in `src/lib/fonts/pairings.ts` (20 pairings).
 * Reference: plans/260412-2300-design-quality-rules/phase-02-typography.md
 */
import '../app/globals.css'

export function AppShell({ children }: { children: React.ReactNode }) {
    return (
        <div className="font-sans antialiased">
            {children}
        </div>
    )
}
