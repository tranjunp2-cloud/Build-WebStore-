'use client'

import { useCallback } from 'react'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/hooks/queries/query-keys'
import { refreshQueries } from '@/hooks/queries/refresh-queries'
import { useQueryScope } from '@/providers/query-provider'
import { getBrowserViewerTimeZone } from '@/lib/viewer-timezone'
import type { Order } from './OrdersTable'

export type OrdersListParams = {
    page: number
    limit: number
    sort: string
    search: string
    status: string
    date: string
    paymentMethod: string
}

type OrdersPage = { docs: Order[]; totalDocs: number }

export function ordersUrl(p: OrdersListParams): string {
    let url = `/api/orders?page=${p.page}&limit=${p.limit}&sort=${encodeURIComponent(p.sort)}`
    if (p.search) url += `&search=${encodeURIComponent(p.search)}`
    if (p.status && p.status !== 'all') url += `&status=${encodeURIComponent(p.status)}`
    if (p.date && p.date !== 'all') url += `&date=${encodeURIComponent(p.date)}`
    if (p.paymentMethod) url += `&paymentMethod=${encodeURIComponent(p.paymentMethod)}`
    return url
}

async function readOrdersPage(params: OrdersListParams, signal: AbortSignal): Promise<OrdersPage> {
    const res = await fetch(ordersUrl(params), {
        headers: { 'X-Viewer-Time-Zone': getBrowserViewerTimeZone() },
        signal,
    })
    if (!res.ok) throw new Error('Failed to fetch')
    const data = await res.json()
    if (!data.success || !data.docs) throw new Error('Failed to fetch')
    return { docs: data.docs, totalDocs: data.totalDocs ?? data.total ?? data.docs.length }
}

/** One page of the orders table: cached per page + filters, the previous rows stay while another page loads. */
export function useOrdersPageQuery(params: OrdersListParams) {
    const scope = useQueryScope()
    return useQuery({
        queryKey: queryKeys.orders.list(scope, params),
        queryFn: ({ signal }) => readOrdersPage(params, signal),
        placeholderData: keepPreviousData,
    })
}

const NO_METRICS = { pending: 0, confirmed: 0, readyToShip: 0, shipped: 0, completed: 0, cancelled: 0, refunded: 0 }
export type OrderMetrics = typeof NO_METRICS

/** The status counts above the table. A failed read keeps the last counts (zeros before the first one). */
export function useOrderMetricsQuery() {
    const scope = useQueryScope()
    const query = useQuery({
        queryKey: queryKeys.orders.metrics(scope),
        queryFn: async ({ signal }): Promise<OrderMetrics> => {
            const res = await fetch('/api/orders/metrics', { signal })
            const json = await res.json()
            if (!json.success || !json.data) throw new Error('Failed to load metrics')
            return { ...NO_METRICS, ...json.data }
        },
    })
    return { counts: query.data ?? NO_METRICS, query }
}

/** Bank transfers waiting for the merchant to check the proof (the chip under the counts). */
export function useAwaitingVerificationCount() {
    const scope = useQueryScope()
    return useQuery({
        // a list query (limit 0): every orders list invalidation moves it too
        queryKey: queryKeys.orders.list(scope, { paymentStatus: 'pending_verification', paymentMethod: 'bank_transfer', limit: 0 }),
        queryFn: async ({ signal }) => {
            const res = await fetch('/api/orders?paymentStatus=pending_verification&paymentMethod=bank_transfer&limit=0', { signal })
            const data = await res.json()
            return (data?.totalDocs ?? 0) as number
        },
    })
}

export function useInvalidateOrderMetrics() {
    const scope = useQueryScope()
    const queryClient = useQueryClient()
    return useCallback(() => queryClient.invalidateQueries({ queryKey: queryKeys.orders.metrics(scope) }), [queryClient, scope])
}

export type OrderLoad<T> = { order: T } | { notFound: true }

/**
 * One order with its relations (`?depth=2`). A 404 on the first read is "not found"; a 404 on a background re-read
 * (replica lag, a session blip) is an error, so the order already on screen stays.
 */
export function useOrderDetailQuery<T>(orderId: string) {
    const scope = useQueryScope()
    const queryClient = useQueryClient()
    const queryKey = queryKeys.orders.detail(scope, orderId)
    return useQuery({
        queryKey,
        queryFn: async ({ signal }): Promise<OrderLoad<T>> => {
            const res = await fetch(`/api/orders/${orderId}?depth=2`, { signal })
            if (res.status === 404) {
                if (queryClient.getQueryData<OrderLoad<T>>(queryKey)) throw new Error('not_found_on_refresh')
                return { notFound: true }
            }
            if (!res.ok) throw new Error('fetch_failed')
            const result = await res.json()
            return { order: (result.data || result) as T }
        },
    })
}

/** An order changed from this screen: its detail, every list page, the counts and the chip are stale. */
export function useInvalidateOrders() {
    const scope = useQueryScope()
    const queryClient = useQueryClient()
    return useCallback(() => refreshQueries(queryClient, queryKeys.orders.all(scope)), [queryClient, scope])
}
