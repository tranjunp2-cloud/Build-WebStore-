import { Globe, HardDrive } from 'lucide-react'

type StatCardProps = {
    icon: React.ElementType
    label: string
    value: string
    sub?: string
    progress?: number
    iconColor?: string
}

function StatCard({ icon: Icon, label, value, sub, progress, iconColor = 'text-gray-500' }: StatCardProps) {
    return (
        <div className="rounded-xl border border-white/10 bg-[#1E293B] p-5 transition-all hover:border-white/20">
            <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">{label}</span>
                <div className="rounded-lg bg-white/5 p-2">
                    <Icon className={`h-4 w-4 ${iconColor}`} />
                </div>
            </div>
            <p className="mt-3 text-2xl font-bold text-white">{value}</p>
            {sub && <p className="mt-1 text-xs text-gray-500">{sub}</p>}
            {typeof progress === 'number' && (
                <div className="mt-3 h-1.5 rounded-full bg-gray-800">
                    <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                            width: `${Math.min(progress, 100)}%`,
                            backgroundColor: progress > 80 ? '#EF4444' : progress > 50 ? '#F59E0B' : '#3B82F6',
                        }}
                    />
                </div>
            )}
        </div>
    )
}

type DashboardStatsProps = {
    totalSites: number
    storageUsed: number
    storageLimit: number
    publishedCount: number
}

export function DashboardStats({
    totalSites,
    storageUsed,
    storageLimit,
    publishedCount,
}: DashboardStatsProps) {
    const draftCount = totalSites - publishedCount

    return (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard
                icon={Globe}
                label="Tổng Website"
                value={String(totalSites)}
                sub={`${publishedCount} published · ${draftCount} draft`}
                iconColor="text-blue-400"
            />
            <StatCard
                icon={Globe}
                label="Đã Publish"
                value={String(publishedCount)}
                sub={publishedCount > 0 ? 'Website đang live' : 'Chưa có site nào live'}
                iconColor="text-green-400"
            />
            <StatCard
                icon={HardDrive}
                label="Dung lượng"
                value={storageUsed > 0 ? `${storageUsed}MB / ${storageLimit}MB` : 'Chưa sử dụng'}
                progress={storageUsed > 0 ? (storageUsed / storageLimit) * 100 : 0}
                iconColor="text-amber-400"
            />
        </div>
    )
}
