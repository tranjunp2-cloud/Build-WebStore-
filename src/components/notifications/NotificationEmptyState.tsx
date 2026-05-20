'use client'

import { BellOff } from 'lucide-react'
import { useI18n } from '@/i18n'

export function NotificationEmptyState() {
  const { t } = useI18n()

  return (
    <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
      <BellOff className="h-10 w-10 text-white/20 mb-3" />
      <p className="text-[14px] text-[#94A3B8]">
        🔕 {t.notifications.empty}
      </p>
    </div>
  )
}
