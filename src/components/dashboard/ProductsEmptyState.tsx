import { PackageOpen } from 'lucide-react'
import Link from 'next/link'
import { useI18n } from '@/i18n'

interface ProductsEmptyStateProps {
    onAddProduct?: () => void
}

export function ProductsEmptyState({ onAddProduct }: ProductsEmptyStateProps) {
    const { t } = useI18n()

    return (
        <div className="flex h-[60vh] flex-col items-center justify-center rounded-xl border border-dashed border-white/20 bg-[#1E293B]/20 px-6 py-12 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#2DD4BF]/10 mb-6">
                <PackageOpen className="h-10 w-10 text-blue-400" />
            </div>
            <h2 className="mb-2 text-xl font-semibold text-white">{t.dashboard.products.empty.title}</h2>
            <p className="mb-6 max-w-sm text-sm text-gray-400">
                {t.dashboard.products.empty.description}
            </p>
            {onAddProduct ? (
                <button
                    onClick={onAddProduct}
                    className="inline-flex items-center gap-2 rounded-lg bg-[#2DD4BF] px-6 py-3 text-sm font-semibold text-[#0B1120] shadow-lg shadow-[#2DD4BF]/20 transition-colors hover:bg-[#2DD4BF]/90"
                >
                    + {t.dashboard.products.addProduct}
                </button>
            ) : (
                <Link
                    href="/products/new"
                    className="inline-flex items-center gap-2 rounded-lg bg-[#2DD4BF] px-6 py-3 text-sm font-semibold text-[#0B1120] shadow-lg shadow-[#2DD4BF]/20 transition-colors hover:bg-[#2DD4BF]/90"
                >
                    + {t.dashboard.products.addProduct}
                </Link>
            )}
        </div>
    )
}
