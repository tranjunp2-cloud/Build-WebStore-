import { AppShell } from '@/components/AppShell'

export const dynamic = 'force-dynamic'

/**
 * Harness route layout — wraps fixture pages with AppShell so globals.css,
 * fonts, and Tailwind all load. Without this, harness pages render raw HTML
 * because root layout.tsx intentionally omits globals.css.
 *
 * Gated by `.harness.tsx` extension (ENABLE_HARNESS=1 only — see next.config.ts).
 */
export default function TestHarnessLayout({ children }: { children: React.ReactNode }) {
    return <AppShell>{children}</AppShell>
}
