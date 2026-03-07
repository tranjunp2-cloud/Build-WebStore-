import Link from 'next/link'
import { Globe, Sparkles } from 'lucide-react'

export function DashboardEmptyState() {
    return (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-white/10 py-20">
            <div className="rounded-full bg-blue-500/10 p-5">
                <Globe className="h-10 w-10 text-blue-400" />
            </div>
            <h3 className="mt-5 text-xl font-semibold text-white">
                Chưa có website nào
            </h3>
            <p className="mt-2 max-w-sm text-center text-sm text-gray-400">
                Tạo website đầu tiên của bạn chỉ trong 5 phút với AI.
                Mô tả business, AI sẽ tạo đầy đủ website cho bạn.
            </p>
            <Link
                href="/onboarding"
                className="mt-8 inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 px-8 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 hover:from-blue-500 hover:to-purple-500 transition-all hover:scale-105"
            >
                <Sparkles className="h-4 w-4" />
                Tạo Website Mới
            </Link>
        </div>
    )
}
