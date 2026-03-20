import { AppShell } from '@/components/AppShell'

// Force dynamic rendering — builder pages require auth and import heavy
// dependencies (block registry → jsdom chain) that fail during static prerender
// in Docker standalone builds.
export const dynamic = 'force-dynamic'

export default function BuilderLayout({
    children,
}: {
    children: React.ReactNode
}) {
    // Builder has its own full-screen layout (no dashboard sidebar)
    return <AppShell>{children}</AppShell>
}
