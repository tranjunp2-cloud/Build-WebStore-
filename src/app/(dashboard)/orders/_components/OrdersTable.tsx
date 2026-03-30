import React from 'react'
import { OrderStatusBadge, OrderStatus } from './OrderStatusBadge'

const mockOrders: {
    id: string
    customer: string
    total: string
    status: OrderStatus
}[] = [
        { id: 'P-1001', customer: 'Ali Baba', total: 'RM 120', status: 'Pending' },
        { id: 'P-1002', customer: 'Fatimah Ahmad', total: 'RM 250', status: 'Confirmed' },
        { id: 'P-1003', customer: 'Chen Wei', total: 'RM 180', status: 'Shipped' },
        { id: 'P-1004', customer: 'Rajesh Kumar', total: 'RM 90', status: 'Pending' },
        { id: 'P-1005', customer: 'Sarah Lee', total: 'RM 340', status: 'Refunded' },
        { id: 'P-1006', customer: 'Ahmad Ibrahim', total: 'RM 200', status: 'Cancelled' },
        { id: 'P-1007', customer: 'Lim Mei Ling', total: 'RM 150', status: 'Ready to Ship' },
        { id: 'P-1008', customer: 'David Tan', total: 'RM 280', status: 'Completed' },
        { id: 'P-1009', customer: 'Nurul Huda', total: 'RM 95', status: 'Shipped' },
        { id: 'P-1010', customer: 'Wong Kar Wai', total: 'RM 420', status: 'Pending' },
    ]

export function OrdersTable() {
    return (
        <div className="w-full bg-[rgba(30,41,59,0.6)] border border-[rgba(255,255,255,0.08)] rounded-2xl overflow-hidden mt-6">
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[800px]">
                    <thead className="bg-[rgba(11,17,32,0.5)] h-[56px]">
                        <tr>
                            <th className="px-6 py-4 w-12 text-center text-xs font-semibold tracking-[0.025em] text-[rgba(248,250,252,0.6)] uppercase">
                                <input
                                    type="checkbox"
                                    className="w-4 h-4 rounded border-slate-600 bg-slate-800 focus:ring-blue-500/50 cursor-pointer"
                                />
                            </th>
                            <th className="px-6 py-4 text-xs font-semibold tracking-[0.025em] text-[rgba(248,250,252,0.6)] uppercase">
                                Order #
                            </th>
                            <th className="px-6 py-4 text-xs font-semibold tracking-[0.025em] text-[rgba(248,250,252,0.6)] uppercase">
                                Customer
                            </th>
                            <th className="px-6 py-4 text-xs font-semibold tracking-[0.025em] text-[rgba(248,250,252,0.6)] uppercase">
                                Total
                            </th>
                            <th className="px-6 py-4 text-xs font-semibold tracking-[0.025em] text-[rgba(248,250,252,0.6)] uppercase">
                                Status
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {mockOrders.map((order, index) => (
                            <tr
                                key={order.id}
                                className="h-[62px] border-b border-[rgba(255,255,255,0.05)] hover:bg-slate-800/40 transition-colors last:border-b-0"
                            >
                                <td className="px-6 align-middle text-center">
                                    <input
                                        type="checkbox"
                                        className="w-4 h-4 rounded border-slate-600 bg-slate-800 focus:ring-blue-500/50 cursor-pointer"
                                    />
                                </td>
                                <td className="px-6 align-middle text-sm font-semibold text-[#F8FAFC]">
                                    {order.id}
                                </td>
                                <td className="px-6 align-middle text-sm font-normal text-[#F8FAFC]">
                                    {order.customer}
                                </td>
                                <td className="px-6 align-middle text-sm font-semibold text-[#F8FAFC]">
                                    {order.total}
                                </td>
                                <td className="px-6 align-middle">
                                    <OrderStatusBadge status={order.status} />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
