import { X, ExternalLink, ImageIcon } from 'lucide-react'
import { useI18n } from '@/i18n'
import type { Order } from '../types'
import { formatPrice } from '../types'
import { OrderStatusBadge } from './OrderStatusBadge'

export function OrderDrawer({
    order,
    onClose,
    onStatusChange,
    isUpdating
}: {
    order: Order | null
    onClose: () => void
    onStatusChange: (id: string, status: string) => void
    isUpdating?: string | boolean | null
}) {
    const { t } = useI18n()
    const o = t.dashboard.orders

    if (!order) return null

    // Status Timeline rendering
    const timelineSteps = ['pending', 'confirmed', 'shipped', 'completed']
    const timelineLabels: Record<string, string> = {
        pending: o.status.pending,
        confirmed: o.status.confirmed,
        shipped: o.status.shipped,
        completed: o.status.completed,
    }
    const currentIndex = timelineSteps.indexOf(order.status) >= 0 ? timelineSteps.indexOf(order.status) :
        (order.status === 'ready_to_ship' ? 1.5 : -1)

    const isCancelled = order.status === 'cancelled'
    const isRefunded = order.status === 'refunded'

    return (
        <div className="fixed inset-y-0 right-0 z-50 w-full md:w-[480px] border-l border-white/10 bg-[#0F172A] shadow-2xl transition-transform duration-300 transform flex flex-col">
            <div className="flex items-center justify-between border-b border-white/10 p-4 md:p-6">
                <div>
                    <h2 className="text-lg font-bold text-white">Order #{order.orderNumber}</h2>
                    <p className="text-xs text-gray-500">{new Date(order.createdAt).toLocaleString('en-MY')}</p>
                </div>
                <div className="flex items-center gap-3">
                    <OrderStatusBadge order={order} onStatusChange={onStatusChange} isUpdating={isUpdating} />
                    <button onClick={onClose} className="rounded-full p-2 text-gray-400 hover:bg-white/10 hover:text-white transition-colors">
                        <X className="h-5 w-5" />
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-8">
                {/* Timeline */}
                <div>
                    <h3 className="text-sm font-semibold text-white mb-4 uppercase tracking-wider text-gray-400">{o.drawer.timeline}</h3>
                    {isCancelled || isRefunded ? (
                        <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-4">
                            <p className="text-sm font-medium text-red-500 capitalize">
                                {isCancelled ? o.drawer.orderCancelled : o.drawer.orderRefunded}
                            </p>
                            {order.cancelReason && <p className="mt-1 text-sm text-red-400/80">{o.drawer.reason}: {order.cancelReason}</p>}
                        </div>
                    ) : (
                        <div className="relative">
                            <div className="absolute left-3.5 top-2 bottom-2 w-[2px] bg-white/10" />
                            <div className="space-y-6">
                                {timelineSteps.map((step, idx) => {
                                    const isActive = currentIndex >= idx
                                    const isCurrent = (currentIndex === idx) || (order.status === 'ready_to_ship' && step === 'confirmed')
                                    return (
                                        <div key={step} className="relative flex items-center gap-4">
                                            <div className={`relative z-10 flex h-7 w-7 items-center justify-center rounded-full border-2 bg-[#0F172A] ${isActive ? 'border-blue-500' : 'border-white/20'}`}>
                                                {isActive && <div className="h-2.5 w-2.5 rounded-full bg-blue-500" />}
                                            </div>
                                            <div>
                                                <p className={`text-sm font-medium ${isActive ? 'text-white' : 'text-gray-500'}`}>{timelineLabels[step] || step}</p>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* Customer */}
                <div>
                    <h3 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wider">{o.drawer.customer}</h3>
                    <div className="rounded-xl border border-white/5 bg-white/5 p-4 space-y-2 text-sm">
                        <p className="font-medium text-white">{order.customerName}</p>
                        <p className="text-gray-400">{order.customerEmail}</p>
                        <p className="text-gray-400">{order.customerPhone || o.drawer.noPhone}</p>
                        {order.shippingAddress && (
                            <div className="mt-2 pt-2 border-t border-white/5 text-gray-400">
                                <p>{order.shippingAddress.line1}</p>
                                {order.shippingAddress.line2 && <p>{order.shippingAddress.line2}</p>}
                                <p>{order.shippingAddress.postcode} {order.shippingAddress.city}, {order.shippingAddress.state}</p>
                                <p>{order.shippingAddress.country}</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Payment & QR Proof */}
                <div>
                    <h3 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wider">{o.drawer.payment}</h3>
                    <div className="rounded-xl border border-white/5 bg-white/5 p-4 text-sm flex justify-between items-center">
                        <div>
                            <p className="font-medium text-white uppercase">{order.paymentMethod.replace('_', ' ')}</p>
                        </div>
                        {order.paymentMethod === 'qr_banking' && order.paymentProofImage && (
                            <a href={typeof order.paymentProofImage === 'string' ? order.paymentProofImage : order.paymentProofImage.url}
                                target="_blank" rel="noreferrer"
                                className="inline-flex items-center gap-2 rounded-lg bg-blue-500/10 px-3 py-1.5 text-blue-400 hover:bg-blue-500/20 transition-colors">
                                <ImageIcon className="h-4 w-4" />
                                <span className="text-xs font-medium">{o.drawer.viewReceipt}</span>
                                <ExternalLink className="h-3 w-3" />
                            </a>
                        )}
                    </div>
                </div>

                {/* Items */}
                <div>
                    <h3 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wider">{o.drawer.lineItems} ({order.items?.length || 0})</h3>
                    <div className="space-y-3">
                        {order.items?.map((item, i) => (
                            <div key={i} className="flex justify-between items-start rounded-xl border border-white/5 bg-white/5 p-4">
                                <div>
                                    <p className="text-sm font-medium text-white">{item.productName}</p>
                                    {item.variant && <p className="text-xs text-gray-500 mt-1">Variant: {item.variant}</p>}
                                    <p className="text-xs text-gray-500 mt-1">Qty: {item.quantity}</p>
                                </div>
                                <p className="text-sm font-medium text-white">{formatPrice(item.unitPrice * item.quantity, order.currency)}</p>
                            </div>
                        ))}
                    </div>

                    <div className="mt-4 rounded-xl border border-white/5 bg-white/5 p-4 space-y-2 text-sm">
                        <div className="flex justify-between text-gray-400">
                            <span>{o.drawer.subtotal}</span>
                            <span>{formatPrice(order.subtotal, order.currency)}</span>
                        </div>
                        <div className="flex justify-between text-gray-400">
                            <span>{o.drawer.shipping}</span>
                            <span>{formatPrice(order.shippingFee || 0, order.currency)}</span>
                        </div>
                        <div className="flex justify-between text-gray-400">
                            <span>{o.drawer.tax}</span>
                            <span>{formatPrice(order.tax, order.currency)}</span>
                        </div>
                        <div className="flex justify-between pt-2 mt-2 border-t border-white/10 font-bold text-white text-base">
                            <span>{o.drawer.total}</span>
                            <span>{formatPrice(order.total, order.currency)}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
