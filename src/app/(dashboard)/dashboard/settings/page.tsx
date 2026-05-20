import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { isStaging } from '@/lib/env'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { ResetAccountCard } from './ResetAccountCard'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
    const user = await getCurrentUser()

    if (!user) {
        redirect('/login?returnUrl=/dashboard/settings')
    }

    const u = user as unknown as {
        id: string
        email: string
        firstName?: string
        lastName?: string
        roles?: string[]
        tenants?: Array<{ tenant: string | { id: string; name?: string }; role: string }>
    }

    const fullName = [u.firstName, u.lastName].filter(Boolean).join(' ') || 'User'
    const role = u.roles?.[0] || 'tenant-owner'
    const tenantCount = u.tenants?.length || 0

    return (
        <div className="space-y-6 max-w-2xl">
            <h1 className="text-2xl font-bold text-white">Settings</h1>

            {/* Profile Card */}
            <Card>
                <CardHeader>
                    <CardTitle>Profile</CardTitle>
                    <CardDescription>Your account information</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center gap-4">
                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-r from-blue-600 to-purple-600 text-xl font-bold text-white">
                            {fullName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <p className="text-lg font-semibold text-white">{fullName}</p>
                            <p className="text-sm text-gray-400">{u.email}</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 pt-2">
                        <div>
                            <p className="text-xs text-gray-500 uppercase tracking-wider">Role</p>
                            <p className="text-sm text-gray-300 capitalize">{role.replace('-', ' ')}</p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-500 uppercase tracking-wider">Stores</p>
                            <p className="text-sm text-gray-300">{tenantCount}</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Danger Zone — staging only */}
            {isStaging() && <ResetAccountCard />}
        </div>
    )
}
