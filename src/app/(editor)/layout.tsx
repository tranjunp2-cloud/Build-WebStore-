import { AppShell } from '@/components/AppShell'
import { Toaster } from '@/components/ui/sonner'

export default function EditorLayout({
    children,
}: {
    children: React.ReactNode
}) {
    // Editor has its own full-screen layout (no dashboard sidebar)
    return (
        <AppShell>
            {children}
            <Toaster position="bottom-right" />
        </AppShell>
    )
}
