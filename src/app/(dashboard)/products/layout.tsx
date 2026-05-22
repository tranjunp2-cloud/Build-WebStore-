import { requirePermission } from '@/lib/permission-guard'
import type { ReactNode } from 'react'

export default async function ProductsLayout({ children }: { children: ReactNode }) {
    await requirePermission('products')
    return <>{children}</>
}
