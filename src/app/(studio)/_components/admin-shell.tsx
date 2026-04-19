'use client'

/**
 * AdminShell — client-side wrapper combining Sidebar + Topbar + Toaster.
 * Receives server-fetched user from the layout server component.
 * CSS tokens are scoped via .studio-shell to avoid shadcn :root conflicts.
 */
import { Toaster } from 'sonner'
import { AdminSidebar } from './admin-sidebar'
import { AdminTopbar } from './admin-topbar'
import type { AdminUser } from '@/lib/admin/auth-guard'

export function AdminShell({
    user,
    children,
}: {
    user: AdminUser
    children: React.ReactNode
}) {
    return (
        <div className="studio-shell flex min-h-screen">
            <AdminSidebar />

            <div className="flex flex-col flex-1 min-w-0">
                <AdminTopbar user={user} />

                <main
                    className="flex-1 overflow-auto p-[var(--pad)]"
                    id="studio-main"
                    tabIndex={-1}
                >
                    {children}
                </main>
            </div>

            {/* Toast system — 2.5s auto-dismiss, supports Undo action */}
            <Toaster
                position="bottom-right"
                duration={2500}
                toastOptions={{
                    classNames: {
                        toast: 'rounded-lg border text-sm',
                        actionButton: 'text-xs font-medium',
                    },
                }}
            />
        </div>
    )
}
