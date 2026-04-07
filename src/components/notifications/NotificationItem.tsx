import { formatDistanceToNow } from 'date-fns'
import { ShoppingCart, Megaphone, CircleAlert, FileText, ShoppingBag, type LucideIcon } from 'lucide-react'
import type { NotificationItem as NotificationItemType } from '@/types/notification'

interface Props {
  notification: NotificationItemType
  onClick?: (notification: NotificationItemType) => void
}

export function NotificationItem({ notification, onClick }: Props) {
  const { type, title, message, isRead, createdAt } = notification

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
  } else if (type as string === 'ABANDONED_CART') {
    Icon = ShoppingBag
    iconBgClass = 'bg-[#A855F7]/10 text-[#C084FC]' // From image, abandoned cart uses purple
  }

  return (
    <div
      onClick={() => onClick?.(notification)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.(notification) } }}
      className={`relative flex items-start gap-[10px] sm:gap-[12px] px-[8px] py-[12px] sm:px-[20px] sm:py-[16px] transition-colors hover:bg-white/5 cursor-pointer border-b border-t-0 border-r-0 border-white/5 last:border-b-0 bg-transparent`}>
      {!isRead && (
        <div className="absolute left-[2px] sm:left-[6px] top-[29px] sm:top-[33px] h-[6px] w-[6px] rounded-full bg-[#3B82F6]" />
      )}
      
      <div className={`flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-2xl ${iconBgClass}`}>
        <Icon className="h-5 w-5" />
      </div>
      
      <div className="flex-1 flex flex-col pt-[2px] pr-[10px]">
        <h4 className={`text-[14px] leading-[20px] mb-1 ${!isRead ? 'font-semibold text-white' : 'font-normal text-[#CBD5E1]'}`}>
          {title}
        </h4>
        <p className="text-[12px] font-medium leading-[16px] text-[#94A3B8]">
          {message}
        </p>
        <p className="text-[12px] font-medium leading-[16px] text-[#64748B] mt-1">
          {formatDistanceToNow(new Date(createdAt), { addSuffix: true })}
        </p>
      </div>
    </div>
  )
}
