import { AppShell } from '@/components/AppShell'

export default function EditorLayout({
    children,
}: {
    children: React.ReactNode
}) {
    // Editor has its own full-screen layout (no dashboard sidebar)
    return <AppShell>{children}</AppShell>
}
