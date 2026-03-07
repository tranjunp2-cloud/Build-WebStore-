import { DashboardSidebar } from '@/components/dashboard/Sidebar'

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <div className="min-h-screen bg-[#0F172A]">
            <DashboardSidebar />
            <main className="pl-[240px]">
                <div className="p-8">
                    {children}
                </div>
            </main>
        </div>
    )
}
