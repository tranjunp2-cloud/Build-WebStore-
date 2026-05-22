import { requirePermission } from '@/lib/permission-guard'
import type { ReactNode } from 'react'

export default async function OrdersLayout({ children }: { children: ReactNode }) {
    await requirePermission('orders')
    return <>{children}</>
}
