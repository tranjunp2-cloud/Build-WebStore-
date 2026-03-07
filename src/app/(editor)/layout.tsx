export default function EditorLayout({
    children,
}: {
    children: React.ReactNode
}) {
    // Editor has its own full-screen layout (no dashboard sidebar)
    return <>{children}</>
}
