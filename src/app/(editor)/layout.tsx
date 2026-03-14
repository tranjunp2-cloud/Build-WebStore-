import { Toaster } from '@/components/ui/sonner'

export default function EditorLayout({
    children,
}: {
    children: React.ReactNode
}) {
    // Editor has its own full-screen layout (no dashboard sidebar)
    return (
        <>
            {children}
            <Toaster position="bottom-right" />
        </>
    )
}
