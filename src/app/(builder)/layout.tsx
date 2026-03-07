export default function BuilderLayout({
    children,
}: {
    children: React.ReactNode
}) {
    // Builder has its own full-screen layout (no dashboard sidebar)
    return <>{children}</>
}
