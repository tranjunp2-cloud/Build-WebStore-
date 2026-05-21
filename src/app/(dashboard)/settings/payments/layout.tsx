import { requirePermission } from '@/lib/permission-guard'
import type { ReactNode } from 'react'

export default async function PaymentsLayout({ children }: { children: ReactNode }) {
    await requirePermission('settings')
    return <>{children}</>
}
