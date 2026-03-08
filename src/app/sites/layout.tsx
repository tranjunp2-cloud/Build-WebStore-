import { AppShell } from '@/components/AppShell'

export default function SitesLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return <AppShell>{children}</AppShell>
}
