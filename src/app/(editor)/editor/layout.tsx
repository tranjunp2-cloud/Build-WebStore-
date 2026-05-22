import { requirePermission } from '@/lib/permission-guard'
import type { ReactNode } from 'react'

export default async function SiteEditorLayout({ children }: { children: ReactNode }) {
    await requirePermission('builder')
    return <>{children}</>
}
