'use client'

import { formatDistanceToNow } from 'date-fns'
import { ms as dateFnsMsLocale } from 'date-fns/locale/ms'
import { ShoppingCart, Megaphone, CircleAlert, FileText, ClipboardCheck, MessageSquare, type LucideIcon } from 'lucide-react'
import { useI18n } from '@/i18n'
import type { NotificationItem as NotificationItemType } from '@/types/notification'

interface Props {
  notification: NotificationItemType
  onClick?: (notification: NotificationItemType) => void
}

/** Interpolate {key} placeholders in a template string with metadata values */
function interpolate(template: string, metadata: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => metadata[key] ?? `{${key}}`)
}

export function NotificationItem({ notification, onClick }: Props) {
  const { type, title, message, metadata, isRead, createdAt } = notification
  const { t, locale } = useI18n()

  // Use i18n template + metadata for translated content; fallback to raw DB values
  const typeTemplates = (t.notifications as Record<string, unknown>).types as
    Record<string, { title: string; message: string }> | undefined
  const template = typeTemplates?.[type]
  const displayTitle = template && metadata ? interpolate(template.title, metadata) : title
  const displayMessage = template && metadata ? interpolate(template.message, metadata) : message

  let Icon: LucideIcon = ShoppingCart
  let iconBgClass = 'bg-[#00BC7D]/10 text-[#00BC7D]'

  if (type === 'SYSTEM_ALERT') {
    Icon = Megaphone
    iconBgClass = 'bg-[#2B7FFF]/10 text-[#51A2FF]' 
  } else if (type === 'PRODUCT_LOW_STOCK') {
    Icon = CircleAlert
    iconBgClass = 'bg-[#FF6900]/10 text-[#FF8904]'
  } else if (type === 'BLOG_PUBLISHED') {
    Icon = FileText
    iconBgClass = 'bg-white/10 text-white'
  } else if (type === 'AUTOMATION_REMINDER') {
    Icon = ClipboardCheck
    iconBgClass = 'bg-[#2DD4BF]/10 text-[#2DD4BF]'
  } else if (type === 'LEAD_NEW') {
    Icon = MessageSquare
    iconBgClass = 'bg-[#A78BFA]/10 text-[#A78BFA]'
  }

  return (
    <div
      onClick={() => onClick?.(notification)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.(notification) } }}
      className={`relative flex items-start gap-[10px] sm:gap-[12px] px-[8px] py-[12px] sm:px-[20px] sm:py-[16px] min-h-[44px] transition-colors hover:bg-white/5 cursor-pointer border-b border-t-0 border-r-0 border-white/5 last:border-b-0 ${!isRead ? 'border-l-2 border-l-[#3B82F6] bg-white/[0.02]' : 'border-l-2 border-l-transparent bg-transparent'}`}>
      {!isRead && (
        <div className="absolute left-[2px] sm:left-[6px] top-[29px] sm:top-[33px] h-[8px] w-[8px] rounded-full bg-[#3B82F6]" />
      )}
      
      <div className={`flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-2xl ${iconBgClass}`}>
        <Icon className="h-5 w-5" />
      </div>
      
      <div className="flex-1 flex flex-col pt-[2px] pr-[10px]">
        <div className="flex items-center gap-[6px] mb-1">
          <h4 className={`text-[12px] sm:text-[14px] leading-[20px] ${!isRead ? 'font-semibold text-white' : 'font-normal text-[#CBD5E1]'}`}>
            {displayTitle}
          </h4>
          {type === 'SYSTEM_ALERT' && (
            <span className="inline-flex items-center rounded-full bg-[#7C3AED]/15 px-[6px] py-[1px] text-[10px] font-medium leading-[14px] text-[#A78BFA] whitespace-nowrap">
              {t.notifications.tagSystem}
            </span>
          )}
        </div>
        <p className="text-[12px] font-medium leading-[16px] text-[#94A3B8]">
          {displayMessage}
        </p>
        <p className="text-[12px] font-medium leading-[16px] text-[#64748B] mt-1">
          {formatDistanceToNow(new Date(createdAt), { addSuffix: true, locale: locale === 'ms' ? dateFnsMsLocale : undefined })}
        </p>
      </div>
    </div>
  )
}
