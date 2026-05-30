import { requirePermission } from '@/lib/permission-guard'
import type { ReactNode } from 'react'

export default async function EmailTemplatesLayout({ children }: { children: ReactNode }) {
    await requirePermission('settings')
    return <>{children}</>
}
