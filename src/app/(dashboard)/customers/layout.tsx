import { requirePermission } from '@/lib/permission-guard'
import type { ReactNode } from 'react'

export default async function CustomersLayout({ children }: { children: ReactNode }) {
    await requirePermission('customers')
    return <>{children}</>
}
