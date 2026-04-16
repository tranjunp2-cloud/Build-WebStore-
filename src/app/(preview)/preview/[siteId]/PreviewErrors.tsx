'use client'

import Link from 'next/link'
import { useI18n } from '@/i18n'

export function PreviewAccessDenied() {
    const { t } = useI18n()
    return (
        <div className="flex items-center justify-center min-h-screen bg-slate-50">
            <div className="p-8 bg-white rounded-lg shadow-xl max-w-md text-center">
                <h1 className="text-2xl font-bold text-red-600 mb-4">{t.previewPage.accessDenied}</h1>
                <p className="text-slate-600 mb-6">{t.previewPage.noPermission}</p>
                <Link href="/dashboard" className="px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors">
                    {t.previewPage.backToDashboard}
                </Link>
            </div>
        </div>
    )
}

export function PreviewNoPage() {
    const { t } = useI18n()
    return <div>{t.previewPage.noPage}</div>
}

export function PreviewLoadError() {
    const { t } = useI18n()
    return <div>{t.previewPage.loadError}</div>
}
