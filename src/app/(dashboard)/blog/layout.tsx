import { requirePermission } from '@/lib/permission-guard'
import type { ReactNode } from 'react'

export default async function BlogLayout({ children }: { children: ReactNode }) {
    await requirePermission('blog')
    return <>{children}</>
}
