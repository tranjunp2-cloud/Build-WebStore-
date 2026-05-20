/**
 * CustomersOrdersTab — Payload 3.79 custom Edit view tab component.
 *
 * Payload 3.79 API path chosen: admin.components.views.edit.ordersTab
 * (spec "views.Edit.Tab" shape — correct Payload 3.79 API is views.edit.{key}.Component)
 *
 * This is a Server Component (RSC). Payload 3.79 admin supports RSC for custom views.
 * Fetches orders linked to the current customer via Payload Local API.
 *
 * Registered in: src/collections/Customers.ts
 *   admin.components.views.edit.ordersTab.Component = '@/components/admin/customers-orders-tab'
 */
import React from 'react'
import { getPayload } from 'payload'
import config from '@payload-config'
import type { Where } from 'payload'

// Payload 3.79 passes these props to custom edit view components
interface CustomersOrdersTabProps {
    // Payload injects the current document; id may be string or number depending on DB adapter
    id?: string | number
    searchParams?: Record<string, string | string[] | undefined>
}

const PAGE_SIZE = 25

function formatDate(val: string | Date | null | undefined): string {
    if (!val) return '—'
    const d = new Date(val as string)
    return d.toLocaleDateString('en-MY', { year: 'numeric', month: 'short', day: '2-digit' })
}

const STATUS_COLOURS: Record<string, string> = {
    pending: '#b45309',
    processing: '#1d4ed8',
    shipped: '#0369a1',
    delivered: '#15803d',
    cancelled: '#dc2626',
    refunded: '#7c3aed',
}

const PAYMENT_COLOURS: Record<string, string> = {
    pending: '#b45309',
    paid: '#15803d',
    failed: '#dc2626',
    refunded: '#7c3aed',
    partial: '#0369a1',
}

function Badge({ value, colours }: { value: string; colours: Record<string, string> }) {
    const colour = colours[value] ?? '#6b7280'
    return (
        <span
            style={{
                display: 'inline-block',
                padding: '2px 8px',
                borderRadius: '9999px',
                fontSize: '12px',
                fontWeight: 600,
                color: '#fff',
                background: colour,
                textTransform: 'capitalize',
            }}
        >
            {value}
        </span>
    )
}

export default async function CustomersOrdersTab({ id, searchParams }: CustomersOrdersTabProps) {
    if (!id) {
        return (
            <div style={{ padding: '24px', color: '#6b7280' }}>
                Save the customer record first to view linked orders.
            </div>
        )
    }

    const rawPage = searchParams?.page
    const page = typeof rawPage === 'string' ? Math.max(1, parseInt(rawPage, 10) || 1) : 1

    let orders: Awaited<ReturnType<typeof payload.find<'orders'>>> | null = null
    let fetchError: string | null = null

    try {
        const payload = await getPayload({ config })

        // Fetch the parent customer to read its tenant — used for defence-in-depth scoping
        // (payload.find without req defaults to overrideAccess:true, so add explicit tenant
        // filter to prevent leaking orders if customer.id ever points across tenants)
        const customerResult = await payload.find({
            collection: 'customers',
            where: { id: { equals: id } },
            limit: 1,
            depth: 0,
        })
        const customer = customerResult.docs[0] as { id: string | number; tenant?: string | number | { id: string | number } } | undefined

        const tenantId = customer?.tenant != null
            ? (typeof customer.tenant === 'object' ? customer.tenant.id : customer.tenant)
            : undefined

        const where: Where = tenantId != null
            ? { and: [{ customer: { equals: id } }, { tenant: { equals: tenantId } }] }
            : { customer: { equals: id } }

        orders = await payload.find({
            collection: 'orders',
            where,
            sort: '-createdAt',
            limit: PAGE_SIZE,
            page,
            depth: 0,
        })
    } catch (err) {
        console.error('[CustomersOrdersTab] fetch error', err)
        fetchError = err instanceof Error ? err.message : 'Unknown error fetching orders'
    }

    if (fetchError) {
        return (
            <div style={{ padding: '24px', color: '#dc2626' }}>
                Failed to load orders: {fetchError}
            </div>
        )
    }

    const docs = orders?.docs ?? []
    const totalDocs = orders?.totalDocs ?? 0
    const totalPages = orders?.totalPages ?? 1
    const hasPrev = page > 1
    const hasNext = page < totalPages

    return (
        <div style={{ padding: '24px', fontFamily: 'inherit' }}>
            <h3 style={{ marginTop: 0, marginBottom: '16px', fontSize: '16px', fontWeight: 600 }}>
                Orders ({totalDocs})
            </h3>

            {docs.length === 0 ? (
                <p style={{ color: '#6b7280', fontStyle: 'italic' }}>No orders linked yet.</p>
            ) : (
                <>
                    {/* Table */}
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                            <thead>
                                <tr style={{ background: '#f3f4f6', textAlign: 'left' }}>
                                    {['Order #', 'Status', 'Total', 'Payment', 'Date', ''].map((h) => (
                                        <th
                                            key={h}
                                            style={{
                                                padding: '8px 12px',
                                                fontWeight: 600,
                                                borderBottom: '1px solid #e5e7eb',
                                                whiteSpace: 'nowrap',
                                            }}
                                        >
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {docs.map((order) => {
                                    const o = order as {
                                        id: string | number
                                        orderNumber?: string
                                        status?: string
                                        total?: number
                                        currency?: string
                                        paymentStatus?: string
                                        createdAt?: string
                                    }
                                    return (
                                        <tr key={String(o.id)} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                            <td style={{ padding: '8px 12px', fontWeight: 500 }}>
                                                {o.orderNumber ?? String(o.id)}
                                            </td>
                                            <td style={{ padding: '8px 12px' }}>
                                                {o.status ? (
                                                    <Badge value={o.status} colours={STATUS_COLOURS} />
                                                ) : '—'}
                                            </td>
                                            <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                                                {o.total != null
                                                    ? `${(o.total).toFixed(2)} ${o.currency ?? 'MYR'}`
                                                    : '—'}
                                            </td>
                                            <td style={{ padding: '8px 12px' }}>
                                                {o.paymentStatus ? (
                                                    <Badge value={o.paymentStatus} colours={PAYMENT_COLOURS} />
                                                ) : '—'}
                                            </td>
                                            <td style={{ padding: '8px 12px', whiteSpace: 'nowrap', color: '#6b7280' }}>
                                                {formatDate(o.createdAt)}
                                            </td>
                                            <td style={{ padding: '8px 12px' }}>
                                                <a
                                                    href={`/admin/collections/orders/${o.id}`}
                                                    style={{ color: '#2563eb', textDecoration: 'none', fontSize: '12px' }}
                                                >
                                                    View →
                                                </a>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div style={{ marginTop: '16px', display: 'flex', gap: '8px', alignItems: 'center', fontSize: '13px' }}>
                            {hasPrev && (
                                <a href={`?page=${page - 1}`} style={{ color: '#2563eb', textDecoration: 'none' }}>
                                    ← Previous
                                </a>
                            )}
                            <span style={{ color: '#6b7280' }}>Page {page} of {totalPages}</span>
                            {hasNext && (
                                <a href={`?page=${page + 1}`} style={{ color: '#2563eb', textDecoration: 'none' }}>
                                    Next →
                                </a>
                            )}
                        </div>
                    )}
                </>
            )}
        </div>
    )
}
