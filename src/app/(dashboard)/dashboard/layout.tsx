import { ReactNode } from 'react'
import { DashboardGreeting } from '@/components/dashboard/DashboardGreeting'

export default function DashboardSubLayout({ children }: { children: ReactNode }) {
    return (
        <div className="flex flex-col w-full h-full">
            <div className="flex flex-col w-full mb-4">
                <DashboardGreeting />
            </div>
            <div>
                {children}
            </div>
        </div>
    )
}
