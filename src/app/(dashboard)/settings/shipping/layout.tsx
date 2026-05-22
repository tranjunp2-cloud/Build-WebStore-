import { requirePermission } from '@/lib/permission-guard'
import type { ReactNode } from 'react'

export default async function ShippingLayout({ children }: { children: ReactNode }) {
    await requirePermission('settings')
    return <>{children}</>
}
