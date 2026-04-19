/**
 * Studio route group layout — server component.
 * Enforces super-admin RBAC via requireSuperAdmin() (defense-in-depth on top of middleware).
 * Imports studio.css for scoped design tokens.
 */
import './studio.css'
import { requireSuperAdmin } from '@/lib/admin/auth-guard'
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
    const { user } = await requireSuperAdmin()

    return <AdminShell user={user}>{children}</AdminShell>
}
