import { requirePermission } from '@/lib/permission-guard'
import { getCurrentTenantId } from '@/lib/auth'
import { OrdersNoWorkspace } from './_components/OrdersNoWorkspace'
import type { ReactNode } from 'react'

export const dynamic = 'force-dynamic'

export default async function OrdersLayout({ children }: { children: ReactNode }) {
    await requirePermission('orders')
    if (!(await getCurrentTenantId())) return <OrdersNoWorkspace />
    return <>{children}</>
}
