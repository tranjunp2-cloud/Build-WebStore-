/**
 * Support area — the Prime team that builds merchant sites (role `support`) and super-admins.
 * Server-side guard on top of the edge middleware hint: the DB roles decide.
 */
import '../globals.css'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { canUseMerchantAccess } from '@/lib/admin/studio-roles'
import type { PlatformUser } from '@/types/user'

export const metadata = {
    title: { template: '%s | Prime Support', default: 'Prime Support' },
    robots: { index: false, follow: false },
}

export default async function SupportLayout({ children }: { children: React.ReactNode }) {
    const rawUser = await getCurrentUser()
    if (!rawUser) redirect('/login')
    const user = rawUser as unknown as PlatformUser
    if (!canUseMerchantAccess(user.roles)) redirect('/login')

    return (
        <div className="min-h-[100dvh] bg-slate-50 text-slate-900">
            <header className="border-b border-slate-200 bg-white px-6 py-3 text-sm text-slate-600">
                Prime Support · signed in as <span className="font-medium text-slate-900">{user.email}</span>
            </header>
            <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">{children}</main>
        </div>
    )
}
