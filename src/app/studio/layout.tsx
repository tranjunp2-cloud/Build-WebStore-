/**
 * Studio route group layout — server component.
 * Enforces super-admin RBAC via requireSuperAdmin() (defense-in-depth on top of middleware).
 * Fetches sidebar badge counts in parallel with auth check.
 * Imports globals.css for Tailwind base/utilities, then studio.css for scoped design tokens.
 */
import '../globals.css'
import './studio.css'
import { requireSuperAdmin } from '@/lib/admin/auth-guard'
import { fetchSidebarCounts } from './_components/sidebar-counts'
import { AdminShell } from './_components/admin-shell'

export const metadata = {
    title: {
        template: '%s | Prime Studio',
        default: 'Prime Studio',
    },
    robots: { index: false, follow: false },
}

export default async function StudioLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const [{ user }, counts] = await Promise.all([
        requireSuperAdmin(),
        fetchSidebarCounts(),
    ])

    return <AdminShell user={user} counts={counts}>{children}</AdminShell>
}
