'use client'

import { useI18n, type Translations } from '@/i18n'
import type { ReactNode } from 'react'

export function I18nText({ render }: { render: (t: Translations) => ReactNode }) {
    const { t } = useI18n()
    return <>{render(t)}</>
}
