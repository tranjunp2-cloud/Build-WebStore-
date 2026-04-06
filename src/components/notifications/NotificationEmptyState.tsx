import { BellOff } from 'lucide-react'

export function NotificationEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
      <BellOff className="h-10 w-10 text-white/20 mb-3" />
      <p className="text-[14px] text-[#94A3B8]">
        🔕 You have no new notifications right now.
      </p>
    </div>
  )
}
