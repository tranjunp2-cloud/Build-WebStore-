import { Banknote, QrCode, CreditCard } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/i18n'
import type { Order } from '../types'
import { STATUS_CONFIG, formatPrice } from '../types'
import { OrderStatusBadge } from './OrderStatusBadge'

const paymentIcons: Record<string, React.ElementType> = {
    cod: Banknote,
    qr_banking: QrCode,
    stripe: CreditCard,
}

export function OrderMobileCard({
    order,
    onSelect,
    onStatusChange,
    isUpdating,
    isSelected,
    onToggleSelect,
}: {
    order: Order
    onSelect: (order: Order) => void
    onStatusChange: (id: string, status: string) => void
    isUpdating?: string | boolean | null
    isSelected: boolean
    onToggleSelect: (id: string, checked: boolean) => void
}) {
    const { t } = useI18n()
    const o = t.dashboard.orders
    const config = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending
    const PaymentIcon = paymentIcons[order.paymentMethod] || Banknote

    return (
        <div
            className={cn(
                'relative rounded-xl border p-4 transition-colors active:bg-white/10',
                isSelected
                    ? 'border-blue-500/40 bg-blue-500/5'
                    : 'border-white/10 bg-[#1E293B]/40'
            )}
        >
            {/* Top Row: Checkbox + Order # + Status */}
            <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-3">
                    <input
                        type="checkbox"
                        className="mt-1 rounded border-white/20 bg-white/5"
                        checked={isSelected}
                        onChange={(e) => onToggleSelect(order.id, e.target.checked)}
                    />
                    <div
                        className="cursor-pointer min-w-0"
                        role="button"
                        tabIndex={0}
                        onClick={() => onSelect(order)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(order) } }}
                    >
                        <p className="text-sm font-semibold text-white">
                            #{order.orderNumber}
                        </p>
                        <p className="text-xs text-gray-400 truncate mt-0.5">
                            {order.customerName}
                        </p>
                    </div>
                </div>
                <OrderStatusBadge
                    order={order}
                    onStatusChange={onStatusChange}
                    isUpdating={isUpdating}
                />
            </div>

            {/* Bottom Row: Items, Total, Payment, Date */}
            <div
                className="mt-3 flex items-center justify-between cursor-pointer"
                role="button"
                tabIndex={0}
                onClick={() => onSelect(order)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(order) } }}
            >
                <div className="flex items-center gap-3">
                    {/* Total */}
                    <span className="text-sm font-bold text-white">
                        {formatPrice(order.total, order.currency)}
                    </span>
                    {/* Items count */}
                    <span className="text-xs text-gray-500">
                        {order.items.length}{' '}
                        {order.items.length !== 1 ? o.table.itemPlural : o.table.item}
                    </span>
                </div>

                <div className="flex items-center gap-2">
                    {/* Payment method icon */}
                    <span className="inline-flex items-center gap-1 rounded-md bg-white/5 px-2 py-0.5 text-[10px] text-gray-400">
                        <PaymentIcon className="h-3 w-3" />
                        {order.paymentMethod === 'qr_banking' ? 'QR' : order.paymentMethod.toUpperCase()}
                    </span>
                    {/* Date */}
                    <span className="text-[10px] text-gray-500">
                        {new Date(order.createdAt).toLocaleDateString('en-MY', {
                            day: '2-digit',
                            month: 'short',
                        })}
                    </span>
                </div>
            </div>
        </div>
    )
}
