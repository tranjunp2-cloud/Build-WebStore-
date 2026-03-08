/**
 * AppShell — a pass-through wrapper for non-Payload routes.
 * <html> and <body> are now provided by the root layout.tsx.
 * This component exists for convenience — sub-layouts can wrap content here
 * for any shared provider/context needs in the future.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
    return <>{children}</>
}
